//
// The one failure in this product that is not a fault.
//
// Every other non-`ok` response from the GTM layer means something went wrong: a malformed
// request, a prospect that does not exist, a state the engine refused to move. They all
// call for the same thing on screen — say what the server said, offer Try again.
//
// A `402` is different in a way that matters to the operator. Nothing went wrong and
// retrying will not help: they cannot afford the action, and their next step is to top up.
// Rendering it as a red "something went wrong" box is the one wrong answer, because it
// tells them to retry a thing that will fail identically every time.
//
// It is also the one refusal that is a **no-op**, and saying so is the point. The backend
// charges before it acts, so a refused action provisioned nothing, queued nothing and
// billed nothing. An operator who is not told that will reasonably assume they have been
// left with a half-completed action and a bill for it.
//
// Rendered as a plain (not `destructive`) alert on purpose: destructive styling is this
// screen's vocabulary for "a thing failed", and reusing it here would say the wrong thing
// in the one channel — colour — that reaches a reader before any text does.

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_LABELS } from "./CreditBalance";

export interface InsufficientCreditsAlertProps {
  /**
   * The server's own sentence, which already names the price and the balance — "this
   * action costs 2 credit(s) and this workspace has 1". Rendered rather than replaced: it
   * is the only place the two numbers appear together, and the operator needs both to know
   * how much to top up by.
   */
  detail?: string | null;
  /** What the workspace has left, when the caller knows. */
  balance?: number | null;
  /** Where to go to buy more. Absent renders no control rather than a dead button. */
  onTopUp?: () => void;
  topUpLabel?: string;
  className?: string;
}

export function InsufficientCreditsAlert({
  detail,
  balance = null,
  onTopUp,
  topUpLabel = "Top up credits",
  className,
}: InsufficientCreditsAlertProps) {
  return (
    <Alert className={cn("border-amber-300/70 bg-amber-50/60", className)}>
      <Coins aria-hidden="true" className="h-4 w-4 text-amber-700" />
      {/* h3 because every alert title on these pages is an h3 — the heading outline is
          h1 → h2 per section → h3 per card, and an alert is a card. */}
      <AlertTitle as="h3" className="text-amber-900">
        {CREDIT_LABELS.insufficientTitle}
      </AlertTitle>
      <AlertDescription className="space-y-2 text-amber-900/90">
        <p>{CREDIT_LABELS.insufficientBody}</p>
        {detail ? <p className="text-[13px] text-amber-900/80">{detail}</p> : null}
        {balance !== null ? (
          <p className="text-[13px] tabular-nums text-amber-900/80">
            {balance === 0
              ? CREDIT_LABELS.none
              : `${balance} ${CREDIT_LABELS.unit(balance)} remaining`}
          </p>
        ) : null}
        {onTopUp ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onTopUp}
            className="border-amber-400 bg-white/70 text-amber-900 hover:bg-white"
          >
            {topUpLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
