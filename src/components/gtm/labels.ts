// components/gtm/labels.ts
//
// The GTM label tables — the one place a machine value becomes a human string.
//
// Two rules govern this module, and they are the reason it exists at all:
//
// **One source for action labels.** `GTM_ACTION_LABELS` is exported from here and
// nowhere else. Every GTM control takes its label from this table, so the R12.2
// scan (`pages/__tests__/GTMProspect.labels.test.tsx`) has a single object to walk
// and there is no second place a control could quietly be labelled `Send`. Weez
// never sends anything inside LinkedIn: every label that touches LinkedIn says
// what actually happens, which is that a tab opens and the operator acts.
//
// **Lookup, never computation.** Nothing here derives a score, a level, or a
// state. `STATE_LABEL` and `SURFACE_LABEL` are dictionaries keyed by the exact
// enum values `schemas/gtm.py` sends, and `relTime` / `absTime` are formatters over
// a timestamp the server observed. If a value is missing from a table the caller
// renders the raw value rather than substituting a plausible one — an unmapped
// enum is a display gap, not a licence to guess.

import type { ActionType, ConfirmationStatus, SourceSurface } from "@/services/gtmAPI";

// ─── Action control labels (R12.1, R12.2) ─────────────────────────────────────

/**
 * Every label a GTM control can carry.
 *
 * No entry is `Send`, and none can be: Weez opens LinkedIn and the human sends.
 * The LinkedIn message control is `Open LinkedIn & Send` (R12.1) — the conjunction
 * is load-bearing, because it names both halves of what happens and leaves the
 * dispatch with the operator.
 */
export const GTM_ACTION_LABELS = {
  SEND_MESSAGE: "Open LinkedIn & Send",
  CONNECT: "Open LinkedIn & Connect",
  MEETING_REQUEST: "Open LinkedIn & Ask for time",
  OPEN_THREAD: "Open LinkedIn thread",
  CONFIRM_SENT: "I sent it",
  CONFIRM_MANUALLY: "Confirm manually",
  REVIEW_REPLY: "Review reply",
  COPY: "Copy message",
  REGENERATE: "Regenerate",
  EDIT: "Edit",
  SAVE: "Save",
  CANCEL: "Cancel",
} as const;

export type GtmActionLabelKey = keyof typeof GTM_ACTION_LABELS;

/**
 * The label for a prepared action, keyed by the `actionType` the server returned.
 *
 * A projection of `GTM_ACTION_LABELS`, not a second table: the strings still live
 * in exactly one object, so the scan that reads that object covers this map too.
 */
export const GTM_ACTION_LABEL_BY_TYPE: Record<ActionType, string> = {
  SEND_MESSAGE: GTM_ACTION_LABELS.SEND_MESSAGE,
  CONNECT: GTM_ACTION_LABELS.CONNECT,
  MEETING_REQUEST: GTM_ACTION_LABELS.MEETING_REQUEST,
};

// ─── Tone → tailwind chip classes (the palette Eva / Max / Prospect already use) ─
//
// Literal class strings so Tailwind keeps them, and the same `bg-*-50` /
// `text-*-700` / `border-*-200` triples the rest of the app uses — which clear
// 4.5:1 for body text (R18.9). Colour is never the only carrier of meaning here:
// every chip built on this table pairs its tone with a text label and an icon.

export const TONE: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

// ─── Dimension value labels ───────────────────────────────────────────────────

/**
 * Human text for every value of every dimension, flat because the vocabularies do
 * not collide: where two dimensions share a token (`UNKNOWN`, `NOT_STARTED`,
 * `MEETING_REQUESTED`, `MEETING_BOOKED`) they mean the same thing to a reader.
 *
 * `UNKNOWN` reads "Unknown" and never "None", "Inactive", or "Not connected".
 * The whole point of the value is that nothing has been observed (R14.2).
 *
 * **This is the only place a dimension value gets a string.** Every section below —
 * including the state engine's `buying_stage`, `engagement_trend`,
 * `activity_trend_flag`, `within_business_hours` and channel `availability` — is read
 * by `ObservedValue`, which is the one primitive allowed to render a fact. The
 * dedicated panels that also render these dimensions do not carry their own strings:
 * `BUYING_STAGE_LABEL`, `ENGAGEMENT_TREND_LABEL`, `BUSINESS_HOURS_LABEL` and
 * `ACTIVITY_TREND_FLAG_LABEL` are projections of this table in the sense
 * `GTM_ACTION_LABEL_BY_TYPE` is a projection of `GTM_ACTION_LABELS` — a narrowing to
 * one dimension's members, never a second set of strings. That is what stops the same
 * fact reading two ways on one screen.
 *
 * Two tokens share a label without sharing a key: `DECLINING` (`engagement_trend`) and
 * `DECLINE` (`activity_trend_flag`) both read "Declining", because to a reader they are
 * the same news about two different counts. Distinct keys, so neither shadows the
 * other, and the row label beside each one says which count it is about.
 */
export const STATE_LABEL: Record<string, string> = {
  // shared
  UNKNOWN: "Unknown",
  NOT_STARTED: "Not started",

  // relationship_state
  NOT_CONNECTED: "Not connected",
  CONNECTION_PENDING: "Invitation pending",
  CONNECTED: "Connected",
  REJECTED: "Not accepted",

  // conversation_state
  WARMUP_READY: "Warm-up ready",
  WARMUP_SENT: "Warm-up seen in thread",
  WAITING_FOR_REPLY: "Waiting for reply",
  CONVERSATION_ACTIVE: "Conversation active",
  CTA_READY: "Ready to ask",
  MEETING_REQUESTED: "Meeting requested",
  MEETING_BOOKED: "Meeting booked",
  CLOSED: "Closed",

  // conversation_stage
  CONNECTION: "Connection",
  WARMUP: "Warm-up",
  ENGAGEMENT: "Engagement",
  DISCOVERY: "Discovery",
  VALUE: "Value",
  CTA: "CTA",
  MEETING: "Meeting",

  // execution_state
  ACTION_REQUESTED: "Action requested",
  ACTION_IN_PROGRESS: "LinkedIn opened",
  ACTION_SUCCEEDED: "Action succeeded",
  ACTION_FAILED: "Action failed",
  VERIFICATION_PENDING: "Verification pending",
  VERIFIED: "Verified",

  // activity_level
  INACTIVE: "Inactive",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very high",

  // cta_state
  NOT_READY: "Not ready",
  SOFT_CTA_READY: "Soft CTA ready",
  MEETING_CTA_READY: "Meeting CTA ready",

  // buying_stage — the five *placeable* stages, in the order a buyer moves through
  // them. `UNKNOWN` is covered by `shared` above and means the signals were too thin
  // to place anyone: it reads "Unknown" and must never acquire a stage label, because
  // `UNAWARE` is a reading about the prospect and `UNKNOWN` is a gap in ours.
  UNAWARE: "Unaware of the problem",
  PROBLEM_AWARE: "Problem aware",
  SOLUTION_AWARE: "Solution aware",
  EVALUATING: "Evaluating",
  DECIDING: "Deciding",

  // engagement_trend — a direction over three trailing counts. No `UNKNOWN` member on
  // the wire; a missing payload collapses to unknown at the call site instead.
  RISING: "Rising",
  FLAT: "Flat",
  DECLINING: "Declining",

  // activity_trend_flag
  SPIKE: "Spiking",
  STEADY: "Steady",
  DECLINE: "Declining",

  // within_business_hours — `UNKNOWN` here means no timezone resolved, which is not
  // the same claim as `OUTSIDE`, so it stays on the shared "Unknown" and gets no
  // working-hours wording.
  WITHIN: "Within their working hours",
  OUTSIDE: "Outside their working hours",

  // channel availability — `UNAVAILABLE` is an absence and never a low score (R6.6),
  // so it names the absence rather than reading as a verdict on the channel.
  AVAILABLE: "Available",
  UNAVAILABLE: "No contact identifier",
};

