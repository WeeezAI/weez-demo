// src/__tests__/a11y.audit.test.tsx
//
// **Property 44 — the four audited surfaces have no automated accessibility violations.**
//
// R19.6 asks for an accessibility suite covering the Prospect_Dossier, the
// Decision_Card_Panel, the Action_Queue_Page and the Analytics_Page. This is the automated
// half of it: `jest-axe` over each of those four, in each of the four presentations R18.6
// enumerates — **loading, empty, failure and populated** — reporting zero violations.
//
// The state axis is what makes this more than a smoke test. A surface's populated state is
// the one everybody looks at; its empty and failure states are written last, are reached by
// nobody during development, and are exactly where an unlabelled icon, a heading level
// skipped by a collapsed section or a control with no accessible name survives. So each
// case below *proves it reached the state it claims* — every mount waits on that state's own
// copy and fails as a wrong state rather than passing as a vacuously clean tree.
//
// ─── The nineteen passes, and why nineteen rather than sixteen ─────────────────
//
// Four surfaces × four states is sixteen. The dossier's populated state is audited **per
// stage**, which is the sub-axis task 21.3 names, and four stages are reachable from a
// served payload:
//
//   ENRICHED     no `li_gtm_profiles` row — the decision point, so band 8 is on screen
//   WAITING      activated, `state_version: 0` — activated and nothing observed yet
//   ACTIVE       activated, `state_version > 0` — a belief moved, no recommendation
//   RECOMMENDED  the ranking carries a winner, so the next-best-action card renders
//
// **The three stages that are not audited here, and why.** `ENRICHING`, `RESOLVING` and
// `ACTIVATING` are not payload states at all: `prospectStageOf` reads them from `busy`, a
// request this page has in flight, so reaching one means pressing a control and holding its
// response open. Two of them are reachable that way — `RESOLVING` and `ACTIVATING` both
// follow an Activate press — and `ENRICHING` is not reachable on this page at all: nothing
// here sets `busy` to `"enriching"`, because Enrich Now lives on Market Intelligence. They
// are named rather than substituted: this file audits the four stages a served workspace can
// stand in, and says so.
//
// ─── Why an enumerated table and not a generated property ─────────────────────
//
// The subject is finite: nineteen (surface, state) pairs, each a distinct fixture. A
// generator over that space would draw the same nineteen with duplicates, spend an axe pass
// on each draw, and — the part that actually matters — **shrink to one counterexample**. For
// an accessibility audit the useful report is the opposite: every failing pair at once, so
// one run tells you whether you have one violation in one state or the same violation in all
// four. `it.each` gives that, one named test per pair, and a violation names its own surface
// and state in the test title instead of arriving as a shrunk record. The other properties in
// this feature generate because their input spaces are unbounded; this one does not, so it
// does not.
//
// ─── Explicit budgets, because 5s is a default and not a decision ─────────────
//
// The table carries an explicit `30_000`, for the reason `components/gtm/__tests__/panels.test.tsx`
// records against its own `20_000`: an axe pass over a composed tree does not reliably fit
// Vitest's 5s default, and under load the default turns a slow sweep into a *reported
// violation* — a failure that says nothing true about the markup. So the budget is a
// decision here rather than an inherited default, sized for the most expensive case (a
// dossier mount, its four served reads, then the sweep). The options object is the second
// argument; the trailing-options form is deprecated in Vitest 4.
//
// ─── Hygiene these passes depend on ───────────────────────────────────────────
//
// 1. **`container`, never `document.body`.** RTL binds both `screen` and the queries on
//    `render`'s return value to `document.body`, and `App`'s toaster portals out of the
//    container — a body-scoped sweep would audit chrome this file does not mount. Every
//    query goes through `within(container)` or `container.querySelector`, and `axe()` is
//    handed the run's own `container`.
// 2. **`cleanup()` in a `finally`.** Including the failing case: a tree left mounted would
//    be swept again by the next case, and a violation would then be reported nineteen times
//    with no way to tell which mount produced it. `mounted()` is the sentinel that says so
//    out loud for the three page surfaces.
// 3. **An unserved read is a failure, not an absence.** The transport returns `404` for any
//    route no case set up and records it; each mount asserts nothing unexpected was read. A
//    surface that quietly fell back to an error state would otherwise be audited as its own
//    "populated" case.
//
// ─── What is mounted, and what is deliberately not ────────────────────────────
//
// One transport for all four surfaces: `fetch` is served by route, so the real `gtmAPI`
// normalisers run from wire to DOM and no surface needs a client-level stub of its own. Eva's
// workspace read is mocked at the service boundary, exactly as
// `pages/__tests__/ProspectDossier.compose.test.tsx` does — its wire format is `evaAPI`'s
// business — and it is also the dossier's loading/empty/failure lever, since it is the read
// that decides whether the page has a workspace at all.
//
// `ConversationSidebar` is replaced by a `<nav>` and `sonner` by spies, matching every other
// suite on these pages: both reach for auth and the network, neither is a surface R19.6
// names, and the sidebar doubles as the mount sentinel because it renders in every state
// including the empty ones.
//
// **The dossier's disclosures are audited closed.** `IntelligenceSection.children` is a
// `() => ReactNode`, so a closed disclosure has rendered nothing to sweep — and the panels
// behind them already carry their own axe sweeps in `panels.test.tsx`,
// `primitives.test.tsx`, `nextAction.test.tsx`, `ProspectTimeline.test.tsx`,
// `ConnectionPanel.test.tsx` and `IdentityConfirmPanel.test.tsx`. What an expanded
// disclosure *names* and *announces* is tasks 21.1 and 21.2's subject, in
// `ProspectDossier.a11y.test.tsx`. This file audits what the four surfaces present on
// arrival, in four states each, which is the gap those files leave.
//
// ─── If a violation turns up ──────────────────────────────────────────────────
//
// It is triaged as a finding and reported, not silenced with a rule exclusion. These
// surfaces are expected to be close to clean already, and the one recurring mistake this
// codebase has a written history with is `aria-label` on a roleless element — a prohibited
// attribute under `aria-prohibited-attr`, which is why `Analytics.tsx` conveys its figures
// with screen-reader text instead. `axe()` therefore runs with the default rule set and no
// `configureAxe`: an exclusion here would be this file deciding a requirement does not apply.

