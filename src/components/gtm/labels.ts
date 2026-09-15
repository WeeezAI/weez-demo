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
// substitutes no meaning for it — an unmapped enum is a display gap, not a licence
// to guess. What is allowed is `humanisedIfToken`, reached through
// `resolveStateValue` and through the four `resolving()` tables, and what it does is
// spelled out where it is defined: it re-cases and de-underscores the server's token,
// which is a typographic transformation of the token and not a reading of it. Every
// other table still returns nothing for a key it does not carry, and its caller still
// renders the value raw.

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

  // ── The three derived profile vocabularies (R8.3) ──
  //
  // `seniority`, `icp_match` and `intent_signal` reach the screen through
  // `ProspectHeader` → `ObservedValue`, which is a *primary* statement and not an
  // evidence disclosure. Until these keys existed every one of them printed its wire
  // value there — `C_LEVEL`, `PASSED`, `HIGH_INTENT_LEAD` — so the rule that a primary
  // statement is made in sales language was broken for every real prospect rather than
  // for an edge case. The values below are the backend's own, not a guess at them.

  // seniority — `li_gtm_profiles.observed_seniority`, the six `scoring_tables.SENIORITY_*`
  // bands. A headline nobody could place yields no value at all, which reads "Unknown"
  // through the shared key above: no band is a stand-in for an unread headline.
  C_LEVEL: "C-level",
  FOUNDER: "Founder",
  VP: "VP",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  IC: "Individual contributor",

  // icp_match — `_qualification_of()`'s verdict. The gate's own two-way answer, used
  // when the persisted criteria carry no booleans; with booleans the verdict travels as
  // "3/5 criteria matched", which is already a sentence and needs no key here.
  PASSED: "Matches your ICP",
  NOT_PASSED: "Doesn't match your ICP",

  // intent_signal — `sales_leads.intent_class`. Three values reach a lead, because gate 3
  // of `lead_scorer.run_three_gate_pipeline` admits only the three `INTENT_SCORE_MAP`
  // scores; the wider comment vocabulary never becomes a lead. Written as what the person
  // did, in the past tense, for the reason `GTM_SIGNAL_TYPE_LABELS` gives: a signal reads
  // as an event about someone rather than as a category they were filed under.
  HIGH_INTENT_LEAD: "Showed buying interest",
  REFERRAL: "Pointed you to someone else",
  QUESTION: "Asked about what you do",
};

// ─── Resolving one dimension value for display (R8.3) ─────────────────────────
//
// The two shapes a backend token arrives in, in the same two patterns the R8.3 scan
// (`pages/__tests__/ProspectDossier.labels.test.tsx`) uses to find one on screen. The
// shape is the whole gate: `STATE_LABEL` is keyed by the vocabularies `schemas/gtm.py`
// sends *today*, and the backend grows a vocabulary before this file learns the word.

/**
 * Two or more upper-snake segments — `NEWLY_DECLARED_STATE`, `PARTNER_INTRO_REQUESTED`.
 * An underscore between two capitalised segments makes a token, never a sentence.
 */
const UPPER_SNAKE_TOKEN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/**
 * The single-segment members of the same unions — `SUPERSEDED`, `UNAVAILABLE`.
 *
 * Four characters is the floor, and it is the floor the R8.3 scan itself uses: the
 * acronyms an operator says out loud — `CTA`, `ICP`, `VP`, `IC` — are what a rep calls
 * the thing, and re-casing one into `Cta` would be a mangling rather than a reading.
 */
const LONE_UPPER_TOKEN = /^[A-Z][A-Z0-9]{3,}$/;

/** How the text beside a fact was produced. */
export type StateValueOrigin =
  /** A curated string from `STATE_LABEL`. */
  | "mapped"
  /** The server's own token, re-cased. Not curated copy — the caller must mark it. */
  | "humanised"
  /** The value exactly as it arrived, because it is not a token shape. */
  | "verbatim";

export interface ResolvedStateValue {
  /** The text to render. */
  text: string;
  /** Where `text` came from, so a caller can keep a humanised value from reading as copy. */
  origin: StateValueOrigin;
}

