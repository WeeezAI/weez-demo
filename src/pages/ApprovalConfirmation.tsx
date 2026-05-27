// src/pages/ApprovalConfirmation.tsx
//
// Approval confirmation screen — destination of the "Approve Post" button
// rendered into approval emails:
//
//   /campaign/{campaign_id}/approve/{content_id}?token={approval_token}
//
// Behavior (Req 7.1, 7.4, 7.5, 7.6, 21.1–21.4, 21.6):
//  - On mount, call approvalAPI.approve(campaignId, contentId, token).
//  - 2xx success         -> success view with day, subject, scheduled time, status,
//                           "Return To Dashboard" button.
//  - 409 RECORD_TERMINAL -> current status with "This post is no longer pending
//                           approval" (Req 7.4) and no Approve/Edit/Reject controls
//                           (Req 21.4).
//  - 401 TOKEN_MALFORMED -> "Invalid Link" (Req 21.1).
//  - 401 TOKEN_EXPIRED   -> "Link Expired" with expires_at_utc (Req 21.2).
//  - 401 TOKEN_CONSUMED  -> "Already Used" + current status (Req 21.3).
//  - 5xx / network       -> "Temporary Issue" + Retry control (Req 21.6).
//
// Timestamps render in the browser's local time zone with the TZ abbreviation
// (Req 18.3).

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  Clock,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approvalAPI,
  ApprovalAPIError,
  type ApprovalRecord,
  type ApprovalStatus,
} from "@/services/approvalAPI";

// ---------------------------------------------------------------------------
// View-state model
// ---------------------------------------------------------------------------

type ViewState =
  | { kind: "loading" }
  | { kind: "success"; record: ApprovalRecord }
  | {
      kind: "no_longer_pending";
      currentStatus: ApprovalStatus | string | null;
      record: ApprovalRecord | null;
    }
  | { kind: "invalid_link" }
  | { kind: "link_expired"; expiresAtUtc: string | null }
  | {
      kind: "already_used";
      currentStatus: ApprovalStatus | string | null;
    }
  | { kind: "temporary_issue"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EDITED_APPROVED: "Edited+Approved",
  AUTO_APPROVED: "Auto Approved",
  POSTED: "Posted",
};

const TERMINAL_STATUSES: ReadonlySet<ApprovalStatus> = new Set<ApprovalStatus>([
  "REJECTED",
  "POSTED",
]);

/** Exported for tests / future surfaces that gate Approve/Edit/Reject controls (Req 21.4). */
export function isTerminalStatus(s: ApprovalStatus | string | null | undefined): boolean {
  return !!s && TERMINAL_STATUSES.has(s as ApprovalStatus);
}

function formatStatusLabel(value: ApprovalStatus | string | null | undefined): string {
  if (!value) return "—";
  return STATUS_LABELS[value as ApprovalStatus] ?? String(value);
}

/** Render an ISO-8601 UTC string in the browser's local TZ with the TZ abbreviation. */
function formatLocalWithTz(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  // Locale-aware date/time + short time zone name (e.g., "PST", "GMT+5:30").
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function detailString(
  details: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!details) return null;
  const v = details[key];
  return typeof v === "string" ? v : null;
}

/**
 * Map an ApprovalAPIError plus the route inputs to a concrete ViewState.
 * Pure so it can be unit tested in isolation.
 */
