// src/pages/ContentHistory.tsx
//
// History_Dashboard surface (Req 12). Lists Approval_Records for a campaign
// in a table with the columns mandated by Req 12.1, applies the Req 12.2
// status badge mapping, and renders all timestamps in the user's configured
// time zone with the time-zone abbreviation (Req 18.3).
//
// References:
//   - Requirement 12.1: column set
//   - Requirement 12.2: status badge labels
//   - Requirement 12.3: Mode column = mode_used
//   - Requirement 12.4: Generated/Scheduled/Posted columns rendered in user TZ
//   - Requirement 12.5: empty Posted Time when posted_at is null
//   - Requirement 12.7: empty-state copy when no records
//   - Requirement 12.8: error + Retry, no partial table
//   - Requirement 18.3: render in user TZ + display TZ abbreviation
//   - Requirement 20.4: "Paused — Action Required" badge + Approve/Edit/Reject
//     controls for requires_owner_action rows

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, RefreshCw, Inbox, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  approvalAPI,
  ApprovalAPIError,
  type ApprovalRecord,
  type IsoUtcMillis,
} from "@/services/approvalAPI";

import {
  ApprovalStatusBadge,
  PAUSED_ACTION_REQUIRED_LABEL,
} from "@/components/ApprovalStatusBadge";
import {
  PausedActionRequiredBanner,
  type PausedAction,
} from "@/components/PausedActionRequiredBanner";

// ---------------------------------------------------------------------------
// Time-zone helpers (Req 18.3)
// ---------------------------------------------------------------------------

/**
 * Resolve the browser's IANA time zone, e.g. "America/Los_Angeles".
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` is well-supported in
 * every browser the rest of the app already targets (see weezAPI.ts) and is
 * the same source the backend uses to interpret user-local input.
 */
function userTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Format an ISO-8601 UTC millisecond timestamp in the user's time zone with
 * the trailing zone abbreviation, e.g. "2025-01-15 08:30 PST".
 *
 * Returns the empty string when the input is null/undefined so the caller can
 * unconditionally render the cell (Req 12.5: empty Posted Time when
 * `posted_at IS NULL`).
 */