/** `NEWLY_DECLARED_STATE` → `Newly declared state`. Case and underscores, nothing else. */
function humaniseToken(token: string): string {
  const spaced = token.split("_").join(" ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The humanised form of `value`, or `null` when `value` is not shaped like a token. */
function humanisedIfToken(value: string): string | null {
  if (UPPER_SNAKE_TOKEN.test(value) || LONE_UPPER_TOKEN.test(value)) return humaniseToken(value);
  return null;
}

/**
 * The prototype that makes a label table resolve its own miss.
 *
 * ── Why a table resolves, rather than each caller ──
 *
 * `ObservedValue` is the one primitive allowed to render a fact, and it resolves through
 * `resolveStateValue` below. Four vocabularies do not reach the screen that way: the
 * journey position and the intent rows are read straight out of these tables by
 * `pages/ProspectIntelligence.tsx`, and the action title and the why-now signal by
 * `NextBestActionCard`, each with the `TABLE[value] ?? value` idiom. Humanising at those
 * call sites would put the answer in four places, and a reader — including a test — that
 * asks the table what a value reads as would get a different answer from the screen.
 * `pages/__tests__/ProspectDossier.labels.test.tsx` does exactly that, in the clause that
 * checks an intent row still names its meaning: it derives the expected text as
 * `GTM_INTENT_LABELS[intentType] ?? intentType`. So the table is where the fallback has
 * to live for the screen and the expectation to agree.
 *
 * The trap fires only for a key the table does **not** carry, and only when that key is
 * token-shaped, so every curated string is returned untouched by an ordinary own-property
 * read. `Object.keys`, `Object.entries`, spread and `for…in` see the curated keys and
 * nothing else — which matters, because `IntentPanel` builds its canonical eleven rows
 * from `Object.keys(GTM_INTENT_LABELS)` and a phantom key would become a phantom row.
 */
const RESOLVING_TABLE_PROTO: Record<string, string> = new Proxy(
  Object.prototype as Record<string, string>,
  {
    get(target, key, receiver) {
      if (typeof key === "string") {
        const humanised = humanisedIfToken(key);
        if (humanised !== null) return humanised;
      }
      return Reflect.get(target, key, receiver);
    },
  }
);

/**
 * Mark an open table as resolving: `TABLE[token]` reads `Newly declared state` rather than
 * `undefined`, for a token the table has no copy for.
 *
 * Applied to exactly the four tables a primary statement is read from outside
 * `ObservedValue`. Every other table in this file is untouched and still returns
 * `undefined` for a key it does not carry, which is what keeps its callers' raw fallback
 * meaningful.
 *
 * `STATE_LABEL` is deliberately **not** one of them. Its reader is `ObservedValue`, which
 * needs to know whether the text it is about to render is curated copy or a re-cased
 * token so it can mark the second case — and a table that resolves silently cannot tell
 * it. `resolveStateValue` answers that question, and it can only answer it while the
 * table itself still misses.
 */
function resolving<T extends Record<string, string>>(table: T): T {
  return Object.setPrototypeOf(table, RESOLVING_TABLE_PROTO) as T;
}

/**
 * The text for one dimension value: the curated label, else a humanised token, else the
 * value untouched.
 *
 * **Humanising is a typographic transformation of the server's own token, not a guess at
 * its meaning.** `NEWLY_DECLARED_STATE` becomes `Newly declared state` by lower-casing
 * five capitals and turning two underscores into two spaces; every word a reader sees is
 * a word the backend chose. That is the difference between this and the substitution the
 * tables refuse to make: nothing is inferred, nothing is renamed, and a token whose
 * meaning we have not written copy for still says only what it said. What it stops is a
 * rep reading `NEWLY_DECLARED_STATE` in a primary statement (R8.3) — and because the
 * text is the token and not our reading of it, the honesty the raw fallback protected
 * survives, provided the caller marks the result. `ObservedValue` does, as visible text
 * beside the value, next to the `derived` and `stale` markers.
 *
 * **The gate is the token's shape, never "the table missed."** Some of the fields that
 * reach `ObservedValue` carry prose rather than an enum: `_qualification_of()` returns
 * `"3/5 criteria matched"` for `icp_match` whenever the persisted ICP criteria carry
 * booleans, and `acv_tier` is persisted lower-case. Neither is in `STATE_LABEL` and
 * neither is a token, so both pass through as `verbatim` — a miss on the table is not
 * evidence that a value needs tidying.
 */
export function resolveStateValue(value: string): ResolvedStateValue {
  const mapped = STATE_LABEL[value];
  if (mapped !== undefined) return { text: mapped, origin: "mapped" };
  const humanised = humanisedIfToken(value);
  if (humanised !== null) return { text: humanised, origin: "humanised" };
  return { text: value, origin: "verbatim" };
}

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
 *
 * A `resolving()` table: the projection is stated as a chip in the dossier's status band,
 * which is a primary statement, and a twenty-second value declared server-side reads as
 * its own token re-cased rather than as `NEWLY_DECLARED_STATE` (R8.3).
 */
export const GTM_JOURNEY_LABELS: Record<string, string> = resolving({
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
});

/**
 * The eleven Intent_Types.
 *
 * Eleven records per prospect rather than one label, because a hiring signal is
 * not a buying signal (R5.1). An unsupported type is materialised at value zero
 * and confidence zero rather than left absent (R5.5), so every key here always has
 * a row to label — a zero is "nothing observed for this intent", which is why the
 * value beside the label needs its confidence to be readable too.
 *
 * A `resolving()` table: the strongest three are stated in the dossier's buying-intent
 * band, which is a primary statement, so a twelfth type reads as its own token re-cased
 * (R8.3). The eleven canonical rows are still `Object.keys` of this object and only those.
 */
export const GTM_INTENT_LABELS: Record<string, string> = resolving({
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
});

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
 *
 * A `resolving()` table: the title of the recommended action is the loudest primary
 * statement on the dossier, so a fourteenth type reads as its own token re-cased rather
 * than as `PARTNER_INTRO_REQUESTED` (R8.3). `readActionTypeParam` in
 * `pages/GTMActionQueue.tsx` guards the URL parameter with `in`, which still answers for
 * the thirteen keys this object owns and for nothing else.
 */
export const GTM_NBA_ACTION_LABELS: Record<string, string> = resolving({
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
});

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
  /**
   * What the button does when a LinkedIn identity has not been confirmed yet.
   *
   * Two facts a rep needs before pressing a control tagged "2 credits": this press does not
   * spend them, and the lookup is quick and unattended. The charge happens on the track
   * route and only when intelligence actually starts.
   */
  trackFirstStep:
    "We'll find their LinkedIn profile first — that's free and runs in the background. The 2 credits are only charged when intelligence actually starts.",
  trackLookingUp: "Finding their profile",
  trackStarting: "Starting intelligence",
  /**
   * What activation does, in a rep's words.
   *
   * An earlier version read "continuously monitors this prospect's signals, evolves their
   * prospect state, and recommends the next best action" — three engine nouns in one
   * sentence. A rep does not know what a signal or a prospect state is, and does not need
   * to: what they need to know is that Weez keeps watching so they don't have to guess when
   * to reach out.
   */
  trackBody:
    "Weez keeps watching this person — what they post, when they change role, when they show interest — and tells you the moment there's a good reason to reach out, and what to say.",

  // What each control actually did. Neither claims more than a queued job.
  resolveQueued: "Looking for their LinkedIn profile. The result lands on the next read.",
  resolveDeduped: "Already looking — an identical search is queued for this lead.",
  resolveFailed: "Couldn't ask for an identity search",
  /**
   * The lookup is taking longer than this page is willing to keep polling for.
   *
   * Not a failure and not a timeout of the *job* — only of our watching. The search is still
   * queued and the verdict will be there next time, so the sentence says that rather than
   * implying something broke.
   */
  /**
   * No address on the lead, and nothing in this deployment that can go and find one.
   *
   * A real terminal state, and it used to be indistinguishable from a running search: the
   * resolve route queued a job whatever happened, so the client said "we're looking", the
   * bounded poll timed out, and `resolveStillRunning` claimed a background search would
   * finish — about a job with no consumer. It never would.
   *
   * The route now answers `NOT_QUEUED` / `NO_RESOLVER` for that case and this is what the
   * dossier says about it. It names what is missing and what changes it, per R18.4, and it
   * hands the rep no identity task: re-running Enrich Now is a product action they already
   * know, and Weez confirming an address the provider returns is Weez's own work.
   */
  resolveNoResolver:
    "Weez has no confirmed LinkedIn address for this person yet, and can't go looking for one on this workspace — so intelligence can't be activated. Re-run Enrich Now; when a provider returns their address, Weez confirms it and this opens up.",

  resolveStillRunning:
    "Still looking. The search is queued and will finish in the background — check back and it'll be here.",

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

  /**
   * Identity verification ran and came back without a person, so activation stops here
   * (R6.3).
   *
   * Distinct from `cannotTrack.noMatch`, which is the 409 the *track route* returns when
   * somebody presses Activate on a lead nobody has resolved. This is the other order of
   * events — the press started a lookup, the lookup finished unverified, and no track
   * request was ever issued (R6.4). The second clause exists to say exactly that: the
   * operator pressed a priced control, and they are owed an explicit statement that nothing
   * was activated and nothing was charged for it.
   *
   * Rendered as a notice in the stage banner under `aria-live="polite"`, because the verdict
   * arrives on a later poll rather than in the click that asked for it.
   */
  activationStopped:
    "Activation stopped — We couldn't verify this person on LinkedIn. Intelligence was not activated.",

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
    label: "Finding their details",
    body: "Looking up this person's contact details and confirming who they are.",
  },
  RESOLVING: {
    label: "Finding their profile",
    /**
     * No made-up duration, and no instruction to wait.
     *
     * The lookup is a queued job the LinkedIn worker picks up, and the backend publishes no
     * SLA for it — so any "about 30 seconds" here would be invented. What removes the "how
     * long is this going to take" problem is not a number, it is that the rep does not have
     * to watch: the page re-checks on its own and fills in when the answer lands. Saying that
     * is both true and more useful than an estimate.
     */
    body:
      "Weez is looking for this person on LinkedIn. This runs in the background and the page updates itself — you don't need to wait here.",
  },
  ENRICHED: {
    label: "Ready to decide",
    body:
      "You know who this is and how to reach them. Reach out now, or let Weez watch them and tell you when the moment is right.",
  },
  ACTIVATING: {
    /**
     * The transition, named as itself (R7.2).
     *
     * "Turning on intelligence" described a switch; this describes the thing the rep just
     * bought being brought up. The body is retained — it is the only sentence that says a
     * first read of the profile and the activity is already going out.
     */
    label: "Activating intelligence…",
    body: "Setting this prospect up and taking a first look at their profile and activity.",
  },
  WAITING: {
    label: "Watching for activity",
    /**
     * The one stage that has to survive being empty for a while (R7.3).
     *
     * Pinned by the requirement, so it is set verbatim: two clauses, the state and what is
     * being done about it, and no promise about when. The longer sentence it replaces spelt
     * out the three things that could land here, which the `ACTIVE` body below already does
     * once the first one has.
     *
     * It says "Weez", the same subject `RESOLVING.body` above and `ACTIVE.body` below use.
     * R7.3 was first drafted saying "Dextroflow", which would have put two voices in three
     * adjacent bodies of one banner; the product owner resolved that by **amending the
     * requirement** — the product has one user-facing name, and it is Weez. So this is still
     * the requirement's word verbatim, not a re-voicing of a pinned string.
     */
    body: "Intelligence is active. Weez is watching for new activity and signals.",
  },
  ACTIVE: {
    label: "Watching · nothing to do yet",
    body:
      "Weez is picking up activity and building a picture of this prospect. There's no move worth making right now — you'll see one here when there is.",
  },
  RECOMMENDED: {
    label: "Ready to act",
    body: "Weez has a recommended move for this prospect, and the reason for it.",
  },
};

