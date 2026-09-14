// pages/__tests__/ProspectDossier.labels.test.tsx
//
// The four claims about what the dossier is allowed to *say*.
//
//   Property 21  Nothing is presented that a backend read did not supply
//                (R8.5, 8.6, 8.7, 8.10, 9.1, 12.5, 20.2)
//   Property 23  No primary statement contains backend vocabulary (R8.3, 8.8)
//   Property 24  A number never gains precision or loses its meaning
//                (R8.4, 9.7, 9.8, 19.3)
//   Property 26  The fifteen absence conditions have fifteen distinct honest sentences
//                (R18.1, 18.3, 18.4, 18.6)
//
// plus the six exact strings R4.4, 6.3, 7.2, 7.3, 9.4 and 9.5 pin.
//
// ─── Why three of the four render the real page ────────────────────────────────
//
// Every one of these properties is a claim about a *composition*, not about a component.
// "Traces to a payload field" is only checkable where the payload and the screen are the
// same run, so the payload travels the real transport: `fetch` is served by url, `gtmAPI`'s
// own normaliser turns each body into the domain object, and `ProspectIntelligence` decides
// what to do with it. Nothing here constructs a `ProspectDetail`, an `ActionQueueItem` or a
// `NextBestAction` by hand — a fixture built past the normaliser would be this file
// asserting against its own idea of the wire.
//
// The harness is `components/gtm/__tests__/insufficientCredits.test.tsx`', deliberately
// unchanged in shape: one workspace, one prospect, `fetch` stubbed by url longest-match
// first, `ConversationSidebar` and `sonner` mocked as existing chrome, and the mount waited
// on by the dossier's own `data-gtm-stage` marker rather than by a timer.
//
// Property 26 is the exception and renders almost nothing. Its subject is the *copy tables*
// — the task asks for the fifteen to be "scanned against the label tables themselves, not
// only the rendered output" — because a sentence that is wrong in the table is wrong on
// every surface that reads it, and a rendered scan can only ever reach the states this file
// managed to reproduce. The one of the fifteen that has no table (state 1, whose copy is
// written inline in `ProspectIntelligence.tsx`) is read off the DOM instead of copied here,
// so the scan cannot drift from what the page says.
//
// ─── What counts as a primary statement, stated once ──────────────────────────
//
// `Evidence_Disclosure` is defined in the glossary as a Progressive_Disclosure section
// holding the auditable basis of a statement, and every one of them on this surface is a
// native `<details>` — `IntelligenceSection`'s seven, and `NextBestActionCard`'s "View why".
// So "inside an evidence disclosure" is exactly "has a `<details>` ancestor", and the
// primary region is the dossier minus those subtrees. That definition is mechanical, needs
// no list of selectors to maintain, and is the same one a reader would apply by eye.
//
// Text is read from text nodes rather than from `textContent`, so a parent never inherits a
// child's words and a violation is reported against the element that actually holds it.
//
// ─── Every query is scoped, and every run cleans up after itself ──────────────
//
// RTL binds `screen` *and* the queries on `render`'s return value to `document.body`, so one
// leaked mount would answer every later query in the file. Every read below goes through the
// run's own `container`, `mounted()` asserts exactly one dossier on the page, and `cleanup()`
// runs in a `finally` at the *end* of each run — including the failing one, which fast-check
// re-enters while it shrinks.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import ProspectIntelligence, {
  PROSPECT_GTM_LABELS,
  nbaAbsenceStatement,
} from "@/pages/ProspectIntelligence";
import { ANALYTICS_LABELS } from "@/pages/Analytics";
import { CreditsProvider } from "@/hooks/useCredits";
import {
  evaAPI,
  type ChannelSignal,
  type EvaWorkspace,
  type QualifiedLead,
  type SignalType,
} from "@/services/evaAPI";
import {
  ATTENTION_LABELS,
  GTM_ABSENCE_LABELS,
  GTM_IDENTITY_LABELS,
  GTM_INTENT_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_SIGNAL_TYPE_LABELS,
  MEETING_LABELS,
  PROSPECT_DECISION_LABELS,
  PROSPECT_STAGE_LABELS,
} from "@/components/gtm/labels";
import { ACTION_EXPLANATION_LABELS } from "@/components/gtm/ActionExplanation";
import { INTENT_PANEL_LABELS } from "@/components/gtm/IntentPanel";
import { ACTION_CARD_LABELS } from "@/components/gtm/NextActionPanel";
import { NEXT_BEST_ACTION_CARD_LABELS } from "@/components/gtm/NextBestActionCard";
import { CREDIT_LABELS } from "@/components/gtm/CreditBalance";
import { MEASURE_BAND_FLOORS, MEASURE_BAND_LABELS, bandOf } from "@/components/gtm/measure";
import type { ProspectStage } from "@/components/gtm/prospectStage";

vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toast: toastFn, Toaster: () => null };
});

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── The workspace, and the one prospect in it ────────────────────────────────

/** A real brand id: `evaAPI` refuses to talk to the network for anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EVA_LEAD = "lead_ada7f1";
const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
const PERSON = "Ada Lovelace";
const COMPANY = "Analytical Engines";
const LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
const ISO = "2024-05-01T12:00:00.000Z";
const EARLIER = "2024-04-28T09:30:00.000Z";

function qualifiedLead(over: Partial<QualifiedLead> = {}): QualifiedLead {
  return {
    id: EVA_LEAD,
    entityId: "ent-1",
    company: COMPANY,
    domain: "analyticalengines.com",
    website: "https://analyticalengines.com",
    industry: "B2B SaaS",
    employeeRange: "51-200",
    hqLocation: "London",
    acvTier: "medium",
    identityVerified: true,
    enrichable: true,
    icpFit: 82,
    recommendedAction: "queued_review",
    escalation: "none",
    qualificationReason: "Hiring for a data platform team.",
    primaryEvent: "Posted three data-platform roles",
    eventType: "job_posting",
    signals: [],
    contact: {
      name: PERSON,
      role: "Head of Engineering",
      email: "ada@analyticalengines.com",
      emailVerified: true,
      linkedinUrl: LINKEDIN,
    },
    enrichment: { website: "https://analyticalengines.com", status: "enriched" },
    handoffState: "enriched",
    status: "qualified",
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    gtmLeadId: GTM_LEAD,
    ...over,
  };
}

function workspace(leads: QualifiedLead[]): EvaWorkspace {
  return {
    signals: [],
    entities: [],
    leads,
    potentialLeads: [],
    channels: [],
    icp: {
      brand_name: "Weez",
      industry: "B2B SaaS",
      segments: ["Mid-market SaaS"],
      personas: ["RevOps"],
      value_prop: "unify GTM reporting into one decision view",
    },
    metrics: {
      channelsMonitored: 4,
      signalsCaptured: 0,
      signalsThisWeek: 0,
      orgsTracked: 1,
      potentialLeads: 0,
      qualifiedLeads: leads.length,
      enrichedLeads: leads.filter((lead) => Boolean(lead.gtmLeadId)).length,
      emailsFound: leads.length,
      handedToMax: 0,
      byTier: { low: 0, medium: leads.length, high: 0 },
      bySignalType: {},
    },
    // Discovery has landed, so the page arms no silent re-read behind these mounts.
    sweepState: "complete",
    isDemo: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// The supply: one generated payload, and the wire it arrives on
// ══════════════════════════════════════════════════════════════════════════════
//
// `Supply` is the *whole* of what the backend told this page. Every expectation below is
// computed from this object and from the label tables — never from a second reading of the
// DOM — which is what makes "traces to a payload field" an assertion rather than a tautology.
//
// It is deliberately small. This page mounts a workspace, a dossier, eight bands and up to
// four panels per run, so a payload with forty rows in it would buy nothing and cost every
// run.

/** One EPS dimension set, as an `ActionQueueItem` carries it. */
interface MeasureSupply {
  urgency: number;
  expectedSuccessProbability: number;
  businessValue: number;
  signalFreshness: number;
}

/** One Why_Now bullet: a signal reference, its instant and its strength. */
interface BulletSupply {
  signalId: string;
  evidenceId: string;
  signalType: string | null;
  eventTimestamp: string | null;
  effectiveStrength: number;
}

interface IntentSupply {
  intentType: string;
  value: number;
  confidence: number;
  evaluated: boolean;
}

/** One of Eva's captured channel events, which is what band 5 renders pre-activation. */
interface EventSupply {
  id: string;
  signalType: SignalType;
  detail: string;
}