/** The tone each dimension value carries. Decoration only — the text carries the meaning. */
export const STATE_TONE: Record<string, string> = {
  UNKNOWN: "zinc",
  NOT_STARTED: "zinc",

  NOT_CONNECTED: "zinc",
  CONNECTION_PENDING: "amber",
  CONNECTED: "emerald",
  REJECTED: "rose",

  WARMUP_READY: "sky",
  WARMUP_SENT: "sky",
  WAITING_FOR_REPLY: "amber",
  CONVERSATION_ACTIVE: "emerald",
  CTA_READY: "violet",
  MEETING_REQUESTED: "violet",
  MEETING_BOOKED: "emerald",
  CLOSED: "zinc",

  ACTION_REQUESTED: "sky",
  ACTION_IN_PROGRESS: "sky",
  ACTION_SUCCEEDED: "emerald",
  ACTION_FAILED: "rose",
  VERIFICATION_PENDING: "amber",
  VERIFIED: "emerald",

  INACTIVE: "zinc",
  LOW: "zinc",
  MEDIUM: "sky",
  HIGH: "emerald",
  VERY_HIGH: "emerald",

  NOT_READY: "zinc",
  SOFT_CTA_READY: "sky",
  MEETING_CTA_READY: "violet",
};

// ─── Provenance labels (R14.3) ────────────────────────────────────────────────

/**
 * Where a fact was seen, in words an operator recognises.
 *
 * `WEEZ_UI_CLICK` is deliberately blunt — "Your click in Weez" is evidence that a
 * request was made and nothing more, and the label refuses to let it read like an
 * observation of LinkedIn.
 */
export const SURFACE_LABEL: Record<SourceSurface, string> = {
  LINKEDIN_PROFILE_PAGE: "LinkedIn profile",
  LINKEDIN_ACTIVITY_TAB: "LinkedIn activity",
  LINKEDIN_MESSAGING_THREAD: "LinkedIn thread",
  LINKEDIN_INVITATION_MANAGER: "LinkedIn invitations",
  LINKEDIN_API_ORG_SOCIAL: "LinkedIn page engagement",
  HUMAN_CONFIRMATION: "You confirmed it",
  CALENDAR_BOOKING: "Calendar booking",
  WEEZ_UI_CLICK: "Your click in Weez",
};

// ─── Confirmation status labels (R5.4, R5.5, R13.5, R13.6, R12.4) ─────────────

/**
 * What we can say about the outcome of the last requested action.
 *
 * `UNKNOWN` is the sensitive one. It means the verification budget ran out with
 * nothing observed — a statement about Weez, not about the operator — so it reads
 * "Couldn't confirm — check LinkedIn" in a neutral tone with a question icon, and
 * never as a failure in red (R5.5, R13.6).
 */
export const CONFIRMATION_LABEL: Record<ConfirmationStatus, string> = {
  NOT_APPLICABLE: "Nothing requested yet",
  WAITING_FOR_CONFIRMATION: "Waiting for confirmation",
  CONFIRMED: "Confirmed",
  UNKNOWN: "Couldn't confirm — check LinkedIn",
};

export const CONFIRMATION_TONE: Record<ConfirmationStatus, string> = {
  NOT_APPLICABLE: "zinc",
  WAITING_FOR_CONFIRMATION: "amber",
  CONFIRMED: "emerald",
  UNKNOWN: "zinc",
};

// ─── Score labels (R1.8, R9.6) ────────────────────────────────────────────────

/**
 * The name of the only kind of score this layer emits.
 *
 * The disclaimer itself is never composed here: it travels on the payload as
 * `DerivedScore.scoreDisclaimer` and is rendered verbatim, so the wording that
 * says "prioritisation signal, not a predicted probability" comes from the engine
 * that computed the number.
 */
export const SCORE_KIND_LABEL: Record<string, string> = {
  RECOMMENDATION_SCORE: "Recommendation score",
};

// ─── Timestamp formatters — the only transforms on this side of the wire ──────

/** "3h ago" from an ISO-8601 instant. Empty string for anything unreadable. */
export function relTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** The absolute instant, for a `title` beside the relative one. */
export function absTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
// ─── Panel labels (R18.1, R18.2, R18.3, R18.4, R9.5, R9.6) ────────────────────
//
// Everything below is a dictionary, in the same shape as the tables above: a key
// the server sent, a string a human reads. The panels added by task 20.4 look up
// through these and render the raw value when a key is missing, because an
// unmapped code is a display gap and not a licence to invent a friendlier one.
//
// `Record<string, string>` rather than `Record<ChannelKey, string>` deliberately,
// matching `TONE` and `STATE_LABEL`: the lookup site already handles the miss, and
// keeping the key type open means a value the backend adds tomorrow renders as
// itself instead of failing to type-check today.

/** Panel titles and the small pieces of prose the panels need. */
export const GTM_UI_LABELS = {
  // Panel headings (one `<h2>` per panel, per the page's heading outline).
  prospectTitle: "Prospect",
  activityTitle: "LinkedIn activity",
  channelsTitle: "Channel recommendation",
  stateTitle: "Current state",
  ctaTitle: "Meeting readiness",

  // Controls owned by these panels. No entry here is an action inside LinkedIn,
  // so none of them is — or could be — labelled `Send`.
  refresh: "Refresh",
  refreshing: "Refreshing",
  reevaluate: "Re-evaluate channels",
  viewProfile: "Open LinkedIn profile",

  // Honest empties. Each says what is absent rather than showing a zero.
  noEvaluation: "No channel evaluation yet. Nothing has been scored for this prospect.",
  noReasoning: "No factors recorded.",
  noSummary: "No summary yet.",
  noRecommendedChannel: "No recommended channel yet.",

  // Section labels inside the panels.
  reasoningHeading: "Why",
  unavailableHeading: "Not observed",
  recommendedChannel: "Recommended",
  recommendation: "Next move",
  confidence: "Confidence",
  observed: "Observed",
  computed: "Computed",
  decidedBy: "Decided by",
  recommendedCta: "Suggested ask",

  // The two notes that keep a display convenience from reading as authority.
  displayOnlyNote:
    "Display only. Each dimension is shown separately below and carries its own evidence.",
  unavailableNote:
    "A factor nobody could observe is left out of the score rather than counted as zero, and it lowers confidence.",
} as const;

/**
 * Field labels for the identity block and the dimension grid.
 *
 * The three state-engine dimensions at the bottom carry the same strings their own
 * panels already use — `BUYING_STAGE_PANEL_LABELS.title`,
 * `ENGAGEMENT_TREND_PANEL_LABELS.title` and
 * `TIMING_PANEL_LABELS.fields.activityTrendFlag` — so a row heading in
 * `StateDimensionGrid` and the heading of the panel that expands the same dimension
 * read identically. Without them `labelFor()` falls through to the raw key and the
 * grid prints `buying_stage`.
 */
export const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  headline: "Headline",
  company: "Company",
  role: "Role",
  location: "Location",
  seniority: "Seniority",
  icp_match: "ICP match",
  intent_signal: "Intent signal",
  acv_tier: "ACV tier",
  lead_score: "Lead score",
  activity_score: "Activity score",
  activity_level: "Activity level",
  relationship_state: "Relationship",
  conversation_state: "Conversation",
  conversation_stage: "Stage",
  execution_state: "Last requested action",
  confirmation_status: "Confirmation",
  display_summary: "Summary",
  cta_score: "Readiness score",
  cta_state: "Readiness",
  buying_stage: "Buying stage",
  engagement_trend: "Engagement trend",
  activity_trend_flag: "Activity trend",
};

/** The three channels, and the tone each card carries. */
export const CHANNEL_LABEL: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  EMAIL: "Email",
  PHONE: "Phone",
};

/**
 * The same three channels, named as the *dimension* a channel row reports.
 *
 * `StateDimensionGrid` heads every row by the dimension it reports — "Relationship",
 * "Conversation", "Buying stage" — so a channel row has to name availability rather
 * than the channel. `CHANNEL_LABEL` names the subject, which is right for a card, a
 * chip or a column heading and wrong for a `<dt>`: with it, the grid heads a row
 * "LinkedIn" while `ChannelIntelligencePanel` heads a column "LinkedIn" on the same
 * prospect page, and one string stands for two different facts on one screen.
 *
 * A channel missing from this table falls back to `CHANNEL_LABEL`, which is the
 * convention every table in this file follows: an unmapped key is a display gap, not
 * a licence to invent a string.
 */
export const CHANNEL_AVAILABILITY_LABEL: Record<string, string> = {
  LINKEDIN: "LinkedIn availability",
  EMAIL: "Email availability",
  PHONE: "Phone availability",
};

export const CHANNEL_TONE: Record<string, string> = {
  LINKEDIN: "sky",
  EMAIL: "indigo",
  PHONE: "teal",
};

