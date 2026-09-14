// components/gtm/NextActionPanel.tsx
//
// The next move, the message ready beside it, and the one control in this product
// that touches LinkedIn (R18.5, R12.1, R12.3, R12.4, R13.1, R13.3).
//
// What `Open LinkedIn & Send` actually does, in this order and no other:
//
//   1. `requestAction`  records that the operator intends to act. An intent, and
//      nothing else: the route writes `execution_state = ACTION_REQUESTED` and
//      leaves `relationship_state` and `conversation_state` exactly where they were
//      (R13.1). It comes back with a destination and a payload — a place to go and
//      some text to paste, which is the whole of what Weez can offer here.
//   2. the clipboard, on the operator's own machine. A convenience, not a LinkedIn
//      interaction.
//   3. `window.open(url, "_blank", "noopener,noreferrer")`. `noopener` is the
//      load-bearing part: Weez holds no handle to the tab it opened and could not
//      script LinkedIn from this file even if someone tried to make it (R12.3).
//   4. `markOpened` records `LINKEDIN_CHAT_OPENED` (R13.3). Opening a chat is not
//      sending a message, and the server treats it as neither.
//   5. a toast that says a tab opened.
//
// Four things it deliberately does not do, and the reason the test beside this file
// spies on `gtmAPI` rather than on the button:
//
//   • it does not set `conversation_state` — no client call can
//   • it does not create a message-sent record — `MESSAGE_SENT` has no client path
//   • it does not write `sent_content` — this control never calls `confirmAction`
//   • it does not claim success. The toast reports that LinkedIn was opened, which
//     is the only thing that verifiably happened. Whether a message was sent is
//     unknown until the thread is read or the operator says so, and the difference
//     between those two sentences is the entire point of this layer.
//
// `I sent it` is the operator's own assertion, routed through `confirmAction` so the
// server records it under `HUMAN_CONFIRMATION` — the one non-observation source
// R7.5 admits for `sent_content`. It is a separate control with a separate label
// because it is a separate claim, made by a different party.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Ban, ExternalLink, Loader2, PencilLine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import gtmAPI, {
  type Action,
  type ActionType,
  type CandidateAction,
  type CandidateActionType,
  type ConfirmationStatus,
  type FeedbackRecorded,
  type LifecyclePosition,
  type Message,
  type NextAction,
  type NextBestAction,
  type PriorityTier,
  type TimelineEntry,
  type UnexecutableReason,
} from "@/services/gtmAPI";
import { ConfirmationStatusBadge } from "./ConfirmationStatusBadge";
import { CreditPriceTag } from "./CreditBalance";
import { DerivedScore } from "./DerivedScore";
import { MessageComposer } from "./MessageComposer";
import {
  absTime,
  CHANNEL_LABEL,
  CHANNEL_TONE,
  FACTOR_LABEL,
  GTM_ACTION_LABELS,
  GTM_ACTION_LABEL_BY_TYPE,
  GTM_ACTION_TOASTS,
  GTM_EXCLUSION_LABELS,
  GTM_LIFECYCLE_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_PRIORITY_TIER_LABELS,
  GTM_SIGNAL_TYPE_LABELS,
  GTM_UI_LABELS,
  relTime,
  TONE,
} from "./labels";

/** Shown in place of the primary control when a terminal reply closed the thread. */
export const SUPPRESSED_NOTE = "Outreach is paused for this prospect. The timeline says why.";

/** Shown when the payload is prepared, so a blocked popup is still recoverable. */
export const REOPEN_HINT = "If the tab didn't open, use the control again — the request is already recorded.";