interface Supply {
  /** `profile_id` on the wire — the `li_gtm_profiles` row, i.e. the activation flag. */
  activated: boolean;
  /** `state_version`. Zero is exact: activation moves no dimension. */
  stateVersion: number;
  /** Whether `timing.last_meaningful_signal_at` is set, which picks one of two absences. */
  meaningfulSignal: boolean;
  /** The ranking's winner, or null for an evaluation that produced none. */
  ranking: {
    actionType: string;
    channel: string | null;
    actionConfidence: number;
    bullets: BulletSupply[];
  } | null;
  /** This lead's row on the one action-queue page the dossier reads, or absent from it. */
  queueRow: MeasureSupply | null;
  intents: IntentSupply[];
  events: EventSupply[];
  /** `activity.level` — an observed band, or nothing observed. */
  activityLevel: string | null;
  journeyState: string | null;
  relationshipState: string;
  conversationState: string;
  /**
   * The four *derived* profile facts, or their absence.
   *
   * `seniority`, `icp_match`, `intent_signal` and `acv_tier` are optional on
   * `ProspectProfileOut` and are sent whenever the enrichment produced them, so their
   * presence is generated rather than fixed — the shrinker can then tell a violation that
   * needs them from one that does not.
   *
   * Their values are the backend's own, read out of `scoring_tables.py` and
   * `_qualification_of()` rather than invented, because Property 23 is a claim about what
   * a rep reads off a real payload. An invented `"EXECUTIVE"` would produce a
   * counterexample nobody could reach; `"C_LEVEL"` is what `observed_seniority` actually
   * holds.
   */
  derivedProfile: DerivedProfileSupply | null;
}

/** The four derived profile facts, at the values the backend persists. */
interface DerivedProfileSupply {
  /** `li_gtm_profiles.observed_seniority` — one of `scoring_tables.SENIORITY_*`. */
  seniority: string;
  /** `_qualification_of()`'s ICP verdict: a criteria count, or the gate's own fallback. */
  icpMatch: string;
  /** `sales_leads.intent_class` — one of `scoring_tables.INTENT_CLASS_SCORES`' keys. */
  intentSignal: string;
  /** Eva's ACV tier, persisted lower-case by `core/strategy/acv_tiers.py`. */
  acvTier: string;
}

/** The stage `prospectStageOf` will land on for this supply. Computed, never read back. */
function stageFor(supply: Supply): ProspectStage {
  if (!supply.activated) return "ENRICHED";
  if (supply.ranking) return "RECOMMENDED";
  return supply.stateVersion > 0 ? "ACTIVE" : "WAITING";
}

const activeFor = (supply: Supply) => supply.activated;

/**
 * Eva's captured channel events, on the workspace lead where the page reads them.
 *
 * Band 5 has two grounded sources and this is the one that is *not* on the GTM wire: the
 * observed activity level rides on `getProspect`, and these ride on the workspace payload.
 * Both have to come from the supply for R8.10 to be assertable — the order the payload
 * carried is the order the band must present, and a lead served with no signals would make
 * that clause pass for the reason that nothing was there to re-order.
 */
function evaSignals(supply: Supply): ChannelSignal[] {
  return supply.events.map((event) => ({
    id: event.id,
    signalType: event.signalType,
    company: COMPANY,
    detail: event.detail,
    channel: "careers",
    confidence: 0.8,
    timestamp: ISO,
  }));
}

function fact(value: string | null, over: Record<string, unknown> = {}) {
  return {
    value,
    is_unknown: value === null,
    source_surface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observed_at: value === null ? null : ISO,
    is_stale: false,
    is_derived: false,
    ...over,
  };
}

function wireScore(value: number | null) {
  return {
    score: value,
    score_kind: "RECOMMENDATION_SCORE",
    score_disclaimer: "A prioritisation signal, not a predicted probability of conversion.",
    is_derived: true,
  };
}

/** `ProspectOut`, as `schemas/gtm.py` serialises it. */
function wireDetail(supply: Supply) {
  const derived = supply.derivedProfile
    ? {
        seniority: fact(supply.derivedProfile.seniority, { is_derived: true }),
        icp_match: fact(supply.derivedProfile.icpMatch, { is_derived: true }),
        intent_signal: fact(supply.derivedProfile.intentSignal, { is_derived: true }),
        acv_tier: fact(supply.derivedProfile.acvTier, { is_derived: true }),
      }
    : {};

  return {
    lead_id: GTM_LEAD,
    profile: {
      lead_id: GTM_LEAD,
      profile_id: supply.activated ? "profile-1" : null,
      profile_url: supply.activated ? LINKEDIN : null,
      public_identifier: supply.activated ? "ada-lovelace" : null,
      linkedin_verification_status: "VERIFIED",
      linkedin_verified_at: ISO,
      linkedin_match_confidence: 93,
      name: fact(PERSON),
      headline: fact("Head of Engineering"),
      company: fact(COMPANY),
      role: fact("Head of Engineering"),
      location: fact("London"),
      ...derived,
      lead_score: wireScore(82),
    },
    // Absent entirely when nothing was observed: `toActivity` answers with an unknown
    // level, which is what puts band 5 on its absence sentence rather than on a zero.
    activity: supply.activityLevel
      ? {
          score: wireScore(64),
          level: fact(supply.activityLevel, {
            source_surface: "LINKEDIN_ACTIVITY_TAB",
            is_derived: true,
          }),
          observed_at: ISO,
          is_stale: false,
          source_surface: "LINKEDIN_ACTIVITY_TAB",
          components: {},
        }
      : undefined,
    channels: [],
    recommended_channel: null,
    state: {
      relationship_state: fact(supply.relationshipState),
      conversation_state: fact(supply.conversationState),
      confirmation_status: "NOT_APPLICABLE",
      display_summary: "Warm-up ready",
      display_summary_is_derived: true,
    },
    message_versions: [],
    updated_at: ISO,
  };
}

/** `ProspectStateFullOut`. The belief, the intents and the timing read. */
function wireStateFull(supply: Supply) {
  return {
    lead_id: GTM_LEAD,
    state_version: supply.stateVersion,
    journey_state: supply.journeyState
      ? fact(supply.journeyState, { is_derived: true })
      : fact(null),
    state_confidence: 66,
    state_flags: [],
    dimensions: {},
    intents: supply.intents.map((intent) => ({
      intent_type: intent.intentType,
      value: intent.value,
      confidence: intent.confidence,
      source: "DERIVED",
      evaluated_at: intent.evaluated ? ISO : null,
      decay_rate: 0,
      signal_ids: [],
      is_derived: true,
    })),
    channels: [],
    timing: {
      last_meaningful_signal_at: supply.meaningfulSignal ? ISO : null,
      signal_freshness: 0,
      urgency: 0,
      cooldown_until: null,
      ideal_next_action_window_start: null,
      ideal_next_action_window_end: null,
      within_business_hours: "WITHIN",
      activity_trend_flag: "STEADY",
    },
    dimension_confidence: {},
    do_not_contact: fact(null),
    updated_at: ISO,
  };
}

/** `NextBestActionOut`. `recommended: null` is a real answer, not a gap. */
function wireNextBestAction(supply: Supply) {
  if (!supply.ranking) return { lead_id: GTM_LEAD };
  const { actionType, channel, actionConfidence, bullets } = supply.ranking;
  const candidate = {
    recommendation_id: "reco-1",
    action_type: actionType,
    channel,
    execution_verb: "SEND_MESSAGE",
    executable: true,
    unexecutable_reason: null,
    rank: 1,
    is_recommended: true,
    action_score: wireScore(77),
    action_confidence: actionConfidence,
    state_confidence: 66,
    terms: [],
    unavailable_terms: [],
    available_weight_mass: 88,
    exclusion_reason: null,
    // A recommendation with no persisted reasoning is a real payload, and the card has its
    // own sentence for it — so an empty bullet list travels as a null explanation rather
    // than as an explanation carrying nothing.
    explanation:
      bullets.length === 0
        ? null
        : {
            why_now: bullets.map((bullet) => ({
              signal_id: bullet.signalId,
              signal_type: bullet.signalType,
              event_timestamp: bullet.eventTimestamp,
              effective_strength: bullet.effectiveStrength,
              term: "signal_freshness",
              contribution_hundredths: 18,
              evidence_id: bullet.evidenceId,
            })),
            why_this_channel: [],
            why_this_message: null,
            why_not_the_other_channels: [],
            scope: null,
            versions: {},
          },
    expires_at: null,
    computed_at: ISO,
  };
  return {
    lead_id: GTM_LEAD,
    evaluation_id: "eval-1",
    computed_at: ISO,
    expires_at: null,
    recommended: candidate,
    candidates: [candidate],
    lifecycle: null,
  };
}