/**
 * Confidence, spelled out.
 *
 * "Low" alone next to a number invites the reader to ignore it; "Low confidence"
 * says what is low. The tone is decoration — the text carries the meaning (R18.9).
 */
export const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
  HIGH: "High confidence",
};

export const CONFIDENCE_TONE: Record<string, string> = {
  LOW: "zinc",
  MEDIUM: "amber",
  HIGH: "emerald",
};

/**
 * The coded next-move labels `channel_recommendation.py` emits.
 *
 * Every `HOLD_*` label says why we are holding, because "do nothing" is only
 * useful advice when the reason travels with it.
 */
export const RECOMMENDATION_LABEL: Record<string, string> = {
  HOLD_INSUFFICIENT_DATA: "Hold — too little observed to recommend a channel",
  HOLD_PROSPECT_CLOSED: "Hold — this prospect is closed",
  HOLD_CHANNEL_UNREACHABLE: "Hold — no channel is reachable",

  LINKEDIN_CONNECT_FIRST: "Connect on LinkedIn first",
  LINKEDIN_AWAIT_CONNECTION: "Wait for the invitation to be accepted",
  LINKEDIN_WARMUP_MESSAGE: "Send a warm-up message on LinkedIn",
  LINKEDIN_FOLLOW_UP: "Follow up on LinkedIn",
  LINKEDIN_CONTINUE_CONVERSATION: "Continue the LinkedIn conversation",
  LINKEDIN_MEETING_ASK: "Ask for a meeting on LinkedIn",
  LINKEDIN_AWAIT_MEETING_RESPONSE: "Wait for a response to the meeting ask",
  LINKEDIN_MEETING_BOOKED: "Meeting booked — prepare for it",

  EMAIL_FIRST_TOUCH: "Open with an email",
  EMAIL_FOLLOW_UP: "Follow up by email",
  PHONE_DIRECT_CALL: "Call them",
  PHONE_FOLLOW_UP_CALL: "Follow up with a call",
};

/**
 * Factor names for a reasoning list.
 *
 * The twelve channel-scoring factors from `scoring_tables.FACTOR_KEYS`, plus the
 * five CTA components from `cta_readiness.COMPONENT_KEYS` — one table because a
 * reasoning row reads the same either way.
 */
export const FACTOR_LABEL: Record<string, string> = {
  icp_match: "ICP match",
  intent_class: "Intent",
  acv_tier: "ACV tier",
  signal_strength: "Signal strength",
  signal_recency: "Signal recency",
  linkedin_activity_level: "LinkedIn activity",
  email_available: "Email address",
  phone_available: "Phone number",
  prior_interaction_count: "Prior interactions",
  prior_interaction_outcomes: "Prior outcomes",
  relationship_state: "Relationship",
  seniority: "Seniority",

  reply: "Reply so far",
  stage: "Conversation stage",
  depth: "Exchange depth",
  relationship: "Relationship",
  recency: "Engagement recency",
};

/**
 * Which way a factor pulled a score.
 *
 * `UNAVAILABLE` reads "Not observed" rather than "None": the factor was not seen,
 * which is why it was dropped from the weight mass instead of scored at zero (R1.7).
 */
export const DIRECTION_LABEL: Record<string, string> = {
  RAISES: "Raises",
  LOWERS: "Lowers",
  NEUTRAL: "Neutral",
  UNAVAILABLE: "Not observed",
};

export const DIRECTION_TONE: Record<string, string> = {
  RAISES: "emerald",
  LOWERS: "rose",
  NEUTRAL: "zinc",
  UNAVAILABLE: "zinc",
};

/** `scoring_tables.RECOMMENDED_CTA_BY_STATE` values, in words. */
export const RECOMMENDED_CTA_LABEL: Record<string, string> = {
  CONTINUE_WARMUP: "Keep warming the conversation up",
  SOFT_INTEREST_CHECK: "Test interest gently",
  DIRECT_MEETING_ASK: "Ask for the meeting",
  AWAIT_RESPONSE: "Wait for their response",
  NONE: "Nothing to ask — the meeting is booked",
};

/**
 * `cta_readiness.DECIDED_BY_*` — whether the score band or an evidence gate
 * produced `cta_state`. The meeting states are mirrors of the reconciled
 * `conversation_state` and are never reached by a score (R9.4), and the label says
 * so.
 */
export const CTA_DECIDED_BY_LABEL: Record<string, string> = {
  CONVERSATION_STATE_MEETING_BOOKED: "Observed booking",
  CONVERSATION_STATE_MEETING_REQUESTED: "Observed meeting request",
  NEXT_ACTION_SUPPRESSED: "Outreach suppressed by a reply",
  CTA_SCORE_BAND: "Readiness score band",
};

// ─── Action toast copy (R12.3, R13.3) ─────────────────────────────────────────

/**
 * What Weez says after an action control runs.
 *
 * These live beside `GTM_ACTION_LABELS` for the same reason the labels do: the
 * honesty rule they carry has to be checkable in one place. `OPENED` is the
 * sensitive one — the click opened a tab and copied some text, and that is the
 * entire claim it is allowed to make. It reports that LinkedIn was *opened*, never
 * that a message was sent, because Weez did not send one and cannot know whether
 * the operator did until something is observed in the thread.
 *
 * `CONFIRMED_SENT` attributes the claim to the operator ("you sent it") rather than
 * asserting it as an observation, because that is exactly what it is: a human
 * confirmation, which the server records under `HUMAN_CONFIRMATION` and the
 * reconciler weighs like any other evidence.
 */
export const GTM_ACTION_TOASTS = {
  OPENED: "LinkedIn opened. Paste the message there and send it yourself.",
  COPIED: "Message copied. Paste it into LinkedIn.",
  COPY_FAILED: "Couldn't reach the clipboard — select the message and copy it.",
  CONFIRMED_SENT: "Recorded that you sent it in LinkedIn.",
  PREPARE_FAILED: "Couldn't prepare the message",
} as const;
// ─── Timeline labels (R17.4, R17.6, R18.6) ────────────────────────────────────

/**
 * What the reconciler decided about a transition, in words.
 *
 * The three `REJECTED_*` outcomes are the reason this table exists. A refused
 * transition is still a recorded event — "a late or unevidenced observation
 * arrived and was declined" is information the operator wants — so each one names
 * *why* it was refused rather than disappearing into a generic failure. The
 * server's `summary` carries the specific values and timestamps; this label is the
 * class of refusal, rendered as text beside it and never as a tooltip alone.
 *
 * `DUPLICATE` is not a refusal: the same fact was observed twice and the second
 * observation changed nothing, which is the system working.
 */
export const EVENT_OUTCOME_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  RECORDED: "Recorded",
  CORRECTED: "Corrected from a later observation",
  DUPLICATE: "Already recorded",
  REJECTED_NO_EVIDENCE: "Declined — no evidence",
  REJECTED_STALE: "Declined — evidence older than the current value",
  REJECTED_ILLEGAL: "Declined — transition not permitted",
};

/**
 * The tone each outcome carries. The three refusals and `DUPLICATE` are `zinc`:
 * muted, because a declined transition is a footnote in the record rather than an
 * error the operator has to act on (R18.6). Nothing here is rose — a refusal is
 * the guard doing its job, not a failure.
 */
export const EVENT_OUTCOME_TONE: Record<string, string> = {
  APPLIED: "emerald",
  RECORDED: "zinc",
  CORRECTED: "amber",
  DUPLICATE: "zinc",
  REJECTED_NO_EVIDENCE: "zinc",
  REJECTED_STALE: "zinc",
  REJECTED_ILLEGAL: "zinc",
};

/** The outcomes that render muted, with their reason visible. */
export const MUTED_OUTCOMES: readonly string[] = [
  "REJECTED_NO_EVIDENCE",
  "REJECTED_STALE",
  "REJECTED_ILLEGAL",
  "DUPLICATE",
];

/** The dimension a transition entry moved, named as the screen names it elsewhere. */
export const DIMENSION_LABEL: Record<string, string> = {
  relationship_state: "Relationship",
  conversation_state: "Conversation",
  conversation_stage: "Stage",
  execution_state: "Execution",
  activity_level: "Activity",
};

/**
 * The timeline's own chrome.
 *
 * `LOAD_EARLIER` is the paging control's label and says which direction it walks:
 * the first page is the newest activity, and each further page is strictly earlier
 * (R18.6). `EMPTY` states the absence rather than filling it — a prospect with no
 * recorded activity has none, and inventing a placeholder entry would be the same
 * mistake as substituting a value for UNKNOWN.
 */