/**
 * What the dossier says when there is nothing to show, and when a read failed (R18.1).
 *
 * The stage table above says where a prospect *is*. These five sentences cover the places
 * on an activated prospect's dossier where a section has nothing in it — the next-best-action
 * slot, the activity band — and the two reads that can fail without taking the page down.
 *
 * Three rules hold across every one of them, and they are the reason these live in a table
 * rather than at the call sites they replace (R18.2, R18.4):
 *
 *   **Each says what is absent, not that data is missing.** No entry is "No data available",
 *   "N/A", an em dash or a blank. A rep cannot act on "N/A"; they can act on "not enough
 *   evidence yet".
 *
 *   **Each carries a next step.** Either what Weez is doing about it — `We're watching`,
 *   `reads their profile … on a schedule`, `appears here` — or, for the two failures, a retry
 *   control rendered beside the sentence from `GTM_PAGE_LABELS.retry`. A failure statement
 *   with no way to try again is a dead end.
 *
 *   **Each is distinct.** Two absences that read the same are two absences a reader cannot
 *   tell apart, and "no recommendation yet" and "no signal worth your attention yet" are
 *   genuinely different news.
 *
 * `noRecommendation` and `noMeaningfulSignal` are pinned exact strings (R9.4, R9.5) and both
 * stand *in place of* the NBA card rather than inside it: there is no recommendation, so
 * there is no card, and a card-shaped placeholder would imply one is loading.
 *
 * The two `*ReadFailed` sentences are lifted from the strings that were written inline in
 * `ProspectIntelligence.tsx`. Both name what could not be read *and what that costs* — a
 * stage we cannot show, a recommendation that may exist and is not on screen — because a
 * failed read is not the same claim as an absence, and an operator who cannot tell the two
 * apart will read a gap as a verdict.
 */