import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProspectIntelligence from "@/pages/ProspectIntelligence";
import GTMActionQueue, { ACTION_QUEUE_LABELS } from "@/pages/GTMActionQueue";
import Analytics, {
  ANALYTICS_LABELS,
  ANALYTICS_UI_LABELS,
  analyticsRowTestId,
} from "@/pages/Analytics";
import { ProspectDecision } from "@/components/gtm/ProspectDecision";
import { ATTENTION_LABELS, GTM_IDENTITY_LABELS } from "@/components/gtm/labels";
import { CreditsProvider } from "@/hooks/useCredits";
import { GTM_BASE_URL } from "@/services/gtmAPI";
import { evaAPI, type EvaWorkspace, type QualifiedLead } from "@/services/evaAPI";
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

// ══════════════════════════════════════════════════════════════════════════════
// Identity
// ══════════════════════════════════════════════════════════════════════════════

/** A real brand id: `CreditsProvider` and `evaAPI` both refuse anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
/** Eva's document id, and the `sales_leads.id` Enrich Now promoted it to. */
const EVA_LEAD = "lead_ada7f1";
const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
/** A second prospect, so the queue's checklist is a list rather than one row. */
const GTM_LEAD_2 = "1b7d90ae-2c55-4a83-b0d1-6e4f7a9c2b31";
const GTM_LEAD_3 = "4e8a61cf-9d13-4f77-8b2e-5c1a0d3f8e42";
const GTM_LEAD_4 = "7a2c34bd-6f81-4e29-9c05-2d8b1e6a4f53";

const PERSON = "Ada Lovelace";
const ROLE = "Head of Engineering";
const COMPANY = "Analytical Engines";
const ISO = "2024-05-01T12:00:00.000Z";
const HOUR_MS = 3_600_000;

// ══════════════════════════════════════════════════════════════════════════════
// Eva's side of the world
// ══════════════════════════════════════════════════════════════════════════════

function qualifiedLead(): QualifiedLead {
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
    signals: [
      {
        id: "sig-1",
        signalType: "job_posting",
        company: COMPANY,
        detail: "Opened a data platform role",
        channel: "careers",
        confidence: 0.8,
        timestamp: ISO,
      },
    ],
    contact: {
      name: PERSON,
      role: ROLE,
      email: "ada@analyticalengines.com",
      emailVerified: true,
      linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
    },
    enrichment: { website: "https://analyticalengines.com", status: "enriched" },
    handoffState: "enriched",
    status: "qualified",
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    gtmLeadId: GTM_LEAD,
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
      signalsCaptured: leads.length,
      signalsThisWeek: leads.length,
      orgsTracked: leads.length,
      potentialLeads: 0,
      qualifiedLeads: leads.length,
      enrichedLeads: leads.length,
      emailsFound: leads.length,
      handedToMax: 0,
      byTier: { low: 0, medium: leads.length, high: 0 },
      bySignalType: {},
    },
    sweepState: "complete",
    isDemo: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// The wire, as `schemas/gtm.py` serialises it
// ══════════════════════════════════════════════════════════════════════════════

function fact(value: string | null) {
  return {
    value,
    is_unknown: value === null,
    source_surface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observed_at: value === null ? null : ISO,
    is_stale: false,
    is_derived: false,
  };
}

const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

/** Everything the dossier's stage and its optional bands are decided by. */
interface Scene {
  /** `li_gtm_profiles` exists — the activation flag, and the whole of "intelligence is on". */
  activated: boolean;
  /** `ProspectStateFull.stateVersion`. `0` with a profile row is `WAITING`. */
  stateVersion: number;
  /** The ranking carries a winner, which is what makes an activated prospect `RECOMMENDED`. */
  recommended: boolean;
  /** `detail.activity.level` was actually observed, which is what puts band 6 up. */
  observedActivity: boolean;
}

