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

/** Singular/plural handled explicitly rather than by a naive `+ "s"`. */
const creditUnit = (n: number) => (n === 1 ? "credit" : "credits");

export const CREDIT_LABELS = {
  balance: "Credits",
  balanceAria: "Credit balance",
  unit: creditUnit,
  prices: "What things cost",
  ledger: "Recent credit activity",
  ledgerEmpty: "No credit activity yet.",
  /**
   * A priced-at-zero action. "Free" rather than "Included" because the operator is
   * reading it beside a control they are about to press, and "Free" answers "what will
   * this cost me" in one word.
   *
   * Message generation is the only action this applies to, and it is free because it is
   * part of the Contact Directly credit. Note the backend does **not** serve this price:
   * `credits.PRICES` carries ENRICH, CONTACT and ACTIVATE only, so `priceFor` returns null
   * for generation and a caller that wants this tag has to pass a literal `0`. That is a
   * product statement, and the one place in the credit UI that is not read off the wire.
   */
  free: "Free",
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
  /**
   * The gap, stated where the control was, *before* a press (R17.5).
   *
   * Both figures are the workspace read's own — the balance from `GET /gtm/credits` and the
   * price from that same payload's list — and the deficit is their difference. Nothing here
   * is invented: a sentence that named a number the server never sent would be this screen
   * guessing at the ledger, which is what the credit feature exists to stop.
   *
   * The deficit is deliberately *not* phrased as "N credits". A price tag already says
   * "N credits" beside the control, and that reads the same whether or not the workspace can
   * afford it — so the one figure that only a shortfall carries has to be legible as itself.
   */
  shortfall: (balance: number, price: number) =>
    `Needs ${price - balance} more — this costs ${price} ${creditUnit(price)} and ` +
    `this workspace holds ${balance}. Top up to continue.`,
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

// ─── Can this workspace afford it ─────────────────────────────────────────────

/** A gap between what the workspace holds and what a control costs. */
export interface CreditShortfall {
  /** The workspace's balance, as the server reported it. */
  balance: number;
  /** The server's price for this action. */
  price: number;
  /** How many more credits are needed. Always at least 1. */
  short: number;
  /** The sentence a rep reads in place of the control. */
  statement: string;
}

/**
 * The gap that keeps a priced control non-executing, or `null` when there is none.
 *
 * Design §11's rule, stated once so that every priced control asks the same question:
 *
 *     blocked  ⇔  balance is known ∧ price is known ∧ balance < price
 *
 * Both `null`s block nothing, and that is the whole point of putting this beside `priceOf`
 * rather than writing `balance < price` at a call site. An **unread balance** is "we have not
 * asked", not "you cannot afford it" — refusing on that basis would stop a rep who has the
 * credits, which is a worse failure than the one this guards. An **unread price** is nothing
 * to compare against, so it is not a shortfall either; `priceOf` already returns `null` for a
 * price list that has not landed and for an action the server did not price.
 *
 * A control that can be afforded gets `null` too, which is why callers can render the
 * statement unconditionally when this is non-null: the presence of a gap and the sentence
 * describing it are one answer, so a control cannot be blocked without saying why.
 */
export function shortfallOf(
  balance: number | null,
  price: number | null
): CreditShortfall | null {
  if (balance === null || price === null) return null;
  if (balance >= price) return null;
  return {
    balance,
    price,
    short: price - balance,
    statement: CREDIT_LABELS.shortfall(balance, price),
  };
}
