// src/pages/ContentEditor.tsx
//
// Editor_Screen for an Approval_Record.
//
// Loads the current editable fields via approvalAPI.getEdit, lets the campaign
// owner edit subject / content_body / poster_url / scheduled_publish_time, and
// submits via approvalAPI.submitEdit either as a save (confirm=false) or
// save-and-approve (confirm=true) per Req 8.2-8.3.
//
// Client-side validation matches the server constraints (Req 8.5-8.8):
//   - subject:                1..200 chars
//   - content_body:           1..8000 chars
//   - poster_url:             non-empty, http(s):// URL
//   - scheduled_publish_time: strictly in the future
//
// scheduled_publish_time is rendered with a `datetime-local` input in the
// user's local time zone (Req 18.3) and converted to UTC ISO-8601 ms before
// submission (Req 18.4). The user's IANA zone and zone abbreviation are
// displayed alongside the input.
//
// On HTTP 422 (VALIDATION_FAILED), per-field errors are surfaced inline and
// the form values are preserved (Req 21.5). Other token / record / service
// error codes render the canonical Editor_Screen states from design.md
// "Approval_Screen / Editor_Screen states".

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  approvalAPI,
  ApprovalAPIError,
  ApprovalRecord,
  ApprovalStatus,
  EditPayload,
} from "@/services/approvalAPI";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECT_MIN = 1;
const SUBJECT_MAX = 200;
const BODY_MIN = 1;
const BODY_MAX = 8000;

/**
 * The set of approval statuses for which editing is allowed (Req 8.4, 8.10).
 * Records flagged `requires_owner_action` are also editable per Req 20.5.
 */
const EDITABLE_STATUSES: ReadonlySet<ApprovalStatus> = new Set<ApprovalStatus>([
  "PENDING",
]);

// ---------------------------------------------------------------------------
// Time-zone helpers
// ---------------------------------------------------------------------------

/**
 * Returns the IANA zone name for the current browser session,
 * e.g. "America/Los_Angeles".
 */
function resolvedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Returns the short zone abbreviation for `date` in the user's locale,
 * e.g. "PST", "GMT+5:30". Falls back to the IANA zone on platforms whose
 * `timeZoneName: "short"` formatter is not available.
 */
function shortZoneAbbr(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
      hour: "numeric",
    }).formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tz) return tz;
  } catch {
    /* ignore */
  }
  return resolvedTimeZone();
}

/**
 * Convert a UTC ISO-8601 string to the value format expected by
 * `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm") in the user's local
 * time zone. Returns "" for missing or invalid input.
 */
function isoUtcToLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Convert a `<input type="datetime-local">` value (user-local wall clock)
 * to a UTC ISO-8601 string with millisecond precision and a trailing "Z"
 * (Req 18.2, 18.4). Returns null when the input cannot be parsed.
 */
function localDatetimeInputToIsoUtc(value: string): string | null {
  if (!value) return null;
  // `new Date("YYYY-MM-DDTHH:mm")` interprets the value as local time,
  // exactly what the spec requires (Req 18.4).
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // Always UTC + ".sssZ"
}

/**
 * Format a UTC ISO timestamp in the user's local time zone, with the
 * zone abbreviation appended (Req 18.3).
 */
function formatInUserZone(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "";
  const formatted = d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatted} ${shortZoneAbbr(d)}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface FormValues {
  subject: string;
  content_body: string;
  poster_url: string;
  /** Local datetime-local input ("YYYY-MM-DDTHH:mm"). */
  scheduled_publish_time_local: string;
}

type FieldName = keyof FormValues;

type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_LABELS: Record<FieldName, string> = {
  subject: "Subject",
  content_body: "Content body",
  poster_url: "Poster URL",
  scheduled_publish_time_local: "Scheduled publish time",
};

/**
 * Map the API field name returned in a 422 envelope to our local form
 * field name. The server uses `scheduled_publish_time`; we surface it on
 * the local datetime input.
 */
function apiFieldToFormField(name: string): FieldName | null {
  switch (name) {
    case "subject":
      return "subject";
    case "content_body":
      return "content_body";
    case "poster_url":
      return "poster_url";
    case "scheduled_publish_time":
      return "scheduled_publish_time_local";
    default:
      return null;
  }
}