export const GTM_ABSENCE_LABELS = {
  /** No recommendation for a tracked prospect (R9.4). In place of the NBA card. */
  noRecommendation:
    "Not enough evidence yet. We're watching this prospect. We'll surface a recommendation when there is a meaningful signal.",

  /** Tracked, observed, and nothing observed is worth acting on (R9.5). `ACTIVE` stage. */
  noMeaningfulSignal:
    "Watching — Nothing needs your attention yet. We'll tell you when something changes.",

  /**
   * The ranking read failed. Rendered as an amber line above the NBA slot, with a retry.
   *
   * The second clause is the honest part: this is our failure, not an empty queue, so it must
   * not be mistaken for `noRecommendation` above.
   */
  rankingReadFailed:
    "Couldn't read the next best action for this prospect, so there may be a recommendation we aren't showing.",

  /**
   * The prospect read failed. Rendered above the dossier bands, with a retry.
   *
   * Names both things the failure took with it — the stage and the controls that depend on it
   * — so a dossier missing its banner and its decision cards reads as one failed read rather
   * than as several unexplained gaps.
   */
  prospectReadFailed:
    "Couldn't read this prospect's GTM record, so its stage and the actions available on it aren't known.",

  /**
   * Nothing has been observed on their profile or feed yet. Band 5.
   *
   * Says the observation is scheduled rather than absent, because activation queues reads and
   * a rep who has just paid for one deserves to know it is coming instead of inferring that
   * nothing happens.
   */
  noActivity:
    "No activity has been observed for this prospect yet. Weez reads their profile and recent posts on a schedule, and anything it finds appears here.",
} as const;

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
    /**
     * The pinned tagline (R4.4), which is now the card's whole pitch in one line.
     *
     * It used to read "I don't want to reach out blind." — the rep's half of the choice,
     * matching the contact card's voice — with `headline` carrying the promise underneath.
     * The requirement pins the promise itself, in lowercase, so the two lines would restate
     * each other and the card drops `headline` from its copy instead.
     */
    tagline: "Find out who, how, and why now before reaching out.",
    /**
     * The identity block's own headline, kept aliased and no longer on the card.
     *
     * `tagline` above now carries this promise in the pinned wording, so rendering both put
     * the same sentence on the card twice in two capitalisations.
     */
    headline: GTM_IDENTITY_LABELS.trackHeadline,
    /** Still on the card, and still the identity block's string so the pitch cannot drift. */
    body: GTM_IDENTITY_LABELS.trackBody,
    /**
     * The busy label, and there is only one of it.
     *
     * `GTM_IDENTITY_LABELS.trackFirstStep` used to be aliased here as `firstStep` and
     * rendered under the button whenever the identity was unresolved. It named the
     * plumbing — a LinkedIn profile lookup — on the one surface where the operator is
     * choosing between two product outcomes, so it is gone from this table (R4.5, R6.6).
     * `trackLookingUp` ("Finding their profile") is the same problem in a shorter
     * sentence, so the card reads `starting` in *both* busy branches and the Activate
     * copy is identical whatever the identity verdict says (R4.6). `lookingUp` stays
     * declared for the identity block, which is where naming the lookup belongs.
     */
    lookingUp: GTM_IDENTITY_LABELS.trackLookingUp,
    starting: GTM_IDENTITY_LABELS.trackStarting,
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
   * Why Contact Directly cannot be offered, when it cannot.
   *
   * **There used to be a third sentence here, `needsActivation`, and it is gone.** It read
   * "Weez needs a GTM record for this prospect before it can draft a message. Activate
   * Intelligence creates one." That was true while `_require_profile` guarded both contact
   * routes. It is not true any more: the guard takes `allow_missing` and both
   * `POST /message/generate` and `POST /action/request` now answer for a lead with no
   * `li_gtm_profiles` row (§5.3). Contact Directly is independent of activation (R5.5), so
   * the sentence would be a lie, and a lie left in a label table is a lie somebody reuses.
   *
   * Its two replacements are the *only* two gates that remain, and both are read from
   * backend-supplied facts rather than from the activation stage:
   *
   *   `needsEnrichment` — no `gtmLeadId`, so there is no enrichment assertion for the
   *   writer to ground a draft in. Enriching is the next step and the sentence says so.
   *
   *   `noChannel` — no email address, no `contact.linkedinUrl` and no
   *   `profile.profileUrl`, so `_lead_destination()` would refund the charge and answer
   *   `422`. Nothing to open is not the same news as nothing to say, which is why it is a
   *   second sentence rather than a rewording of the first.
   *
   * `needsConversation` is retained and **re-scoped to the tracked path only**: it is the
   * `_require_conversation` 404 an *activated* prospect still returns when the observation
   * layer has not seen a thread yet. It no longer speaks for an unactivated prospect —
   * that one has a draft available and always did after the relaxation.
   *
   * Every one of these is stated rather than hidden. A control that would 404 is not
   * rendered, and the reason it is missing is printed where it would have been (R5.8).
   */
  needsEnrichment:
    "This prospect hasn't been enriched yet, so there's nothing to write from. Enrich them first and the draft will have something to say.",
  noChannel:
    "We don't have an email address or a LinkedIn profile for this person yet, so there's no channel to open.",
  needsConversation:
    "No LinkedIn thread has been observed for this prospect yet, so there's nothing for a draft to attach to. This clears once Weez has read their profile.",
  generateFailed: "Couldn't draft a message for this prospect",

  /**
   * The pre-activation draft is not saved anywhere, and the operator is told before they
   * lose it (R5.6).
   *
   * `_lead_message_out` and `_lead_action_out` return `persisted: false` with a null id, so
   * `MessageComposer` has no `message_id` to key `PATCH /message/{id}` or
   * `POST /message/{id}/regenerate` on and hides **Rewrite** and inline **Edit**. This line
   * takes their place: it says why two controls are absent, it names the one thing to do
   * about it now — copy the text — and it names what activation would buy instead of
   * leaving the missing persistence as a mystery. Generate, review, copy and open-channel
   * are all still live, so this is a note and not a refusal.
   */
  unpersistedNote:
    "This draft isn't saved — copy it before you leave. Activate Intelligence and Weez keeps the thread, the replies and what came of them.",
} as const;