export interface NextActionPanelProps {
  brandId: string;
  leadId: string;
  /** `ProspectDetail.nextAction`. `null` when the worker has not proposed one yet. */
  nextAction: NextAction | null;
  /**
   * The state engine's ranking, when the page has read it (R27.1, R27.5).
   *
   * Optional and additive, in the shape `StateDimensionGrid.stateFull` takes: without
   * it this panel renders exactly what it rendered before, and with it the Action_Card
   * for `recommended` appears *above* the existing recommendation — which stays where
   * it was, with its own message composer and its own confirm ladder. The card is one
   * more thing on the panel and never a replacement for it.
   */
  nextBestAction?: NextBestAction | null;
  /** `ProspectState.confirmationStatus` — beside the control, per R12.4. */
  confirmationStatus: ConfirmationStatus;
  /** Every retained version, newest first. Handed straight to the composer. */
  messageVersions: Message[];
  /** A fresher action row, so the page can merge it without a refetch. */
  onActionRequested?: (action: Action) => void;
  /** The card's ledger rows — `VIEWED` on render, `CANCELLED` on dismissal. */
  onLifecycleRecorded?: (entry: TimelineEntry) => void;
  /** The feedback row the card's not-relevant control persisted. */
  onFeedbackRecorded?: (recorded: FeedbackRecorded) => void;
  /** Handed the candidate when the operator opens its reasoning to edit it. */
  onEditReasoning?: (action: CandidateAction) => void;
  /** A message row the server rewrote (a saved edit, a new version). */
  onMessagePersisted?: (message: Message) => void;
  /** What Contact Directly costs, passed through to the card's open-channel control. */
  contactPrice?: number | null;
  className?: string;
}

const ACTION_CODE: Record<ActionType, string> = {
  SEND_MESSAGE: "s",
  CONNECT: "c",
  MEETING_REQUEST: "m",
};

/**
 * A stable key for one logical request, inside the server's 8–64 character bound.
 *
 * The tuple that identifies the request is `lead + action + message + version`, and
 * spelled out with UUID ids it runs past 64 characters — so it is folded with two
 * FNV-1a lanes rather than truncated. Truncation would let two prospects share a
 * prefix and collide onto one another's requested action, which is the one failure
 * mode an idempotency key exists to prevent.
 */