export const TIMELINE_LABELS = {
  LIST: "Prospect activity timeline",
  LOAD_EARLIER: "Load earlier activity",
  LOADING: "Loading prospect activity",
  LOADING_EARLIER: "Loading earlier activity",
  EMPTY: "No activity recorded yet",
  RETRY: "Try again",
  EVIDENCE_PREFIX: "Evidence: ",
  OBSERVED_PREFIX: "observed ",
} as const;

// ─── Page labels (R18.4, R18.7, R18.8) ────────────────────────────────────────
//
// The chrome `pages/GTMProspect.tsx` owns: the page heading, the live status line,
// the loading and failure copy, and the entry action that reaches this page from
// `pages/ProspectIntelligence.tsx`. Appended here for the same reason every other
// table lives here — the page composes panels and must not be the one place a
// user-visible string is inlined.
//
// `pageTitle` is the page's single `<h1>`. It is a static title rather than the
// prospect's name because the heading has to exist in all four states the page can
// be in — loading, loaded, failed, and unknown-heavy — and a name is a fact that
// may read "Unknown". The name is rendered beside it by `ProspectHeader` through
// `ObservedValue`, which is the only thing allowed to render a fact.
//
// `statusLoading` / `statusRefreshing` are announcements, not claims about the
// prospect: they say what the page is doing. What the *prospect* is doing is the
// server's `displaySummary`, which the status line passes through unchanged.

export const GTM_PAGE_LABELS = {
  // Chrome
  eyebrow: "LinkedIn GTM",
  /**
   * "Prospect execution", not "Relationship intelligence".
   *
   * This page is where a decision gets carried out: the draft, the channel, the confirm
   * ladder, the outcome. The *intelligence* — the stage, the state, the next best action
   * and its evidence — is on Prospect Intelligence, which is where an operator now
   * activates and decides. Calling this page "Relationship intelligence" made it read as a
   * second, competing intelligence destination, which is exactly the framing the
   * restructure removes: Activate Intelligence is a state transition, not a place.
   */
  pageTitle: "Prospect execution",
  subtitle: "What we observed, what it means, and the next move",
  timelineTitle: "Activity timeline",
  backToProspects: "Back to Prospect Intelligence",

  /**
   * The entry into this page, from the Prospect Intelligence dossier and from an Action
   * Queue row.
   *
   * Named for the destination — the prospect's own page — rather than for a product
   * concept. It used to read "Relationship intelligence" at both call sites, which promised
   * an intelligence surface and delivered an execution one.
   */
  entryAction: "Open prospect",

  // Live-region announcements about the page itself.
  statusLoading: "Loading prospect intelligence",
  statusRefreshing: "Refreshing prospect intelligence",
  statusReady: "Prospect intelligence loaded",

  // Failures. Each names what could not be done, and each has a working retry
  // except the one that has nothing to retry.
  loadFailedTitle: "Couldn't load this prospect",
  refreshFailedToast: "Couldn't refresh this prospect",
  refreshedToast: "Prospect intelligence refreshed",
  reevaluateFailed: "Couldn't re-evaluate the channels",
  reevaluatedToast: "Channels re-evaluated",
  retry: "Try again",

  /**
   * Reached without a prospect. Not an error to retry — the route is missing the
   * `lead_id` it needs, so the copy says where the page is opened from instead of
   * offering a control that would fail again.
   */
  noLeadTitle: "No prospect selected",
  noLeadBody:
    "Open this page from a decision-maker in Prospect Intelligence, so it knows which prospect to read.",

  // ── Honest empties for absent intelligence (R26.7) ──
  //
  // The prospect payload carries the state engine's reading when there is one, and
  // drops those keys entirely when the prospect has no belief, an incomplete belief,
  // or no evaluation. Absence is therefore a normal condition and not a failure: it
  // gets a sentence, never an alert, never a retry, and never a zero standing in for
  // a value nobody read.
  //
  // Both strings are in the two-clause form `GTM_UI_LABELS.noEvaluation` established
  // — what is absent, then what that means — and neither apologises or promises a
  // reading later. They say what has not happened, in the present tense, and stop.
  //
  // They are notes *about a section*, not about a dimension: a dimension nobody
  // observed already reads "Unknown" through `ObservedValue`, which is a different
  // claim. "Unknown" means a belief exists and places nothing here; these mean no
  // belief was read at all.
  noStateBelief: "No journey or timing reading yet. Nothing has been observed beyond the dimensions below.",
  noIntelligenceRead:
    "No intent, buying stage or channel reading yet. Nothing has been evaluated for this prospect.",
} as const;

// ─── Prospect state engine labels (R27.7, R27.3) ──────────────────────────────
//
// Six more dictionaries, in the shape every table above is in: a key the server
// sent, a string a human reads. They cover the vocabularies the state engine adds
// — the Journey_State_Projection, the eleven Intent_Types, the thirteen
// Candidate_Action types, the nine exclusion reasons, the eleven lifecycle
// positions, and the Action_Queue's four priority tiers.
//
// `Record<string, string>` throughout, for the reason the panel tables above give:
// the lookup site renders the raw value on a miss, so an open key type means a
// value the backend adds tomorrow renders as itself rather than failing to
// type-check today. None of these keys is typed in `services/gtmAPI.ts` as a union
// yet, and none of them needs to be for a lookup to be safe.
//
// **The send rule, restated for the action vocabulary.** Weez sends nothing. Every
// label below that touches a channel follows the convention `GTM_ACTION_LABELS`
// established — `Open <channel> & <verb>`, naming both halves and leaving the
// dispatch with the operator — and every other label is either a recommendation
// ("Wait", "Nurture") or a report of something observed ("Warm-up seen in thread",
// "Channel opened"). No entry states or implies that Weez performed a send, and
// none reads as a completed send at all: `WARMUP_SENT` is "Warm-up seen in thread"
// for exactly that reason, the same wording `STATE_LABEL` already uses for it.
//
// These tables are appended rather than folded into the maps above because the
// R12.2 scan walks `GTM_ACTION_LABELS` exhaustively and its guarantee depends on
// that object holding the control labels and only those. A recommendation label is
// not a control label.

/**
 * The 21-value Journey_State_Projection, in the journey's own order.
 *
 * A projection and never a dimension (R9.2): the value is recomputed from the
 * dimensions on every read, so the label is a summary of where the prospect
 * stands, not a fact with its own evidence. The dimension grid beside it is what
 * carries the evidence.
 *
 * `CONNECTION_PENDING`, `AWAITING_REPLY` and `WARMUP_SENT` deliberately reuse the
 * wording `STATE_LABEL` already gives them, so the same situation does not read
 * two different ways on one screen.
 */
export const GTM_JOURNEY_LABELS: Record<string, string> = {
  // Qualification
  NEW: "New",
  IDENTIFIED: "Identified",
  QUALIFIED: "Qualified",
  DISQUALIFIED: "Disqualified",
  RESEARCH_NEEDED: "Research needed",

  // Relationship
  NOT_CONNECTED: "Not connected",
  CONNECTION_REQUESTED: "Invitation requested",
  CONNECTION_PENDING: "Invitation pending",
  CONNECTION_REJECTED: "Not accepted",
  CONNECTED: "Connected",

  // Conversation
  NO_ENGAGEMENT: "No engagement",
  WARMUP_SENT: "Warm-up seen in thread",
  AWAITING_REPLY: "Waiting for reply",
  NO_RESPONSE: "No response yet",
  CONVERSATION_ACTIVE: "Conversation active",
  DISCOVERY: "Discovery",
  MEETING_REQUESTED: "Meeting requested",
  MEETING_BOOKED: "Meeting booked",

  // Regression and terminal
  NURTURE: "Nurture",
  DORMANT: "Dormant",
  DO_NOT_CONTACT: "Do not contact",
};

/**
 * The eleven Intent_Types.
 *
 * Eleven records per prospect rather than one label, because a hiring signal is
 * not a buying signal (R5.1). An unsupported type is materialised at value zero
 * and confidence zero rather than left absent (R5.5), so every key here always has
 * a row to label — a zero is "nothing observed for this intent", which is why the
 * value beside the label needs its confidence to be readable too.
 */