// Empty-state copy is deliberately NOT centralised into one table here.
//
// A first pass at this feature added an `EMPTY_STATE_LABELS` block covering all four
// surfaces, and it was removed before it shipped: every one of those surfaces already
// owns specific, contextual empty copy — `GTM_PAGE_LABELS.noStateBelief` and
// `.noIntelligenceRead` here, `ACTION_QUEUE_LABELS.emptyRankedOnly` / `.emptyFiltered` in
// `pages/GTMActionQueue.tsx`, and five distinct `EmptyPanel` states in
// `pages/ProspectIntelligence.tsx` that already tell "discovery has found nothing yet"
// apart from "discovery found forty accounts and none is enriched". A second table
// stating the same things in weaker words would be dead code the day it landed and a
// contradiction the day somebody edited one copy and not the other.
//
// Where empty copy falls short it is fixed where it lives.

// ─── The deeper intelligence, behind disclosures ──────────────────────────────
//
// The sections below the Next Best Action card on an activated prospect. Each is a
// `<summary>` an operator opens when they want to understand *why*, which is the second
// question — the first is "what should I do", and the NBA card answers that above them.
//
// **These are summaries, not headings.** Every panel behind them already owns its own
// heading naming exactly what it renders, so these strings label the disclosure rather than
// the content: a heading here would either repeat the panel's name or invent a second name
// for the same thing.
//
// **Four of them fetch their own data, and are mounted only when opened.** `SignalList`,
// `StateHistoryPanel`, `ProspectTimeline` and `LearningInsightsPanel` each own a collection,
// a pager and a failure. Mounting them closed would add four requests to every prospect
// selection for panels nobody asked to see. The other three read nothing on open:
// `standing`, `reach` and `relationship` render slices of the `ProspectStateFull` payload the
// page already holds, so opening one costs nothing. `StateDimensionGrid` reads no route
// either — it renders the same held payload — so it needs no disclosure and gets none.
//
// `reach` is the one with a caveat: `ChannelRecommendationPanel` issues `recommendChannel`
// only when the operator presses re-evaluate, never on open, which is why it sits with the
// free sections rather than the fetching ones.
//
// The order is the order the questions arrive: where do they stand, how do we reach them,
// where does the relationship stand, what moved them, what did we read, what happened when,
// and what have we learned from prospects like this.