/**
 * The one action-queue page the dossier reads for the whole page.
 *
 * `has_more: false` is what licenses `OverlayState`'s `none`: a truncated page cannot say
 * this prospect is unranked, only that we did not look at all of it.
 */
function wireQueuePage(supply: Supply) {
  if (!supply.queueRow) return { items: [], next_cursor: null, has_more: false };
  const row = supply.queueRow;
  return {
    items: [
      {
        lead_id: GTM_LEAD,
        recommendation_id: "reco-1",
        profile_id: supply.activated ? "profile-1" : null,
        profile_url: supply.activated ? LINKEDIN : null,
        name: fact(PERSON),
        headline: fact("Head of Engineering"),
        company: fact(COMPANY),
        journey_state: supply.journeyState
          ? fact(supply.journeyState, { is_derived: true })
          : fact(null),
        relationship_state: fact(supply.relationshipState),
        action_type: supply.ranking?.actionType ?? "WAIT",
        channel: supply.ranking?.channel ?? null,
        execution_verb: "SEND_MESSAGE",
        executable: true,
        unexecutable_reason: null,
        action_score: wireScore(77),
        action_confidence: 63,
        state_confidence: 66,
        priority_tier: "TODAY",
        urgency: row.urgency,
        expected_success_probability: row.expectedSuccessProbability,
        business_value: row.businessValue,
        signal_freshness: row.signalFreshness,
        why_now: [],
        expires_at: null,
        computed_at: ISO,
      },
    ],
    next_cursor: null,
    has_more: false,
  };
}

/** The ledger, so `CreditsProvider` and every price tag have a server answer. */
function wireCredits() {
  return {
    brand_id: BRAND,
    balance: 40,
    prices: [
      { action: "ENRICH", credits: 1 },
      { action: "CONTACT", credits: 1 },
      { action: "ACTIVATE", credits: 2 },
    ],
    history: [],
  };
}

// ─── Transport ────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/**
 * Every route the dossier can reach, answered from one supply.
 *
 * Ordered longest-first: `/prospect/{id}/state` and `/prospect/{id}` both contain
 * `/prospect/`, and matching the bare read first would answer the belief with a profile.
 */
function serve(supply: Supply) {
  // The request log, cleared at the top of every run rather than in `beforeEach`.
  //
  // fast-check re-enters the predicate a hundred times inside one `it`, and `beforeEach`
  // runs once for the whole `it` — so a log reset there would leave run 40 reading the
  // accumulated calls of runs 1-39. `serve` is the first thing every run does, which makes
  // it the one place the reset is guaranteed to happen once per supply. `mockClear` and not
  // `mockReset`: the implementation is being replaced on the next line and a reset would
  // drop it.
  fetchMock.mockClear();
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.includes("/credits")) return ok(wireCredits());
    if (url.includes("/action-queue")) return ok(wireQueuePage(supply));
    if (url.includes("/next-best-action")) return ok(wireNextBestAction(supply));
    if (url.includes("/timeline")) return ok({ entries: [], next_cursor: null, has_more: false });
    if (url.includes("/state")) return ok(wireStateFull(supply));
    if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail(supply));
    return ok({});
  });
}

// ─── Harness ──────────────────────────────────────────────────────────────────

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker, which carries the stage. Exactly one per mounted dossier. */
const STAGE = "[data-gtm-stage]";
/** Band 2's `ProspectHeader` renders a `<dl>` only once `getProspect` has landed. */
const LOADED = '[data-gtm-section="prospect"] dl';

/** How many dossiers are on the page. Exactly one, or a run leaked its mount. */
const mounted = () => document.body.querySelectorAll(STAGE).length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

function renderPage(leads: QualifiedLead[] = [qualifiedLead()]) {
  vi.mocked(evaAPI.getWorkspace).mockResolvedValue(workspace(leads));
  return render(
    <MemoryRouter initialEntries={[`/prospect-intelligence/${BRAND}`]}>
      <CreditsProvider brandId={BRAND}>
        <Routes>
          <Route path="/prospect-intelligence/:spaceId" element={<ProspectIntelligence />} />
        </Routes>
      </CreditsProvider>
    </MemoryRouter>
  );
}

/**
 * The loaded dossier for one supply.
 *
 * The wait is on the stage *and* on a payload-derived element, and both are needed. Band 3
 * renders from the first paint — a prospect whose read is still in flight is `ENRICHED`,
 * which is a real answer and not a placeholder — so a fixture whose expected stage is
 * `ENRICHED` would satisfy a stage-only wait before its payload had landed, and every
 * assertion below would then be measuring an empty page.
 */
async function openDossier(supply: Supply) {
  serve(supply);
  const utils = renderPage([qualifiedLead({ signals: evaSignals(supply) })]);
  const container = utils.container;
  const expected = stageFor(supply);

  await waitFor(() => {
    expect(stageOf(container)).toBe(expected);
    expect(container.querySelector(LOADED)).not.toBeNull();
  });

  return {
    container,
    dossier: container.querySelector(DOSSIER) as HTMLElement,
    user: userEvent.setup(),
  };
}

// ─── Reading the screen ───────────────────────────────────────────────────────

/** Whether this node sits inside an evidence disclosure — i.e. under a `<details>`. */
function insideDisclosure(node: Node | null, root: Element): boolean {
  let current: Node | null = node;
  while (current && current !== root.parentNode) {
    if ((current as Element).tagName === "DETAILS") return true;
    current = current.parentNode;
  }
  return false;
}

interface Statement {
  text: string;
  /** The element holding the text, for a counterexample that points at a place. */
  where: string;
}

/** Where in the dossier an element sits, named by the nearest band marker. */
function bandOfElement(element: Element | null): string {
  let current: Element | null = element;
  while (current) {
    const section = current.getAttribute?.("data-gtm-section");
    if (section) return section;
    const region = current.getAttribute?.("data-gtm-region");
    if (region) return region;
    current = current.parentElement;
  }
  return "dossier";
}

/**
 * Every non-empty text node in the dossier that is *not* inside a disclosure.
 *
 * Text nodes rather than `textContent`, so `Urgency: High · 68` is reported as the three
 * fragments it is written as and a violation names the element that holds it rather than
 * every ancestor of it.
 */
function primaryStatements(root: Element): Statement[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Statement[] = [];
  let node = walker.nextNode();
  while (node) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length > 0 && !insideDisclosure(node.parentNode, root)) {
      out.push({ text, where: bandOfElement(node.parentElement) });
    }
    node = walker.nextNode();
  }
  return out;
}

/** The same walk, over everything — inside disclosures included. */
function allStatements(root: Element): Statement[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Statement[] = [];
  let node = walker.nextNode();
  while (node) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length > 0) out.push({ text, where: bandOfElement(node.parentElement) });
    node = walker.nextNode();
  }
  return out;
}

/** Whether any element in the dossier holds exactly this sentence and nothing else. */
function says(root: ParentNode, sentence: string): boolean {
  return Array.from(root.querySelectorAll("p, h1, h2, h3, span, div, li")).some(
    (element) => (element.textContent ?? "").trim() === sentence
  );
}

const NBA_CARD = '[data-gtm-section="next-best-action"]';

/** The EPS dimension rows, keyed by the wire field each one renders. */
function measureRows(root: Element): Map<string, HTMLElement> {
  const rows = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-measure]").forEach((row) => {
    rows.set(row.getAttribute("data-measure") ?? "", row);
  });
  return rows;
}

/** Band 6's intent rows, keyed by intent type. */
function intentRows(root: Element): Map<string, HTMLElement> {
  const rows = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-intent-type]").forEach((row) => {
    rows.set(row.getAttribute("data-intent-type") ?? "", row);
  });
  return rows;
}

/**
 * The why-now bullets the card states *primarily* — outside its own "View why".
 *
 * `NextBestActionCard` leads with one bullet and puts the rest behind the disclosure, so
 * this is the set R8.6's "Why now?" statement is made of.
 */
function primaryBullets(root: Element): string[] {
  const card = root.querySelector(NBA_CARD);
  if (!card) return [];
  return Array.from(card.querySelectorAll<HTMLElement>("li[data-signal-type]"))
    .filter((li) => !insideDisclosure(li, card))
    .map((li) => li.getAttribute("data-signal-type") ?? "");
}

