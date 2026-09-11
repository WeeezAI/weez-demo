//
// The workspace's credit balance, the price list, and where the balance went.
//
// Three actions in this product are priced — Enrich Now 1, Contact Directly 1, Activate
// Intelligence 2 — and message generation is 0. The numbers rendered here are the
// server's, read off `GET /gtm/credits`, never constants in this file. A screen with its
// own copy of the price list is a screen that can advertise a price nothing enforces,
// which is the exact failure the ledger was built to remove.
//
// Three components, because there are three different questions:
//
//   `CreditBalanceBadge`  "how many have I got" — sits in page chrome, one number.
//   `CreditPriceTag`      "what will this cost" — sits on a priced control.
//   `CreditLedgerPanel`   "where did they go"   — the movements, newest first.
//
// Nothing here computes a balance. The balance is the sum of the movements and the server
// is the only thing that sums them; a client that added up a page of history would
// disagree with the server the moment the window did not cover every movement.

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import type {
  CreditBalance as CreditBalancePayload,
  CreditMovement,
  CreditPrice,
  CreditReason,
} from "@/services/gtmAPI";
import { absTime, relTime } from "./labels";

// ─── Labels ───────────────────────────────────────────────────────────────────
// Every string on screen lives here, the convention the rest of `components/gtm`
// follows. The reason labels are the operator's words for the priced actions, not the
// backend's enum values: "ENRICH" is a ledger reason, "Enrich Now" is a button they
// clicked.

export const CREDIT_REASON_LABELS: Record<CreditReason, string> = {
  ENRICH: "Enrich Now",
  CONTACT: "Contact Directly",
  ACTIVATE: "Activate Intelligence",
  INITIAL_GRANT: "Starting allowance",
  PURCHASE: "Credits purchased",
  ADJUSTMENT: "Manual adjustment",
};

export const CREDIT_LABELS = {
  balance: "Credits",
  balanceAria: "Credit balance",
  /** Singular/plural handled explicitly rather than by a naive `+ "s"`. */
  unit: (n: number) => (n === 1 ? "credit" : "credits"),
  prices: "What things cost",
  ledger: "Recent credit activity",
  ledgerEmpty: "No credit activity yet.",
  free: "Included",
  /** The empty balance. Not an error — nobody has granted this workspace anything yet. */
  none: "No credits",
  spent: "spent",
  added: "added",
  refunded: "refunded",
  insufficientTitle: "Not enough credits",
  /**
   * The paywall sentence. Deliberately says what did *not* happen, because the backend
   * charges before it acts: a refused action is a no-op, and an operator who is not told
   * that will assume they have been billed for a half-done thing.
   */
  insufficientBody:
    "This action was not performed and nothing was charged. Top up to continue.",
  repeat: "Already paid for",
  repeatNote: "You were charged for this once. This click cost nothing.",
} as const;

const ENTRY_VERB: Record<CreditMovement["entryKind"], string> = {
  DEBIT: CREDIT_LABELS.spent,
  GRANT: CREDIT_LABELS.added,
  REFUND: CREDIT_LABELS.refunded,
};

// ─── The badge ────────────────────────────────────────────────────────────────

export interface CreditBalanceBadgeProps {
  /** `null` while the balance has not been read yet — which is not the same as zero. */
  balance: number | null;
  className?: string;
}

/**
 * The balance, as one number in page chrome.
 *
 * `null` renders nothing at all rather than a zero or a dash. "We have not asked the
 * server yet" and "the workspace has none" are different states, and a zero shown for the
 * first would tell an operator with credits that they had none.
 *
 * The number is not colour-coded by how low it is. A colour would be this component
 * deciding what counts as low, which depends on what the operator is about to do — and
 * the control they are about to press already carries its own price.
 */
export function CreditBalanceBadge({ balance, className }: CreditBalanceBadgeProps) {
  if (balance === null) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/40",
        "bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground",
        className
      )}
    >
      <Coins aria-hidden="true" className="h-3 w-3 text-slate-500" />
      <span className="sr-only">{CREDIT_LABELS.balanceAria}: </span>
      <span className="tabular-nums">{balance}</span>
      <span className="text-slate-500">{CREDIT_LABELS.unit(balance)}</span>
    </span>
  );
}

// ─── The price tag ────────────────────────────────────────────────────────────

export interface CreditPriceTagProps {
  /**
   * What the server says this action costs, or `null` when the price list has not been
   * read. `0` is a real answer and renders as "Included" — message generation is free
   * because it is part of the Contact Directly credit, and saying so is better than
   * saying nothing.
   */
  credits: number | null;
  className?: string;
}