function wireDetail(leadId: string, scene: Scene) {
  return {
    lead_id: leadId,
    profile: {
      lead_id: leadId,
      profile_id: scene.activated ? "profile-1" : null,
      profile_url: scene.activated ? "https://www.linkedin.com/in/observed" : null,
      public_identifier: scene.activated ? "observed" : null,
      linkedin_verification_status: "VERIFIED",
      linkedin_verified_at: ISO,
      linkedin_match_confidence: 93,
      name: fact(PERSON),
      headline: fact("Head of Data Platform"),
      company: fact(COMPANY),
      role: fact(ROLE),
      location: fact("London"),
      lead_score: {
        score: 82,
        score_kind: "RECOMMENDATION_SCORE",
        score_disclaimer: DISCLAIMER,
        is_derived: true,
      },
    },
    activity: { level: scene.observedActivity ? fact("HIGH") : fact(null) },
    state: {
      relationship_state: fact("NOT_CONNECTED"),
      conversation_state: fact("WARMUP_READY"),
      confirmation_status: "NOT_APPLICABLE",
      display_summary: "Not connected · warm-up ready",
      display_summary_is_derived: true,
    },
    updated_at: ISO,
  };
}

const wireState = (leadId: string, scene: Scene) => ({
  lead_id: leadId,
  state_version: scene.stateVersion,
});

function wireRanking(leadId: string, scene: Scene) {
  return {
    lead_id: leadId,
    evaluation_id: `eval-${leadId}`,
    computed_at: ISO,
    recommended: scene.recommended
      ? {
          recommendation_id: `rec-${leadId}`,
          action_type: "SEND_LINKEDIN_MESSAGE",
          channel: "LINKEDIN",
          execution_verb: "SEND_MESSAGE",
          executable: true,
          rank: 1,
          is_recommended: true,
        }
      : null,
    candidates: [],
  };
}

/**
 * One ranked row, full enough that the queue's expanded detail has something to render.
 *
 * `why_now` carries two entries because the disclosure presents them as a set — an empty
 * one renders the absence sentence instead, which is a different fragment to audit and is
 * the one the collapsed rows beside it already cover.
 */
function wireQueueItem(leadId: string, name: string | null = PERSON) {
  return {
    lead_id: leadId,
    recommendation_id: `rec-${leadId}`,
    profile_id: `profile-${leadId}`,
    profile_url: null,
    name: fact(name),
    headline: fact("Head of Data Platform"),
    company: fact(COMPANY),
    journey_state: fact("ENGAGING"),
    relationship_state: fact("CONNECTED"),
    action_type: "SEND_LINKEDIN_MESSAGE",
    channel: "LINKEDIN",
    execution_verb: "SEND_MESSAGE",
    executable: true,
    unexecutable_reason: null,
    action_score: {
      score: 72,
      score_kind: "RECOMMENDATION_SCORE",
      score_disclaimer: DISCLAIMER,
      is_derived: true,
    },
    action_confidence: 61,
    state_confidence: 58,
    priority_tier: "TODAY",
    urgency: 68,
    expected_success_probability: 47,
    business_value: 55,
    signal_freshness: 80,
    why_now: [
      {
        signal_id: "sig-1",
        signal_type: "JOB_POSTING",
        event_timestamp: ISO,
        effective_strength: 74,
        term: "SIGNAL_STRENGTH",
        contribution_hundredths: 1200,
        evidence_id: "ev-1",
      },
      {
        signal_id: "sig-2",
        signal_type: "PROFILE_VIEW",
        event_timestamp: ISO,
        effective_strength: 51,
        term: "RECENCY",
        contribution_hundredths: 400,
        evidence_id: "ev-2",
      },
    ],
    expires_at: null,
    computed_at: ISO,
  };
}

/** The ledger. Prices exist so the tags render; nothing here presses a priced control. */
const wireCredits = () => ({
  brand_id: BRAND,
  balance: 40,
  prices: [
    { action: "ENRICH", credits: 1 },
    { action: "CONTACT", credits: 1 },
    { action: "ACTIVATE", credits: 2 },
  ],
  history: [],
});

// ─── The attention feed ───────────────────────────────────────────────────────

interface ItemSpec {
  leadId: string;
  /** `null` is a prospect nobody observed a name for — the `UNKNOWN_TEXT` branch. */
  name: string | null;
  trigger: string;
  reason: string;
  requiredResponse: string;
  tier: string;
  /** `null` is an instant that cannot be read: its own day bucket, never today's. */
  dueHoursAgo: number | null;
  escalatedFrom?: string;
  escalationReason?: string;
}

function wireAttentionItem(spec: ItemSpec) {
  return {
    lead_id: spec.leadId,
    prospect_name: fact(spec.name),
    company: fact(COMPANY),
    trigger: spec.trigger,
    reason: spec.reason,
    required_response: spec.requiredResponse,
    consequence_tier: spec.tier,
    escalated_from: spec.escalatedFrom ?? null,
    escalation_reason: spec.escalationReason ?? null,
    due_at:
      spec.dueHoursAgo === null
        ? ""
        : new Date(Date.now() - spec.dueHoursAgo * HOUR_MS).toISOString(),
    computed_at: new Date().toISOString(),
    route: `/prospect-intelligence/${BRAND}?lead_id=${spec.leadId}`,
    criteria: [],
  };
}

