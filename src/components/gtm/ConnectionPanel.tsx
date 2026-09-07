// components/gtm/ConnectionPanel.tsx
//
// Where the LinkedIn connection stands, and the only honest way to find out (R3.1,
// R3.4, R13.1-R13.2, R14.2).
//
// This block exists because of one fact about LinkedIn: **connection degree is
// account-relative**. The 1st-degree badge and the invitation-pending badge are
// rendered for whoever is signed in, so they do not exist for a logged-off reader —
// not for a public web fetch, not for a data vendor, not for us without a session in
// our own browser. `EVIDENCE_SURFACE_ALLOW_LIST[relationship_state]` names three
// admissible surfaces and only `HUMAN_CONFIRMATION` needs no session of ours. The
// operator sent the invitation themselves and can see the answer; nobody else can.
// So this panel asks them, and their answer is evidence like any other.
//
// **A click is not a connection, and this file is where that line is drawn on
// screen.** Pressing "Send Connection Request" records an intent and opens their
// profile in a new tab. It does not move `relationship_state`, and the backend
// enforces that rather than trusting us: `TARGET_SURFACE_REQUIREMENTS` admits only
// `WEEZ_UI_CLICK` for `ACTION_REQUESTED`, and
// `tests/gtm/test_click_semantics.py::test_p19_connect_click_does_not_produce_connection_pending`
// asserts that the click leaves this dimension and its provenance untouched — down
// to forbidding the string `CONNECTION_PENDING` from appearing in any event detail
// on that path.
//
// **So returning to the tab is a question, never a confirmation.** The prompt reads
// "Did you send the connection request?" and it has a real "no". An operator may have
// closed the tab, opened the wrong profile, been rate-limited by LinkedIn, or changed
// their mind, and none of those are visible to us. Inferring "sent" from a mere
// return would wedge the prospect in a pending state that nothing can ever correct,
// because nothing observed it. The whole flow is one question at a time.
//
// **"Still awaiting" writes nothing, deliberately.** Nothing was observed, the state
// is already pending, and re-stamping it would refresh a staleness clock that should
// keep running. There is no `RelationshipState` for "still waiting" and this panel
// does not invent one — the control acknowledges and closes, and the *age* the
// operator sees is a subtraction over the confirmation's own `observedAt`, not a
// stored field. That is also why there is no reminder table and no reminder worker
// anywhere behind this: the relationship row already holds the truth this view counts
// from.
//
// **What unblocks the rest of the product.** `CONNECTED` is the data precondition
// `conversation_state` → `WARMUP_READY` carries, and `WARMUP_READY` is what makes
// `SEND_LINKEDIN_WARMUP` a reachable action at all. So confirming an acceptance here
// is the moment a tracked prospect becomes actionable, which is worth saying in a
// sentence rather than leaving as a state name.
//
// No heading. The page's outline is closed at eight `<h2>`s and this block's subject
// is named by the `ObservedValue` label inside it, the same way `IdentityPanel`
// handles it.

import { Check, Clock, Loader2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ObservedFact, RelationshipState } from "@/services/gtmAPI";
import { ObservedValue } from "./ObservedValue";
import {
  DIMENSION_LABEL,
  GTM_CONNECTION_LABELS,
  STATE_LABEL,
  STATE_TONE,
  TONE,
} from "./labels";

/** `data-*` hook, so a test can scope to this block by structure. */
export const CONNECTION_SECTION = "connection";

/**
 * How long a pending invitation waits before the panel asks about it.
 *
 * Three days, because an acceptance usually lands inside one and asking sooner is
 * noise. Below this the panel states the age and offers nothing — the operator has
 * nothing new to tell us yet.
 */
export const NUDGE_AFTER_DAYS = 3;

/**
 * How long before the panel says the wait is worth a decision.
 *
 * Three weeks. Not a deadline and not a failure: an unanswered invitation is
 * ordinary, and LinkedIn never expires them visibly. What changes at this point is
 * only that marking it declined becomes the more useful action, because it frees the
 * prospect for another channel instead of leaving them parked.
 *
 * **This is a render threshold, not a schedule.** Nothing pushes a reminder; the
 * question appears when the operator opens the prospect. A cadence would need a
 * scheduler to enforce it, and claiming one we do not have would be the same kind of
 * fabrication this panel exists to avoid.
 */
export const DECIDE_AFTER_DAYS = 21;

/** The states that mean an invitation is out and unanswered. */
export const PENDING: RelationshipState = "CONNECTION_PENDING";