/** Band 5's activity list, in the order it is on screen. */
function activityLines(root: Element): string[] {
  const band = root.querySelector('[data-gtm-section="activity"]');
  if (!band) return [];
  return Array.from(band.querySelectorAll("ul > li")).map((li) =>
    (li.textContent ?? "").trim()
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// The generated space
// ══════════════════════════════════════════════════════════════════════════════
//
// Enum-valued fields are drawn from a mix of values the label tables map and values they do
// not, because that mix is the whole subject of Property 23 — R8.3 is a claim about what a
// rep reads, and a payload carrying a value nobody has written copy for is the case where a
// lookup-with-raw-fallback becomes visible. The mapped values dominate the distribution
// because they are what actually arrives.

/**
 * Journey positions `GTM_JOURNEY_LABELS` maps.
 *
 * All three are members of `JourneyState` (`backend/core/linkedin/gtm/journey_state.py`) and
 * all three have copy. The `unmapped` arm below is where a value no table maps comes from —
 * this list had carried `WARMING_UP`, which is neither a member of the 21-value projection
 * nor a key in any table, so it was an unmapped value wearing a mapped value's label and it
 * made a mapped-vocabulary counterexample indistinguishable from an unmapped one.
 */
const JOURNEY = ["CONVERSATION_ACTIVE", "WARMUP_SENT", "MEETING_BOOKED"] as const;
const RELATIONSHIP = ["NOT_CONNECTED", "CONNECTED", "CONNECTION_PENDING"] as const;
const CONVERSATION = ["WARMUP_READY", "WAITING_FOR_REPLY", "CONVERSATION_ACTIVE"] as const;
const ACTIVITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "VERY_HIGH"] as const;
const MAPPED_ACTIONS = Object.keys(GTM_NBA_ACTION_LABELS);
const MAPPED_SIGNALS = Object.keys(GTM_SIGNAL_TYPE_LABELS);
const MAPPED_INTENTS = Object.keys(GTM_INTENT_LABELS);

/** Values the server can send and no table maps. Real: the tables are open by design. */
const UNMAPPED = [
  "NEWLY_DECLARED_STATE",
  "PARTNER_INTRO_REQUESTED",
  "SUPERSEDED_BY_POLICY",
] as const;

// ── The four derived profile facts, at the backend's own values ──
//
// Not invented. `observed_seniority` is one of `scoring_tables.SENIORITY_*`; `icp_match` is
// `_qualification_of()`'s answer, which is a criteria count when the ICP details carry
// booleans and the gate's own verdict otherwise; `intent_signal` is `sales_leads.intent_class`,
// keyed by `INTENT_CLASS_SCORES`; `acv_tier` is Eva's tier, persisted lower-case.

const SENIORITY_RANKS = ["C_LEVEL", "FOUNDER", "VP", "DIRECTOR", "MANAGER", "IC"] as const;
const ICP_VERDICTS = ["PASSED", "NOT_PASSED", "3/5 criteria matched"] as const;
const INTENT_CLASSES = ["HIGH_INTENT_LEAD", "REFERRAL", "QUESTION"] as const;
const ACV_TIERS = ["high", "medium", "low"] as const;

const derivedProfileArb: fc.Arbitrary<DerivedProfileSupply> = fc.record({
  seniority: fc.constantFrom(...SENIORITY_RANKS),
  icpMatch: fc.constantFrom(...ICP_VERDICTS),
  intentSignal: fc.constantFrom(...INTENT_CLASSES),
  acvTier: fc.constantFrom(...ACV_TIERS),
});

const unmapped = fc.constantFrom(...UNMAPPED);

/** Mostly a mapped value, sometimes one no table has copy for. */
function enumArb(mapped: readonly string[]): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 5, arbitrary: fc.constantFrom(...mapped) },
    { weight: 1, arbitrary: unmapped }
  );
}

/**
 * A measure on the Hundredths_Scale — a bounded **integer**, and only ever that.
 *
 * ── Why the fractional arm this generator used to carry is gone ──
 *
 * It generated one-decimal measures on the reasoning that the TS type is `number` with no
 * integer constraint, and it found a counterexample: a supplied `0.1` renders `0.10`,
 * because the eleven GTM panels share a `formatNumber` documented as "a number as the
 * server sent it, to two places when it has a fraction". Read against R9.8 that is two
 * decimal places from a one-decimal supply.
 *
 * It is not reachable. `Hundredths = Annotated[int, Field(ge=0, le=100)]`
 * (`backend/schemas/gtm.py:710`) types every measure the dossier renders — `urgency`,
 * `expected_success_probability`, `business_value`, `signal_freshness`,
 * `action_confidence`, `state_confidence`, `effective_strength` and every intent value and
 * confidence — so pydantic refuses a fractional one before it reaches the wire. A generator
 * that produces a payload the API cannot serialise is not finding a defect in the page, it
 * is measuring a formatter against an input it will never see, and the counterexample it
 * yields would send a reader to change copy that is right.
 *
 * The clause it leaves behind is stronger rather than weaker: with an integer supply the
 * precision bound is **zero decimal places**, so the scan asserts that no number anywhere in
 * the primary region carries a decimal point at all. A page that divided a measure by a
 * hundred, or printed `68.0`, or averaged two dimensions, fails on that.
 */
const measureArb = fc.integer({ min: 0, max: 100 });

const bulletArb: fc.Arbitrary<BulletSupply> = fc
  .tuple(
    fc.integer({ min: 1, max: 99 }),
    fc.option(enumArb(MAPPED_SIGNALS), { nil: null }),
    fc.option(fc.constantFrom(ISO, EARLIER), { nil: null }),
    measureArb
  )
  .map(([n, signalType, eventTimestamp, effectiveStrength]) => ({
    signalId: `sig-${n}`,
    evidenceId: `ev-${n}`,
    signalType,
    eventTimestamp,
    effectiveStrength,
  }));

const intentArb: fc.Arbitrary<IntentSupply> = fc
  .tuple(
    enumArb(MAPPED_INTENTS),
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 }),
    fc.boolean()
  )
  .map(([intentType, value, confidence, evaluated]) => ({
    intentType,
    value,
    confidence,
    evaluated,
  }));

const eventArb: fc.Arbitrary<EventSupply> = fc
  .tuple(
    fc.integer({ min: 1, max: 99 }),
    fc.constantFrom<SignalType>("job_posting", "funding", "product_launch")
  )
  .map(([n, signalType]) => ({
    id: `evt-${n}`,
    signalType,
    // Distinct per event, so a re-ordered list is detectable rather than merely shorter.
    detail: `Observed item ${n}`,
  }));

const supplyArb: fc.Arbitrary<Supply> = fc
  .record({
    activated: fc.boolean(),
    stateVersion: fc.integer({ min: 0, max: 12 }),
    meaningfulSignal: fc.boolean(),
    ranking: fc.option(
      fc.record({
        actionType: enumArb(MAPPED_ACTIONS),
        channel: fc.option(fc.constantFrom("LINKEDIN", "EMAIL"), { nil: null }),
        actionConfidence: measureArb,
        bullets: fc.array(bulletArb, { maxLength: 3 }),
      }),
      { nil: null }
    ),
    queueRow: fc.option(
      fc.record({
        urgency: measureArb,
        expectedSuccessProbability: measureArb,
        businessValue: measureArb,
        signalFreshness: measureArb,
      }),
      { nil: null }
    ),
    intents: fc.array(intentArb, { maxLength: 4 }),
    events: fc.array(eventArb, { maxLength: 3 }),
    activityLevel: fc.option(enumArb(ACTIVITY_LEVELS), { nil: null }),
    journeyState: fc.option(enumArb(JOURNEY), { nil: null }),
    relationshipState: enumArb(RELATIONSHIP),
    conversationState: enumArb(CONVERSATION),
    derivedProfile: fc.option(derivedProfileArb, { nil: null }),
  })
  .map((supply) => ({
    ...supply,
    // A ranking is what makes a prospect `RECOMMENDED`, and that stage exists only after
    // activation. An unactivated prospect with a recommendation is not a state the backend
    // can produce: the evaluation runs off a belief the track route creates.
    ranking: supply.activated ? supply.ranking : null,
    // Intent types are unique per prospect — eleven rows, one per type — so a duplicate in
    // the generated list would be a payload the engine cannot emit.
    intents: supply.intents.filter(
      (intent, index, all) =>
        all.findIndex((other) => other.intentType === intent.intentType) === index
    ),
    events: supply.events.filter(
      (event, index, all) => all.findIndex((other) => other.id === event.id) === index
    ),
  }));

/** The payload for a prospect the backend has told us nothing about beyond activation. */
const EMPTY_SUPPLY: Supply = {
  activated: true,
  stateVersion: 0,
  meaningfulSignal: false,
  ranking: null,
  queueRow: null,
  intents: [],
  events: [],
  activityLevel: null,
  journeyState: null,
  relationshipState: "NOT_CONNECTED",
  conversationState: "WARMUP_READY",
  derivedProfile: null,
};

