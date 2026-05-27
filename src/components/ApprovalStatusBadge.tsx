// src/components/ApprovalStatusBadge.tsx
//
// Pure status badge for the History_Dashboard table.
//
// References:
//   - Requirements 12.2 (badge label mapping)
//   - Requirements 20.4 ("Paused — Action Required" overrides the regular badge
//     when the row is flagged requires_owner_action)
//   - Design Property 12 (canonical label mapping)
//
// The label mapping is the single source of truth: PENDING→"Pending",
// APPROVED→"Approved", REJECTED→"Rejected", EDITED_APPROVED→"Edited+Approved",
// POSTED→"Posted", AUTO_APPROVED→"Auto Approved".

import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/services/approvalAPI";

/**
 * Canonical label mapping per Req 12.2.
 *
 * Exported so unit / property tests can assert directly against the mapping
 * without having to render the component.
 */
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EDITED_APPROVED: "Edited+Approved",
  POSTED: "Posted",
  AUTO_APPROVED: "Auto Approved",
};

/** Label used when the row is flagged `requires_owner_action` (Req 20.4). */
export const PAUSED_ACTION_REQUIRED_LABEL = "Paused — Action Required";

/**
 * Returns the human-readable badge label for a record.
 *
 * When `requiresOwnerAction` is true (Req 20.4) the paused label takes
 * precedence over the underlying approval_status mapping, because the row's
 * publishing has been suspended pending owner action.
 */
export function approvalStatusLabel(
  status: ApprovalStatus,
  requiresOwnerAction = false,
): string {
  if (requiresOwnerAction) return PAUSED_ACTION_REQUIRED_LABEL;
  return APPROVAL_STATUS_LABELS[status];
}

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  /** When true, renders the "Paused — Action Required" variant (Req 20.4). */
  requiresOwnerAction?: boolean;
  /**
   * Optional server-supplied label override (Req 12.2, ApprovalRecord.status_label).
   * Falls back to the client-side mapping when not provided.
   */
  serverLabel?: string | null;
  className?: string;
}

/**
 * Color tokens chosen to read clearly in light + dark modes without pulling in
 * additional design tokens. Each variant uses a tailwind utility ramp.
 */
const STATUS_VARIANTS: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30",
  APPROVED: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30",
  REJECTED: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30",
  EDITED_APPROVED: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30",
  POSTED: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/30",
  AUTO_APPROVED: "bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-500/30",
};

const PAUSED_VARIANT =
  "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-500/40";

/**
 * `ApprovalStatusBadge` — renders a colored pill with the canonical label for
 * an Approval_Record. Pure presentational component; no side effects, safe to
 * unit-test in isolation (Property 12).
 */
export function ApprovalStatusBadge({
  status,
  requiresOwnerAction = false,
  serverLabel,
  className,
}: ApprovalStatusBadgeProps) {
  // Prefer the server-rendered label when present (Req 12.2 says the server
  // computes status_label); otherwise compute from the canonical mapping.
  // The paused override (Req 20.4) always takes precedence.
  const label = requiresOwnerAction
    ? PAUSED_ACTION_REQUIRED_LABEL
    : serverLabel && serverLabel.length > 0
      ? serverLabel
      : APPROVAL_STATUS_LABELS[status];

  const variant = requiresOwnerAction ? PAUSED_VARIANT : STATUS_VARIANTS[status];

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variant,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default ApprovalStatusBadge;
