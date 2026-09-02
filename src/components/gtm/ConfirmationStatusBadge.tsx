// components/gtm/ConfirmationStatusBadge.tsx
//
// The confirmation status of the last requested action, beside the control that
// requested it (R12.4, R5.4, R5.5, R13.5, R13.6).
//
// Colour is never the only carrier of meaning (R18.9): every status pairs a tone
// from the shared `TONE` table with a text label and a distinct `lucide` icon, and
// the icon is `aria-hidden` because the text already says it. There is no bare
// amber dot on this screen.
//
// The four statuses say four different things, and the wording matters:
//
//   NOT_APPLICABLE            nothing has been requested yet
//   WAITING_FOR_CONFIRMATION  requested, budget remains, nothing observed (R13.5)
//   CONFIRMED                 observed in LinkedIn, or the operator confirmed it
//   UNKNOWN                   the budget ran out with nothing observed (R13.6)
//
// `UNKNOWN` renders neutrally, with a question icon, as "Couldn't confirm — check
// LinkedIn". It is a statement about the limits of what Weez could see, not a
// failure of the operator's action, so it must never render in the red that would
// tell them their message bounced.

import { CheckCircle2, Clock, HelpCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfirmationStatus } from "@/services/gtmAPI";
import { CONFIRMATION_LABEL, CONFIRMATION_TONE, TONE } from "./labels";

/** One icon per status, so the four are distinguishable without colour. */
const CONFIRMATION_ICON: Record<ConfirmationStatus, typeof Clock> = {
  NOT_APPLICABLE: MinusCircle,
  WAITING_FOR_CONFIRMATION: Clock,
  CONFIRMED: CheckCircle2,
  UNKNOWN: HelpCircle,
};

export interface ConfirmationStatusBadgeProps {
  status: ConfirmationStatus;
  className?: string;
}

export function ConfirmationStatusBadge({ status, className }: ConfirmationStatusBadgeProps) {
  const Icon = CONFIRMATION_ICON[status] ?? HelpCircle;
  const label = CONFIRMATION_LABEL[status] ?? CONFIRMATION_LABEL.UNKNOWN;
  const tone = TONE[CONFIRMATION_TONE[status] ?? "zinc"] ?? TONE.zinc;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Confirmation status: </span>
      {label}
    </span>
  );
}

export default ConfirmationStatusBadge;