function formatInUserTimeZone(value: IsoUtcMillis | null | undefined): string {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const tz = userTimeZone();

  // "yyyy-MM-dd HH:mm" portion
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  // Zone abbreviation (e.g. "PST", "GMT+5:30") via the "short" format token.
  let abbrev = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(d);
    abbrev = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    abbrev = "";
  }

  return abbrev ? `${datePart} ${timePart} ${abbrev}` : `${datePart} ${timePart}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: ApprovalRecord[] }
  | { kind: "error"; message: string };

interface ContentHistoryProps {
  /**
   * Optional campaign id override. When omitted the component reads
   * `:campaignId` from the route params.
   */
  campaignId?: string;
}

/**
 * History_Dashboard page. Reads `:campaignId` from the route, fetches the
 * approval ledger, and renders the canonical Req 12.1 table.
 *
 * Failure mode (Req 12.8): when the fetch fails, the table is *not* rendered
 * partially — instead the user sees an error block with a Retry control.
 */
export function ContentHistory({ campaignId: campaignIdProp }: ContentHistoryProps = {}) {
  const params = useParams<{ campaignId?: string }>();
  const campaignId = campaignIdProp ?? params.campaignId ?? "";
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!campaignId) {
      setState({ kind: "error", message: "Missing campaign id." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const records = await approvalAPI.listApprovalRecords(campaignId);
      // Req 12.8: only render the table when the load fully succeeded.
      setState({ kind: "ready", records });
    } catch (err) {
      const message =
        err instanceof ApprovalAPIError
          ? err.message
          : err instanceof Error
            ? err.message
            : "We couldn't load this campaign's history.";
      setState({ kind: "error", message });
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const handlePausedAction = useCallback(
    async (record: ApprovalRecord, action: PausedAction) => {
      setBusyRecordId(record.id);
      try {
        if (action === "APPROVE") {
          await approvalAPI.approve(record.campaign_id, record.id);
          toast.success("Post approved");
          await fetchRecords();
        } else if (action === "REJECT") {
          await approvalAPI.reject(record.campaign_id, record.id);
          toast.success("Post rejected");
          await fetchRecords();
        } else {
          // Edit opens the dedicated editor surface (Req 8). The editor route
          // mirrors the backend path for consistency with email links.
          navigate(`/campaign/${record.campaign_id}/edit/${record.id}`);
        }
      } catch (err) {
        const message =
          err instanceof ApprovalAPIError ? err.message : "Action failed. Please try again.";
        toast.error(message);
      } finally {
        setBusyRecordId(null);
      }
    },
    [fetchRecords, navigate],
  );

  const tzAbbrev = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimeZone(),
        timeZoneName: "short",
      }).formatToParts(new Date());
      return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      return "";
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content history</h1>
          <p className="text-sm text-muted-foreground">
            Generated posts for this campaign{tzAbbrev ? ` — times shown in ${tzAbbrev}` : ""}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchRecords()}
          disabled={state.kind === "loading"}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${state.kind === "loading" ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </header>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {state.kind === "loading" && (
        <div
          role="status"
          aria-busy="true"
          className="flex items-center justify-center rounded-lg border bg-card py-16 text-muted-foreground"
        >
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading content history...
        </div>
      )}

      {/* ── Error + Retry (Req 12.8) ────────────────────────────────── */}
      {state.kind === "error" && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center"
        >
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div>
            <p className="font-semibold">We couldn't load content history.</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button onClick={() => void fetchRecords()} variant="default" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* ── Empty state (Req 12.7) ──────────────────────────────────── */}
      {state.kind === "ready" && state.records.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No content has been generated for this campaign yet
          </p>
        </div>
      )}

      {/* ── Table (Req 12.1) ────────────────────────────────────────── */}
      {state.kind === "ready" && state.records.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Day</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-28">Mode</TableHead>
                <TableHead className="w-44">Approval Status</TableHead>
                <TableHead>Generated Time</TableHead>
                <TableHead>Scheduled Publish</TableHead>
                <TableHead>Posted Time</TableHead>
                <TableHead className="w-72">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.records.map((r) => (
                <TableRow
                  key={r.id}
                  data-record-id={r.id}
                  data-requires-owner-action={r.requires_owner_action ? "true" : "false"}
                >
                  <TableCell className="font-medium">{r.day_number}</TableCell>
                  <TableCell className="max-w-[24rem] truncate" title={r.subject}>
                    {r.subject}
                  </TableCell>
                  <TableCell>
                    {/* Req 12.3: render mode_used directly */}
                    <span className="text-xs font-medium uppercase tracking-wide">
                      {r.mode_used}
                    </span>
                  </TableCell>
                  <TableCell>
                    {/* Req 12.2 + 20.4 */}
                    <ApprovalStatusBadge
                      status={r.approval_status}
                      requiresOwnerAction={r.requires_owner_action}
                      serverLabel={r.status_label}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {/* Req 12.4 + 18.3 */}
                    {formatInUserTimeZone(r.generated_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatInUserTimeZone(r.scheduled_publish_time)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {/* Req 12.5: empty when posted_at IS NULL */}
                    {formatInUserTimeZone(r.posted_at)}
                  </TableCell>
                  <TableCell>
                    {r.requires_owner_action ? (
                      <PausedActionRequiredBanner
                        record={r}
                        busy={busyRecordId === r.id}
                        onAction={handlePausedAction}
                      />
                    ) : (
                      <span
                        className="text-xs text-muted-foreground"
                        aria-label={
                          r.approval_status === "PENDING"
                            ? "Awaiting approval"
                            : "No actions available"
                        }
                      >
                        {r.approval_status === "PENDING" ? "Awaiting approval" : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// Re-export the paused-state label so route-level code can assert against the
// canonical string from one place (kept stable for Property 12).
export { PAUSED_ACTION_REQUIRED_LABEL };

export default ContentHistory;