/**
 * A populated checklist, in the endpoint's own order (band, then newest, then lead id).
 *
 * Four items, chosen so one pass covers the row shapes that differ in markup rather than
 * only in text: the mandatory one carries the disclosure, the second carries an escalation
 * line, the third has an unreadable due instant and lands in its own day bucket, and the
 * fourth has no observed name.
 */
const ATTENTION_ITEMS: readonly ItemSpec[] = [
  {
    leadId: GTM_LEAD,
    name: PERSON,
    trigger: "ACTION_MANDATORY",
    reason: "has a ranked action waiting",
    requiredResponse: "Review and respond",
    tier: "IMMEDIATE",
    dueHoursAgo: 2,
  },
  {
    leadId: GTM_LEAD_2,
    name: "Grace Hopper",
    trigger: "PROSPECT_REPLIED",
    reason: "replied to your message",
    requiredResponse: "Offer a time",
    tier: "MATERIAL",
    dueHoursAgo: 30,
    escalatedFrom: "OTHER",
    escalationReason: "A reply raises the band whatever the stage says.",
  },
  {
    leadId: GTM_LEAD_3,
    name: "Alan Turing",
    trigger: "HIGH_INTENT_SIGNAL",
    reason: "viewed your profile twice this week",
    requiredResponse: "Re-engage before it lapses",
    tier: "IMPORTANT",
    dueHoursAgo: null,
  },
  {
    leadId: GTM_LEAD_4,
    name: null,
    trigger: "AT_RISK_OR_LOSING",
    reason: "has gone quiet since the intro call",
    requiredResponse: "Send the pricing note",
    tier: "OTHER",
    dueHoursAgo: 50,
  },
] as const;

function wireAttentionFeed(specs: readonly ItemSpec[]) {
  const byTier: Record<string, number> = {};
  const byTrigger: Record<string, number> = {};
  specs.forEach((spec) => {
    byTier[spec.tier] = (byTier[spec.tier] ?? 0) + 1;
    byTrigger[spec.trigger] = (byTrigger[spec.trigger] ?? 0) + 1;
  });
  return {
    period_days: 7,
    computed_at: new Date().toISOString(),
    summary: { total: specs.length, by_tier: byTier, by_trigger: byTrigger },
    items: specs.map(wireAttentionItem),
  };
}

// ─── Day-bucketed analytics ───────────────────────────────────────────────────

/** 2024-05-01, the first calendar day the offsets below count from. */
const BASE_MS = Date.UTC(2024, 4, 1);
const DAY_MS = 86_400_000;
const isoDate = (offset: number) => new Date(BASE_MS + offset * DAY_MS).toISOString().slice(0, 10);

const wireMetric = (count: number, trend: string | null, criteria: number) => ({
  count,
  lead_ids: Array.from({ length: count }, (_, i) => `lead-${i}`),
  criteria: Array.from({ length: criteria }, (_, i) => ({
    field: `gtm_prospect_state.column_${i}`,
    operator: "EQUALS",
    values: [`clause-${i}`],
  })),
  trend,
});

/**
 * Three days, covering the three readings the page must keep apart.
 *
 * Day 0 measures all six. Day 1 omits three keys — an omitted key is an uncomputable
 * measure and renders the absence sentence, never a `0` — and measures a real `0` on a
 * fourth. Day 2 measures one. So one populated pass sweeps the measured figure, the
 * measured zero, the absent-metric cell, and both trend treatments (a direction the server
 * sent, and the sentence that stands in for a comparison nobody could make).
 */
const ANALYTICS_ROWS = [
  {
    date: isoDate(0),
    metrics: {
      prospects_contacted: wireMetric(6, null, 2),
      state_changed: wireMetric(4, null, 1),
      most_likely_to_close: wireMetric(3, "RISING", 3),
      at_risk: wireMetric(1, null, 1),
      meetings_booked: wireMetric(2, null, 1),
      meetings_completed: wireMetric(1, null, 1),
    },
  },
  {
    date: isoDate(1),
    metrics: {
      prospects_contacted: wireMetric(0, null, 2),
      most_likely_to_close: wireMetric(2, "FALLING", 3),
      meetings_booked: wireMetric(1, null, 1),
    },
  },
  {
    date: isoDate(2),
    metrics: {
      most_likely_to_close: wireMetric(5, null, 3),
    },
  },
] as const;

/** The day whose expansion the populated pass audits: the one carrying absences. */
const SELECTED_DAY = isoDate(1);

const wireDailyAnalytics = (rows: readonly { date: string }[]) => ({
  brand_id: BRAND,
  days: 7,
  start_date: rows[0]?.date ?? "",
  end_date: rows[rows.length - 1]?.date ?? "",
  computed_at: ISO,
  rows,
});

// ══════════════════════════════════════════════════════════════════════════════
// Transport
// ══════════════════════════════════════════════════════════════════════════════

/** How one route answers. `pending` never settles, which is what a loading state is. */
type Mode = "ok" | "pending" | "fail";

interface Served {
  mode: Mode;
  body: unknown;
}