export const GTM_INTENT_LABELS: Record<string, string> = {
  BUYING: "Buying",
  HIRING: "Hiring",
  FUNDING: "Funding",
  EXPANSION: "Expansion",
  PRODUCT_LAUNCH: "Product launch",
  PAIN_PROBLEM: "Pain or problem",
  RESEARCH: "Research",
  COMPETITOR: "Competitor",
  ENGAGEMENT: "Engagement",
  CONVERSATION: "Conversation",
  MEETING: "Meeting",
};

/**
 * The thirteen Candidate_Action types, in catalog order.
 *
 * Every one is a *recommendation*, and the labels say so. The six channel-touching
 * types carry the `Open <channel> & <verb>` form `GTM_ACTION_LABELS.SEND_MESSAGE`
 * established — the conjunction is load-bearing in the same way it is there,
 * because it names the tab Weez opens and leaves the sending with the operator.
 * `REQUEST_MEETING` and `CONNECT_LINKEDIN` reuse that table's strings outright,
 * since they are the same move under a different vocabulary.
 *
 * `WAIT` and `RESEARCH_MORE` are the floor of the catalog, not the absence of a
 * recommendation, so neither reads as an empty state: "do nothing yet" and "find
 * out more" are answers.
 */
export const GTM_NBA_ACTION_LABELS: Record<string, string> = {
  // Outreach
  CONNECT_LINKEDIN: GTM_ACTION_LABELS.CONNECT,
  SEND_LINKEDIN_WARMUP: "Open LinkedIn & Send a warm-up",
  SEND_LINKEDIN_FOLLOWUP: "Open LinkedIn & Send a follow-up",
  SEND_EMAIL: "Open email & Send a first touch",
  SEND_EMAIL_FOLLOWUP: "Open email & Send a follow-up",
  CALL: "Call them",

  // The floor — neither touches a channel, neither has a precondition.
  WAIT: "Wait — nothing to do yet",
  RESEARCH_MORE: "Find out more first",

  // Conversation moves, on a thread that is already open.
  CHANGE_MESSAGE_ANGLE: "Open LinkedIn & Try a different angle",
  ASK_DISCOVERY_QUESTION: "Open LinkedIn & Ask a discovery question",
  REQUEST_MEETING: GTM_ACTION_LABELS.MEETING_REQUEST,

  // Retreat
  NURTURE: "Nurture — keep them warm without asking",
  STOP_OUTREACH: "Stop outreach",
};

/**
 * The nine exclusion reasons.
 *
 * A held candidate is generated and then excluded with its reason recorded, never
 * dropped (R13.3) — which is only useful if the reason travels with it, so every
 * label names *why*, in the same spirit as the `HOLD_*` entries in
 * `RECOMMENDATION_LABEL`.
 *
 * `STATE_STALE_DEPRIORITISED` is the one that is not a refusal: the action is still
 * admissible, it just ranks below a fresher one, and the label says "deprioritised"
 * rather than "held" so a reader does not go looking for a block that is not there.
 */
export const GTM_EXCLUSION_LABELS: Record<string, string> = {
  DO_NOT_CONTACT: "Held — this prospect is marked do-not-contact",
  CHANNEL_UNAVAILABLE: "Held — that channel isn't reachable",
  COOLDOWN_ACTIVE: "Held — cooling down after a recent touch",
  USER_SUPPRESSED: "Held — you suppressed this action",
  NEXT_ACTION_SUPPRESSED: "Held — outreach suppressed by a reply",
  FREQUENCY_CAP: "Held — the frequency cap is reached",
  PRECONDITION_UNMET: "Held — doesn't apply in the current state",
  INSUFFICIENT_CONFIDENCE: "Held — too little confidence to recommend it",
  STATE_STALE_DEPRIORITISED: "Deprioritised — the state is stale",
};

/**
 * The eleven lifecycle positions.
 *
 * `CLICKED` and `STARTED` are the sensitive pair. Both mean a human asked for the
 * action and a tab opened, and neither is allowed to read as the action having
 * happened (R27.3) — so they borrow the wording `STATE_LABEL` already gives the
 * execution states they map onto, "Action requested" and an opened channel, and
 * stop there.
 *
 * `EXECUTED` attributes its claim to the operator the way `SURFACE_LABEL`'s
 * `HUMAN_CONFIRMATION` does: it is a human confirmation the reconciler weighs like
 * any other evidence, not an observation. Only `CONFIRMED` reads as settled,
 * because only `CONFIRMED` required an observation surface or a confirmation to
 * reach (R18.4).
 *
 * `CANCELLED` retires the *recommendation* and touches no action, which is why it
 * reads "dismissed" rather than "cancelled" — an attempt the operator abandoned
 * after clicking is `FAILED`, and the two must not read the same.
 */
export const GTM_LIFECYCLE_LABELS: Record<string, string> = {
  RECOMMENDED: "Recommended",
  VIEWED: "Shown to you",
  CLICKED: "Action requested",
  STARTED: "Channel opened",
  EXECUTED: "You said you did it",
  CONFIRMED: "Confirmed",
  FAILED: "Action failed",
  CANCELLED: "Recommendation dismissed",
  EXPIRED: "Expired untouched",
  SYSTEM_OBSERVED: "Something was observed",
  OUTCOME_RECEIVED: "Outcome recorded",
};

/**
 * The Action_Queue's four priority tiers, most urgent first.
 *
 * A band over the six inputs R27.6 names, not a score, so it carries no
 * disclaimer — the Action_Confidence rendered beside it is the number that does
 * (R27.7). The tone is decoration; the text carries the meaning (R18.9).
 */
export const GTM_PRIORITY_TIER_LABELS: Record<string, string> = {
  NOW: "Now",
  TODAY: "Today",
  THIS_WEEK: "This week",
  LATER: "Later",
};

// ─── LinkedIn identity and tracking (R30.7, R3.2, R14.2) ──────────────────────
//
// Three more dictionaries and one control table, in the shape every table above is
// in: a key the server sent, a string a human reads. They cover the two steps that
// come *before* everything else on this page — find out who this person is on
// LinkedIn, then decide whether Weez should watch them.
//
// **Why these strings do not join `STATE_LABEL`.** They cannot. `STATE_LABEL`
// already carries `VERIFIED`, where it is an `execution_state` and means "the
// outcome of a requested action was confirmed". An identity verdict of `VERIFIED`
// means "a profile page was opened and compared against what the lead row claims".
// Same token, two unrelated facts, and `STATE_LABEL` is flat precisely because its
// vocabularies do *not* collide. So the identity vocabulary gets its own table, and
// the panel resolves the string before handing it to `ObservedValue` — which finds
// nothing for it in `STATE_LABEL` and renders it as given, exactly as the
// unmapped-key convention at the top of this file describes.
//
// **The four states are four different claims, and the fourth is the one that
// matters.** `VERIFIED`, `POSSIBLE_MATCH` and `NO_MATCH` all mean *an attempt ran*.
// Absence — a null verdict, which is how every lead starts — means **nobody has
// tried**, and it gets its own entry under `UNRESOLVED` rather than borrowing
// `NO_MATCH`'s. `models/lead.py` states the prohibition at the column ("Do not
// backfill NULL to NO_MATCH — a lead nobody has tried to enrich has not failed
// enrichment") and this table is the screen's half of it: rendering "we found no
// matching profile" for a lead nobody searched for would be Weez reporting the
// result of work it never did.

/**
 * The identity verdict, in words. Four keys, four different claims.
 *
 * `NO_MATCH` says an attempt ran, so it is written as a report of that attempt —
 * "we looked" is load-bearing. `UNRESOLVED` is the absence of an attempt and says
 * so without using the word "no", because "no match" is the claim it must not be
 * confused with. `POSSIBLE_MATCH` names the ambiguity rather than resolving it in
 * either direction: a candidate was found and it was not confirmed, and an operator
 * reading this should understand that acting on it is their judgement and not ours.
 */
export const GTM_VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "LinkedIn profile verified",
  POSSIBLE_MATCH: "Possible match — not confirmed",
  NO_MATCH: "We looked and found no matching profile",
  UNRESOLVED: "LinkedIn identity not yet resolved",
};

/**
 * The tone each verdict carries. Decoration only — the text carries the meaning
 * (R18.9), and every chip built on this pairs the tone with the label above.
 *
 * `NO_MATCH` and `UNRESOLVED` are both `zinc` on purpose. Neither is a failure: one
 * is a search that came back empty and the other is a search nobody has run, and
 * rose would tell an operator to go and fix something. What tells them apart is the
 * sentence, not the colour.
 */