/** The states from which asking to connect is the sensible next step. */
export const CONNECTABLE: readonly string[] = ["UNKNOWN", "NOT_CONNECTED"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days between `observedAt` and `now`, or `null` when there is no instant.
 *
 * `null` rather than `0` for a missing timestamp: zero would claim the invitation
 * went out today, which is a fact nobody recorded. Callers render the age only when
 * this returns a number.
 *
 * Negative skew clamps to 0. A server clock marginally ahead of the browser's should
 * read "today", not "-1 days".
 */
export function daysSince(observedAt: string | null, now: Date = new Date()): number | null {
  if (!observedAt) return null;
  const then = Date.parse(observedAt);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/** The age sentence for a pending invitation. Singular, plural, and today. */
export function pendingLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return GTM_CONNECTION_LABELS.pendingForToday;
  if (days === 1) return GTM_CONNECTION_LABELS.pendingForOneDay;
  return GTM_CONNECTION_LABELS.pendingFor.replace("{days}", `${days} days`);
}

export interface ConnectionPanelProps {
  /**
   * `state.relationshipState` from the payload the page already fetched.
   *
   * Read, never written: the value here is whatever the reconciler last persisted,
   * including after a confirmation it declined. The panel has no opinion of its own
   * about what the state should be.
   */
  relationship: ObservedFact;

  /**
   * True once the operator has pressed send and the profile tab has been opened.
   *
   * Owned by the page because it is ephemeral: it is "we are mid-flow and have not
   * asked yet", not a fact about the prospect, and it must not survive a reload as
   * though it were one.
   */
  awaitingSendAnswer?: boolean;

  /** Record the intent and open their profile. Moves no relationship state. */
  onSendRequest: () => void;
  sending?: boolean;

  /**
   * Assert a state. The panel passes the value; the page calls
   * `gtmAPI.confirmRelationship` and re-reads.
   */
  onConfirm: (state: RelationshipState) => void;
  confirming?: boolean;

  /** Dismiss the "did you send it?" prompt without asserting anything. */
  onDismissPrompt: () => void;

  /**
   * Acknowledge that the invitation is still unanswered. Writes nothing at all —
   * see the module header.
   */
  onStillAwaiting: () => void;

  /** The last thing a control did, or the server's refusal. Announced politely. */
  notice?: string | null;
  className?: string;
}

export function ConnectionPanel({
  relationship,
  awaitingSendAnswer = false,
  onSendRequest,
  sending = false,
  onConfirm,
  confirming = false,
  onDismissPrompt,
  onStillAwaiting,
  notice = null,
  className,
}: ConnectionPanelProps) {
  const value = relationship.value ?? "UNKNOWN";
  const pending = value === PENDING;
  const days = pending ? daysSince(relationship.observedAt) : null;

  // The status check appears once the wait is long enough to have news, and the
  // decide sentence once it is long enough to be worth closing.
  const askAboutStatus = pending && days !== null && days >= NUDGE_AFTER_DAYS;
  const longEnough = pending && days !== null && days >= DECIDE_AFTER_DAYS;

  const tone = TONE[STATE_TONE[value] ?? "zinc"] ?? TONE.zinc;

  // The fact rendered through the one primitive allowed to render a fact, with the
  // dimension's own label. Not marked derived: this is a reading — an assertion by
  // the operator is evidence, and its surface says so on the provenance line.
  const fact: ObservedFact = {
    ...relationship,
    value: relationship.value === null ? null : STATE_LABEL[value] ?? value,
  };

  return (
    <div
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      data-gtm-block={CONNECTION_SECTION}
      data-relationship-state={value}
      data-days-pending={days === null ? undefined : String(days)}
    >
      <ObservedValue
        variant="inline"
        label={DIMENSION_LABEL.relationship_state}
        fact={fact}
        hideProvenance={fact.sourceSurface == null && fact.observedAt == null}
        className={cn("rounded-md border px-3 py-2", tone)}
      />

      {/* How long they have been waiting. Derived from the confirmation's own
          instant, which is why it disappears rather than reading "0 days" when no
          instant was recorded. */}
      {pending && pendingLabel(days) && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] leading-relaxed text-slate-600">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {pendingLabel(days)}
        </p>
      )}

      {/*
        The return prompt. A question with a real "no", shown only while the page is
        mid-flow. This is the single most important control in the block: it is the
        difference between recording what the operator did and inferring it from the
        fact that they came back.
      */}
      {awaitingSendAnswer && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-[13px] font-semibold text-amber-900">
            {GTM_CONNECTION_LABELS.askOnReturn}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            {GTM_CONNECTION_LABELS.askOnReturnWhy}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirm(PENDING)}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {GTM_CONNECTION_LABELS.didSend}
            </Button>
            {/* Writes nothing. An honest "not yet" has to be as easy as a "yes". */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDismissPrompt}
              disabled={confirming}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {GTM_CONNECTION_LABELS.didNotSend}
            </Button>
          </div>
        </div>
      )}

      {/*
        The status check. Only where an invitation is actually outstanding and has
        been for long enough that the operator might have something new to tell us.
      */}
      {askAboutStatus && !awaitingSendAnswer && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-[13px] font-semibold text-zinc-800">
            {GTM_CONNECTION_LABELS.checkStatus}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            {GTM_CONNECTION_LABELS.checkStatusWhy}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirm("CONNECTED")}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {GTM_CONNECTION_LABELS.accepted}
            </Button>
            {/* Writes nothing; acknowledges and closes. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStillAwaiting}
              disabled={confirming}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {GTM_CONNECTION_LABELS.stillAwaiting}
            </Button>
            {/* A decline is invisible on every surface we can read, so the operator
                is its only possible witness — which is exactly why the reconciler
                gates REJECTED to HUMAN_CONFIRMATION alone. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onConfirm("REJECTED")}
              disabled={confirming}
            >
              {GTM_CONNECTION_LABELS.declined}
            </Button>
          </div>
          {longEnough && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {GTM_CONNECTION_LABELS.pendingLongEnough}
            </p>
          )}
        </div>
      )}

      {/*
        The send control. Offered only from the states where asking to connect is the
        sensible next step — never beside a pending invitation, which would invite a
        duplicate, and never beside a confirmed connection.
      */}
      {CONNECTABLE.includes(value) && !awaitingSendAnswer && (
        <div className="mt-4">
          <Button type="button" size="sm" onClick={onSendRequest} disabled={sending}>
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {sending ? GTM_CONNECTION_LABELS.sending : GTM_CONNECTION_LABELS.send}
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {GTM_CONNECTION_LABELS.sendHint}
          </p>
        </div>
      )}

      {/*
        What the last control did. `aria-live` without `role="status"`: the page owns
        exactly one `role="status"` region and a second would compete with it.
      */}
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-[11px] leading-relaxed text-slate-500">
        {notice ?? ""}
      </p>
    </div>
  );
}

export default ConnectionPanel;