const ROUTE = {
  detail: "prospect:",
  state: "prospect:state",
  ranking: "prospect:next-best-action",
  /** `POST …/lifecycle`. `NextActionPanel` records `VIEWED` when a card first renders. */
  lifecycle: "prospect:lifecycle",
  queue: "/action-queue",
  credits: "/credits",
  attention: "/attention-feed",
  analytics: "/analytics/daily",
} as const;

/**
 * The one write any of these surfaces makes on arrival.
 *
 * `NextActionPanel` posts `VIEWED` the moment a recommendation is put on screen, so the
 * dossier's `RECOMMENDED` case — and only that one — has a write to serve. It is served
 * rather than refused because a rejected write would put a failure notice on the card and
 * the case would then be auditing a failed lifecycle write instead of a recommendation.
 */
const wireLifecycleEntry = () => ({
  event_id: "evt-1",
  event_type: "RECOMMENDATION_VIEWED",
  event_at: ISO,
  summary: "Recommendation put on screen",
  outcome: "NEUTRAL",
  actor_id: "rep-1",
  actor_type: "USER",
  recommendation_id: `rec-${GTM_LEAD}`,
});

/** The route table for one case, plus the log of anything it did not expect. */
let served: Map<string, Served>;
let unexpected: string[];
let fetchMock: ReturnType<typeof vi.fn>;

const ok = (body: unknown): Served => ({ mode: "ok", body });
const pending = (): Served => ({ mode: "pending", body: null });
const failing = (): Served => ({ mode: "fail", body: null });

/** The GTM route with the lead id lifted out, so `/state` cannot answer for `/state/history`. */
function routeOf(url: string): string {
  const path = url.startsWith(GTM_BASE_URL) ? url.slice(GTM_BASE_URL.length) : url;
  const [bare] = path.split("?");
  const prospect = /^\/prospect\/([^/]+)(.*)$/.exec(bare ?? "");
  if (prospect) return `prospect:${(prospect[2] ?? "").replace(/^\//, "")}`;
  return bare ?? "";
}

function serve() {
  fetchMock.mockImplementation(async (input: unknown) => {
    const route = routeOf(String(input));
    const answer = served.get(route);

    if (!answer) {
      // A read no case set up. Recorded and refused, so a surface cannot quietly reach a
      // failure state and then be audited as though that were the state under test.
      unexpected.push(route);
      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: `a11y.audit: no route served for ${route}` }),
      };
    }
    if (answer.mode === "pending") return new Promise<never>(() => {});
    if (answer.mode === "fail") {
      return {
        ok: false,
        status: 500,
        json: async () => ({ detail: "GTM backend error 500" }),
      };
    }
    return { ok: true, status: 200, json: async () => answer.body };
  });
}