/** `intentSummary`'s contract, restated here so the expectation is not read off the page. */
function expectedIntentRows(supply: Supply): string[] {
  return [...supply.intents]
    .filter((intent) => intent.value > 0)
    .sort((a, b) => (b.value !== a.value ? b.value - a.value : b.confidence - a.confidence))
    .slice(0, 3)
    .map((intent) => intent.intentType);
}

/** The four dimension keys an `ActionQueueItem` carries, and the only four band 4 may show. */
const EPS_KEYS = [
  "urgency",
  "expected_success_probability",
  "business_value",
  "signal_freshness",
] as const;

/** Which supplied number each EPS row renders. */
function epsValue(row: MeasureSupply, key: string): number {
  switch (key) {
    case "urgency":
      return row.urgency;
    case "expected_success_probability":
      return row.expectedSuccessProbability;
    case "business_value":
      return row.businessValue;
    default:
      return row.signalFreshness;
  }
}

/** The meaning label each EPS row is headed with. */
const EPS_MEANING: Record<string, string> = {
  urgency: PROSPECT_GTM_LABELS.epsUrgency,
  expected_success_probability: ACTION_CARD_LABELS.expectedOutcome,
  business_value: PROSPECT_GTM_LABELS.epsBusinessValue,
  signal_freshness: PROSPECT_GTM_LABELS.epsSignalFreshness,
};

const decimalsOf = (value: number) => (String(value).split(".")[1] ?? "").length;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Eva's workspace read is her own, with a wire format this file has no business
  // restating. Everything GTM goes through the transport unmocked, which is the point.
  vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(workspace([qualifiedLead()]));
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 21 — nothing is presented that a backend read did not supply
// ══════════════════════════════════════════════════════════════════════════════