/**
 * Best-effort URL validity check. We only require that the value parses as
 * an absolute http(s) URL on the client; final MIME validation happens on
 * the server (Req 8.7).
 */
function isLikelyValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(values: FormValues, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {};

  const subjectLen = values.subject.length;
  if (subjectLen < SUBJECT_MIN) {
    errors.subject = "Subject is required.";
  } else if (subjectLen > SUBJECT_MAX) {
    errors.subject = `Subject must be at most ${SUBJECT_MAX} characters (currently ${subjectLen}).`;
  }

  const bodyLen = values.content_body.length;
  if (bodyLen < BODY_MIN) {
    errors.content_body = "Content body is required.";
  } else if (bodyLen > BODY_MAX) {
    errors.content_body = `Content body must be at most ${BODY_MAX} characters (currently ${bodyLen}).`;
  }

  const url = values.poster_url.trim();
  if (!url) {
    errors.poster_url = "Poster URL is required.";
  } else if (!isLikelyValidUrl(url)) {
    errors.poster_url = "Enter a valid http(s) URL.";
  }

  if (!values.scheduled_publish_time_local) {
    errors.scheduled_publish_time_local = "Scheduled publish time is required.";
  } else {
    const iso = localDatetimeInputToIsoUtc(values.scheduled_publish_time_local);
    if (!iso) {
      errors.scheduled_publish_time_local = "Enter a valid date and time.";
    } else if (new Date(iso).getTime() <= now.getTime()) {
      errors.scheduled_publish_time_local =
        "Scheduled publish time must be in the future.";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Token / load error states (design.md "Editor_Screen states")
// ---------------------------------------------------------------------------

interface LoadErrorState {
  title: string;
  message: string;
  /** Show a Retry control (Req 21.6). */
  showRetry: boolean;
}

function loadErrorFromApi(err: unknown): LoadErrorState {
  if (err instanceof ApprovalAPIError) {
    switch (err.code) {
      case "TOKEN_MALFORMED":
        return {
          title: "Invalid Link",
          message:
            "This link is malformed. Please use the most recent approval email or open the dashboard.",
          showRetry: false,
        };
      case "TOKEN_EXPIRED": {
        const expiresAt = (err.details?.expires_at_utc as string | undefined) ?? null;
        const human = expiresAt ? formatInUserZone(expiresAt) : "earlier";
        return {
          title: "Link Expired",
          message: `This approval link expired on ${human}. Open the dashboard to take action.`,
          showRetry: false,
        };
      }
      case "TOKEN_CONSUMED":
        return {
          title: "Already Used",
          message: "This approval link has already been used.",
          showRetry: false,
        };
      case "RECORD_TERMINAL":
        return {
          title: "Already Decided",
          message:
            "This content is no longer pending review. Open the dashboard for the latest status.",
          showRetry: false,
        };
      case "SERVICE_UNAVAILABLE":
        return {
          title: "Temporary Issue",
          message:
            "We could not reach the approval service. Please try again in a moment.",
          showRetry: true,
        };
      default:
        if (err.status >= 500) {
          return {
            title: "Temporary Issue",
            message:
              "We could not reach the approval service. Please try again in a moment.",
            showRetry: true,
          };
        }
        return {
          title: "Cannot Open Editor",
          message: err.message || "The editor could not be loaded.",
          showRetry: false,
        };
    }
  }

  return {
    title: "Temporary Issue",
    message:
      "We could not reach the approval service. Please try again in a moment.",
    showRetry: true,
  };
}

/**
 * Parse a 422 error envelope into per-field client errors. The server may
 * surface field errors under a number of conventional shapes; we accept
 * any of them defensively.
 */
function parseFieldErrors(err: ApprovalAPIError): FieldErrors {
  const out: FieldErrors = {};
  const details = (err.details ?? {}) as Record<string, unknown>;

  // Shape A: { field_errors: { field: message } }
  // Shape B: { fields:        { field: message } }
  for (const key of ["field_errors", "fields", "errors"]) {
    const obj = details[key];
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [name, msg] of Object.entries(obj as Record<string, unknown>)) {
        const f = apiFieldToFormField(name);
        if (f && typeof msg === "string") out[f] = msg;
      }
    }
  }

  // Shape C: FastAPI-style array under `details.detail` or top-level `raw.detail`.
  const fastApiErrors =
    (Array.isArray(details.detail) ? (details.detail as unknown[]) : null) ??
    (err.raw &&
    typeof err.raw === "object" &&
    Array.isArray((err.raw as { detail?: unknown }).detail)
      ? ((err.raw as { detail: unknown[] }).detail as unknown[])
      : null);
  if (fastApiErrors) {
    for (const item of fastApiErrors) {
      if (!item || typeof item !== "object") continue;
      const loc = (item as { loc?: unknown }).loc;
      const msg = (item as { msg?: unknown }).msg;
      if (Array.isArray(loc) && typeof msg === "string") {
        // loc usually starts with "body" then field name.
        const fieldName = [...loc].reverse().find((p) => typeof p === "string") as
          | string
          | undefined;
        if (fieldName) {
          const f = apiFieldToFormField(fieldName);
          if (f) out[f] = msg;
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EDITED_APPROVED: "Edited + Approved",
  AUTO_APPROVED: "Auto Approved",
  POSTED: "Posted",
};

function statusLabel(record: ApprovalRecord | null): string {
  if (!record) return "";
  return record.status_label || STATUS_LABELS[record.approval_status] || record.approval_status;
}

interface FieldShellProps {
  name: FieldName;
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}

const FieldShell = ({ name, label, helper, error, children }: FieldShellProps) => (
  <div className="space-y-2">
    <Label
      htmlFor={name}
      className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground"
    >
      {label}
    </Label>
    {children}
    {(error || helper) && (
      <p
        id={`${name}-help`}
        className={cn(
          "text-xs leading-snug",
          error ? "text-red-600" : "text-muted-foreground/70"
        )}
        role={error ? "alert" : undefined}
      >
        {error || helper}
      </p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ContentEditor = () => {
  // Route: /campaign/:campaignId/edit/:contentId?token=...
  const { campaignId, contentId } = useParams<{
    campaignId: string;
    contentId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [record, setRecord] = useState<ApprovalRecord | null>(null);

  const [values, setValues] = useState<FormValues>({
    subject: "",
    content_body: "",
    poster_url: "",
    scheduled_publish_time_local: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"save" | "approve" | null>(null);
  const [submittedOk, setSubmittedOk] = useState<ApprovalRecord | null>(null);

  const userZone = useMemo(() => resolvedTimeZone(), []);
  const userZoneAbbr = useMemo(() => shortZoneAbbr(new Date()), []);

  // ---- Load editable fields ------------------------------------------------

  const load = useCallback(async () => {
    if (!campaignId || !contentId) {
      setLoadError({
        title: "Invalid Link",
        message:
          "This link is malformed. Please use the most recent approval email or open the dashboard.",
        showRetry: false,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await approvalAPI.getEdit(campaignId, contentId, token);
      setRecord(r);
      setValues({
        subject: r.subject ?? "",
        content_body: r.content_body ?? "",
        poster_url: r.poster_url ?? "",
        scheduled_publish_time_local: isoUtcToLocalDatetimeInput(
          r.scheduled_publish_time
        ),
      });
    } catch (err) {
      setLoadError(loadErrorFromApi(err));
    } finally {
      setLoading(false);
    }
  }, [campaignId, contentId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Field handlers ------------------------------------------------------

  const setField = (name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear the per-field error as the user edits (preserve other errors).
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSubmitError(null);
  };

  // ---- Submit --------------------------------------------------------------

  const handleSubmit = async (confirm: boolean) => {
    if (!record || !campaignId || !contentId) return;

    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors); // Form values are preserved (Req 21.5).
      setSubmitError(null);
      return;
    }

    const isoUtc = localDatetimeInputToIsoUtc(values.scheduled_publish_time_local);
    if (!isoUtc) {
      setFieldErrors({
        scheduled_publish_time_local: "Enter a valid date and time.",
      });
      return;
    }

    const payload: EditPayload = {
      subject: values.subject,
      content_body: values.content_body,
      poster_url: values.poster_url.trim(),
      scheduled_publish_time: isoUtc, // UTC ISO-8601 ms (Req 18.4).
      confirm,
    };

    setSubmitting(confirm ? "approve" : "save");
    setSubmitError(null);
    setFieldErrors({});

    try {
      const updated = await approvalAPI.submitEdit(
        campaignId,
        contentId,
        payload,
        token
      );
      setRecord(updated);
      setSubmittedOk(updated);
    } catch (err) {
      if (err instanceof ApprovalAPIError) {
        if (err.status === 422 || err.code === "VALIDATION_FAILED") {
          // Per-field errors, preserve form values (Req 21.5).
          const parsed = parseFieldErrors(err);
          if (Object.keys(parsed).length > 0) {
            setFieldErrors(parsed);
          } else {
            setSubmitError(err.message || "Validation failed.");
          }
        } else if (err.code === "RECORD_TERMINAL" || err.status === 409) {
          // Reload to surface the new status (Req 8.4, 8.10).
          setSubmitError(
            "This content is no longer editable. Refreshing to show the latest status."
          );
          void load();
        } else if (err.status >= 500 || err.code === "SERVICE_UNAVAILABLE") {
          setSubmitError(
            "We could not reach the approval service. Please try again in a moment."
          );
        } else {
          setSubmitError(err.message || "Submission failed.");
        }
      } else {
        setSubmitError(
          "We could not reach the approval service. Please try again in a moment."
        );
      }
    } finally {
      setSubmitting(null);
    }
  };

  // ---- Derived flags -------------------------------------------------------

  const status = record?.approval_status ?? null;
  const editable = !!record && EDITABLE_STATUSES.has(record.approval_status);

  // ---- Render --------------------------------------------------------------

  if (loading) {
    return <FullPage title="Loading editor" icon={<Loader2 className="w-10 h-10 text-primary animate-spin" />} />;
  }

  if (loadError) {
    return (
      <FullPage
        title={loadError.title}
        message={loadError.message}
        icon={<AlertCircle className="w-10 h-10 text-amber-500" />}
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {loadError.showRetry && (
              <Button
                onClick={() => void load()}
                className="h-14 rounded-2xl flex-1 text-xs font-black uppercase tracking-[0.2em]"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate("/spaces")}
              className="h-14 rounded-2xl flex-1 text-xs font-black uppercase tracking-[0.2em]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Open dashboard
            </Button>
          </div>
        }
      />
    );
  }

  if (submittedOk) {
    const approved = submittedOk.approval_status === "EDITED_APPROVED";
    return (
      <FullPage
        title={approved ? "Edits approved" : "Edits saved"}
        message={
          approved
            ? "Your edits were saved and the post is approved for publishing at the scheduled time."
            : "Your edits were saved. The post is still pending approval."
        }
        icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />}
        actions={
          <Button
            onClick={() => navigate("/spaces")}
            className="h-14 rounded-2xl w-full text-xs font-black uppercase tracking-[0.2em]"
          >
            Return to dashboard
          </Button>
        }
      />
    );
  }

  if (!record) return null;

  if (!editable) {
    return (
      <FullPage
        title="Already Decided"
        message={`This content is no longer pending review (current status: ${statusLabel(record)}).`}
        icon={<ShieldCheck className="w-10 h-10 text-primary" />}
        actions={
          <Button
            onClick={() => navigate("/spaces")}
            className="h-14 rounded-2xl w-full text-xs font-black uppercase tracking-[0.2em]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Open dashboard
          </Button>
        }
      />
    );
  }

  const subjectLen = values.subject.length;
  const bodyLen = values.content_body.length;

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-start justify-center p-6 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-[2.5rem] p-10 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 my-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary rounded-full">
              <Edit3 className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                Edit Content
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-foreground leading-tight">
              Refine before approving
            </h1>
            <p className="text-sm text-muted-foreground/80 max-w-lg">
              Make any final adjustments below. Save to keep the post pending,
              or save and approve to schedule publication.
            </p>
          </div>
          <Badge variant="secondary" className="font-mono uppercase tracking-wider">
            {statusLabel(record)}
          </Badge>
        </div>

        {/* Submit-level error */}
        {submitError && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm">{submitError}</p>
          </div>
        )}

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(false);
          }}
        >
          {/* Subject */}
          <FieldShell
            name="subject"
            label={FIELD_LABELS.subject}
            helper={`${subjectLen} / ${SUBJECT_MAX} characters`}
            error={fieldErrors.subject}
          >
            <Input
              id="subject"
              value={values.subject}
              maxLength={SUBJECT_MAX + 50 /* allow over-typing then validate */}
              onChange={(e) => setField("subject", e.target.value)}
              aria-invalid={!!fieldErrors.subject}
              aria-describedby="subject-help"
              className={cn(
                "h-12 rounded-xl",
                fieldErrors.subject && "border-red-500 focus-visible:ring-red-500"
              )}
            />
          </FieldShell>

          {/* Content body */}
          <FieldShell
            name="content_body"
            label={FIELD_LABELS.content_body}
            helper={`${bodyLen} / ${BODY_MAX} characters`}
            error={fieldErrors.content_body}
          >
            <Textarea
              id="content_body"
              value={values.content_body}
              onChange={(e) => setField("content_body", e.target.value)}
              aria-invalid={!!fieldErrors.content_body}
              aria-describedby="content_body-help"
              rows={10}
              className={cn(
                "rounded-xl resize-y",
                fieldErrors.content_body &&
                  "border-red-500 focus-visible:ring-red-500"
              )}
            />
          </FieldShell>

          {/* Poster URL */}
          <FieldShell
            name="poster_url"
            label={FIELD_LABELS.poster_url}
            helper="Direct link to the poster image (PNG, JPEG, or WEBP)."
            error={fieldErrors.poster_url}
          >
            <Input
              id="poster_url"
              type="url"
              inputMode="url"
              value={values.poster_url}
              onChange={(e) => setField("poster_url", e.target.value)}
              aria-invalid={!!fieldErrors.poster_url}
              aria-describedby="poster_url-help"
              placeholder="https://..."
              className={cn(
                "h-12 rounded-xl font-mono text-xs",
                fieldErrors.poster_url &&
                  "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {values.poster_url && isLikelyValidUrl(values.poster_url) && (
              <div className="mt-3 rounded-xl border border-border/60 overflow-hidden bg-secondary/30">
                <img
                  src={values.poster_url}
                  alt="Poster preview"
                  className="max-h-64 w-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
          </FieldShell>

          {/* Scheduled publish time */}
          <FieldShell
            name="scheduled_publish_time_local"
            label={FIELD_LABELS.scheduled_publish_time_local}
            helper={`Times are in your local zone (${userZone}, ${userZoneAbbr}). Submitted as UTC.`}
            error={fieldErrors.scheduled_publish_time_local}
          >
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                id="scheduled_publish_time_local"
                type="datetime-local"
                value={values.scheduled_publish_time_local}
                onChange={(e) =>
                  setField("scheduled_publish_time_local", e.target.value)
                }
                aria-invalid={!!fieldErrors.scheduled_publish_time_local}
                aria-describedby="scheduled_publish_time_local-help"
                className={cn(
                  "h-12 rounded-xl pl-10",
                  fieldErrors.scheduled_publish_time_local &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
            </div>
            {values.scheduled_publish_time_local &&
              !fieldErrors.scheduled_publish_time_local && (
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Will publish at{" "}
                  <span className="font-medium text-foreground">
                    {formatInUserZone(
                      localDatetimeInputToIsoUtc(
                        values.scheduled_publish_time_local
                      )
                    )}
                  </span>
                </p>
              )}
          </FieldShell>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            <Button
              type="submit"
              variant="outline"
              disabled={submitting !== null}
              className="h-14 rounded-2xl flex-1 text-xs font-black uppercase tracking-[0.2em]"
            >
              {submitting === "save" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              type="button"
              disabled={submitting !== null}
              onClick={() => void handleSubmit(true)}
              className="h-14 rounded-2xl flex-1 text-xs font-black uppercase tracking-[0.2em]"
            >
              {submitting === "approve" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Save &amp; Approve
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Full-page status (loading / load error / submitted)
// ---------------------------------------------------------------------------

interface FullPageProps {
  title: string;
  message?: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
}

const FullPage = ({ title, message, icon, actions }: FullPageProps) => (
  <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6 font-sans">
    <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="w-20 h-20 bg-secondary rounded-[1.5rem] flex items-center justify-center">
          {icon}
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-black tracking-tight uppercase text-foreground leading-tight">
            {title}
          </h1>
          {message && (
            <p className="text-sm text-muted-foreground/80 leading-relaxed">
              {message}
            </p>
          )}
        </div>
        {actions && <div className="w-full">{actions}</div>}
      </div>
    </div>
  </div>
);

export default ContentEditor;