export const GTM_VERIFICATION_TONE: Record<string, string> = {
  VERIFIED: "emerald",
  POSSIBLE_MATCH: "amber",
  NO_MATCH: "zinc",
  UNRESOLVED: "zinc",
};

/**
 * Whether Weez is watching this prospect. Three keys, and there is no fourth.
 *
 * **There is deliberately no `PAUSED` and no `STOPPED`.** Neither is expressible:
 * nothing in the schema records "is this prospect tracked" — the presence of the
 * profile row *is* the flag — so `TrackProspectOut.tracking_state` has exactly one
 * member, `TRACKING`, and a payload only exists once the rows do. Expressing a
 * paused state would need a new column and a new engine to honour it. A label for a
 * state nothing can reach would be a promise the product cannot keep: an operator
 * who saw "Paused" would reasonably look for the control that resumes it, and there
 * is none, because there is nothing to resume.
 *
 * So the three here are the three a screen can actually be in. `TRACKING` is the
 * server's own value. `NOT_TRACKING` and `UNRESOLVED` are what the *absence* of
 * tracking looks like, split in two because they need different things next:
 * `NOT_TRACKING` is a verified prospect nobody has clicked Track on yet, and
 * `UNRESOLVED` is a prospect who cannot be tracked at all until their identity is
 * settled. One is a decision waiting to be made, the other is a precondition that
 * has not been met.
 */
// The user-facing concept is **Activate Intelligence**, not tracking. Internally the
// row is still `li_gtm_profiles` and the route is still `/track`, and that is fine —
// but an operator is not deciding whether to "track a person", they are deciding
// whether they want Weez to keep understanding this prospect and tell them when and
// how to act. The three states below are the same three the server can be in; only
// the sentences changed.
export const GTM_TRACKING_STATE_LABELS: Record<string, string> = {
  TRACKING: "Intelligence active",
  NOT_TRACKING: "Intelligence not activated",
  UNRESOLVED: "Needs a confirmed LinkedIn profile first",
};

export const GTM_TRACKING_STATE_TONE: Record<string, string> = {
  TRACKING: "emerald",
  NOT_TRACKING: "zinc",
  UNRESOLVED: "zinc",
};

/**
 * The identity block's own chrome: its field labels, its two controls, and one
 * refusal sentence per case the track route actually refuses.
 *
 * **The two controls describe what happens, not what Weez achieves.** `resolve` is
 * "Enrich Now" because that is what the operator is asking for and the honest
 * report of it is that a search was *queued* — the API process navigates nothing,
 * a job row lands in the queue and the LinkedIn VM does the work later. So
 * `resolveQueued` says a search was queued and `resolveDeduped` says an identical
 * one already was, and neither claims a profile was found. `track` is "Track
 * Prospect", which is a decision the operator makes rather than an action Weez
 * performs on LinkedIn, and no string here is or could be a send.
 *
 * **`candidateUrl` is the honesty rule of this whole block.** A lead can arrive
 * from a data provider carrying a LinkedIn address, and landing that address in
 * `sales_leads.linkedin_url` says nothing about whether that profile is this
 * person. So a url beside an unresolved verdict is labelled a candidate and
 * `candidateNote` says why, in words, next to it. Only `verifiedUrl` — reachable
 * only from a `VERIFIED` verdict with a verification instant — calls a url this
 * prospect's profile.
 *
 * **`cannotTrack` has one entry per 409 the route returns**, because the four
 * refusals call for four different things on screen. `unresolved` needs Enrich Now.
 * `possibleMatch` and `noMatch` are attempts that ran, so they say what the attempt
 * concluded rather than suggesting the operator try the same thing again — and they
 * are two sentences, not one, because "we found somebody we could not confirm" and
 * "we found nobody" are different situations for a human to act on. `noAddress` is
 * the defensive case a verdict with no url produces, and `unrecognised` is the
 * fourth-verdict case: a status the screen does not know, reported as unknown rather
 * than guessed at.
 */
export const GTM_IDENTITY_LABELS = {
  // Field labels, read by `ObservedValue` in this block.
  verificationField: "LinkedIn identity",
  trackingField: "Intelligence",
  confidenceField: "Match confidence",

  // Controls.
  //
  // `resolve` is deliberately NOT called "Enrich Now" any more. It used to be, and the
  // result was two controls in the product with one name doing two different things:
  // Market Intelligence's Enrich Now is `evaAPI.enrichLead` — the priced action that
  // finds the contact, resolves the identity and promotes the prospect — while this one
  // is `gtmAPI.resolveIdentity`, a re-run of the LinkedIn search alone on a prospect
  // already enriched. Naming it after what it does keeps the journey's one Enrich Now
  // step unambiguous.
  resolve: "Find their LinkedIn profile",
  resolving: "Resolving identity",
  track: "Activate Intelligence",
  tracking: "Activating intelligence",

  /**
   * The positioning, rendered beside the control rather than left to be inferred.
   *
   * `trackHeadline` is the promise in one line and `trackBody` is what the product
   * actually does to keep it. Both exist because the choice between contacting somebody
   * now and paying to understand them first is the central decision in this product, and
   * an operator should be able to make it in a few seconds without being told how the
   * state engine works.
   *
   * Neither mentions a duration. There is no activation expiry in this product —
   * `TrackProspectOut` carries no expiry field, the profile row's existence *is* the
   * flag, and there is deliberately no pause and no stop. So the copy says "continuously"
   * and stops; "30 days of Prospect Intelligence" would be a window nothing enforces and
   * a countdown nothing counts.
   */
  trackHeadline: "Find out Who, How, and Why Now before reaching out.",
  trackBody:
    "Weez continuously monitors this prospect's signals, evolves their prospect state, and recommends the next best action.",

  // What each control actually did. Neither claims more than a queued job.
  resolveQueued: "Looking for their LinkedIn profile. The result lands on the next read.",
  resolveDeduped: "Already looking — an identical search is queued for this lead.",
  resolveFailed: "Couldn't ask for an identity search",

  /**
   * The state transition, not a receipt.
   *
   * Activation is the moment the prospect stops being a contact record and starts being
   * an intelligent one, so the copy names the transition and then says what happens next.
   * A bare "Activated" would leave the operator looking at empty state and NBA sections
   * wondering whether they had bought something broken — which is exactly what the
   * `waitingForSignals` state below exists to answer.
   */
  tracked: "Intelligence activated.",
  trackedNext:
    "We're observing this prospect and building their evolving profile. Next: we'll surface the right moment and recommend what to do.",
  alreadyTracking: "Intelligence is already active for this prospect — nothing changed.",
  // Activation queues two reads at the click — the profile page and the activity feed —
  // rather than leaving the first activity observation to a 180-minute staleness sweep.
  // Saying so matters: the operator has just paid for intelligence, and "we have started
  // looking" is the difference between a product that feels asleep and one that does not.
  observationQueued: "Reading their profile and recent activity now.",
  observationNotQueued:
    "Intelligence is active, but no read could be queued yet — the next sweep will pick them up.",
  trackFailed: "Couldn't activate intelligence for this prospect",

  // The url, and the two very different things it can be.
  verifiedUrl: "Verified profile",
  candidateUrl: "Unverified candidate profile",
  candidateNote:
    "A provider gave us this address and nothing has checked it. It may not be this person, so it is not their confirmed profile.",

  /** One sentence per 409 the track route returns. */
  cannotTrack: {
    unresolved:
      "Nobody has looked for this person on LinkedIn yet. Intelligence needs a profile we have actually confirmed before it can observe anyone.",
    possibleMatch:
      "We found a candidate and could not confirm it is them. Activating on an unconfirmed profile would attach everything we learn to the wrong person.",
    noMatch:
      "We looked and found no matching profile, so there is nobody to observe. Their details may need correcting before another search is worth running.",
    noAddress:
      "The identity is confirmed but no profile address came with it, so there is no page to observe.",
    unrecognised:
      "This lead's identity verdict isn't one this screen knows how to read, so activation is held rather than guessed at.",
  },
} as const;