export const PROSPECT_INTELLIGENCE_SECTIONS = {
  /** No disclosure: this one costs nothing to render. */
  state: "Current state",
  stateNote: "Where this prospect stands, on the evidence.",

  /**
   * `BuyingStagePanel`, `IntentPanel` and `ChannelIntelligencePanel`, folded in from
   * `GTMProspect`. All three read `detail.state`, so opening this issues no request.
   *
   * The summary deliberately names the buyer's position rather than the three panels, which
   * is why it reads close to `stateNote` above it: that note describes the always-open grid
   * of dimension values, this one opens onto the argument behind them.
   */
  standing: "Where this prospect stands",
  standingNote:
    "Their buying stage, what they're interested in, and which channels reach them.",

  /**
   * `ChannelRecommendationPanel` and `CTAReadinessPanel`. Nothing on open — the channel
   * recommendation is only recomputed when the operator asks for it.
   */
  reach: "How to reach them",
  reachNote: "Which channel is most likely to work, and whether they're ready for an ask.",

  /** `ConnectionPanel`, reading `detail.state.relationshipState`. No request. */
  relationship: "Relationship & connection",
  relationshipNote: "Whether you're connected, and what you've confirmed about it.",

  stateHistory: "What changed, and why",
  stateHistoryNote:
    "Every time Weez changed its mind about this prospect, and what it saw that made it.",

  signals: "What Weez has seen",
  signalsNote:
    "The things Weez observed about this person, newest first. Older ones stay on the list but count for less.",

  timeline: "Everything that happened",
  timelineNote:
    "The full record for this prospect: changes, drafts, the actions you took and how they turned out.",

  /**
   * `LearningInsightsPanel`, one `/debug` read on open. This is where the retired standalone
   * learning page lands (R8.12): learning is a property of a prospect, not a destination.
   *
   * The summary is the R8.11 heading verbatim. "We've" and not "Weez has" because the
   * subject is the shared record — what worked across this workspace's prospects — and a rep
   * reading it is one of the parties that produced it.
   */
  learned: "What we've learned",
  learnedNote:
    "What worked with prospects like this, and how that shaped the recommendation.",

  /**
   * The heading over the whole region.
   *
   * "Deeper intelligence" rather than "Details": every section under this heading is an
   * answer to "why should I believe the recommendation above", and calling them details
   * would suggest they are optional trivia rather than the argument.
   */
  regionHeading: "Why Weez thinks this",
  regionNote: "Open any of these if you want to check the reasoning. You don't need to.",
} as const;

// ─── Signal types, in a rep's words ───────────────────────────────────────────
//
// The twenty-nine `signals.SignalType` values, as the thing that actually happened.
//
// **Why this table did not exist before.** `ActionExplanation.WhyNowList` carries a note
// saying "`signalType` renders raw — `labels.ts` carries no table for the 29 values and the
// convention on a miss is the raw value", and that was a reasonable call while the only
// reader of a why-now bullet was somebody auditing a score. It stopped being reasonable
// once "Why now?" became the most important sentence on the Next Best Action card. A rep
// reading `POST_ENGAGEMENT` or `TECH_STACK_CHANGE` has to translate before they can decide,
// and the whole promise of the card is that they don't have to.
//
// Written as **what happened**, in the past tense, so a bullet reads as an event rather
// than as a category: "Changed jobs", not "Job change". That is what makes a list of these
// scan as a story about a person.
//
// `Record<string, string>` and never a closed union, so a thirtieth type added
// server-side renders rather than failing to type-check. It renders as the token it is,
// re-cased: this is one of the four `resolving()` tables, because a why-now bullet is a
// primary statement (R8.3) and `NextBestActionCard` reads its text straight out of here.
export const GTM_SIGNAL_TYPE_LABELS: Record<string, string> = resolving({
  // What they did on LinkedIn.
  LINKEDIN_POST: "Posted on LinkedIn",
  LINKEDIN_COMMENT: "Commented on a post",
  LINKEDIN_REACTION: "Reacted to a post",
  LINKEDIN_SHARE: "Shared a post",
  PROFILE_VIEWED_US: "Viewed your profile",

  // What changed about them or their company.
  JOB_CHANGE: "Changed jobs",
  PROMOTION: "Was promoted",
  COMPANY_GROWTH: "Their company is growing",
  FUNDING_ROUND: "Their company raised funding",
  PRODUCT_LAUNCH: "Their company launched something",
  HIRING_SIGNAL: "Their company is hiring",
  TECH_STACK_CHANGE: "Their company changed tools",
  COMPETITOR_MENTION: "Mentioned a competitor",
  PAIN_STATEMENT: "Described a problem you solve",

  // Where the relationship stands.
  CONNECTION_REQUESTED: "You sent a connection request",
  CONNECTION_ACCEPTED: "Accepted your connection request",
  CONNECTION_REJECTED: "Didn't accept your connection request",

  // What came back.
  INBOUND_REPLY: "Replied to you",
  POSITIVE_REPLY: "Replied — interested",
  NEGATIVE_REPLY: "Replied — not interested",
  OBJECTION: "Raised an objection",
  MEETING_REQUESTED: "Asked for a meeting",
  MEETING_BOOKED: "Booked a meeting",

  // Reasons to stop, and things that went wrong.
  OPTED_OUT: "Asked not to be contacted",
  WRONG_PERSON: "Said they're the wrong person",
  EMAIL_BOUNCED: "Their email bounced",

  // Ours, not theirs.
  ACTION_EXECUTED: "You took an action",
  HUMAN_NOTE: "You recorded a note",
  UNCLASSIFIED: "Something we couldn't classify",
});