describe("Feature: sales-workflow-frontend-restructure, Property 21: Nothing is presented that a backend read did not supply", () => {
  // The instrument, checked before anything is generated against it. A scan that could not
  // find the dossier would pass every clause below for reasons that have nothing to do with
  // R9.1.
  it("mounts one dossier whose statements are readable", async () => {
    const { container, dossier } = await openDossier(EMPTY_SUPPLY);
    expect(mounted()).toBe(1);
    expect(stageOf(container)).toBe("WAITING");
    expect(primaryStatements(dossier).length).toBeGreaterThan(5);
    cleanup();
  });

  it(
    "presents scoring, intent, signals, activity and recommendation exactly as supplied",
    // Dozens of whole-page mounts do not fit the 5s default.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(supplyArb, async (supply) => {
          const { container, dossier } = await openDossier(supply);

          try {
            // One dossier on the page, so every reading below is this run's answer.
            expect(mounted()).toBe(1);
            const active = activeFor(supply);

            // ── Scoring: at most the dimensions the backend supplied (R8.5) ──
            //
            // The EPS_Summary is the queue row joined by lead id, so no row means no
            // dimensions at all — never a defaulted band and never a zero standing in for a
            // measure nobody took.
            const measures = measureRows(dossier);
            if (supply.queueRow && supply.ranking) {
              expect(
                [...measures.keys()].sort(),
                "the dimension set is not the four the row carries"
              ).toEqual([...EPS_KEYS].sort());
              EPS_KEYS.forEach((key) => {
                const supplied = epsValue(supply.queueRow!, key);
                expect(measures.get(key)!.textContent).toContain(String(Math.round(supplied)));
              });
            } else if (!supply.queueRow) {
              expect(
                measures.size,
                "dimensions were presented for a prospect with no queue row"
              ).toBe(0);
            }

            // ── Buying intent: the supplied rows, strongest first, nothing else (R9.1) ──
            const intents = expectedIntentRows(supply);
            const rendered = [...intentRows(dossier).keys()];
            if (active) {
              expect(
                rendered,
                `intent rows do not equal the supplied observed intents`
              ).toEqual(intents);
            } else {
              // Band 6 is not on screen before activation: nothing has been evaluated, so
              // the band could only report an absence.
              expect(rendered).toHaveLength(0);
            }

            // ── Signals: the why-now bullets are the backend's, entire (R8.6, R8.7) ──
            const suppliedBullets = supply.ranking?.bullets ?? [];
            const leading = suppliedBullets
              .slice(0, 1)
              .map((bullet) => bullet.signalType)
              .filter((type): type is string => type !== null);
            expect(
              primaryBullets(dossier),
              "the stated why-now bullets are not the leading supplied bullets"
            ).toEqual(leading);
            // And no bullet anywhere on the dossier names a signal nobody sent.
            const suppliedTypes = new Set(
              suppliedBullets.map((bullet) => bullet.signalType).filter(Boolean)
            );
            dossier.querySelectorAll("[data-signal-type]").forEach((element) => {
              const type = element.getAttribute("data-signal-type") ?? "";
              expect(
                suppliedTypes.has(type),
                `a bullet named ${type}, which no read supplied`
              ).toBe(true);
            });
            // A recommendation with no persisted reasoning says so rather than composing one.
            if (supply.ranking && suppliedBullets.length === 0) {
              expect(says(dossier, NEXT_BEST_ACTION_CARD_LABELS.noReasoning)).toBe(true);
            }

            // ── Activity: the payload's order, never a client-side ranking (R8.10) ──
            const expectedLines = supply.events.map((event) => event.detail);
            const lines = activityLines(dossier);
            expect(
              lines.length,
              "band 5 presented more activity than the payload carried"
            ).toBeLessThanOrEqual(supply.events.length);
            expectedLines.forEach((detail, index) => {
              expect(lines[index], "band 5 re-ordered the supplied activity").toContain(detail);
            });

            // ── Recommendations: the card exists iff one was recommended (R9.1) ──
            const card = dossier.querySelector(NBA_CARD);
            expect(Boolean(card), "a recommendation card with no recommendation behind it").toBe(
              supply.ranking !== null
            );
            if (!supply.ranking) {
              // And in its place, exactly the sentence the absence vocabulary declares —
              // computed here from the supply through the page's own exported rule, so a
              // fourth way of saying "nothing" would fail rather than pass unnoticed.
              const expectedAbsence = nbaAbsenceStatement({
                active,
                hasRecommendation: false,
                rankingFailed: false,
                timing: active
                  ? {
                      lastMeaningfulSignalAt: supply.meaningfulSignal ? ISO : null,
                      signalFreshness: 0,
                      urgency: 0,
                      cooldownUntil: null,
                      idealNextActionWindowStart: null,
                      idealNextActionWindowEnd: null,
                      withinBusinessHours: "WITHIN",
                      activityTrendFlag: "STEADY",
                    }
                  : null,
              });
              if (expectedAbsence !== null) {
                expect(
                  says(dossier, expectedAbsence),
                  "the recommendation slot does not carry its declared absence sentence"
                ).toBe(true);
              }
            }
          } finally {
            // At the end of the run, including the failing one: fast-check shrinks by
            // re-running the predicate, and a run that left its dossier mounted would hand
            // the shrinker a page with two of them and a counterexample describing this
            // harness rather than the product.
            cleanup();
          }
        }),
        { numRuns: 30 }
      );
      expect(mounted()).toBe(0);
    }
  );

  it("renders only absence statements for a payload that carries nothing", async () => {
    const { dossier } = await openDossier(EMPTY_SUPPLY);

    try {
      expect(mounted()).toBe(1);

      // Nothing scored, nothing intended, nothing recommended, nothing observed.
      expect(measureRows(dossier).size).toBe(0);
      expect(intentRows(dossier).size).toBe(0);
      expect(dossier.querySelector(NBA_CARD)).toBeNull();
      expect(dossier.querySelectorAll("[data-signal-type]")).toHaveLength(0);
      expect(activityLines(dossier)).toHaveLength(0);

      // And in each of those places, the declared sentence — not a blank, not a zero.
      expect(says(dossier, GTM_ABSENCE_LABELS.noMeaningfulSignal)).toBe(true);
      expect(says(dossier, GTM_ABSENCE_LABELS.noActivity)).toBe(true);
      expect(says(dossier, PROSPECT_STAGE_LABELS.WAITING.body)).toBe(true);
      expect(says(dossier, INTENT_PANEL_LABELS.neverEvaluated)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("presents the action reason from the backend's own explanation and never its own", async () => {
    // A recommendation whose reasoning was never persisted: the surface the rep is handed
    // must say so rather than filling the slot (R12.5).
    const supply: Supply = {
      ...EMPTY_SUPPLY,
      stateVersion: 3,
      ranking: {
        actionType: "SEND_LINKEDIN_WARMUP",
        channel: "LINKEDIN",
        actionConfidence: 63,
        bullets: [],
      },
    };
    const { dossier, user } = await openDossier(supply);

    try {
      // Press two of the two that open the Contextual_Outreach_Surface.
      await user.click(
        within(dossier).getByRole("button", {
          name: new RegExp(NEXT_BEST_ACTION_CARD_LABELS.takeAction),
        })
      );

      const reason = await waitFor(() => {
        const slot = dossier.querySelector('[data-outreach-slot="reason"]');
        expect(slot).not.toBeNull();
        return slot as HTMLElement;
      });

      // The component's own sentence for an unpersisted argument, and nothing invented.
      expect(reason.textContent).toContain(ACTION_EXPLANATION_LABELS.empty);
      expect(reason.querySelectorAll("[data-signal-type]")).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 23 — no primary statement contains backend vocabulary
// ══════════════════════════════════════════════════════════════════════════════
//
// Two patterns, because backend vocabulary reaches a screen in two shapes.
//
// `SCREAMING_SNAKE` is the unambiguous one: two or more segments joined by an underscore is
// an identifier and never a sentence.
//
// `LONE_SCREAMING` catches the single-word members of the same unions — `EXECUTIVE`,
// `STRONG`, `UNAVAILABLE` — which carry no underscore and are just as much the backend's
// word as the others. Four characters is the floor so the copy's own acronyms are not
// flagged: `CTA` and `ICP` are three, and both are what a rep calls the thing.

const SCREAMING_SNAKE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
const LONE_SCREAMING = /\b[A-Z]{4,}\b/;

/** Copy that is legitimately all-caps. Stated as a set so an addition is deliberate. */
const COPY_ACRONYMS = new Set(["LINKEDIN"]);

function backendVocabularyIn(text: string): string | null {
  const snake = text.match(SCREAMING_SNAKE);
  if (snake) return snake[0];
  const lone = text.match(LONE_SCREAMING);
  if (lone && !COPY_ACRONYMS.has(lone[0])) return lone[0];
  return null;
}

describe("Feature: sales-workflow-frontend-restructure, Property 23: No primary statement contains backend vocabulary", () => {
  it(
    "keeps every raw enum value out of the primary region",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(supplyArb, async (supply) => {
          const { dossier } = await openDossier(supply);

          try {
            expect(mounted()).toBe(1);

            const offences = primaryStatements(dossier)
              .map((statement) => ({
                statement,
                token: backendVocabularyIn(statement.text),
              }))
              .filter((entry) => entry.token !== null);

            // Every offence at once rather than the first: a reader triaging this needs the
            // whole list, and a property that stopped at one would be re-run four times to
            // learn what a single failure could have said.
            expect(
              offences.map((entry) => `${entry.statement.where}: ${entry.token}`),
              `backend vocabulary in the primary region — ${JSON.stringify(
                offences.map((entry) => entry.statement.text).slice(0, 8)
              )}`
            ).toEqual([]);
          } finally {
            cleanup();
          }
        }),
        { numRuns: 30 }
      );
      expect(mounted()).toBe(0);
    }
  );

  it(
    "keeps every evidence identifier inside an evidence disclosure",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(supplyArb, async (supply) => {
          const { dossier } = await openDossier(supply);

          try {
            expect(mounted()).toBe(1);

            // The signal and evidence ids the payload carried. These are the auditable
            // basis of the why-now statement, which R8.8 puts behind a disclosure — the
            // statement itself is hoisted by R8.6 and is not what this clause is about.
            const identifiers = (supply.ranking?.bullets ?? []).flatMap((bullet) => [
              bullet.signalId,
              bullet.evidenceId,
            ]);
            if (identifiers.length === 0) return;

            const leaked = primaryStatements(dossier).filter((statement) =>
              identifiers.some((id) => statement.text.includes(id))
            );
            expect(
              leaked.map((statement) => `${statement.where}: ${statement.text}`),
              "an evidence identifier is stated outside a disclosure"
            ).toEqual([]);
          } finally {
            cleanup();
          }
        }),
        { numRuns: 30 }
      );
      expect(mounted()).toBe(0);
    }
  );

  // The other half of the same claim, and the reason the clause above is not vacuous: the
  // identifiers are not merely absent from the page, they are *in* the disclosure. A scan
  // that passed because nothing rendered them at all would say nothing about R8.8.
  it("presents the evidence behind the statement once the disclosure is opened", async () => {
    const supply: Supply = {
      ...EMPTY_SUPPLY,
      stateVersion: 4,
      ranking: {
        actionType: "SEND_LINKEDIN_WARMUP",
        channel: "LINKEDIN",
        actionConfidence: 63,
        bullets: [
          {
            signalId: "sig-7",
            evidenceId: "ev-7",
            signalType: "LINKEDIN_POST",
            eventTimestamp: ISO,
            effectiveStrength: 34,
          },
        ],
      },
    };
    const { dossier, user } = await openDossier(supply);

    try {
      const card = dossier.querySelector(NBA_CARD) as HTMLElement;
      // Before the press: the statement, in the rep's words, and no identifier.
      expect(primaryBullets(dossier)).toEqual(["LINKEDIN_POST"]);
      expect(
        primaryStatements(card).some((statement) => statement.text.includes("sig-7"))
      ).toBe(false);

      await user.click(within(card).getByText(NEXT_BEST_ACTION_CARD_LABELS.viewWhy));

      await waitFor(() => {
        const inside = allStatements(card).filter(
          (statement) => insideDisclosureText(card, statement.text) && statement.text.includes("sig-7")
        );
        expect(inside.length, "the evidence disclosure does not carry the signal id").toBeGreaterThan(0);
      });
    } finally {
      cleanup();
    }
  });
});

/** Whether this text appears inside a `<details>` somewhere under `root`. */
function insideDisclosureText(root: Element, text: string): boolean {
  return Array.from(root.querySelectorAll("details")).some((details) =>
    (details.textContent ?? "").includes(text)
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Property 24 — a number never gains precision or loses its meaning
// ══════════════════════════════════════════════════════════════════════════════
//
// Two clauses, read where each one lives.
//
// **Precision is global.** R9.8 is a claim about every number on screen, so the scan is over
// every numeric token in the primary region and the bound is the widest precision the
// payload carried. Nothing here has to know which slot renders which field: a token with
// more decimal places than anything the backend sent cannot have come from the backend.
//
// **Meaning is per row.** R8.4 and R9.7 name the slots — each scoring dimension, each
// confidence — so the meaning clause is asserted against the rows that carry them, where
// "the accessible name carries the meaning label alongside the number" is checkable as one
// string rather than as a guess about which label belongs to which figure.

const NUMERIC_TOKEN = /\d+(?:\.\d+)?/g;

/** Every number the payload actually contained. */
function suppliedNumbers(supply: Supply): number[] {
  const numbers: number[] = [];
  if (supply.queueRow) {
    EPS_KEYS.forEach((key) => numbers.push(epsValue(supply.queueRow!, key)));
  }
  if (supply.ranking) {
    numbers.push(supply.ranking.actionConfidence);
    supply.ranking.bullets.forEach((bullet) => numbers.push(bullet.effectiveStrength));
  }
  supply.intents.forEach((intent) => {
    numbers.push(intent.value, intent.confidence);
  });
  numbers.push(supply.stateVersion);
  return numbers;
}

describe("Feature: sales-workflow-frontend-restructure, Property 24: A number never gains precision or loses its meaning", () => {
  it(
    "renders no number more precisely than it arrived, and no measure without its meaning",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(supplyArb, async (supply) => {
          const { dossier } = await openDossier(supply);

          try {
            expect(mounted()).toBe(1);

            // ── Precision (R9.8) ──
            const bound = Math.max(0, ...suppliedNumbers(supply).map(decimalsOf));
            const tooPrecise: string[] = [];
            primaryStatements(dossier).forEach((statement) => {
              const tokens: string[] = statement.text.match(NUMERIC_TOKEN) ?? [];
              tokens.forEach((token) => {
                const places = (token.split(".")[1] ?? "").length;
                if (places > bound) tooPrecise.push(`${statement.where}: ${token}`);
              });
            });
            expect(
              tooPrecise,
              `the payload's widest precision was ${bound} decimal place(s)`
            ).toEqual([]);

            // ── Meaning, on every scoring dimension (R8.4, R9.7, R19.3) ──
            //
            // The row is one run of text, so what a reader sees and what a screen reader
            // reads are the same sentence — which is what R19.3 asks for and why there is
            // no separate accessible name to check.
            measureRows(dossier).forEach((row, key) => {
              const text = (row.textContent ?? "").trim();
              expect(text, `dimension ${key} lost its meaning label`).toContain(
                EPS_MEANING[key]
              );
              expect(text, `dimension ${key} carries no number`).toMatch(/\d/);
            });
            intentRows(dossier).forEach((row, intentType) => {
              const text = (row.textContent ?? "").trim();
              const meaning = GTM_INTENT_LABELS[intentType] ?? intentType;
              expect(text, `intent ${intentType} lost its meaning label`).toContain(meaning);
              expect(text).toMatch(/\d/);
            });
          } finally {
            cleanup();
          }
        }),
        { numRuns: 30 }
      );
      expect(mounted()).toBe(0);
    }
  );

  /**
   * The EPS form R8.4 pins, rendered.
   *
   * **The number is 74 and not the requirement's 68, on purpose.** R8.4 illustrates the form
   * as `"Urgency: High · 68"`, and the band is not the dossier's to choose:
   * `MEASURE_BAND_FLOORS` in `components/gtm/measure.ts` puts `HIGH` at 70, so a supplied 68
   * correctly reads `Urgency: Moderate · 68`. What the requirement pins is the *form* —
   * meaning label, then the band, then the server's own number — and the thresholds are
   * stated once in `measure.ts` precisely so two surfaces cannot disagree in words about the
   * same figure. A second banding table for this one band is the drift that module exists to
   * prevent, so the example uses a number that actually bands `HIGH` and asserts the
   * threshold itself beside it.
   */
  it("presents a scoring dimension as its meaning, its band and the server's number", async () => {
    // The claim the choice of 74 rests on, asserted rather than assumed.
    const highFloor = MEASURE_BAND_FLOORS.find(([band]) => band === "HIGH")?.[1];
    expect(highFloor).toBe(70);
    expect(bandOf(68)).toBe("MODERATE");
    expect(bandOf(74)).toBe("HIGH");

    const supply: Supply = {
      ...EMPTY_SUPPLY,
      stateVersion: 5,
      ranking: {
        actionType: "SEND_LINKEDIN_WARMUP",
        channel: "LINKEDIN",
        actionConfidence: 63,
        bullets: [],
      },
      queueRow: {
        urgency: 74,
        expectedSuccessProbability: 41,
        businessValue: 68,
        signalFreshness: 12,
      },
    };
    const { dossier } = await openDossier(supply);

    try {
      const rows = measureRows(dossier);
      expect((rows.get("urgency")!.textContent ?? "").trim()).toBe(
        `${PROSPECT_GTM_LABELS.epsUrgency}: ${MEASURE_BAND_LABELS.HIGH} · 74`
      );
      // The same form one band down, so the example pins the shape and not one string.
      expect((rows.get("business_value")!.textContent ?? "").trim()).toBe(
        `${PROSPECT_GTM_LABELS.epsBusinessValue}: ${MEASURE_BAND_LABELS.MODERATE} · 68`
      );
    } finally {
      cleanup();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 26 — the fifteen absence conditions have fifteen distinct honest sentences
// ══════════════════════════════════════════════════════════════════════════════
//
// Scanned against the copy tables, which is where R18.1's fifteen conditions actually live.
// A rendered scan could only reach the states this file reproduced, and a sentence that is
// wrong in the table is wrong on every surface that reads it.
//
// Fourteen of the fifteen are table entries. State 1 — no enriched prospects — is written
// inline in `ProspectIntelligence.tsx`, so it is *read off the page* below and fed into the
// same three clauses rather than copied here, where it could drift silently.
//
// ─── What a "next step" is, and why two states declare a companion ────────────
//
// R18.4 asks each statement to name what Weez is doing about the gap *or* what the rep can
// do next, and design §12 declares the marker set. Thirteen of the fifteen carry a marker in
// the sentence itself. Two do not, and both are conditions where the news is what already
// happened rather than what is under way:
//
//   state 4   identity verification failed. `activationStopped` reports a stopped
//             activation; the next step is the stage body it is rendered inside, which is
//             the `ENRICHED` copy offering both ways forward again.
//   state 11  insufficient credits. The sentence is the server's own `402` detail, which
//             names the price and the balance; the product's half is the paywall's standing
//             copy, which says the action did not happen and what to do about it.
//
// So each condition declares its `sentence` and, where the presentation is two strings, the
// `companion` rendered with it. Distinctness and the banned-phrase ban are asserted over the
// sentences alone; the next-step marker is asserted over the presentation, which is what a
// rep actually reads.

const NEXT_STEP_MARKERS = [
  // What Weez is doing about it.
  "is watching",
  "is looking",
  "Looking up",
  "keeps watching",
  "on a schedule",
  "appears here",
  "appears on",
  "fills the moment",
  "We're watching",
  "We'll surface",
  "We'll tell you",
  "updates itself",
  "is scanning",
  "adds them up",
  "will finish",
  "taking a first look",
  // What the rep can do next.
  "Try again",
  "Reach out now",
  "Click Enrich Now",
  "Top up",
  "widening the window",
  "trying the read again",
] as const;

/** The phrasings R18.3 bans outright. A bare em dash and the empty string included. */
const BANNED = ["No data available", "N/A"] as const;

interface AbsenceCondition {
  /** Its number in design §12, so a failure names the condition and not an index. */
  id: number;
  condition: string;
  /** Where the string lives, for the counterexample. */
  source: string;
  sentence: string;
  /** The copy rendered beside it, where the presentation is two strings. */
  companion?: string;
}

/**
 * The fourteen that live in a table, in design §12's order.
 *
 * Read from the tables rather than restated, so a copy edit that breaks one of the three
 * rules fails here instead of shipping.
 */
const TABLE_CONDITIONS: AbsenceCondition[] = [
  {
    id: 2,
    condition: "Enrichment in progress",
    source: "PROSPECT_STAGE_LABELS.ENRICHING.body",
    sentence: PROSPECT_STAGE_LABELS.ENRICHING.body,
  },
  {
    id: 3,
    condition: "Identity verification in progress",
    source: "PROSPECT_STAGE_LABELS.RESOLVING.body",
    sentence: PROSPECT_STAGE_LABELS.RESOLVING.body,
  },
  {
    id: 4,
    condition: "Identity verification failed",
    source: "GTM_IDENTITY_LABELS.activationStopped",
    sentence: GTM_IDENTITY_LABELS.activationStopped,
    companion: PROSPECT_STAGE_LABELS.ENRICHED.body,
  },
  {
    id: 5,
    condition: "Activation in progress",
    source: "PROSPECT_STAGE_LABELS.ACTIVATING.label",
    sentence: PROSPECT_STAGE_LABELS.ACTIVATING.label,
    companion: PROSPECT_STAGE_LABELS.ACTIVATING.body,
  },
  {
    id: 6,
    condition: "Activation waiting for observations",
    source: "PROSPECT_STAGE_LABELS.WAITING.body",
    sentence: PROSPECT_STAGE_LABELS.WAITING.body,
  },
  {
    id: 7,
    condition: "No meaningful signals yet",
    source: "GTM_ABSENCE_LABELS.noMeaningfulSignal",
    sentence: GTM_ABSENCE_LABELS.noMeaningfulSignal,
  },
  {
    id: 8,
    condition: "No next best action available",
    source: "GTM_ABSENCE_LABELS.noRecommendation",
    sentence: GTM_ABSENCE_LABELS.noRecommendation,
  },
  {
    id: 9,
    condition: "Next-best-action read failed",
    source: "GTM_ABSENCE_LABELS.rankingReadFailed",
    sentence: GTM_ABSENCE_LABELS.rankingReadFailed,
    companion: GTM_PAGE_LABELS.retry,
  },
  {
    id: 10,
    condition: "Activity unavailable",
    source: "GTM_ABSENCE_LABELS.noActivity",
    sentence: GTM_ABSENCE_LABELS.noActivity,
  },
  {
    id: 11,
    condition: "Insufficient credits",
    source: "CREDIT_LABELS.insufficientBody",
    sentence: CREDIT_LABELS.insufficientBody,
  },
  {
    id: 12,
    condition: "Backend read failure",
    source: "GTM_ABSENCE_LABELS.prospectReadFailed",
    sentence: GTM_ABSENCE_LABELS.prospectReadFailed,
    companion: GTM_PAGE_LABELS.retry,
  },
  {
    id: 13,
    condition: "No Action Queue items",
    source: "ATTENTION_LABELS.empty",
    sentence: ATTENTION_LABELS.empty,
  },
  {
    id: 14,
    condition: "No meetings",
    source: "MEETING_LABELS.empty",
    sentence: MEETING_LABELS.empty,
  },
  {
    id: 15,
    condition: "No analytics for the selected day",
    source: "ANALYTICS_LABELS.noActivity",
    sentence: ANALYTICS_LABELS.noActivity,
    // State 15's own next step: the day has no row, and the panel's neighbouring copy
    // names what would put one there.
    companion: ANALYTICS_LABELS.metricUnavailableFull,
  },
];

const hasMarker = (text: string) =>
  NEXT_STEP_MARKERS.some((marker) => text.includes(marker));

describe("Feature: sales-workflow-frontend-restructure, Property 26: The fifteen absence conditions have fifteen distinct honest sentences", () => {
  /**
   * State 1, read off the page rather than copied.
   *
   * Its copy is written inline in `ProspectIntelligence.tsx` — design §12 says so — and a
   * string this file restated would pass its own scan forever. So the workspace is served a
   * qualified prospect that Enrich Now has not promoted, which is exactly the condition, and
   * the sentence the page renders is what the three clauses below are applied to.
   */
  async function readState1(): Promise<AbsenceCondition> {
    const unenriched = qualifiedLead({ gtmLeadId: undefined, contact: undefined });
    serve(EMPTY_SUPPLY);
    const { container } = renderPage([unenriched]);

    const sentence = await waitFor(() => {
      const paragraph = Array.from(container.querySelectorAll("p")).find((element) =>
        (element.textContent ?? "").includes("This page is the enriched ones")
      );
      expect(paragraph, "the no-enriched-prospects panel is not on screen").toBeDefined();
      return (paragraph!.textContent ?? "").trim();
    });

    cleanup();
    return {
      id: 1,
      condition: "No enriched prospects",
      source: "ProspectIntelligence.tsx — EmptyPanel",
      sentence,
    };
  }

  it("declares fifteen conditions and no more", async () => {
    const all = [await readState1(), ...TABLE_CONDITIONS];
    expect(all).toHaveLength(15);
    expect([...all].map((entry) => entry.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1)
    );
  });

  it("gives each of the fifteen a non-empty sentence naming a next step", async () => {
    const all = [await readState1(), ...TABLE_CONDITIONS];

    fc.assert(
      fc.property(fc.constantFrom(...all), (entry) => {
        const presentation = [entry.sentence, entry.companion ?? ""].join(" ");

        // Non-empty — the clause every one of the fifteen carries on its own.
        expect(entry.sentence.trim().length, `${entry.id} ${entry.condition} is blank`).toBeGreaterThan(
          0
        );

        // ── "A sentence, not a token" — asserted over the presentation ──
        //
        // The floor sits on what the rep reads rather than on the individual string, and
        // state 5 is why. `PROSPECT_STAGE_LABELS.ACTIVATING.label` is two words —
        // `Activating intelligence…` — and R7.2 pins it *verbatim*, so a three-word floor on
        // the string alone would fail a requirement for obeying a different one. What is on
        // screen at that condition is the banner's label and body together, which is the
        // presentation this clause reads, and it is fifteen words. A bare `—`, an `N/A` or a
        // blank still fails here, which is the drift the floor exists to catch.
        expect(
          presentation.trim().split(/\s+/).length,
          `${entry.id} ${entry.condition} is a token rather than a statement`
        ).toBeGreaterThan(2);

        // R18.4 — what Weez is doing, or what the rep can do next.
        expect(
          hasMarker(presentation),
          `${entry.id} ${entry.condition} (${entry.source}) names no next step: ${JSON.stringify(
            presentation
          )}`
        ).toBe(true);
      }),
      { numRuns: 60 }
    );
  });

  it("uses none of the banned generic phrasings", async () => {
    const all = [await readState1(), ...TABLE_CONDITIONS];

    fc.assert(
      fc.property(fc.constantFrom(...all), (entry) => {
        BANNED.forEach((phrase) =>
          expect(
            entry.sentence.includes(phrase),
            `${entry.id} ${entry.condition} (${entry.source}) says "${phrase}"`
          ).toBe(false)
        );
        // A bare em dash — the character this codebase uses for "something had to go here"
        // — is banned as a whole statement, not as punctuation inside one.
        expect(entry.sentence.trim()).not.toBe("—");
        expect(entry.sentence.trim()).not.toBe("");
      }),
      { numRuns: 60 }
    );
  });

  it("keeps the fifteen pairwise distinct", async () => {
    const all = [await readState1(), ...TABLE_CONDITIONS];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: all.length - 1 }),
        fc.integer({ min: 0, max: all.length - 1 }),
        (left, right) => {
          fc.pre(left !== right);
          expect(
            all[left].sentence,
            `${all[left].id} ${all[left].condition} and ${all[right].id} ${all[right].condition} read the same`
          ).not.toBe(all[right].sentence);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * The two `noActivity` keys, which are two different pieces of news.
   *
   * `GTM_ABSENCE_LABELS.noActivity` is about one prospect having nothing observed;
   * `ANALYTICS_LABELS.noActivity` is about a calendar day holding no row. They share a key
   * name and must never share a sentence — the drift Property 26's distinctness clause
   * exists to catch, and the pair most likely to produce it.
   */
  it("keeps the prospect's silent day and the calendar's silent day apart", () => {
    expect(ANALYTICS_LABELS.noActivity).not.toBe(GTM_ABSENCE_LABELS.noActivity);
    expect(ATTENTION_LABELS.empty).not.toBe(MEETING_LABELS.empty);
  });

  // ─── The six exact strings ───────────────────────────────────────────────────
  //
  // Pinned at the table, which is where a drift would start, and rendered where the dossier
  // can reach the state cheaply. R6.3's and R7.2's rendered assertions belong to
  // `ProspectDossier.identity.test.tsx`, which drives the verdict and the in-flight track
  // request that produce them; here they are pinned as strings.

  it("pins the six exact strings the requirements name", () => {
    expect(PROSPECT_DECISION_LABELS.activate.tagline).toBe(
      "Find out who, how, and why now before reaching out."
    );
    expect(GTM_IDENTITY_LABELS.activationStopped).toBe(
      "Activation stopped — We couldn't verify this person on LinkedIn. Intelligence was not activated."
    );
    expect(PROSPECT_STAGE_LABELS.ACTIVATING.label).toBe("Activating intelligence…");
    expect(PROSPECT_STAGE_LABELS.WAITING.body).toBe(
      "Intelligence is active. Weez is watching for new activity and signals."
    );
    expect(GTM_ABSENCE_LABELS.noRecommendation).toBe(
      "Not enough evidence yet. We're watching this prospect. We'll surface a recommendation when there is a meaningful signal."
    );
    expect(GTM_ABSENCE_LABELS.noMeaningfulSignal).toBe(
      "Watching — Nothing needs your attention yet. We'll tell you when something changes."
    );
  });

  it("puts the R4.4 tagline on the decision, verbatim", async () => {
    const { dossier } = await openDossier({ ...EMPTY_SUPPLY, activated: false });
    try {
      expect(says(dossier, PROSPECT_DECISION_LABELS.activate.tagline)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("puts the R7.3 waiting sentence on the banner, verbatim", async () => {
    const { dossier } = await openDossier(EMPTY_SUPPLY);
    try {
      expect(says(dossier, PROSPECT_STAGE_LABELS.WAITING.body)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("puts the R9.5 no-signal sentence in the recommendation's place, verbatim", async () => {
    // Activated, observed, and nothing meaningful has landed.
    const { dossier } = await openDossier({
      ...EMPTY_SUPPLY,
      stateVersion: 3,
      meaningfulSignal: false,
    });
    try {
      expect(says(dossier, GTM_ABSENCE_LABELS.noMeaningfulSignal)).toBe(true);
      expect(says(dossier, GTM_ABSENCE_LABELS.noRecommendation)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("puts the R9.4 no-recommendation sentence in the recommendation's place, verbatim", async () => {
    // Activated, something meaningful observed, and the evaluation still has no move.
    const { dossier } = await openDossier({
      ...EMPTY_SUPPLY,
      stateVersion: 3,
      meaningfulSignal: true,
    });
    try {
      expect(says(dossier, GTM_ABSENCE_LABELS.noRecommendation)).toBe(true);
      expect(says(dossier, GTM_ABSENCE_LABELS.noMeaningfulSignal)).toBe(false);
    } finally {
      cleanup();
    }
  });
});