/**
 * The lifecycle a prospect moves through, and the one sentence each stage earns.
 *
 * This is the spine of the restructured Prospect Intelligence surface: the page renders
 * the same prospect very differently depending on which of these it is in, and this table
 * is the single statement of what each one is called and what it means.
 *
 * **Every stage here is derivable from a field the backend already sends.** Nothing is a
 * guess and nothing is a timer:
 *
 *   `ENRICHING`      a request is in flight. The only stage that is about this page rather
 *                    than about the prospect.
 *   `RESOLVING`      `linkedin_verification_status` is null or unsettled and a search has
 *                    been queued. `resolve-identity` navigates nothing itself, so the
 *                    verdict lands on a later read — which is why this is a stage and not
 *                    a spinner.
 *   `ENRICHED`       the prospect has a contact and a confirmed identity, and no
 *                    `li_gtm_profiles` row. This is the decision point: Contact Directly
 *                    or Activate Intelligence.
 *   `ACTIVATING`     the track request is in flight.
 *   `WAITING`        the profile row exists — intelligence is active — but no belief has
 *                    been folded yet. Bright Data observation is asynchronous, so this is
 *                    a real and expected stage that can last a while, and it is the one
 *                    the product most needs to name. An empty state panel here is not a
 *                    fault, and saying nothing would make it look like one.
 *   `ACTIVE`         a belief exists. EPS reads, evidence reads, no recommendation yet.
 *   `RECOMMENDED`    an evaluation has run and `recommended` is non-null. The NBA is on
 *                    screen and there is something to do.
 *
 * There is no `EXPIRED` and no `PAUSED`, for the reason `GTM_TRACKING_STATE_LABELS` gives:
 * neither is expressible in this backend.
 */
export const PROSPECT_STAGE_LABELS: Record<string, { label: string; body: string }> = {
  ENRICHING: {
    label: "Enriching",
    body: "Finding this person's contact details and confirming who they are.",
  },
  RESOLVING: {
    label: "Resolving identity",
    body: "Searching LinkedIn for this person. The verdict lands on the next read.",
  },
  ENRICHED: {
    label: "Enriched",
    body: "We know who this is and how to reach them. Choose how you want to proceed.",
  },
  ACTIVATING: {
    label: "Activating intelligence",
    body: "Provisioning this prospect and queueing the first reads.",
  },
  WAITING: {
    label: "Waiting for signals",
    body:
      "Intelligence is active and the first reads are queued. Observation is asynchronous, so their state and recommendation appear here as signals arrive.",
  },
  ACTIVE: {
    label: "Intelligence active",
    body: "We're building this prospect's evolving state. No action is recommended yet.",
  },
  RECOMMENDED: {
    label: "Action recommended",
    body: "Weez has a next best action for this prospect.",
  },
};

/**
 * The connection flow's own chrome: one control, one return prompt, one status
 * check, and the sentences that keep all three honest.
 *
 * **Why this flow is shaped the way it is.** Weez cannot connect on anyone's
 * behalf and cannot see whether a connection exists. Connection degree is rendered
 * relative to whoever is signed in, so no logged-off reader — no scraping vendor,
 * no public fetch — can ever supply it. That leaves the operator, who did the thing
 * in their own browser, as the only witness. Every string below exists to ask them
 * a question they can actually answer, and to avoid claiming anything they did not
 * say.
 *
 * **`send` opens LinkedIn and stops there.** The label is "Send Connection
 * Request", which is what the operator is about to go and do — not what Weez does.
 * Clicking it records an intent and hands back their profile url. It moves no
 * relationship state, because a click proves somebody asked and proves nothing
 * about LinkedIn.
 *
 * **`askOnReturn` is a question, not a confirmation.** This is the load-bearing
 * string of the whole flow. Returning to the tab does not prove an invitation was
 * sent: the operator may have closed it, hit the wrong profile, been rate-limited,
 * or changed their mind. Inferring "Connection Requested" from a mere return would
 * leave a prospect wedged in a pending state that nothing can ever correct, because
 * nothing observed it. So we ask, and the answer is the evidence.
 *
 * **There is a "no" and it writes nothing.** `didNotSend` exists so the honest
 * answer is available and costs nothing. A prompt with only a confirming button is
 * a prompt that manufactures its own answer.
 *
 * **`stillAwaiting` writes nothing either.** Nothing was observed, so there is
 * nothing to assert; the state is already pending and re-stamping it would refresh
 * a staleness clock that ought to keep running. What the operator gets back is the
 * count of days, which is a subtraction over the confirmation's own timestamp and
 * not a stored field.
 *
 * **`accepted` is the sentence that unblocks the rest of the product.** A confirmed
 * connection is the precondition the warm-up action carries, so this is the moment
 * a prospect becomes actionable. It is worth saying plainly rather than as a state
 * name.
 */
export const GTM_CONNECTION_LABELS = {
  // The control, and what it is honestly doing.
  send: "Send Connection Request",
  sending: "Opening their LinkedIn profile",
  sendHint:
    "This opens their profile in a new tab. Send the request there — Weez never clicks anything inside LinkedIn.",
  sendFailed: "Couldn't record the connection request",

  // The prompt on return. A question, deliberately.
  askOnReturn: "Did you send the connection request?",
  askOnReturnWhy:
    "We can't see invitations you send, so we only record it if you tell us. Nothing is saved until you answer.",
  didSend: "Yes, I sent it",
  didNotSend: "No, not yet",

  // The periodic status check, and its two real answers.
  checkStatus: "Has this connection been accepted?",
  checkStatusWhy:
    "LinkedIn does not tell us when someone accepts, and their connection degree is only visible to you. Checking their profile is the only way to know.",
  accepted: "Connection accepted",
  stillAwaiting: "Still awaiting",
  declined: "They declined or it expired",

  // What each answer actually did.
  recordedPending: "Recorded — waiting on them to accept.",
  recordedAccepted:
    "Connection confirmed. Weez can now recommend a warm-up message for this prospect.",
  recordedDeclined: "Recorded. This prospect is no longer awaiting a connection.",
  // Nothing was written, and the copy says so rather than implying a save.
  awaitingAcknowledged: "Nothing changed — we'll ask again in a few days.",
  confirmFailed: "Couldn't record what you told us",
  // Shown when the reconciler declined the assertion. `reason` is appended.
  confirmDeclined: "That change wasn't applied",

  // The pending banner. `{days}` is substituted by the caller.
  pendingFor: "Invitation pending for {days}",
  pendingForOneDay: "Invitation pending since yesterday",
  pendingForToday: "Invitation sent today",
  // Said once the wait has gone on long enough to be worth a decision, and framed
  // as a choice rather than as a failure: an unanswered invitation is ordinary.
  pendingLongEnough:
    "This has been pending a while. If they are not going to accept, marking it declined frees the prospect for another channel.",
} as const;

/**
 * The identity-confirmation block: one question, and the evidence to answer it.
 *
 * **Why a human is asked at all.** `POSSIBLE_MATCH` has always meant "a candidate
 * worth a look that the scorer will not claim on its own" — a verdict designed to be
 * settled by a person. The resolver searches, scores candidates on up to five
 * attributes, picks the strongest, opens the profile, and tries to corroborate what
 * it sees. When that last step fails the verdict is honest rather than optimistic.
 *
 * And the last step fails for reasons that have nothing to do with the person. One
 * real attempt scored a candidate at 80 with name, company and email-domain all
 * matching, then returned `PROFILE_IDENTITY_UNREADABLE` — LinkedIn had renamed a CSS
 * class. The identity was never in question. That is what this block exists for:
 * a two-second judgement a person makes better than a selector.
 *
 * **`confirmHint` is the load-bearing string.** It tells the operator to actually
 * open the profile before answering. A confirmation button next to a name is a
 * button people press without looking; a confirmation button next to "open it and
 * check" is a decision. The whole value of this surface is that a human really
 * looked, so the copy has to ask for that and not merely imply it.
 *
 * **`reject` is not a cancel and does not say "cancel".** It records that somebody
 * looked and this is a different person — a finding worth keeping, and the only way
 * that fact ever enters the system. The labels avoid dismissive words for it because
 * a rejection is as much of an answer as a confirmation.
 *
 * **Nothing here promises tracking.** Confirming makes Track Prospect *offerable*.
 * `confirmed` says the identity is settled and stops there, because provisioning is
 * a separate explicit decision.
 */