// ─── The attention checklist (R11.9, R13.10, R18.1, R18.2, R18.4) ─────────────
//
// The vocabularies the Attention_Feed adds, and the chrome the Action Queue and Nina
// read them through. Three tables, in the shape every table above is in: a key the
// server sent, a string a human reads.
//
// **Both vocabulary tables are `Record<string, string>`** — the convention this file
// has followed since the panel tables, and load-bearing here for a specific reason.
// The nine triggers and the four bands are declared server-side in
// `backend/api/gtm.py`, and a tenth trigger is a backend change that ships without
// this file. Keying these to a closed union would fail to type-check the day that
// happened; keeping them open means the lookup site renders the raw value, so a new
// trigger reads as `NEW_TRIGGER` rather than as blank. An unmapped key is a display
// gap, not a licence to invent a friendlier string for a fact nobody here has seen.
//
// **The tier's text carries its meaning, not its colour.** A chip built on
// `CONSEQUENCE_TIER_LABELS` pairs the band's sentence fragment with whatever tone it
// wears, as every chip on these surfaces does (R18.9) — a reader who cannot see the
// colour still learns that something needs them now.

/**
 * The four Consequence_Tiers, named by what the band means to the reader's day.
 *
 * Not `IMMEDIATE` / `MATERIAL` / `IMPORTANT` / `OTHER`, which are the server's words for
 * its own ordering, and not severity words either. `Needs you now` is a claim about the
 * rep's next ten minutes; `For your awareness` says plainly that nothing is being asked.
 * That is the difference the ordering exists to convey, so the labels state it rather
 * than leaving a rank for the reader to interpret.
 *
 * The order of the keys is the server's declared band order (`CONSEQUENCE_TIERS`), which
 * is also the order the feed returns items in. Nothing here sorts — the page preserves
 * the server's order (R11.4) and this table only names the band it lands in.
 */
export const CONSEQUENCE_TIER_LABELS: Record<string, string> = {
  IMMEDIATE: "Needs you now",
  MATERIAL: "Could change the outcome",
  IMPORTANT: "Worth following up",
  OTHER: "For your awareness",
};

/**
 * The nine Attention_Triggers, as the news about the prospect (R11.2).
 *
 * Written from the prospect's side and in the perfect tense — `Replied to you`, `Going
 * cold` — so a checklist of these scans as a list of things that happened to people
 * rather than as a list of system events. `BUYING_STATE_CHANGED` reads "Buying position
 * moved" and not "State changed", because a rep does not have a state machine in mind
 * when they open the page in the morning.
 *
 * Two of them are deliberately vaguer than the rest, and honestly so.
 * `MEANINGFUL_TRANSITION` fires on a transition the engine judged meaningful without
 * placing it in one of the named categories, so "Something changed" is the whole of what
 * we know; inventing a specific clause would be a claim the trigger did not make.
 * `ACTION_MANDATORY` says what is at stake — the recommendation lapses and the prospect
 * goes quiet — because that is the only trigger where *not* acting is itself the news.
 *
 * These label the trigger for a chip or a summary count. The task line's middle clause is
 * `AttentionItem.reason`, which is server prose over the persisted values, so a task
 * naming a stage or a signal is naming the one the server actually read.
 */
export const ATTENTION_TRIGGER_LABELS: Record<string, string> = {
  PROSPECT_REPLIED: "Replied to you",
  BUYING_STATE_CHANGED: "Buying position moved",
  STAGE_CHANGED: "Moved to a new stage",
  HIGH_INTENT_SIGNAL: "Showed strong intent",
  MOVED_TOWARD_CONVERSION: "Moved closer to a deal",
  AT_RISK_OR_LOSING: "Going cold",
  WINNING_NEEDS_FOLLOWUP: "Waiting on you",
  MEANINGFUL_TRANSITION: "Something changed",
  ACTION_MANDATORY: "Action needed to keep this alive",
};

/**
 * The checklist's own chrome: the heading, the list's accessible name, the separator,
 * the empty state, the failure, and the two relative day headings.
 *
 * `pageTitle` is a question the page answers rather than a noun for a container. "Action
 * queue" described a data structure; "What needs you today" is the promise the surface
 * makes, and it is the same promise Nina's first block makes from the same feed.
 *
 * `list` is the `aria-label` on the single `<ul>` (R11.6, R11.7). It states the ordering
 * as well as the contents, because the order is meaning here — a screen-reader user
 * walking the list top to bottom is walking it in consequence order and deserves to know
 * that without inferring it.
 *
 * `taskSeparator` is the arrow in the R11.2 form —
 * `${prospectName} ${reason} → ${requiredResponse}` — and it lives here rather than in
 * the JSX for the reason every
 * string in this file does: it is user-visible text, it is inside the task's accessible
 * name (R11.10), and a literal in the markup is a string no scan can find.
 *
 * `empty` is state 13 of the fifteen (R18.1) and is shared by the Action Queue and by
 * Nina's blocks 1 and 3 (R11.9, R13.10) — one condition, one sentence, said in one place
 * so the two surfaces cannot drift. It obeys the three rules the other fourteen do
 * (R18.2, R18.4): it says what is absent rather than that data is missing, it says what
 * Weez is doing about it — watching every activated prospect — and it names the
 * three things that would put a row here, which is the reader's actual next question.
 *
 * It is *not* `ACTION_QUEUE_LABELS.emptyRankedOnly`, and the distinction is the whole
 * point of the retitle. That sentence is about ranked recommendations, which is now one
 * of nine reasons a prospect can need attention; this one is about the checklist being
 * genuinely clear. Two different pieces of news, so two different sentences.
 *
 * `loadFailed` is a failure and not an absence: the feed could not be read, so the page
 * shows no list at all rather than a partial one assembled from another source. Its next
 * step is the retry control rendered beside it (R18.5) from `GTM_PAGE_LABELS.retry`,
 * which is the same shape `GTM_PAGE_LABELS.loadFailedTitle` uses.
 *
 * `today` / `yesterday` are the two relative day headings (R11.3). Every other day heads
 * with its own date, formatted at the call site from `dueAt` — there is no
 * "3 days ago" heading, because a date is unambiguous and a rounded interval is not.
 */