function viewStateFromError(
  err: ApprovalAPIError,
  hasToken: boolean,
): ViewState {
  // Service-side outage / timeout (Req 21.6).
  if (err.status >= 500) {
    return { kind: "temporary_issue", message: err.message };
  }

  switch (err.code) {
    case "TOKEN_MALFORMED":
      return { kind: "invalid_link" };

    case "TOKEN_EXPIRED":
      return {
        kind: "link_expired",
        expiresAtUtc: detailString(err.details, "expires_at_utc"),
      };

    case "TOKEN_CONSUMED":
      return {
        kind: "already_used",
        currentStatus: detailString(err.details, "current_status"),
      };

    case "RECORD_TERMINAL":
      return {
        kind: "no_longer_pending",
        currentStatus: detailString(err.details, "current_status"),
        record: null,
      };

    case "SERVICE_UNAVAILABLE":
      return { kind: "temporary_issue", message: err.message };

    default:
      // 401 with no token at all -> treat as malformed/missing link (Req 21.1).
      if (err.status === 401 && !hasToken) {
        return { kind: "invalid_link" };
      }
      // Generic 4xx fallback: show the message in the temporary-issue surface
      // so the user has a Retry control. Avoids silently failing.
      return { kind: "temporary_issue", message: err.message };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ApprovalConfirmation = () => {
  const navigate = useNavigate();
  const { campaignId = "", contentId = "" } = useParams<{
    campaignId: string;
    contentId: string;
  }>();
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get("token");
  const token = tokenParam && tokenParam.length > 0 ? tokenParam : undefined;

  const [view, setView] = useState<ViewState>({ kind: "loading" });

  const runApprove = useCallback(async () => {
    if (!campaignId || !contentId) {
      setView({ kind: "invalid_link" });
      return;
    }
    setView({ kind: "loading" });
    try {
      const record = await approvalAPI.approve(campaignId, contentId, token);

      // Per Req 7.4: if the record is not in PENDING (server returned 200 but
      // the status was already APPROVED/REJECTED/POSTED/etc.), surface the
      // "no longer pending" state rather than the success state. Server
      // implementations that prefer 409 RECORD_TERMINAL hit the catch branch.
      if (
        record.approval_status === "APPROVED" ||
        record.approval_status === "EDITED_APPROVED"
      ) {
        // Successful approve transition (PENDING -> APPROVED) — record is now
        // APPROVED. We can't tell from the response alone whether *this*
        // request caused the transition, so trust 200 + APPROVED as success.
        setView({ kind: "success", record });
        return;
      }

      // 200 with non-approved status -> not pending anymore.
      setView({
        kind: "no_longer_pending",
        currentStatus: record.approval_status,
        record,
      });
    } catch (e) {
      if (e instanceof ApprovalAPIError) {
        setView(viewStateFromError(e, Boolean(token)));
        return;
      }
      // Network / TypeError / unknown — treat as temporary issue (Req 21.6).
      const message =
        e instanceof Error ? e.message : "Unable to reach the approval service.";
      setView({ kind: "temporary_issue", message });
    }
  }, [campaignId, contentId, token]);

  useEffect(() => {
    void runApprove();
  }, [runApprove]);

  const goToDashboard = () => navigate("/spaces");

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 relative overflow-hidden">
        {view.kind === "loading" && <LoadingShell />}

        {view.kind === "success" && (
          <SuccessShell record={view.record} onReturn={goToDashboard} />
        )}

        {view.kind === "no_longer_pending" && (
          <NoLongerPendingShell
            currentStatus={view.currentStatus}
            onReturn={goToDashboard}
          />
        )}

        {view.kind === "invalid_link" && (
          <ErrorShell
            tone="warning"
            icon={<Link2Off className="w-10 h-10 text-amber-500" />}
            badge="Invalid Link"
            title="Invalid Link"
            message="This link is malformed. Please use the most recent approval email or open the dashboard."
            onReturn={goToDashboard}
          />
        )}

        {view.kind === "link_expired" && (
          <ErrorShell
            tone="warning"
            icon={<Clock className="w-10 h-10 text-amber-500" />}
            badge="Link Expired"
            title="Link Expired"
            message={
              view.expiresAtUtc
                ? `This approval link expired on ${formatLocalWithTz(
                    view.expiresAtUtc,
                  )}. Open the dashboard to take action.`
                : "This approval link has expired. Open the dashboard to take action."
            }
            onReturn={goToDashboard}
          />
        )}

        {view.kind === "already_used" && (
          <ErrorShell
            tone="muted"
            icon={<CircleSlash className="w-10 h-10 text-muted-foreground" />}
            badge="Already Used"
            title="Already Used"
            message={
              view.currentStatus
                ? `This approval link has already been used. Current status: ${formatStatusLabel(
                    view.currentStatus,
                  )}.`
                : "This approval link has already been used."
            }
            onReturn={goToDashboard}
          />
        )}

        {view.kind === "temporary_issue" && (
          <TemporaryIssueShell
            detail={view.message}
            onRetry={runApprove}
            onReturn={goToDashboard}
          />
        )}
      </div>
    </div>
  );
};

export default ApprovalConfirmation;

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function LoadingShell() {
  return (
    <div className="relative z-10 flex flex-col items-center text-center space-y-6 py-8">
      <Loader2 className="w-10 h-10 animate-spin text-muted-foreground/40" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">
        Confirming approval…
      </p>
    </div>
  );
}

function SuccessShell({
  record,
  onReturn,
}: {
  record: ApprovalRecord;
  onReturn: () => void;
}) {
  return (
    <>
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <ShieldCheck className="w-48 h-48 -rotate-12 text-emerald-500" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        {/* Success icon (Req 7.5) */}
        <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-2">
          <Check className="w-10 h-10 text-emerald-500" />
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
              {formatStatusLabel(record.approval_status)}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
            Post Approved
            <br />
            <span className="text-muted-foreground/30">Successfully.</span>
          </h1>
        </div>

        {/* Record summary */}
        <div className="w-full text-left bg-[#FDFBFF] border border-border/40 rounded-2xl p-5 space-y-3">
          <DetailRow label="Day" value={`Day ${record.day_number}`} />
          <DetailRow label="Subject" value={record.subject} />
          <DetailRow
            label="Scheduled Publish"
            value={formatLocalWithTz(record.scheduled_publish_time)}
          />
          <DetailRow
            label="Status"
            value={formatStatusLabel(record.approval_status)}
          />
        </div>

        {/* Return To Dashboard (Req 7.5, 7.6).
            Approve/Edit/Reject controls are intentionally NOT rendered on this
            confirmation surface — for terminal records this is required by
            Req 21.4, and once a record has just been APPROVED there is no
            further user action to take. */}
        <Button
          onClick={onReturn}
          className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
        >
          Return To Dashboard <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

function NoLongerPendingShell({
  currentStatus,
  onReturn,
}: {
  currentStatus: ApprovalStatus | string | null;
  onReturn: () => void;
}) {
  return (
    <>
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <AlertTriangle className="w-48 h-48 -rotate-12 text-muted-foreground" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className="w-24 h-24 bg-muted rounded-[2rem] flex items-center justify-center mb-2">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-muted/60 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {formatStatusLabel(currentStatus)}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
            No Longer
            <br />
            <span className="text-muted-foreground/30">Pending.</span>
          </h1>
          <p className="text-base font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
            This post is no longer pending approval.
            {currentStatus
              ? ` Current status: ${formatStatusLabel(currentStatus)}.`
              : ""}
          </p>
        </div>

        {/* Per Req 21.4 / 7.4: do NOT render Approve/Edit/Reject controls for
            terminal or non-pending records. */}
        <Button
          onClick={onReturn}
          className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
        >
          Return To Dashboard <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

function ErrorShell({
  tone,
  icon,
  badge,
  title,
  message,
  onReturn,
}: {
  tone: "warning" | "muted";
  icon: React.ReactNode;
  badge: string;
  title: string;
  message: string;
  onReturn: () => void;
}) {
  const badgeBg = tone === "warning" ? "bg-amber-500/5" : "bg-muted/60";
  const badgeDot = tone === "warning" ? "bg-amber-500" : "bg-muted-foreground";
  const badgeText =
    tone === "warning" ? "text-amber-600" : "text-muted-foreground";
  const iconBg = tone === "warning" ? "bg-amber-500/10" : "bg-muted";

  return (
    <>
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <X className="w-48 h-48 -rotate-12 text-muted-foreground" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className={`w-24 h-24 ${iconBg} rounded-[2rem] flex items-center justify-center mb-2`}>
          {icon}
        </div>

        <div className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${badgeBg} rounded-full`}>
            <div className={`w-1.5 h-1.5 rounded-full ${badgeDot}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${badgeText}`}>
              {badge}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
            {title}
          </h1>
          <p className="text-base font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
        </div>

        <Button
          onClick={onReturn}
          className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
        >
          Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

function TemporaryIssueShell({
  detail,
  onRetry,
  onReturn,
}: {
  detail: string;
  onRetry: () => void;
  onReturn: () => void;
}) {
  return (
    <>
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <RefreshCw className="w-48 h-48 -rotate-12 text-muted-foreground" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className="w-24 h-24 bg-muted rounded-[2rem] flex items-center justify-center mb-2">
          <RefreshCw className="w-10 h-10 text-muted-foreground" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-muted/60 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Temporary Issue
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
            Temporary Issue
          </h1>
          <p className="text-base font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
            We could not reach the approval service. Please try again in a moment.
          </p>
          {detail && (
            <p className="text-[10px] font-mono text-muted-foreground/40 break-words max-w-xs mx-auto">
              {detail}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Button
            onClick={onRetry}
            className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
          <Button
            variant="outline"
            onClick={onReturn}
            className="w-full h-16 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em]"
          >
            Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60 min-w-[7rem]">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground text-right break-words">
        {value}
      </span>
    </div>
  );
}