export const GTM_IDENTITY_CONFIRM_LABELS = {
  heading: "Is this the right person?",
  // Says why a machine is asking rather than telling.
  why:
    "We found this profile and matched it on the details below, but couldn't read the page itself to be sure. LinkedIn changes its layout often — the match is probably right, but we won't claim it without you.",

  candidateField: "Candidate profile",
  confidenceField: "Match confidence",
  matchedField: "Matched on",

  // Controls. The hint is deliberately an instruction, not reassurance.
  open: "Open profile in a new tab",
  confirmHint:
    "Open the profile and check it's them before answering. Nothing is recorded until you do.",
  confirm: "Yes, this is them",
  confirming: "Recording",
  reject: "No, different person",
  rejecting: "Recording",

  // What each answer did. Neither claims more than it should.
  confirmed:
    "Identity confirmed. You can now track this prospect.",
  rejected:
    "Recorded as a different person. This profile won't be offered again.",
  confirmFailed: "Couldn't record your answer",

  /** One sentence per reason the machine stopped short of verifying. */
  failureReason: {
    PROFILE_IDENTITY_UNREADABLE:
      "The profile page loaded but its layout couldn't be read, so nothing on it could corroborate the match.",
    BELOW_VERIFY_THRESHOLD:
      "The candidate matched, but not on enough attributes for us to claim it alone.",
    NAME_ONLY_NO_CORROBORATION:
      "Only the name matched. A name on its own is a common coincidence, so we won't call it verified.",
    RUNNER_UP_WITHIN_MARGIN:
      "Two candidates scored too closely to separate, so picking one would have been a guess.",
    PROFILE_NOT_VERIFIED:
      "The profile was opened but nothing on it confirmed the match.",
  } as Record<string, string>,

  /** How the resolver describes the way an attribute matched. */
  matchKind: {
    exact: "exact",
    compact: "close",
    domain: "domain",
    token: "partial",
    fuzzy: "approximate",
  } as Record<string, string>,

  /** Field names as a person would say them. */
  attribute: {
    name: "Name",
    company: "Company",
    title: "Job title",
    email_domain: "Email domain",
    location: "Location",
  } as Record<string, string>,
} as const;

// ─── The decision: Contact Directly or Activate Intelligence ──────────────────
//
// The central choice in this product, and the one place the UX has to carry the
// product philosophy without explaining the architecture. An operator reading these
// two cards should be able to choose in a few seconds, and neither card should need
// them to know what a Signal, a belief or a recommendation engine is.
//
// The distinction, in the terms a sales rep actually thinks in:
//
//   Contact Directly       "I already know enough. Help me reach them now."
//   Activate Intelligence  "I don't want to reach out blind. Keep understanding this
//                           prospect and tell me who, how and why now."
//
// Both carry their price in the card, before the click. Neither is styled as the
// default: they are two legitimate answers to a real question, and a product that
// visually pushed one would be answering it for the operator.
//
// **What is deliberately absent.** No duration on the activation card — see
// `GTM_IDENTITY_LABELS.trackHeadline` for why there is no expiry to state. No claim
// that Weez sends anything on the contact card: every path ends in the operator
// opening a channel themselves and copying text, which is what the backend actually
// hands back, and Property 30 in `pages/__tests__/GTMProspect.labels.test.tsx` holds
// this file to it.

export const PROSPECT_DECISION_LABELS = {
  heading: "How do you want to proceed?",

  contact: {
    label: "Contact Directly",
    /** The one-line answer to "which of these am I?" */
    tagline: "I already know enough — help me reach them now.",
    body:
      "Weez drafts a personalised message from what it knows about this prospect. You review it, then open the channel and send it yourself.",
    /** Rendered on the generation control. Free, and said so before the click. */
    generateNote: "Writing the message costs nothing — the credit is for the contact.",
  },

  activate: {
    label: "Activate Intelligence",
    tagline: "I don't want to reach out blind.",
    /** The same two strings the identity block uses, so the pitch cannot drift. */
    headline: GTM_IDENTITY_LABELS.trackHeadline,
    body: GTM_IDENTITY_LABELS.trackBody,
  },
} as const;

/**
 * The Contact Directly flow: pick a channel, draft, review, copy, open.
 *
 * Deliberately lightweight. Choosing to contact somebody must not drop the operator
 * into the EPS/NBA experience — they have already decided, and the only thing they
 * need is something good to say and a way to go and say it.
 *
 * **Channel availability is the server's answer, never a list here.** The backend
 * reports `executable` and `unexecutable_reason` per action, and EMAIL currently comes
 * back `CHANNEL_NOT_IMPLEMENTED` because no adapter is registered for it. So the
 * LinkedIn path is the executable one, and the enriched email address is offered as
 * something to copy rather than as a Weez action that would be refused. `emailNote`
 * is what says so, in words, instead of a disabled button with no explanation.
 */
export const CONTACT_DIRECTLY_LABELS = {
  chooseChannel: "Choose a channel",
  linkedin: "LinkedIn",
  email: "Email",

  emailNote:
    "Weez doesn't send email yet. Copy the address and write from your own inbox — the draft below works either way.",

  generate: "Generate personalised message",
  generating: "Writing the message",
  regenerate: "Rewrite",
  review: "Review before you send",
  copy: "Copy message",
  copied: "Copied",
  openChannel: "Open LinkedIn",

  /**
   * Why generation is unavailable, when it is.
   *
   * Two different absences and they need two different sentences, because the operator's
   * next step differs. `needsActivation` is the `_require_profile` 404: no GTM prospect
   * record exists, and only Activate Intelligence creates one. `needsConversation` is the
   * `_require_conversation` 404: the prospect is activated, but the observation layer has
   * not seen a thread yet, so there is nothing for a draft to attach to.
   *
   * Both are stated rather than hidden. A control that would 404 is not rendered, and the
   * reason it is missing is printed where it would have been.
   */
  needsActivation:
    "Weez needs a GTM record for this prospect before it can draft a message. Activate Intelligence creates one.",
  needsConversation:
    "No LinkedIn thread has been observed for this prospect yet, so there's nothing for a draft to attach to. This clears once Weez has read their profile.",
  generateFailed: "Couldn't draft a message for this prospect",
} as const;

// Empty-state copy is deliberately NOT centralised into one table here.
//
// A first pass at this feature added an `EMPTY_STATE_LABELS` block covering all four
// surfaces, and it was removed before it shipped: every one of those surfaces already
// owns specific, contextual empty copy — `GTM_PAGE_LABELS.noStateBelief` and
// `.noIntelligenceRead` here, `ACTION_QUEUE_LABELS.empty` / `.emptyFiltered` in
// `pages/GTMActionQueue.tsx`, and five distinct `EmptyPanel` states in
// `pages/ProspectIntelligence.tsx` that already tell "discovery has found nothing yet"
// apart from "discovery found forty accounts and none is enriched". A second table
// stating the same things in weaker words would be dead code the day it landed and a
// contradiction the day somebody edited one copy and not the other.
//
// Where empty copy falls short it is fixed where it lives.

// ─── The deeper intelligence, behind disclosures ──────────────────────────────
//
// The four sections below the Next Best Action card on an activated prospect. Each is a
// `<summary>` an operator opens when they want to understand *why*, which is the second
// question — the first is "what should I do", and the NBA card answers that above them.
//
// **These are summaries, not headings.** Every panel behind them already owns its own
// heading naming exactly what it renders, so these strings label the disclosure rather than
// the content: a heading here would either repeat the panel's name or invent a second name
// for the same thing.
//
// **Three of the four fetch their own data, and are mounted only when opened.** `SignalList`,
// `StateHistoryPanel` and `ProspectTimeline` each own a collection, a pager and a failure.
// Mounting them closed would add three requests to every prospect selection for panels
// nobody asked to see. `StateDimensionGrid` reads no route — it renders the payload the page
// already holds — so it needs no disclosure and gets none.
//
// The order is the order the questions arrive: where do they stand, what moved them, what
// did we read, and what happened when.

export const PROSPECT_INTELLIGENCE_SECTIONS = {
  /** No disclosure: this one costs nothing to render. */
  state: "Current state",
  stateNote: "Where this prospect stands, on the evidence.",

  stateHistory: "Why did the state change?",
  stateHistoryNote:
    "Each recorded change, the evidence behind it, and the belief as it stood at any instant.",

  signals: "Supporting signals",
  signalsNote:
    "The observed facts the state was folded from, newest first. An expired signal is still shown — it is retained, and only its influence decays.",

  timeline: "Activity timeline",
  timelineNote:
    "The append-only record for this prospect: state changes, drafts, requested actions and recorded outcomes.",

  /**
   * The heading over the whole region.
   *
   * "Deeper intelligence" rather than "Details": these are the four answers to "why should
   * I believe the recommendation above", and calling them details would suggest they are
   * optional trivia rather than the argument.
   */
  regionHeading: "Deeper intelligence",
  regionNote: "The evidence behind the recommendation. Open what you want to check.",
} as const;