export const ATTENTION_LABELS = {
  pageTitle: "What needs you today",
  list: "Prospects that need a response, most consequential first",
  taskSeparator: " → ",
  empty:
    "Nothing needs you right now. Weez is watching every activated prospect and this list fills the moment one replies, moves stage or shows intent.",
  loadFailed: "Couldn't read what needs your attention",
  today: "Today",
  yesterday: "Yesterday",
} as const;

// ─── Meetings (R14.7, R14.11, R18.1, R18.2, R18.4) ────────────────────────────
//
// Three sentences the Meetings page needs and cannot derive, each covering a place
// where the GTM record is thinner than a calendar would be. `as const` rather than
// `Record<string, string>`, matching `ATTENTION_LABELS` above: this is the page's own
// chrome, not a vocabulary keyed by a value the server sends, so there is no unmapped
// key to fall back from and nothing here can grow a tenth member behind our back.
//
// **Why a meetings surface needs absence copy at all.** A meeting on this page is
// assembled from persisted GTM state — a conversation state, a cta state, a journey
// state, a timeline outcome — and none of those is a calendar entry. So the page
// knows *that* a meeting exists and, for the counts, *how many* were recorded, while
// the two things a rep reaches for first (when is it, and how did it go) are either
// somewhere else or not measured yet. Each sentence below names which of those it is,
// because "we don't hold this" and "nothing has happened" are different news and a
// dash in a cell says neither.

/**
 * What the Meetings page says where the record stops short.
 *
 * `noScheduledTimes` is the pinned R14.7 statement, and it is the reason the page groups
 * by status instead of by time. No GTM table holds a meeting's start instant —
 * `li_gtm_conversations` carries `last_inbound_observed_at` and `last_outbound_observed_at`,
 * `LinkedInAction` carries `requested_at` and `delivered_at`, and not one of them is when
 * the meeting is due. Sorting by any of those would present the freshest *observation* as
 * the soonest *meeting*, which is a fabricated schedule built out of real timestamps. So
 * the sentence says where the times actually live — the rep's calendar — and then says
 * what the grouping is instead, which is the honest trade: we cannot tell you when, we can
 * tell you exactly where each one stands.
 *
 * `countsUnavailable` stands in for the booked and completed figures, and covers both ways
 * they can be missing: the analytics read failed (§13.3), or it succeeded and the metric
 * was never computable on any day in the window (§9.3, where an absent metric contributes
 * nothing rather than a zero). One sentence for both, because the rep's position is the
 * same either way — there is no number to show — and a `0` would be a measurement nobody
 * took. It names two next steps, a wider window and a retry, and it says the list below is
 * unaffected so a missing count does not read as a missing page: the counts come from
 * `/gtm/analytics/daily` and the meetings from the per-prospect reads, and only one of
 * those two failed.
 *
 * `empty` is the pinned R14.11 statement and state 14 of the fifteen (R18.1). It obeys the
 * three rules the other fourteen do (R18.2, R18.4): it says what is absent rather than
 * that data is missing, it names what Weez is doing — reading the thread — and it
 * names the two persisted events that would put a row here, an ask and a confirmation, so
 * a rep with no meetings learns what one is made of rather than being told to wait. It is
 * distinct from every other absence on the feature, and pointedly from
 * `ATTENTION_LABELS.empty` directly above: an empty checklist means nothing needs the rep
 * right now, an empty meetings page means no thread has produced a meeting yet, and the
 * two can be true at completely different times.
 */
export const MEETING_LABELS = {
  /** Why there are groups and not times (R14.7). Rendered once, above the groups. */
  noScheduledTimes:
    "Weez knows these meetings exist but not when they're scheduled — that lives in your calendar, not in the LinkedIn thread. These are grouped by where each one stands.",

  /** In place of the booked and completed counts, never a zero (R14.3, R14.5). */
  countsUnavailable:
    "Booked and completed counts aren't available for this window. Weez adds them up from what it measured day by day, so widening the window or trying the read again is what brings them back — the meetings below stand either way.",

  /** No Meeting_State_Evidence anywhere in the workspace (R14.11). State 14 of fifteen. */
  empty:
    "No meetings are recorded yet. A meeting appears here when a prospect asks for one or confirms a time in the thread Weez is reading.",
} as const;