export function actionIdempotencyKey(
  leadId: string,
  actionType: ActionType,
  messageId: string | null,
  version: number | null,
): string {
  const raw = `${leadId}:${actionType}:${messageId ?? "-"}:${version ?? 0}`;
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0;
  }
  const digest = `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
  return `gtm-${ACTION_CODE[actionType] ?? "x"}${version ?? 0}-${digest}`;
}

/**
 * Best-effort clipboard write. A refusal is not a failure of the action: the
 * payload is on screen and selectable either way, so this reports and moves on.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── The Action_Card (R27.1, R27.2, R27.3, R27.4, R27.5, R27.8) ───────────────
//
// The state engine's recommendation, rendered inside this file rather than beside
// it. R27.5 is explicit that the card *extends* `NextActionPanel` and does not
// introduce a parallel action component, and the reason is the one this file's
// header already spends thirty lines on: there is exactly one place in this product
// that opens a channel, and a second component with a second click path would be a
// second place for the send rule to be got wrong.
//
// **The click path, and why it is split across two routes.** Two of the eleven
// lifecycle positions move a state dimension the moment they are recorded, and the
// routes that own those dimensions are the routes that record them:
//
//   `CLICKED`   `POST /gtm/prospect/{lead_id}/action/request` — the *existing*
//               route, reached through `gtmAPI.requestAction` with the same
//               `actionIdempotencyKey()` the panel below has always used. It writes
//               `execution_state = ACTION_REQUESTED` and narrows the evidence to
//               `WEEZ_UI_CLICK`.
//   `STARTED`   `POST /gtm/action/{action_id}/opened`, through `gtmAPI.markOpened`.
//
//   `VIEWED`    `POST /gtm/prospect/{lead_id}/lifecycle` — route 10, through
//   `CANCELLED` `gtmAPI.postLifecycle`. It admits only the positions that move no
//               dimension, and refuses `CLICKED` with a 422 naming the route above.
//
// So the open-channel control does not go to route 10, and route 10 never sees a
// click. Sending `CLICKED` there would be refused, and the refusal is the contract
// working rather than a bug to route around.
//
// **What the card is not allowed to say.** While the position is `CLICKED` or
// `STARTED` a human asked for the action and a tab opened, and that is the whole of
// what happened (R27.3). The status therefore reads through `GTM_LIFECYCLE_LABELS`
// — "Action requested", "Channel opened" — and the card prints no sentence claiming
// the action was performed. `EXECUTED` is the operator's own assertion and belongs
// to the confirm ladder, which is the panel's `I sent it` control below and not
// this card's business.

/**
 * The six strings this card needs and `labels.ts` does not carry.
 *
 * Kept here in one exported object, in the shape `SUPPRESSED_NOTE` and `REOPEN_HINT`
 * already established in this file, because task 14.3 closed `labels.ts` for this
 * feature and adding to it now is out of scope. They belong in `labels.ts` beside
 * `GTM_UI_LABELS`, and moving them there is a one-line change at each use site.
 *
 * None of them states or implies that Weez sends anything: the only string on this
 * card that names a channel is the action title, which comes from
 * `GTM_NBA_ACTION_LABELS` and carries the `Open <channel> & <verb>` form.
 */
export const ACTION_CARD_LABELS = {
  priority: "Priority",
  expectedOutcome: "Expected outcome",
  editReasoning: "Edit reasoning",
  dismiss: "Dismiss",
  notRelevant: "Not relevant",
  feedbackRecorded: "Recorded",
} as const;

/**
 * The Action_Queue's four tiers.
 *
 * A reference to `GTM_PRIORITY_TIER_LABELS` and not a copy of it: the strings stay
 * in `labels.ts`, and this export exists so the card and the queue page reach them
 * under one name without either one restating a tier.
 */
export const PRIORITY_TIER_LABELS: Record<string, string> = GTM_PRIORITY_TIER_LABELS;

/** The card's test hook, one per recommendation, so a queue of cards is addressable. */
export function actionCardTestId(recommendationId: string): string {
  return `gtm-action-card-${recommendationId}`;
}

/**
 * Why a recommendation offers no open-channel control, in the operator's words.
 *
 * **This used to be a mapping table, and deleting it was the point.** A
 * `Partial<Record<CandidateActionType, ActionType>>` lived here translating the
 * thirteen candidate types onto the three delivery verbs — the backend's domain,
 * restated in a component, where nothing tested it and where it silently collapsed
 * two very different reasons into one absent control. The server now answers the
 * question itself on every candidate: `executable` says whether the outreach layer
 * can carry the recommendation out, `executionVerb` says what to post, and
 * `unexecutableReason` says which of the three cases applies when it cannot.
 *
 * So the card reads the answer instead of deriving it, and these strings are the only
 * thing left — the *rendering* of a reason, which is genuinely this layer's job.
 *
 *   `ADVISORY`                — WAIT / RESEARCH_MORE / NURTURE / STOP_OUTREACH. The
 *                               recommendation *is* the output; there is nothing to
 *                               open, and offering a send control would record an
 *                               approach the engine had just advised against.
 *   `NO_EXECUTION_VERB`       — CALL. A human can genuinely place it; none of the
 *                               three verbs *is* placing a call, so there is nothing
 *                               to file the click against.
 *   `CHANNEL_NOT_IMPLEMENTED` — SEND_EMAIL / SEND_EMAIL_FOLLOWUP today. The verb
 *                               exists and the channel is real, but no adapter is
 *                               registered, so the destination would go nowhere.
 *
 * Saying which one applies matters because they call for different things from the
 * operator: nothing, a phone, or waiting for us to build it.
 */
export const UNEXECUTABLE_REASON_LABELS: Record<UnexecutableReason, string> = {
  ADVISORY: "No outreach to open — this is a decision, not a message.",
  NO_EXECUTION_VERB: "Weez cannot record a phone call yet, so there is nothing to open.",
  CHANNEL_NOT_IMPLEMENTED:
    "This channel has no delivery adapter yet, so Weez cannot open it for you.",
};

/** The scoring term that carries the expected outcome, per `ActionTermKey`. */
const EXPECTED_OUTCOME_TERM = "expected_success_probability";

/**
 * A number as the server sent it, to two places when it has a fraction.
 *
 * A format and not a computation, in the sense `relTime` is: no band is derived, no
 * percentage is invented, and nothing is rounded into a claim.
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface ActionCardProps {
  brandId: string;
  leadId: string;
  /** The candidate this card argues for — normally `NextBestAction.recommended`. */
  action: CandidateAction;
  /**
   * The newest recorded lifecycle position for this recommendation, when the page
   * knows it. The card advances its own copy as the operator acts, so this is a
   * starting point rather than the source of truth for a card already clicked.
   */
  position?: LifecyclePosition | null;
  /** The queue's band. Absent on the prospect page, where there is one card. */
  priorityTier?: PriorityTier | null;
  /**
   * The channel destination to open. Optional because `action/request` returns one:
   * this is the fallback for a blocked or empty response, never a URL composed here.
   */
  destinationUrl?: string | null;
  /** Overrides the `expected_success_probability` term, for the queue's own value. */
  expectedSuccessProbability?: number | null;
  /** A fresher action row, so the page can merge it without a refetch. */
  onActionRequested?: (action: Action) => void;
  /** The ledger row route 10 wrote, for `VIEWED` and for `CANCELLED`. */
  onLifecycleRecorded?: (entry: TimelineEntry) => void;
  /** The feedback row the server persisted, so the page sees what the card saw. */
  onFeedbackRecorded?: (recorded: FeedbackRecorded) => void;
  /** Handed the candidate when the operator opens its reasoning to edit it. */
  onEditReasoning?: (action: CandidateAction) => void;
  /**
   * What Contact Directly costs, from the server's price list, rendered on the
   * open-channel control.
   *
   * `null` — the default — renders no tag. That is deliberate for a component whose
   * callers include a queue that may not have read the balance: a control with no price
   * tag is honest, and one that looks free while charging a credit is not.
   */
  contactPrice?: number | null;
  className?: string;
}

export function ActionCard({
  brandId,
  leadId,
  action,
  position = null,
  priorityTier = null,
  destinationUrl = null,
  contactPrice = null,
  expectedSuccessProbability = null,
  onActionRequested,
  onLifecycleRecorded,
  onFeedbackRecorded,
  onEditReasoning,
  className,
}: ActionCardProps) {
  const titleId = useId();
  const [recorded, setRecorded] = useState<LifecyclePosition | null>(position);
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackRecorded | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [busy, setBusy] = useState<null | "open" | "dismiss" | "feedback">(null);

  const { recommendationId, actionType, channel } = action;
  // The server's answer, not ours. `executable` is the conjunction — a verb exists *and*
  // its channel has a registered adapter — and it is the only field this control should
  // read. `executionVerb` is what gets posted; both come off the candidate, so a card and
  // a queue row cannot disagree about whether the same recommendation can be acted on.
  const requestActionType = action.executable ? action.executionVerb : null;
  const title = GTM_NBA_ACTION_LABELS[actionType] ?? actionType;
  const messageId = action.explanation?.whyThisMessage?.messageId ?? null;
  const whyNow = action.explanation?.whyNow ?? [];

  const expectedOutcome = useMemo(() => {
    if (typeof expectedSuccessProbability === "number") return expectedSuccessProbability;
    const term = action.terms.find((entry) => entry.factor === EXPECTED_OUTCOME_TERM);
    return term?.available && typeof term.value === "number" ? term.value : null;
  }, [action.terms, expectedSuccessProbability]);

  /**
   * `VIEWED`, once, through route 10 (R26.1).
   *
   * Fire-and-forget on purpose: a ledger row nobody asked for must not raise a toast
   * at an operator who only looked at a card. The ref keys on the recommendation, so
   * a re-render records one position and a *new* recommendation records its own.
   */
  const viewedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!recommendationId || viewedFor.current === recommendationId) return;
    viewedFor.current = recommendationId;
    void gtmAPI
      .postLifecycle(brandId, leadId, {
        recommendationId,
        position: "VIEWED",
        actionType,
        channel,
      })
      .then((entry) => onLifecycleRecorded?.(entry))
      .catch(() => undefined);
  }, [actionType, brandId, channel, leadId, onLifecycleRecorded, recommendationId]);

  /**
   * The open-channel control (R27.2).
   *
   * `requestAction` first, so the click is on the record before a tab exists, then
   * the destination in a new browser context with `noopener` — Weez holds no handle
   * to the tab it opened and cannot script the channel from here — then `markOpened`
   * for `STARTED`. The toast is this file's existing `OPENED` copy: a tab opened,
   * which is the only thing that verifiably happened.
   */
  const onOpenChannel = useCallback(async () => {
    if (!requestActionType) return;
    setBusy("open");
    try {
      // `CLICKED`, on the route that owns the dimension it moves. Not route 10.
      const requested = await gtmAPI.requestAction(brandId, leadId, {
        actionType: requestActionType,
        messageId,
        idempotencyKey: actionIdempotencyKey(leadId, requestActionType, messageId, null),
      });
      setRecorded("CLICKED");
      if (requested) onActionRequested?.(requested);

      const url = requested?.destinationUrl ?? destinationUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");

      // `STARTED`. Opening a channel is not acting in it, and the server agrees.
      if (requested?.actionId) {
        const opened = await gtmAPI.markOpened(brandId, requested.actionId);
        if (opened) {
          setRecorded("STARTED");
          onActionRequested?.(opened);
        }
      }

      toast.success(GTM_ACTION_TOASTS.OPENED);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : GTM_ACTION_TOASTS.PREPARE_FAILED);
    } finally {
      setBusy(null);
    }
  }, [brandId, destinationUrl, leadId, messageId, onActionRequested, requestActionType]);

  /** `CANCELLED` through route 10: the recommendation is retired, no action is touched. */
  const onDismiss = useCallback(async () => {
    setBusy("dismiss");
    try {
      const entry = await gtmAPI.postLifecycle(brandId, leadId, {
        recommendationId,
        position: "CANCELLED",
        actionType,
        channel,
      });
      setRecorded("CANCELLED");
      setDismissed(true);
      onLifecycleRecorded?.(entry);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : GTM_ACTION_TOASTS.PREPARE_FAILED);
    } finally {
      setBusy(null);
    }
  }, [actionType, brandId, channel, leadId, onLifecycleRecorded, recommendationId]);

  /**
   * The not-relevant control (R27.4).
   *
   * A Feedback_Event, and then what the server actually persisted — not what the
   * card hoped it would. The row comes back with the classification the layer chose
   * and the two things the route did besides writing it, and the card renders that.
   */
  const onNotRelevant = useCallback(async () => {
    setBusy("feedback");
    try {
      const row = await gtmAPI.postFeedback(brandId, leadId, {
        recommendationId,
        feedbackType: "NOT_RELEVANT",
      });
      setFeedback(row);
      onFeedbackRecorded?.(row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : GTM_ACTION_TOASTS.PREPARE_FAILED);
    } finally {
      setBusy(null);
    }
  }, [brandId, leadId, onFeedbackRecorded, recommendationId]);

  /** The reasoning, disclosed in place and handed up for whoever can edit it. */
  const onToggleReasoning = useCallback(() => {
    setReasoningOpen((open) => !open);
    onEditReasoning?.(action);
  }, [action, onEditReasoning]);

  const locked = busy !== null;
  const statusLabel = recorded ? GTM_LIFECYCLE_LABELS[recorded] ?? recorded : null;
  const feedbackLabel =
    feedback?.feedbackType === "NOT_RELEVANT"
      ? ACTION_CARD_LABELS.notRelevant
      : feedback?.feedbackType ?? null;

  return (
    <article
      aria-labelledby={titleId}
      data-testid={actionCardTestId(recommendationId)}
      className={cn("rounded-lg border border-zinc-200 bg-white p-3.5", className)}
    >
      {/* The title, the tier and the status. Every one of them text: the tone is
          decoration and the words carry the meaning (R18.9, R27.8). */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="text-[14px] font-semibold leading-snug text-zinc-900">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {priorityTier && (
            <span className={cn("rounded-full border px-2 py-0 text-[10px] font-semibold", TONE.amber)}>
              <span className="sr-only">{ACTION_CARD_LABELS.priority}: </span>
              {PRIORITY_TIER_LABELS[priorityTier] ?? priorityTier}
            </span>
          )}
          {statusLabel && (
            <span
              role="status"
              className={cn("rounded-full border px-2 py-0 text-[10px] font-semibold", TONE.zinc)}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {/* Action_Confidence, and the score with the disclaimer the engine wrote. */}
      <div className="mt-2 flex flex-wrap items-end gap-4">
        <DerivedScore score={action.actionScore} size="sm" />
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", TONE.zinc)}>
          <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
          {formatNumber(action.actionConfidence)}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* The recommended channel. One channel, never a blend of them. */}
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {GTM_UI_LABELS.recommendedChannel}
          </dt>
          <dd className="mt-1">
            {channel ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0 text-[11px] font-semibold",
                  TONE[CHANNEL_TONE[channel] ?? "zinc"] ?? TONE.zinc,
                )}
              >
                {CHANNEL_LABEL[channel] ?? channel}
              </span>
            ) : (
              <span className="text-[12px] text-slate-500">{GTM_UI_LABELS.noRecommendedChannel}</span>
            )}
          </dd>
        </div>

        {/* The expected outcome, as the term recorded it. Absent rather than zero. */}
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {ACTION_CARD_LABELS.expectedOutcome}
          </dt>
          <dd className="mt-1 text-[13px] font-semibold text-zinc-900">
            {expectedOutcome === null ? (
              <span className="font-medium text-slate-500">{GTM_UI_LABELS.unavailableHeading}</span>
            ) : (
              formatNumber(expectedOutcome)
            )}
          </dd>
        </div>
      </dl>

      {/* Why now: one bullet per signal that fed the timing, each naming the signal,
          the term it fed and when the fact happened. A set of references, never a
          sentence composed here. */}
      <div className="mt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {GTM_UI_LABELS.reasoningHeading}
        </p>
        {whyNow.length === 0 ? (
          <p className="mt-1 text-[12px] text-slate-500">{GTM_UI_LABELS.noReasoning}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {whyNow.map((bullet, index) => {
              const termLabel = bullet.term ? FACTOR_LABEL[bullet.term] ?? bullet.term : null;
              // The event, in a rep's words. This list sits outside every `<details>`, so
              // the signal type is a primary statement and goes through the same table
              // `NextBestActionCard` reads it through (R8.3) — one lookup path, and a type
              // the table has no copy for resolves inside the table, re-cased into its own
              // words rather than left as `TECH_STACK_CHANGE`.
              const signalLabel = bullet.signalType
                ? GTM_SIGNAL_TYPE_LABELS[bullet.signalType] ?? bullet.signalType
                : null;
              const when = relTime(bullet.eventTimestamp);
              return (
                <li
                  key={`${index}-${bullet.signalId ?? bullet.signalType ?? "signal"}`}
                  className="flex gap-1.5 text-[12px] leading-relaxed text-slate-600"
                >
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0">
                    {signalLabel ?? termLabel ?? ""}
                    {signalLabel && termLabel ? ` · ${termLabel}` : ""}
                    {when && (
                      <span title={absTime(bullet.eventTimestamp)} className="text-slate-500">
                        {` · ${when}`}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* A held candidate keeps its reason (R13.3), so the reader is not left looking
          for a block that was never explained. */}
      {action.exclusionReason && (
        <p role="status" className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[12px] text-slate-600">
          {GTM_EXCLUSION_LABELS[action.exclusionReason] ?? action.exclusionReason}
        </p>
      )}

      {/* The four controls. Every one a real `button`, so it is reachable by keyboard
          and carries the shared focus ring (R27.8). The open-channel control is
          absent when nothing could record its click, rather than present and lying. */}
      {dismissed ? (
        <p role="status" className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-[12px] text-slate-600">
          {GTM_LIFECYCLE_LABELS.CANCELLED}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {requestActionType ? (
            <Button type="button" size="sm" onClick={() => void onOpenChannel()} disabled={locked}>
              {busy === "open" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {title}
              {/* What the click will cost, from the server's price list. Absent when the
                  price has not been read — a control that looks free and is not is worse
                  than one with no tag. */}
              <CreditPriceTag credits={contactPrice} className="ml-1.5" />
            </Button>
          ) : (
            /* The control is absent, and the reason is said out loud. Silence here reads
               as a broken card: an operator looking at a recommendation with no way to act
               on it needs to know whether that is the recommendation's nature (advisory) or
               a gap in what Weez can do yet. */
            action.unexecutableReason && (
              <p
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[12px] text-slate-600"
                data-testid="gtm-action-unexecutable"
              >
                {UNEXECUTABLE_REASON_LABELS[action.unexecutableReason]}
              </p>
            )
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleReasoning}
            aria-expanded={reasoningOpen}
            disabled={locked}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            {ACTION_CARD_LABELS.editReasoning}
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={() => void onNotRelevant()} disabled={locked}>
            {busy === "feedback" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {ACTION_CARD_LABELS.notRelevant}
          </Button>

          <Button type="button" variant="ghost" size="sm" onClick={() => void onDismiss()} disabled={locked}>
            {busy === "dismiss" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {ACTION_CARD_LABELS.dismiss}
          </Button>
        </div>
      )}

      {/* The reasoning, disclosed: every term with its direction, and the ones whose
          input was missing named rather than counted as zero (R1.7). */}
      {reasoningOpen && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
          <dl className="space-y-1">
            {action.terms.map((term) => (
              <div key={term.factor} className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-[12px] text-slate-600">{FACTOR_LABEL[term.factor] ?? term.factor}</dt>
                <dd className="text-[12px] font-semibold text-zinc-900">
                  {term.available && typeof term.value === "number"
                    ? formatNumber(term.value)
                    : GTM_UI_LABELS.unavailableHeading}
                </dd>
              </div>
            ))}
          </dl>
          {action.unavailableTerms.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {GTM_UI_LABELS.unavailableHeading}
              {": "}
              {action.unavailableTerms.map((term) => FACTOR_LABEL[term] ?? term).join(", ")}
            </p>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{GTM_UI_LABELS.unavailableNote}</p>
        </div>
      )}

      {/* What the server recorded, announced because it is news the operator caused
          and did not otherwise see (R27.4, R27.8). */}
      <div aria-live="polite" className="mt-2">
        {feedback && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[12px] text-slate-600">
            {ACTION_CARD_LABELS.feedbackRecorded}
            {": "}
            {feedbackLabel}
            {feedback.recordedAt && ` · ${relTime(feedback.recordedAt)}`}
          </p>
        )}
      </div>
    </article>
  );
}

export function NextActionPanel({
  brandId,
  leadId,
  nextAction,
  nextBestAction,
  confirmationStatus,
  messageVersions,
  onActionRequested,
  onLifecycleRecorded,
  onFeedbackRecorded,
  onEditReasoning,
  onMessagePersisted,
  contactPrice = null,
  className,
}: NextActionPanelProps) {
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [activeText, setActiveText] = useState("");
  const [prepared, setPrepared] = useState<Action | null>(null);
  const [busy, setBusy] = useState<null | "open" | "copy" | "confirm">(null);

  // Memoised because the composer reports upward from an effect.
  const onActiveMessageChange = useCallback((message: Message | null, text: string) => {
    setActiveMessage(message);
    setActiveText(text);
  }, []);

  const latestAction = prepared ?? nextAction?.latestAction ?? null;
  const status: ConfirmationStatus = latestAction?.confirmationStatus ?? confirmationStatus;

  // What the operator would copy: the payload the server prepared once it has one,
  // and the draft in front of them before that. Never a string composed here.
  const payloadText = useMemo(
    () => prepared?.payloadText ?? activeText ?? nextAction?.payloadText ?? "",
    [prepared, activeText, nextAction],
  );

  const onOpenAndSend = useCallback(async () => {
    if (!nextAction) return;
    const messageId = activeMessage?.messageId ?? nextAction.messageId ?? null;
    setBusy("open");
    try {
      // (1) The intent. Nothing about an outcome.
      const action = await gtmAPI.requestAction(brandId, leadId, {
        actionType: nextAction.actionType,
        messageId,
        idempotencyKey: actionIdempotencyKey(
          leadId,
          nextAction.actionType,
          messageId,
          activeMessage?.version ?? null,
        ),
      });

      const payload = action?.payloadText ?? activeText ?? nextAction.payloadText ?? "";
      // (2) The operator's own clipboard.
      await writeClipboard(payload);

      // (3) The tab. No handle back to it, by construction.
      const destination = action?.destinationUrl ?? nextAction.destinationUrl;
      if (destination) {
        window.open(destination, "_blank", "noopener,noreferrer");
      }

      // (4) Opened is opened. It is not sent.
      if (action) {
        const opened = action.actionId ? await gtmAPI.markOpened(brandId, action.actionId) : null;
        const merged = opened ?? action;
        setPrepared(merged);
        onActionRequested?.(merged);
      }

      // (5) The only claim available: a tab opened.
      toast.success(GTM_ACTION_TOASTS.OPENED);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : GTM_ACTION_TOASTS.PREPARE_FAILED);
    } finally {
      setBusy(null);
    }
  }, [activeMessage, activeText, brandId, leadId, nextAction, onActionRequested]);

  const onCopy = useCallback(async () => {
    setBusy("copy");
    try {
      const ok = await writeClipboard(payloadText);
      if (ok) toast.success(GTM_ACTION_TOASTS.COPIED);
      else toast.error(GTM_ACTION_TOASTS.COPY_FAILED);
    } finally {
      setBusy(null);
    }
  }, [payloadText]);

  const onConfirmSent = useCallback(async () => {
    if (!latestAction?.actionId) return;
    setBusy("confirm");
    try {
      // The operator's assertion, attributed to them. The server records it as
      // `HUMAN_CONFIRMATION` evidence and the reconciler decides what it moves.
      const updated = await gtmAPI.confirmAction(brandId, latestAction.actionId, {
        sentText: payloadText || null,
      });
      if (updated) {
        setPrepared(updated);
        onActionRequested?.(updated);
      }
      toast.success(GTM_ACTION_TOASTS.CONFIRMED_SENT);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : GTM_ACTION_TOASTS.PREPARE_FAILED);
    } finally {
      setBusy(null);
    }
  }, [brandId, latestAction, onActionRequested, payloadText]);

  const locked = busy !== null;

  // The ranking's winner, when the page read one. `lifecycle` is the newest recorded
  // position for it; it arrives as a string and is admitted only if it is one of the
  // eleven, so an event type this file does not know renders no status rather than a
  // status nobody can read.
  const recommended = nextBestAction?.recommended ?? null;
  const recordedPosition = nextBestAction?.lifecycle?.eventType ?? null;
  const cardPosition =
    recordedPosition && recordedPosition in GTM_LIFECYCLE_LABELS
      ? (recordedPosition as LifecyclePosition)
      : null;

  return (
    <section
      aria-labelledby="gtm-next-action-heading"
      className={cn("rounded-xl border border-zinc-200 bg-white p-4", className)}
    >
      <h2 id="gtm-next-action-heading" className="text-[13px] font-bold uppercase tracking-[0.12em] text-zinc-900">
        Next action
      </h2>

      {/* The Action_Card, when the page has a ranking (R27.5). Added to this panel,
          not substituted for anything in it — the recommendation below keeps its
          composer and its confirm ladder exactly as they were. */}
      {recommended && (
        <ActionCard
          className="mt-2"
          brandId={brandId}
          leadId={leadId}
          action={recommended}
          position={cardPosition}
          destinationUrl={nextAction?.destinationUrl ?? null}
          contactPrice={contactPrice}
          onActionRequested={onActionRequested}
          onLifecycleRecorded={onLifecycleRecorded}
          onFeedbackRecorded={onFeedbackRecorded}
          onEditReasoning={onEditReasoning}
        />
      )}

      {!nextAction ? (
        // Absent unless there is nothing at all to show: a card beside "nothing has
        // been prepared" would be two answers to one question.
        recommended ? null : (
          <p className="mt-2 text-[13px] text-slate-500">
            No next action has been prepared yet.
          </p>
        )
      ) : (
        <div className="mt-2 space-y-4">
          {/* The recommendation sentence and the why, both as the server wrote them. */}
          <div>
            <p className="text-[14px] font-semibold leading-snug text-zinc-900">{nextAction.recommendation}</p>
            {nextAction.reasoning.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {nextAction.reasoning.map((reason, index) => (
                  <li key={`${index}-${reason}`} className="flex gap-1.5 text-[12px] leading-relaxed text-slate-600">
                    <span aria-hidden="true">·</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {nextAction.instructions && (
              <p className="mt-2 rounded-md bg-zinc-50 p-2 text-[12px] leading-relaxed text-slate-600">
                {nextAction.instructions}
              </p>
            )}
          </div>

          {messageVersions.length > 0 && (
            <MessageComposer
              brandId={brandId}
              versions={messageVersions}
              onActiveMessageChange={onActiveMessageChange}
              onMessagePersisted={onMessagePersisted}
              disabled={locked}
            />
          )}

          {nextAction.isSuppressed ? (
            <p role="status" className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-[12px] text-slate-600">
              {SUPPRESSED_NOTE}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void onOpenAndSend()} disabled={locked}>
                  {busy === "open" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  )}
                  {GTM_ACTION_LABEL_BY_TYPE[nextAction.actionType]}
                </Button>

                <Button type="button" variant="outline" onClick={() => void onCopy()} disabled={locked}>
                  {GTM_ACTION_LABELS.COPY}
                </Button>

                {/* R12.4 — the confirmation status of the last requested action,
                    beside the control that requested it. Announced, because a move
                    from "waiting" to "confirmed" is news. */}
                <span role="status" aria-live="polite" className="inline-flex">
                  <ConfirmationStatusBadge status={status} />
                </span>
              </div>

              {latestAction && status !== "CONFIRMED" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void onConfirmSent()} disabled={locked}>
                    {busy === "confirm" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {GTM_ACTION_LABELS.CONFIRM_SENT}
                  </Button>
                  <span className="text-[11px] text-slate-500">
                    Weez can only confirm this by reading the thread. Until then, you can tell it.
                  </span>
                </div>
              )}

              {prepared && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                  <p className="text-[11px] text-slate-600">{REOPEN_HINT}</p>
                  {prepared.payloadText && (
                    <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
                      {prepared.payloadText}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default NextActionPanel;