beforeEach(() => {
  served = new Map();
  unexpected = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  serve();
  vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(workspace([]));
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// Mount helpers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * How many pages are on the body.
 *
 * The mocked sidebar rather than any content marker: these pages have states with no
 * content at all — a workspace nobody enriched, a feed that could not be read — and a
 * sentinel has to be something rendered unconditionally.
 */
const mounted = () => document.body.querySelectorAll('nav[aria-label="Conversations"]').length;

/** Nothing was read that the case did not serve, and exactly one page is on the body. */
function expectCleanMount() {
  expect(unexpected).toEqual([]);
  expect(mounted()).toBe(1);
}

/** The dossier's stage band marker. Absent until the prospect read lands. */
const stageOf = (root: ParentNode) =>
  root.querySelector("[data-gtm-stage]")?.getAttribute("data-gtm-stage") ?? null;

// ─── The prospect dossier ─────────────────────────────────────────────────────

/**
 * The page's own inline copy for its three page-level states.
 *
 * Written here rather than imported because the page writes them inline — they are not in
 * `labels.ts`. That is deliberate on this file's part: each mount waits on the sentence for
 * the state it claims, so a copy edit breaks the mount loudly instead of letting a case
 * sweep the wrong state and pass.
 */
const DOSSIER_COPY = {
  loading: "Building your prospect dossiers",
  failure: "We couldn't load your qualified accounts",
  /** `qualifiedLeads.length === 0` — discovery has found nothing yet. */
  empty: "Eva is discovering your accounts",
} as const;

function renderDossier() {
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
 * The two reads the dossier makes whatever the workspace turns out to hold.
 *
 * `loadQueue` and the credits provider are both armed on mount and neither is keyed on
 * `ws`, so every dossier case serves them — including the three where there is no prospect
 * to overlay. An unserved read would land in `unexpected` and fail the mount.
 */
function serveDossierChrome() {
  served.set(ROUTE.credits, ok(wireCredits()));
  served.set(ROUTE.queue, ok({ items: [], next_cursor: null, has_more: false }));
}

/** The dossier while Eva's workspace read is still in flight. */
async function mountDossierLoading(): Promise<HTMLElement> {
  serveDossierChrome();
  vi.mocked(evaAPI.getWorkspace).mockReturnValue(new Promise<EvaWorkspace>(() => {}));

  const { container } = renderDossier();
  await waitFor(() =>
    expect(within(container).getByText(DOSSIER_COPY.loading)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/**
 * The dossier over a workspace with nothing in it.
 *
 * The discovery-empty kind, which is the one an operator meets first. Its sibling —
 * `activeLeads.length === 0`, a workspace of qualified accounts none of which is enriched —
 * is the same `EmptyPanel` with different copy and one `<button>` in place of another, so it
 * is not audited separately.
 */
async function mountDossierEmpty(): Promise<HTMLElement> {
  serveDossierChrome();
  vi.mocked(evaAPI.getWorkspace).mockResolvedValue(workspace([]));

  const { container } = renderDossier();
  await waitFor(() =>
    expect(within(container).getByText(DOSSIER_COPY.empty)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/** The dossier when the read that decides whether there is a workspace failed. */
async function mountDossierFailure(): Promise<HTMLElement> {
  serveDossierChrome();
  vi.mocked(evaAPI.getWorkspace).mockRejectedValue(
    new Error("Couldn't load your qualified accounts")
  );

  const { container } = renderDossier();
  await waitFor(() =>
    expect(within(container).getByText(DOSSIER_COPY.failure)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/**
 * The four stages a served payload can reach, typed against `ProspectStage` itself.
 *
 * `Extract` rather than a fresh union, so the day `prospectStage.ts` renames one of them
 * this table stops compiling instead of silently auditing three.
 */
type PayloadStage = Extract<ProspectStage, "ENRICHED" | "WAITING" | "ACTIVE" | "RECOMMENDED">;

/** The scene each audited stage is reached from, and nothing else in it varies. */
const STAGE_SCENES: Readonly<Record<PayloadStage, Scene>> = {
  // Not activated: the decision point, so band 8 is on screen and nothing is ranked.
  ENRICHED: { activated: false, stateVersion: 0, recommended: false, observedActivity: false },
  // Activated and nothing observed yet — the stage that keeps empty panels honest.
  WAITING: { activated: true, stateVersion: 0, recommended: false, observedActivity: false },
  // A dimension moved, no recommendation.
  ACTIVE: { activated: true, stateVersion: 3, recommended: false, observedActivity: true },
  // The ranking has a winner, so the next-best-action card renders.
  RECOMMENDED: { activated: true, stateVersion: 3, recommended: true, observedActivity: true },
};

/** The dossier for one prospect, once its three reads have landed and band 3 stands. */
function mountDossierStage(stage: PayloadStage) {
  return async (): Promise<HTMLElement> => {
    const scene = STAGE_SCENES[stage];
    served.set(ROUTE.credits, ok(wireCredits()));
    served.set(ROUTE.detail, ok(wireDetail(GTM_LEAD, scene)));
    served.set(ROUTE.state, ok(wireState(GTM_LEAD, scene)));
    served.set(ROUTE.ranking, ok(wireRanking(GTM_LEAD, scene)));
    // Only a ranked prospect is on the ranked read, so the overlay behind the
    // next-best-action card exists exactly where the ranking says there is one.
    served.set(
      ROUTE.queue,
      ok({
        items: scene.recommended ? [wireQueueItem(GTM_LEAD)] : [],
        next_cursor: null,
        has_more: false,
      })
    );
    // A card on screen records that it was seen. Only reachable with a recommendation.
    if (scene.recommended) served.set(ROUTE.lifecycle, ok(wireLifecycleEntry()));
    vi.mocked(evaAPI.getWorkspace).mockResolvedValue(workspace([qualifiedLead()]));

    const { container } = renderDossier();
    await waitFor(() => expect(stageOf(container)).toBe(stage));
    expectCleanMount();
    return container;
  };
}

// ─── The Action Queue ─────────────────────────────────────────────────────────

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={[`/action-queue/${BRAND}`]}>
      <Routes>
        <Route path="/action-queue/:spaceId" element={<GTMActionQueue />} />
      </Routes>
    </MemoryRouter>
  );
}

/** The checklist while the attention read is in flight. The ranked read is not the list. */
async function mountQueueLoading(): Promise<HTMLElement> {
  served.set(ROUTE.attention, pending());
  served.set(ROUTE.queue, ok({ items: [], next_cursor: null, has_more: false }));

  const { container } = renderQueue();
  await waitFor(() =>
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  );
  // The page says it twice on purpose — once as the skeleton's screen-reader text, once in
  // the polite status line in the header — so this counts rather than expecting one.
  expect(within(container).getAllByText(ACTION_QUEUE_LABELS.statusLoading)).toHaveLength(2);
  expectCleanMount();
  return container;
}

/** Nothing needs the operator. A success with an empty list, not a failure. */
async function mountQueueEmpty(): Promise<HTMLElement> {
  served.set(ROUTE.attention, ok(wireAttentionFeed([])));
  served.set(ROUTE.queue, ok({ items: [], next_cursor: null, has_more: false }));

  const { container } = renderQueue();
  await waitFor(() =>
    expect(within(container).getByText(ATTENTION_LABELS.empty)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/** The feed could not be read, so there is no list — and there is a retry beside the reason. */
async function mountQueueFailure(): Promise<HTMLElement> {
  served.set(ROUTE.attention, failing());
  served.set(ROUTE.queue, ok({ items: [], next_cursor: null, has_more: false }));

  const { container } = renderQueue();
  await waitFor(() =>
    expect(within(container).getByText(ATTENTION_LABELS.loadFailed)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/**
 * The whole checklist, with the mandatory task's ranked detail expanded.
 *
 * One pass covers both task forms: expanding one task leaves the other three collapsed
 * beside it, so the collapsed row, the escalation line, the undated bucket and the opened
 * disclosure are all in the swept tree.
 */
async function mountQueuePopulated(): Promise<HTMLElement> {
  served.set(ROUTE.attention, ok(wireAttentionFeed(ATTENTION_ITEMS)));
  served.set(
    ROUTE.queue,
    ok({ items: [wireQueueItem(GTM_LEAD)], next_cursor: null, has_more: false })
  );

  const { container } = renderQueue();
  await waitFor(() =>
    expect(within(container).getByRole("list", { name: ATTENTION_LABELS.list })).toBeInTheDocument()
  );

  const toggle = within(container).getByRole("button", { name: ACTION_QUEUE_LABELS.detailToggle });
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));

  expectCleanMount();
  return container;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function renderAnalytics() {
  return render(
    <MemoryRouter initialEntries={[`/analytics/${BRAND}`]}>
      <Routes>
        <Route path="/analytics/:spaceId" element={<Analytics />} />
      </Routes>
    </MemoryRouter>
  );
}

async function mountAnalyticsLoading(): Promise<HTMLElement> {
  served.set(ROUTE.analytics, pending());

  const { container } = renderAnalytics();
  await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
  // Twice, for the same reason as the queue's: the skeleton's screen-reader text and the
  // header's polite status line both say it while the first read is in flight.
  expect(within(container).getAllByText(ANALYTICS_UI_LABELS.statusLoading)).toHaveLength(2);
  expectCleanMount();
  return container;
}

/** The read landed and carried no day rows. A statement about the range, not the workspace. */
async function mountAnalyticsEmpty(): Promise<HTMLElement> {
  served.set(ROUTE.analytics, ok(wireDailyAnalytics([])));

  const { container } = renderAnalytics();
  await waitFor(() =>
    expect(within(container).getByText(ANALYTICS_UI_LABELS.emptyRange)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

async function mountAnalyticsFailure(): Promise<HTMLElement> {
  served.set(ROUTE.analytics, failing());

  const { container } = renderAnalytics();
  await waitFor(() =>
    expect(within(container).getByText(ANALYTICS_LABELS.loadFailed)).toBeInTheDocument()
  );
  expectCleanMount();
  return container;
}

/**
 * The day table with one day expanded.
 *
 * Selected rather than left unpicked because the expanded panel is strictly more markup —
 * the five named figures, the criteria clauses and the lead ids — and the only fragment it
 * replaces is a `<p>` carrying `selectPrompt`, the same sentence the section header renders
 * above the table in every populated state and therefore already in the swept tree.
 */
async function mountAnalyticsPopulated(): Promise<HTMLElement> {
  served.set(ROUTE.analytics, ok(wireDailyAnalytics(ANALYTICS_ROWS)));

  const { container } = renderAnalytics();
  await waitFor(() => expect(container.querySelector("table")).not.toBeNull());

  const row = within(container).getByTestId(analyticsRowTestId(SELECTED_DAY));
  const dayButton = within(row).getByRole("button");
  fireEvent.click(dayButton);
  await waitFor(() => expect(dayButton).toHaveAttribute("aria-pressed", "true"));

  expectCleanMount();
  return container;
}

// ─── The decision panel ───────────────────────────────────────────────────────
//
// The one surface of the four that reads nothing. `ProspectDecision` is a pure function of
// its props, so its four states are the four prop shapes those states put it in — and the
// state axis still bites, because each shape renders different markup: a busy control with
// a spinner, two bare controls with no price tags, a sentence standing in for the Contact
// control, and both controls live with their prices.
//
// Mounted bare, with no `CreditsProvider`: `useCredits()` outside one answers "unread", so
// no price is claimed and nothing is gated. The shortfall shape — a known balance below a
// known price, which replaces both controls with statements — belongs to
// `components/gtm/__tests__/insufficientCredits.test.tsx`, and the `needsIdentity` shape
// renders strictly less than the failure case below (the same button, without the refusal
// paragraph), which is Property 12's invariance and is pinned in `ProspectDecision.test.tsx`.

const noop = () => {};

const DECISION_PROPS = {
  /** A press is in flight: one control, busy, saying so. */
  loading: { activating: true },
  /** Nothing read. No price on either card, both controls live. */
  empty: {},
  /**
   * Both paths refused, with no lookup that would change either answer — the shape that
   * renders the most: a sentence where the Contact control was, and the server's refusal
   * under a disabled Activate.
   */
  failure: {
    contactUnavailableReason: "This lead has no channel to reach them on.",
    activateUnavailableReason: GTM_IDENTITY_LABELS.cannotTrack.noMatch,
  },
  /** Everything read: both prices from the server's list, both controls live. */
  populated: { contactPrice: 1, activatePrice: 2 },
} as const;

function mountDecision(state: keyof typeof DECISION_PROPS) {
  return async (): Promise<HTMLElement> => {
    const props = DECISION_PROPS[state];
    const { container } = render(
      <ProspectDecision onContactDirectly={noop} onActivate={noop} {...props} />
    );
    // The panel's own root, so a pass cannot be clean because nothing rendered.
    expect(container.querySelector('[data-gtm-section="decision"]')).not.toBeNull();
    expect(unexpected).toEqual([]);
    return container;
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// The table
// ══════════════════════════════════════════════════════════════════════════════

const SURFACE = {
  dossier: "Prospect dossier",
  decision: "Decision panel",
  queue: "Action Queue",
  analytics: "Analytics",
} as const;

interface AuditCase {
  /** What the test title reads, so a violation names its own surface and state. */
  label: string;
  mount: () => Promise<HTMLElement>;
}

/**
 * The budget every pass runs under: a page mount, its served reads, and one axe sweep.
 *
 * One number for the whole table because `it.each` takes one, and it is sized for the
 * most expensive case — the dossier, which is ~4,600 lines and mounts a dozen panels. The
 * four decision-panel passes finish in a fraction of it and are deliberately not given a
 * tighter one: a per-case budget would be decoration here, since the table's is what
 * actually applies.
 */
const AXE_BUDGET_MS = 30_000;

const at = (surface: string, state: string, mount: () => Promise<HTMLElement>): AuditCase => ({
  label: `${surface} · ${state}`,
  mount,
});

const CASES: readonly AuditCase[] = [
  // The dossier: three page-level states, then the populated state per reachable stage.
  at(SURFACE.dossier, "loading", mountDossierLoading),
  at(SURFACE.dossier, "empty", mountDossierEmpty),
  at(SURFACE.dossier, "failure", mountDossierFailure),
  at(SURFACE.dossier, "populated · ENRICHED", mountDossierStage("ENRICHED")),
  at(SURFACE.dossier, "populated · WAITING", mountDossierStage("WAITING")),
  at(SURFACE.dossier, "populated · ACTIVE", mountDossierStage("ACTIVE")),
  at(SURFACE.dossier, "populated · RECOMMENDED", mountDossierStage("RECOMMENDED")),

  // The decision panel, in the four prop shapes those four states put it in.
  at(SURFACE.decision, "loading", mountDecision("loading")),
  at(SURFACE.decision, "empty", mountDecision("empty")),
  at(SURFACE.decision, "failure", mountDecision("failure")),
  at(SURFACE.decision, "populated", mountDecision("populated")),

  // The Action Queue.
  at(SURFACE.queue, "loading", mountQueueLoading),
  at(SURFACE.queue, "empty", mountQueueEmpty),
  at(SURFACE.queue, "failure", mountQueueFailure),
  at(SURFACE.queue, "populated", mountQueuePopulated),

  // Analytics.
  at(SURFACE.analytics, "loading", mountAnalyticsLoading),
  at(SURFACE.analytics, "empty", mountAnalyticsEmpty),
  at(SURFACE.analytics, "failure", mountAnalyticsFailure),
  at(SURFACE.analytics, "populated", mountAnalyticsPopulated),
] as const;

describe("Feature: sales-workflow-frontend-restructure, Property 44: The four audited surfaces have no automated accessibility violations", () => {
  // The instrument. Nineteen tests that each swept an empty tree would all pass, so the
  // count and the shape of the table are asserted before any of them runs.
  it("covers four surfaces in four states, with the dossier's populated state per stage", () => {
    const byLabel = CASES.map((kase) => kase.label);
    expect(new Set(byLabel).size).toBe(CASES.length);
    expect(CASES).toHaveLength(19);

    Object.values(SURFACE).forEach((surface) => {
      const states = byLabel.filter((label) => label.startsWith(`${surface} · `));
      expect(states).toHaveLength(surface === SURFACE.dossier ? 7 : 4);
      ["loading", "empty", "failure", "populated"].forEach((state) => {
        expect(states.some((label) => label.includes(state))).toBe(true);
      });
    });
  });

  /**
   * The second instrument, and the one that makes the nineteen clean passes mean something.
   *
   * Nineteen sweeps that reported nothing would read identically whether the surfaces are
   * clean or the sweep is inert — a mis-scoped root, a matcher that was never extended, an
   * `axe()` that resolved before it ran. So one deliberately broken fragment is swept under
   * the same call, through the same `container` scoping, and it has to come back with a
   * violation. An image with no text alternative is chosen because it is unambiguous and
   * has nothing to do with any of the four surfaces.
   */
  it("reports a violation when one is there", async () => {
    const { container } = render(
      <div>
        <img src="chart.png" />
      </div>
    );
    try {
      const results = await axe(container);
      expect(results.violations.map((violation: { id: string }) => violation.id)).toContain(
        "image-alt"
      );
    } finally {
      cleanup();
    }
  });

  it.each(CASES)(
    "$label has no axe violations",
    { timeout: AXE_BUDGET_MS },
    async ({ mount }) => {
      const container = await mount();
      try {
        // `container`, never `document.body`: the toaster and anything else portalled out
        // of the tree under test is not this surface's markup.
        expect(await axe(container)).toHaveNoViolations();
      } finally {
        cleanup();
      }
    }
  );
});