/**
 * What a control is about to cost, rendered beside it.
 *
 * `null` renders nothing: a control whose price we have not read must not claim to be
 * free. That is the one direction this must not guess in — an unpriced-looking button
 * that charges 2 credits is worse than a button with no tag.
 */
export function CreditPriceTag({ credits, className }: CreditPriceTagProps) {
  if (credits === null) return null;

  if (credits === 0) {
    return (
      <Badge
        variant="outline"
        className={cn("border-border/50 text-[10px] font-medium text-slate-500", className)}
      >
        {CREDIT_LABELS.free}
      </Badge>
    );
  }

  // One text node, not a visual/screen-reader pair. "2 credits" beside a control needs no
  // translating for a screen reader, and duplicating it once visibly and once `sr-only`
  // makes the button's accessible name say the price twice.
  return (
    <Badge
      variant="outline"
      className={cn("border-border/50 text-[10px] font-medium text-slate-600", className)}
    >
      {credits} {CREDIT_LABELS.unit(credits)}
    </Badge>
  );
}

// ─── The price list ───────────────────────────────────────────────────────────

export interface CreditPriceListProps {
  prices: CreditPrice[];
  className?: string;
}

/** The server's price list, as a definition list. Rendered, never composed. */
export function CreditPriceList({ prices, className }: CreditPriceListProps) {
  if (prices.length === 0) return null;

  return (
    <dl className={cn("space-y-1", className)}>
      {prices.map((price) => (
        <div key={price.action} className="flex items-baseline justify-between gap-3">
          <dt className="text-[13px] text-foreground">
            {CREDIT_REASON_LABELS[price.action] ?? price.action}
          </dt>
          <dd className="text-[13px] tabular-nums text-slate-600">
            {price.credits} {CREDIT_LABELS.unit(price.credits)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── The ledger ───────────────────────────────────────────────────────────────

export interface CreditLedgerPanelProps {
  credits: CreditBalancePayload | null;
  /** Rendered above the list, e.g. a refresh control. */
  children?: ReactNode;
  className?: string;
}

/**
 * Where the balance went: the movements, newest first.
 *
 * A refund is rendered as its own row beside the debit it reverses rather than the two
 * being netted away. An operator who watched their balance dip and recover is entitled to
 * see why, and a netted pair is indistinguishable from a charge that never happened.
 *
 * `balanceAfter` is printed per row because it is what makes the list auditable: a reader
 * can follow the balance down the page instead of adding up deltas in their head.
 */
export function CreditLedgerPanel({
  credits,
  children,
  className,
}: CreditLedgerPanelProps) {
  return (
    <section className={cn("space-y-3", className)} aria-labelledby="credit-ledger-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="credit-ledger-heading"
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
        >
          {CREDIT_LABELS.ledger}
        </h2>
        {children}
      </div>

      {credits === null || credits.history.length === 0 ? (
        <p className="text-[13px] text-slate-500">{CREDIT_LABELS.ledgerEmpty}</p>
      ) : (
        <ol className="space-y-2">
          {credits.history.map((movement) => (
            <li
              key={movement.entryId}
              className="flex items-baseline justify-between gap-3 border-b border-border/20 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-foreground">
                  {CREDIT_REASON_LABELS[movement.reason] ?? movement.reason}
                </p>
                <p className="text-[11px] text-slate-500">
                  {ENTRY_VERB[movement.entryKind]}
                  {movement.createdAt ? (
                    <>
                      {" · "}
                      <time dateTime={movement.createdAt} title={absTime(movement.createdAt)}>
                        {relTime(movement.createdAt)}
                      </time>
                    </>
                  ) : null}
                  {movement.note ? ` · ${movement.note}` : null}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-medium tabular-nums text-foreground">
                  {/* The sign is the server's. Rendered explicitly so a grant and a
                      debit are distinguishable without relying on colour. */}
                  {movement.delta > 0 ? `+${movement.delta}` : String(movement.delta)}
                </p>
                <p className="text-[11px] tabular-nums text-slate-500">
                  {movement.balanceAfter} left
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─── Reading a price out of the server's list ─────────────────────────────────

/**
 * What `reason` costs according to `credits`, or `null` when we cannot say.
 *
 * `null` for an unread balance and `null` for a reason the server did not price. Both are
 * "we do not know", and a `CreditPriceTag` given `null` renders nothing — which is the
 * right outcome, because the alternative is a control that looks free and is not.
 */
export function priceOf(
  credits: CreditBalancePayload | null,
  reason: CreditReason
): number | null {
  if (!credits) return null;
  const found = credits.prices.find((price) => price.action === reason);
  return found ? found.credits : null;
}
