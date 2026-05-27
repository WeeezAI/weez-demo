// src/components/PausedActionRequiredBanner.tsx
//
// Banner + action controls rendered for Approval_Records flagged
// `requires_owner_action` (typically AutoPilot records belonging to a user
// whose Premium subscription has lapsed).
//
// References:
//   - Requirement 20.4: "the History_Dashboard SHALL render its row with a
//     'Paused — Action Required' badge and SHALL expose Approve, Edit, and
//     Reject controls equivalent to those available for PENDING records."
//   - Requirement 20.5: action handlers transition the record per Req 7/8/9
//     treating the effective starting status as PENDING.

import { useState } from "react";
import { CheckCircle2, Pencil, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApprovalRecord } from "@/services/approvalAPI";

export type PausedAction = "APPROVE" | "EDIT" | "REJECT";

interface PausedActionRequiredBannerProps {
  record: ApprovalRecord;
  /** Invoked when the user clicks one of the three controls. */
  onAction: (record: ApprovalRecord, action: PausedAction) => void | Promise<void>;
  /**
   * When true, all three buttons render in the loading state and are disabled.
   * Useful for the row currently mid-flight.
   */
  busy?: boolean;
  className?: string;
}

/**
 * Inline banner + Approve / Edit / Reject controls for a single paused record.
 *
 * The component is intentionally compact so it fits inside a table cell, but
 * also renders cleanly as a stand-alone block in detail views.
 */
export function PausedActionRequiredBanner({
  record,
  onAction,
  busy = false,
  className,
}: PausedActionRequiredBannerProps) {
  const [pending, setPending] = useState<PausedAction | null>(null);

  const handleClick = async (action: PausedAction) => {
    if (busy || pending) return;
    setPending(action);
    try {
      await onAction(record, action);
    } finally {
      setPending(null);
    }
  };

  const disabled = busy || pending !== null;

  return (
    <div
      role="region"
      aria-label="Paused — Action Required"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-orange-300/70 bg-orange-50 px-3 py-2",
        "dark:border-orange-500/40 dark:bg-orange-500/10",
        className,
      )}
    >
      <AlertTriangle
        className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-300"
        aria-hidden="true"
      />
      <span className="text-xs font-semibold uppercase tracking-wide text-orange-900 dark:text-orange-200">
        Paused — Action Required
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          disabled={disabled}
          onClick={() => handleClick("APPROVE")}
          aria-label={`Approve day ${record.day_number}`}
          className="h-7 gap-1 bg-emerald-600 px-2 text-xs hover:bg-emerald-700"
        >
          {pending === "APPROVE" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Approve
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => handleClick("EDIT")}
          aria-label={`Edit day ${record.day_number}`}
          className="h-7 gap-1 px-2 text-xs"
        >
          {pending === "EDIT" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Pencil className="h-3 w-3" />
          )}
          Edit
        </Button>

        <Button
          size="sm"
          variant="destructive"
          disabled={disabled}
          onClick={() => handleClick("REJECT")}
          aria-label={`Reject day ${record.day_number}`}
          className="h-7 gap-1 px-2 text-xs"
        >
          {pending === "REJECT" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

export default PausedActionRequiredBanner;
