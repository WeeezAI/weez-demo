// pages/__tests__/ProspectDossier.compose.test.tsx
//
// The dossier's *composition*: what is on it, in what order, at what cost, for which
// prospects, and what it says when a read did not land. Five of the design's numbered
// properties, all of them statements about `pages/ProspectIntelligence.tsx` as a whole
// rather than about any one panel, which is why they live on the page and not beside a
// component.
//
//   Property 5  Presented content follows the Dossier_Hierarchy order      R3.1, 7.5, 8.1
//   Property 6  The dossier's request budget is bounded and correctly keyed R3.4, 3.6, 3.7, 3.8
//   Property 7  The dossier prospect set is exactly the enriched set        R3.5
//   Property 8  The three absence kinds yield three distinct sentences      R3.10
//   Property 9  A secondary read failure leaves the prospect legible        R3.9, 18.5
//
// This file replaces `GTMProspect.compose.test.tsx`, which was written against the page
// this feature stops rendering (design §15.2). Nothing here imports `pages/GTMProspect`.
//
// ─── Why four of the five mount the whole page ─────────────────────────────────
//
// Every one of these claims is about composition, and composition is not a property any
// component can keep. The band order is decided by the order of JSX in `Dossier`; the
// request budget is decided by which effects the page arms and by `IntelligenceSection`'s
// `children` being a function; the prospect set is decided by two `useMemo`s; failure
// isolation is decided by one `Promise.allSettled`. So the page is mounted through the real
// transport — `fetch` is served, `gtmAPI` maps the wire itself, and the assertions read the
// DOM and the request log. Only Eva's workspace read is mocked, because its wire format is
// `evaAPI`'s business and not this file's (the same split
// `components/gtm/__tests__/insufficientCredits.test.tsx` makes, whose fixtures and `serve()`
// idiom this file reuses rather than reinventing).
//
// Property 8 is the exception and is asserted on the two projections directly: they are pure
// functions of `OverlayState`, and mounting a page to read a `switch` would test the page's
// ability to reach a branch rather than the branch's answer. The four kinds' *reachability*
// through `overlayFor()` is pinned as an instrument check above it.
//
// ─── Every query is scoped, and every run cleans up after itself ───────────────
//
// RTL binds both `screen` and the queries on `render`'s return value to `document.body`, so
// a mount that outlived its run would answer every later query in the file. Every read here
// goes through the run's own `container`, `mounted()` asserts exactly one page on the body,
// and `cleanup()` runs in a `finally` at the *end* of each run — including the failing one,
// which fast-check re-enters while it shrinks.
//
// Generated workspaces are deliberately small (at most four prospects). This page is ~4400
// lines and mounts a dozen panels; a hundred runs over small payloads measures the same
// universal statement as ten runs over large ones and finishes.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import ProspectIntelligence, {
  PROSPECT_GTM_LABELS,
  absenceShort,
  absenceSentence,
  gtmLeadIdOf,
  overlayFor,
  type OverlayState,
  type QueueOverlay,
} from "@/pages/ProspectIntelligence";
import {
  GTM_ABSENCE_LABELS,
  GTM_PAGE_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  PROSPECT_STAGE_LABELS,
} from "@/components/gtm/labels";
import {
  isIntelligenceActive,
  prospectStageOf,
  showsDecision,
  type ProspectStage,
} from "@/components/gtm/prospectStage";
import { CreditsProvider } from "@/hooks/useCredits";
import { GTM_BASE_URL, type ActionQueueItem, type ObservedFact } from "@/services/gtmAPI";
import {
  evaAPI,
  isEnrichedProspect,
  type EvaWorkspace,
  type LeadStatus,
  type QualifiedLead,
} from "@/services/evaAPI";

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

// The sidebar owns its own conversation read and none of these properties is about it. It
// is also this file's leak sentinel: exactly one `<nav>` per mounted page, present in every
// state including the empty ones, which `[data-gtm-stage]` is not.
vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ══════════════════════════════════════════════════════════════════════════════
// The workspace
// ══════════════════════════════════════════════════════════════════════════════

/** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ISO = "2024-05-01T12:00:00.000Z";

/**
 * Four prospects' worth of identity, and every field is distinct.
 *
 * Distinct on purpose: Property 6 asserts that no request ever carries an Eva id and
 * Property 7 asserts that an excluded prospect's name is nowhere on the page, and both are
 * only assertions if the two ids and the four names cannot be confused for one another.
 * None of these strings is a substring of another and none appears in the page's own copy.
 */
const PEOPLE = [
  { eva: "lead_ada7f1", gtm: "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20", name: "Ada Lovelace", role: "Head of Engineering" },
  { eva: "lead_gra3c2", gtm: "1b7d90ae-2c55-4a83-b0d1-6e4f7a9c2b31", name: "Grace Hopper", role: "VP Platform" },
  { eva: "lead_alt9b4", gtm: "4e8a61cf-9d13-4f77-8b2e-5c1a0d3f8e42", name: "Alan Turing", role: "Director of Data" },
  { eva: "lead_eds5d6", gtm: "7a2c34bd-6f81-4e29-9c05-2d8b1e6a4f53", name: "Edsger Dijkstra", role: "Chief Architect" },
] as const;

const COMPANIES = [
  { name: "Analytical Engines", domain: "analyticalengines.com" },
  { name: "Bletchley Systems", domain: "bletchleysystems.com" },
] as const;

/** Everything a generated prospect can vary, on the Eva side. */
interface LeadSpec {
  /** Index into `PEOPLE`. Also fixes the Eva id and the GTM id. */
  person: number;
  /** Index into `COMPANIES`. Decides which `groupByCompany` bucket it lands in. */
  company: number;
  status: LeadStatus;
  /**
   * The promoted `sales_leads.id`, or the four ways it can be absent.
   *
   * `null` and `undefined` are a lead nobody enriched; the two blank strings are the case
   * `isEnrichedProspect` trims for, and they are in the space because a whitespace id would
   * key every GTM route on nothing at all.
   */
  gtmLeadId: string | null | undefined;
  /** Eva's own captured events. Band 5's second source, and it needs no GTM read. */
  events: number;
}

function qualifiedLead(spec: LeadSpec): QualifiedLead {
  const person = PEOPLE[spec.person];
  const company = COMPANIES[spec.company];
  return {
    id: person.eva,
    entityId: `ent-${spec.person}`,
    company: company.name,
    domain: company.domain,
    website: `https://${company.domain}`,
    industry: "B2B SaaS",
    employeeRange: "51-200",
    hqLocation: "London",
    acvTier: "medium",
    identityVerified: true,
    enrichable: true,
    // Descending with the index, so `groupByCompany`'s `icpFit` sort preserves the generated
    // order and "the third prospect" means the same thing in the fixture and on screen.
    icpFit: 90 - spec.person * 5,
    recommendedAction: "queued_review",
    escalation: "none",
    qualificationReason: "Hiring for a data platform team.",
    primaryEvent: spec.events > 0 ? "Posted three data-platform roles" : null,
    eventType: spec.events > 0 ? "job_posting" : null,
    signals: Array.from({ length: spec.events }, (_, index) => ({
      id: `sig-${spec.person}-${index}`,
      signalType: "job_posting" as const,
      company: company.name,
      detail: `Opened a data platform role (${index + 1})`,
      channel: "careers",
      confidence: 0.8,
      timestamp: ISO,
    })),
    contact: {
      name: person.name,
      role: person.role,
      email: `${person.name.split(" ")[0]!.toLowerCase()}@${company.domain}`,
      emailVerified: true,
      linkedinUrl: `https://www.linkedin.com/in/${spec.person}`,
    },
    enrichment: { website: `https://${company.domain}`, status: "enriched" },
    handoffState: "enriched",
    status: spec.status,
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    gtmLeadId: spec.gtmLeadId,
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

/**
 * The dossier's subject, derived the way the page derives it — **rejections off first**.
 *
 * ── Property 7's exact statement, and why it carries two filters ──
 *
 * Task 13.4 words the property as "the presented set equals the subset passing the enriched
 * filter and carrying a non-empty `gtmLeadId`". Read literally against the bare workspace
 * that is false, and task 5.6's author flagged it rather than resolving it. Resolving it
 * here: `ProspectIntelligence.tsx` composes the subject in two steps —
 *
 *   `qualifiedLeads`  `ws.leads.filter((l) => l.status !== "rejected")`   discovery's output
 *   `activeLeads`     `qualifiedLeads.filter(isEnrichedProspect)`         this page's subject
 *
 * — and `activeLeads` is what the company list, the decision-maker list, the dossier and the
 * "Enriched prospects" count are all built from. So the presented set is the enriched subset
 * **of the non-rejected workspace**, and a rejected-but-promoted lead is excluded even though
 * `isEnrichedProspect` accepts it. The rejection filter is therefore folded into the
 * property's statement rather than left as a known gap: stating it as the bare enriched subset
 * would make the property fail on a lead the page is right to hide, which is a false alarm and
 * not a finding.
 *
 * Restated here rather than imported because the page holds both filters in `useMemo`s inside
 * the component. `services/__tests__/enrichedProspects.test.ts` already carries the same
 * helper under the same name and for the same reason; the two are deliberately identical, so
 * the day the page's composition changes both files break together.
 */
function dossierProspects(leads: QualifiedLead[]): QualifiedLead[] {
  return leads.filter((l) => l.status !== "rejected").filter(isEnrichedProspect);
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

/** Everything a generated prospect can vary, on the GTM side. */
interface Scene {
  /**
   * `li_gtm_profiles` exists — **the activation flag**, and the only input to
   * `prospectStageOf` that decides whether the decision or the intelligence is on screen.
   */
  activated: boolean;
  /** `ProspectStateFull.stateVersion`. `0` with a profile row is `WAITING`. */
  stateVersion: number;
  /** The ranking carries a winner, which is what makes an activated prospect `RECOMMENDED`. */
  recommended: boolean;
  /** `detail.activity.level` was actually observed, which is what puts band 5's panel up. */
  observedActivity: boolean;
  /** The three per-selection reads that are allowed to fail independently. */
  failDetail: boolean;
  failState: boolean;
  failRanking: boolean;
}

const DEFAULT_SCENE: Scene = {
  activated: false,
  stateVersion: 0,
  recommended: false,
  observedActivity: false,
  failDetail: false,
  failState: false,
  failRanking: false,
};

/** The stage the page derives from a scene, with no press in flight. */
function stageOfScene(scene: Scene): ProspectStage {
  return prospectStageOf({
    // A failed prospect read supplies no profile row, so it reads as un-activated — which is
    // the page's own behaviour and the reason band 8 disappears on that failure.
    profileId: scene.failDetail || !scene.activated ? null : "profile-1",
    stateVersion: scene.failState ? null : scene.stateVersion,
    hasRecommendation: !scene.failRanking && scene.recommended,
    busy: null,
  });
}

function wireDetail(gtmLeadId: string, scene: Scene) {
  return {
    lead_id: gtmLeadId,
    profile: {
      lead_id: gtmLeadId,
      profile_id: scene.activated ? "profile-1" : null,
      profile_url: scene.activated ? "https://www.linkedin.com/in/observed" : null,
      public_identifier: scene.activated ? "observed" : null,
      linkedin_verification_status: "VERIFIED",
      linkedin_verified_at: ISO,
      linkedin_match_confidence: 93,
      name: fact("Observed Name"),
      headline: fact("Observed headline"),
      company: fact("Observed Co"),
      role: fact("Observed role"),
      location: fact("London"),
      lead_score: {
        score: 82,
        score_kind: "RECOMMENDATION_SCORE",
        score_disclaimer:
          "A prioritisation signal, not a predicted probability of conversion.",
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

function wireState(gtmLeadId: string, scene: Scene) {
  return { lead_id: gtmLeadId, state_version: scene.stateVersion };
}

function wireRanking(gtmLeadId: string, scene: Scene) {
  return {
    lead_id: gtmLeadId,
    evaluation_id: `eval-${gtmLeadId}`,
    computed_at: ISO,
    recommended: scene.recommended
      ? {
          recommendation_id: `rec-${gtmLeadId}`,
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

function wireQueueItem(gtmLeadId: string) {
  return {
    lead_id: gtmLeadId,
    recommendation_id: `rec-${gtmLeadId}`,
    journey_state: fact("ENGAGING"),
    relationship_state: fact("NOT_CONNECTED"),
    action_type: "SEND_LINKEDIN_MESSAGE",
    channel: "LINKEDIN",
    execution_verb: "SEND_MESSAGE",
    executable: true,
    priority_tier: "TODAY",
    urgency: 68,
    expected_success_probability: 47,
    business_value: 55,
    signal_freshness: 80,
    why_now: [],
    computed_at: ISO,
  };
}

/** The ledger. Prices exist so the tags render; nothing here presses a priced control. */
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

// ══════════════════════════════════════════════════════════════════════════════
// Transport, and the request log every budget assertion reads
// ══════════════════════════════════════════════════════════════════════════════

/**
 * One request, parsed into the two things the budget is stated in terms of.
 *
 * `route` is the GTM route with the lead id lifted out of it, and `leadId` is that id. Both
 * matter: R3.6 and R3.7 are counts per route, and R3.4 is a claim about what the id in the
 * path *is*. A log of raw urls could answer the first and not the second.
 */
interface Call {
  method: string;
  url: string;
  /** `"/action-queue"`, `"/credits"`, or `"prospect:{tail}"` — `tail` empty for the detail read. */
  route: string;
  /** The path segment after `/prospect/`, decoded, or `null` for a route that carries none. */
  leadId: string | null;
}

function parseCall(url: string, method: string): Call {
  const path = url.startsWith(GTM_BASE_URL) ? url.slice(GTM_BASE_URL.length) : url;
  const [bare] = path.split("?");
  const prospect = /^\/prospect\/([^/]+)(.*)$/.exec(bare ?? "");
  if (prospect) {
    return {
      method,
      url,
      route: `prospect:${(prospect[2] ?? "").replace(/^\//, "")}`,
      leadId: decodeURIComponent(prospect[1]!),
    };
  }
  return { method, url, route: bare ?? "", leadId: null };
}

const ROUTE = {
  detail: "prospect:",
  state: "prospect:state",
  ranking: "prospect:next-best-action",
  history: "prospect:state/history",
  signals: "prospect:signals",
  timeline: "prospect:timeline",
  debug: "prospect:debug",
  queue: "/action-queue",
  credits: "/credits",
} as const;

/** The four disclosures that read, and the one route each of them reads. */
const FETCHING_DISCLOSURES = [
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.stateHistory, route: ROUTE.history },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.signals, route: ROUTE.signals },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.timeline, route: ROUTE.timeline },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.learned, route: ROUTE.debug },
] as const;

/** The three that read nothing on open, because they render slices of a held payload. */
const FREE_DISCLOSURES = [
  PROSPECT_INTELLIGENCE_SECTIONS.standing,
  PROSPECT_INTELLIGENCE_SECTIONS.reach,
  PROSPECT_INTELLIGENCE_SECTIONS.relationship,
] as const;

let fetchMock: ReturnType<typeof vi.fn>;
let log: Call[] = [];
/** The GTM-side scene per `sales_leads.id`, swapped per run. */
let scenes = new Map<string, Scene>();
/** Which prospects the one queue page carries, and whether it reached the end. */
let queueLeads: string[] = [];
let queueHasMore = false;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status = 500) => ({
  ok: false,
  status,
  json: async () => ({ detail: `GTM backend error ${status}` }),
});

const sceneFor = (leadId: string) => scenes.get(leadId) ?? DEFAULT_SCENE;

/**
 * A clean wire, called at the top of **every property run** and not only per test.
 *
 * `beforeEach` runs once per `it`, and fast-check runs the predicate a hundred times inside
 * one. Without this the log accumulates across runs and every count below is a count of the
 * whole test — which is what the first execution of Property 6 reported: a state-read
 * sequence of five for a run that made no selection at all. That was this harness, not the
 * page, and the reset is where the boundary between one run and the next belongs.
 */
function resetWire() {
  log = [];
  scenes = new Map();
  queueLeads = [];
  queueHasMore = false;
}

/**
 * Every route the dossier can reach, logged and answered from the current scene.
 *
 * Ordered by route rather than by substring so `/prospect/{id}/state` and
 * `/prospect/{id}/state/history` cannot answer for one another — the reason the log is
 * parsed once, up front, instead of matched with `includes()` at each branch.
 */
function serve() {
  fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const call = parseCall(url, (init?.method ?? "GET").toUpperCase());
    log.push(call);

    const lead = call.leadId ?? "";
    const scene = sceneFor(lead);

    switch (call.route) {
      case ROUTE.detail:
        return scene.failDetail ? failed() : ok(wireDetail(lead, scene));
      case ROUTE.state:
        return scene.failState ? failed() : ok(wireState(lead, scene));
      case ROUTE.ranking:
        return scene.failRanking ? failed() : ok(wireRanking(lead, scene));
      case ROUTE.queue:
        return ok({
          items: queueLeads.map(wireQueueItem),
          next_cursor: null,
          has_more: queueHasMore,
        });
      case ROUTE.credits:
        return ok(wireCredits());
      case ROUTE.history:
        return ok({ entries: [], next_cursor: null, has_more: false });
      case ROUTE.signals:
        return ok({ signals: [], next_cursor: null, has_more: false });
      case ROUTE.timeline:
        return ok({ entries: [], next_cursor: null, has_more: false });
      case ROUTE.debug:
        return ok({ lead_id: lead, learning_updates: [] });
      default:
        return ok({});
    }
  });
}

/** Every GET on one route, in the order it was issued. */
const readsOn = (route: string) =>
  log.filter((call) => call.method === "GET" && call.route === route);

/** The lead ids one route was read with, in order. */
const readLeads = (route: string) => readsOn(route).map((call) => call.leadId);

// ══════════════════════════════════════════════════════════════════════════════
// Harness
// ══════════════════════════════════════════════════════════════════════════════

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker. Present unless the prospect read failed, so not a mount sentinel. */
const STAGE = "[data-gtm-stage]";

/**
 * How many pages are on the body. Exactly one, or a run leaked its mount.
 *
 * The sidebar's `<nav>` rather than `[data-gtm-stage]`: this page has states with no dossier
 * at all — an empty workspace, a workspace nobody enriched — and Property 7 generates them,
 * so the sentinel has to be something the page renders unconditionally.
 */
const mounted = () => document.body.querySelectorAll('nav[aria-label="Conversations"]').length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

/** The `data-gtm-section` sequence inside one dossier, in document order. */
const sectionSequence = (root: ParentNode) =>
  Array.from(root.querySelectorAll("[data-gtm-section]")).map(
    (element) => element.getAttribute("data-gtm-section") ?? ""
  );

/** A `StatTile`'s number, found by its own label. */
function statTile(root: ParentNode, label: string): string | null {
  const heading = Array.from(root.querySelectorAll("p")).find(
    (element) => (element.textContent ?? "").trim() === label
  );
  const value = heading?.parentElement?.querySelectorAll("p")[1];
  return value ? (value.textContent ?? "").trim() : null;
}

/** Every retry control inside a container. One string for the whole product (R18.5). */
const retries = (root: ParentNode) =>
  Array.from(root.querySelectorAll("button")).filter((button) =>
    (button.textContent ?? "").includes(GTM_PAGE_LABELS.retry)
  );

/** The `<summary>` of one disclosure, found by the section's own label. */
function disclosure(root: ParentNode, summary: string): HTMLElement {
  const match = Array.from(root.querySelectorAll("summary")).find((element) =>
    Array.from(element.querySelectorAll("span")).some(
      (span) => (span.textContent ?? "").trim() === summary
    )
  );
  if (!match) throw new Error(`no disclosure labelled ${JSON.stringify(summary)}`);
  return match as HTMLElement;
}

function renderPage() {
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
 * The loaded page.
 *
 * Waited on `SummaryHeader`'s own tile rather than on the dossier: it renders in every state
 * the workspace read can produce, including the two empty ones, so one wait serves all five
 * properties. Callers that need a settled dossier wait for the stage on top of this.
 */
async function openPage(leads: QualifiedLead[]) {
  vi.mocked(evaAPI.getWorkspace).mockResolvedValue(workspace(leads));
  const utils = renderPage();
  const container = utils.container;
  await waitFor(() => expect(statTile(container, "Enriched prospects")).not.toBeNull());
  return { container, user: userEvent.setup() };
}

/** The dossier, once the selection's reads have landed and band 3 stands at `stage`. */
async function openDossier(leads: QualifiedLead[], stage: ProspectStage) {
  const { container, user } = await openPage(leads);
  await waitFor(() => expect(stageOf(container)).toBe(stage));
  return { container, user, dossier: container.querySelector(DOSSIER) as HTMLElement };
}

/** The prospect card for one person, inside the decision-maker list. */
function prospectCard(container: ParentNode, name: string): HTMLElement {
  const list = container.querySelector('section[aria-label="Decision makers"]') as HTMLElement;
  const label = within(list).getByText(name);
  return label.closest("button") as HTMLElement;
}

/** What the page said, for a counterexample that names it rather than a null. */
function whatThePageSaid(root: ParentNode): string {
  const statements = Array.from(root.querySelectorAll("p, h2"))
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text.length > 0)
    .slice(0, 14);
  return `sections=${JSON.stringify(sectionSequence(root))} statements=${JSON.stringify(statements)}`;
}

beforeEach(() => {
  resetWire();
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
// Property 5 — the Dossier_Hierarchy order
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The eight bands, in the one order design §2.1 fixes, as the attributes carry them.
 *
 * Bands 4 and 7 are one read and one card, and band 7 sits *above* bands 5 and 6 (R7.5) —
 * `next-best-action` is `NextBestActionCard`'s own attribute and the card renders inside the
 * `why-this-matters` region, so document order puts it fifth in this list rather than
 * seventh. That is the hierarchy the design states, not a deviation from it.
 *
 * `decision` is `ProspectDecision`'s own attribute; neither band is wrapped in a second
 * element repeating it, which is why no value can appear twice.
 */
const HIERARCHY = [
  "company",
  "prospect",
  "status",
  "why-this-matters",
  "next-best-action",
  "activity",
  "buying-intent",
  "decision",
] as const;

/** The four bands that render at every stage and in every failure. */
const ALWAYS = ["company", "prospect", "status", "why-this-matters"] as const;

/** Whether `observed` appears in `HIERARCHY` order, i.e. is a subsequence of it. */
function inHierarchyOrder(observed: string[]): boolean {
  let cursor = -1;
  for (const section of observed) {
    const at = HIERARCHY.indexOf(section as (typeof HIERARCHY)[number]);
    if (at <= cursor) return false;
    cursor = at;
  }
  return true;
}

/**
 * The scenes that are reachable from payloads alone.
 *
 * `ENRICHING`, `RESOLVING` and `ACTIVATING` come from `busy` — a request this page has in
 * flight — and not from any field, so they are a statement about a press and belong to
 * `ProspectDossier.identity.test.tsx`. What is generated here is the four stages a served
 * workspace can stand in, crossed with the two things that decide whether bands 5 and 7 have
 * anything to render.
 */
const sceneArb: fc.Arbitrary<Scene> = fc
  .record({
    activated: fc.boolean(),
    stateVersion: fc.nat({ max: 4 }),
    recommended: fc.boolean(),
    observedActivity: fc.boolean(),
  })
  .map((partial) => ({ ...DEFAULT_SCENE, ...partial }));

describe("Feature: sales-workflow-frontend-restructure, Property 5: Presented content follows the Dossier_Hierarchy order", () => {
  // The instrument. A sequence read off the wrong root, or a page whose bands carry no
  // attributes at all, would satisfy an order assertion vacuously.
  it("marks each presented band with its own attribute, once", async () => {
    scenes.set(PEOPLE[0].gtm, { ...DEFAULT_SCENE, activated: true, stateVersion: 2, recommended: true });
    queueLeads = [PEOPLE[0].gtm];
    const leads = [
      qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: PEOPLE[0].gtm, events: 1 }),
    ];

    const { dossier } = await openDossier(leads, "RECOMMENDED");
    const observed = sectionSequence(dossier);

    expect(mounted()).toBe(1);
    expect(observed).toEqual([
      "company",
      "prospect",
      "status",
      "why-this-matters",
      "next-best-action",
      "activity",
      "buying-intent",
    ]);
  });

  it(
    "presents its bands in Dossier_Hierarchy order at every stage a payload can reach",
    // A hundred mounts of a whole page do not fit the 5s default. Second argument, not
    // third: the options-as-third-argument form is deprecated in Vitest 4.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(sceneArb, fc.nat({ max: 2 }), fc.boolean(), async (scene, events, onQueue) => {
          resetWire();
          const gtm = PEOPLE[0].gtm;
          scenes.set(gtm, scene);
          queueLeads = onQueue ? [gtm] : [];
          const leads = [
            qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: gtm, events }),
          ];
          const stage = stageOfScene(scene);

          const { dossier } = await openDossier(leads, stage);

          try {
            expect(mounted()).toBe(1);
            const observed = sectionSequence(dossier);

            // ── Only the eight, and none of them twice ──
            observed.forEach((section) =>
              expect(
                HIERARCHY as readonly string[],
                `${section} is not one of the eight bands. ${whatThePageSaid(dossier)}`
              ).toContain(section)
            );
            expect(new Set(observed).size).toBe(observed.length);

            // ── The order itself (R3.1) ──
            expect(
              inHierarchyOrder(observed),
              `out of hierarchy order: ${JSON.stringify(observed)}`
            ).toBe(true);

            // ── Who, then what is happening, then what it means (R8.1) ──
            // The four that always render, in the order the questions arrive: which account,
            // which person, where they stand, why it matters. Asserted as a prefix rather
            // than as membership, because R8.1 is a claim about sequence.
            expect(observed.slice(0, ALWAYS.length)).toEqual([...ALWAYS]);

            // ── R7.5: the recommendation sits above the observations ──
            if (stage === "RECOMMENDED") {
              const nba = observed.indexOf("next-best-action");
              expect(nba, `RECOMMENDED with no recommendation card. ${whatThePageSaid(dossier)}`)
                .toBeGreaterThan(-1);
              // Band 6 is unconditional once intelligence is active, so at this stage the
              // "why now" genuinely precedes the buying-intent detail rather than merely
              // not following it.
              const intent = observed.indexOf("buying-intent");
              expect(intent).toBeGreaterThan(-1);
              expect(nba).toBeLessThan(intent);
              const activity = observed.indexOf("activity");
              if (activity > -1) expect(nba).toBeLessThan(activity);
            }

            // ── The two stage-gated bands, where the stage decides ──
            if (showsDecision(stage)) expect(observed).toContain("decision");
            else expect(observed).not.toContain("decision");
            if (isIntelligenceActive(stage)) expect(observed).toContain("buying-intent");
            else expect(observed).not.toContain("buying-intent");
          } finally {
            // At the end of the run, including the failing one: fast-check shrinks by
            // re-running the predicate, and a run that left its page mounted would hand the
            // shrinker two of them and a counterexample describing this harness.
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
      expect(mounted()).toBe(0);
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 6 — the request budget
// ══════════════════════════════════════════════════════════════════════════════

/**
 * `[first, ...clicks]` with consecutive repeats removed — the selections that cost a read.
 *
 * Re-pressing the prospect already on screen changes no state the read is keyed on, so it
 * issues nothing. That is not a gap in R3.7: "one read for the selected prospect" is a claim
 * about each *selection*, and pressing the same card twice is one selection.
 */
function selectionsOf(first: string, clicks: string[]): string[] {
  const out = [first];
  for (const id of clicks) if (id !== out[out.length - 1]) out.push(id);
  return out;
}

describe("Feature: sales-workflow-frontend-restructure, Property 6: The dossier's request budget is bounded and correctly keyed", () => {
  // The instrument: a page that reached no prospect would satisfy every count below.
  it("reads the queue once and the selection three times, all on the GTM id", async () => {
    const gtm = PEOPLE[0].gtm;
    scenes.set(gtm, { ...DEFAULT_SCENE, activated: true, stateVersion: 3 });
    const leads = [
      qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: gtm, events: 0 }),
    ];

    const { dossier } = await openDossier(leads, "ACTIVE");

    expect(readsOn(ROUTE.queue)).toHaveLength(1);
    expect(readLeads(ROUTE.detail)).toEqual([gtm]);
    expect(readLeads(ROUTE.state)).toEqual([gtm]);
    expect(readLeads(ROUTE.ranking)).toEqual([gtm]);
    // The seven disclosures are on screen and not one of them has read anything.
    expect(disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.signals)).toBeTruthy();
    FETCHING_DISCLOSURES.forEach(({ route }) => expect(readsOn(route)).toHaveLength(0));
  });

  it(
    "keeps the queue to one read, the selection to one state read on the selected GTM id, and a disclosure to a read only when opened",
    // Each run mounts the page and then makes up to two further selections.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Two or three prospects, all in one company so the whole set is selectable
          // without leaving the decision-maker list.
          fc.integer({ min: 2, max: 3 }),
          fc.array(fc.nat({ max: 2 }), { maxLength: 2 }),
          // Which disclosure the operator opens, or none. Both halves of R3.8 are in the
          // space: the four that read, and the three that must still read nothing.
          fc.option(
            fc.oneof(
              ...FETCHING_DISCLOSURES.map((entry) => fc.constant(entry.summary)),
              ...FREE_DISCLOSURES.map((summary) => fc.constant(summary))
            ),
            { nil: null }
          ),
          async (count, rawClicks, toOpen) => {
            // Every count below is a count of *this* run. `beforeEach` runs once per `it`
            // and fast-check runs this predicate a hundred times inside one, so without the
            // reset the log is the whole test's log — which is exactly what this property
            // reported on its first execution: four state reads on one lead for a run that
            // made no selection at all.
            resetWire();
            const people = PEOPLE.slice(0, count);
            // Activated with a belief, so the disclosure inventory is on screen: it renders
            // only once intelligence is active, and R3.8 is a claim about it.
            people.forEach((person) =>
              scenes.set(person.gtm, { ...DEFAULT_SCENE, activated: true, stateVersion: 3 })
            );
            const leads = people.map((_, index) =>
              qualifiedLead({
                person: index,
                company: 0,
                status: "qualified",
                gtmLeadId: PEOPLE[index]!.gtm,
                events: 0,
              })
            );
            const clicks = rawClicks.filter((index) => index < count);

            const { container, user, dossier } = await openDossier(leads, "ACTIVE");

            try {
              expect(mounted()).toBe(1);

              // ── R3.8, before anything is opened ──
              // Read here rather than at the end: `IntelligenceSection`'s `children` is a
              // function and a collapsed `<details>` never calls it, so "no request for a
              // collapsed section" is only an assertion while every section is collapsed.
              FETCHING_DISCLOSURES.forEach(({ summary, route }) =>
                expect(
                  readsOn(route),
                  `${summary} read its route while collapsed`
                ).toHaveLength(0)
              );

              // ── R3.7, one state read per selection, on the selected prospect ──
              const expected = selectionsOf(PEOPLE[0].gtm, clicks.map((index) => PEOPLE[index]!.gtm));
              for (let step = 1; step < expected.length; step += 1) {
                const person = PEOPLE.find((entry) => entry.gtm === expected[step])!;
                await user.click(prospectCard(container, person.name));
                await waitFor(() =>
                  expect(readLeads(ROUTE.state)).toHaveLength(step + 1)
                );
              }
              expect(
                readLeads(ROUTE.state),
                `the state read did not follow the selection. ${whatThePageSaid(container)}`
              ).toEqual(expected);
              // The other two of the `Promise.allSettled`: one read each, keyed the same
              // way, which is what makes the selection cost three and not six.
              expect(readLeads(ROUTE.detail)).toEqual(expected);
              expect(readLeads(ROUTE.ranking)).toEqual(expected);

              // ── R3.6, one action-queue read for the whole page ──
              // Not per selection and not per row: the read is keyed on the workspace, so
              // three selections cost it nothing.
              expect(
                readsOn(ROUTE.queue),
                "the action queue was read more than once for one page of prospects"
              ).toHaveLength(1);

              // ── R3.4, every GTM path segment is `sales_leads.id` ──
              const gtmIds = new Set<string>(people.map((person) => person.gtm));
              const evaIds = people.map((person) => person.eva);
              log.forEach((call) => {
                if (call.leadId !== null) {
                  expect(
                    gtmIds.has(call.leadId),
                    `${call.route} was keyed on ${call.leadId}, which is not a sales_leads.id`
                  ).toBe(true);
                }
                evaIds.forEach((eva) =>
                  expect(
                    call.url.includes(eva),
                    `${call.route} carried Eva's document id ${eva}`
                  ).toBe(false)
                );
              });

              // ── R3.8, on open ──
              if (toOpen !== null) {
                const before = FETCHING_DISCLOSURES.map(({ route }) => readsOn(route).length);
                await user.click(disclosure(dossier, toOpen));

                const fetching = FETCHING_DISCLOSURES.find((entry) => entry.summary === toOpen);
                if (fetching) {
                  await waitFor(() => expect(readsOn(fetching.route)).toHaveLength(1));
                }
                // Everything else stays where it was: opening one section is one section's
                // cost, and a free section's cost is nothing at all.
                FETCHING_DISCLOSURES.forEach(({ summary, route }, index) => {
                  const expectedCount =
                    fetching && summary === toOpen ? before[index]! + 1 : before[index]!;
                  expect(
                    readsOn(route),
                    `opening ${toOpen} changed what ${summary} read`
                  ).toHaveLength(expectedCount);
                });
                // And the selection's own budget is untouched — a disclosure never re-reads
                // the three the page already holds.
                expect(readLeads(ROUTE.state)).toEqual(expected);
                expect(readsOn(ROUTE.queue)).toHaveLength(1);
              }
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
      expect(mounted()).toBe(0);
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 7 — the presented prospect set
// ══════════════════════════════════════════════════════════════════════════════

const leadSpecArb = (person: number): fc.Arbitrary<LeadSpec> =>
  fc.record({
    person: fc.constant(person),
    company: fc.nat({ max: 1 }),
    status: fc.constantFrom<LeadStatus>("new", "qualified", "handed", "rejected"),
    gtmLeadId: fc.oneof(
      { weight: 4, arbitrary: fc.constant<string | null | undefined>(PEOPLE[person]!.gtm) },
      // The four ways the promoted id can be absent. The two blanks are the case
      // `isEnrichedProspect` trims for: a whitespace id would key every GTM route on nothing.
      { weight: 1, arbitrary: fc.constant<string | null | undefined>(null) },
      { weight: 1, arbitrary: fc.constant<string | null | undefined>(undefined) },
      { weight: 1, arbitrary: fc.constant<string | null | undefined>("") },
      { weight: 1, arbitrary: fc.constant<string | null | undefined>("   ") }
    ),
    events: fc.nat({ max: 1 }),
  });

describe("Feature: sales-workflow-frontend-restructure, Property 7: The dossier prospect set is exactly the enriched set", () => {
  // The instrument, and the resolution of task 5.6's flag stated as an example: a promoted
  // lead Eva rejected passes `isEnrichedProspect` and is still not presented, because the
  // page filters rejections off first. See `dossierProspects`.
  it("excludes a rejected prospect the enriched filter accepts", async () => {
    const kept = qualifiedLead({
      person: 0,
      company: 0,
      status: "qualified",
      gtmLeadId: PEOPLE[0].gtm,
      events: 0,
    });
    const rejected = qualifiedLead({
      person: 1,
      company: 0,
      status: "rejected",
      gtmLeadId: PEOPLE[1].gtm,
      events: 0,
    });

    expect(isEnrichedProspect(rejected)).toBe(true);
    expect(dossierProspects([kept, rejected]).map((l) => l.id)).toEqual([kept.id]);

    const { container } = await openPage([kept, rejected]);

    expect(statTile(container, "Enriched prospects")).toBe("1");
    expect(container.textContent).toContain(PEOPLE[0].name);
    expect(container.textContent).not.toContain(PEOPLE[1].name);
  });

  it(
    "presents exactly the non-rejected prospects carrying a promoted lead id, and nobody else",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(fc.nat({ max: 3 }), { minLength: 1, maxLength: 4 }).chain((people) =>
            fc.tuple(...people.map((person) => leadSpecArb(person)))
          ),
          async (specs) => {
            resetWire();
            const leads = specs.map(qualifiedLead);
            const expected = dossierProspects(leads);
            const expectedNames = new Set(expected.map((lead) => lead.contact.name));
            const excludedNames = leads
              .map((lead) => lead.contact.name)
              .filter((name) => !expectedNames.has(name));
            // Every prospect that *is* presented also carries a usable GTM id, which is the
            // second half of the property and is what makes the surface's controls reachable
            // at all rather than certain to 404.
            expected.forEach((lead) => expect(gtmLeadIdOf(lead)).not.toBe(""));

            const { container, user } = await openPage(leads);

            try {
              expect(mounted()).toBe(1);

              // ── The size of the presented set, off the page's own count ──
              expect(
                statTile(container, "Enriched prospects"),
                `the page counted a different set. ${whatThePageSaid(container)}`
              ).toBe(String(expected.length));

              // ── Nobody the filters excluded is anywhere on the page ──
              // `textContent`, not a query: "not presented" has to mean not in a card, not
              // in a heading, not in a count's subtitle and not in an empty state.
              excludedNames.forEach((name) =>
                expect(
                  container.textContent,
                  `${name} was excluded from the subject and is on the page anyway`
                ).not.toContain(name)
              );

              if (expected.length === 0) {
                // Two empty states, and neither of them lists a prospect. Which one is
                // right is the empty-state task's business; that there is no company column
                // to enumerate is this property's.
                expect(container.querySelector('section[aria-label="Qualified companies"]')).toBeNull();
                expect(statTile(container, "Companies")).toBe("0");
                return;
              }

              // ── Set equality, company by company ──
              // The decision-maker list holds one company at a time, so the presented set is
              // enumerated the way an operator would: every company card, then every card
              // under it. The union is the set, and the per-company count is what makes it
              // an equality rather than containment.
              const byCompany = new Map<string, QualifiedLead[]>();
              expected.forEach((lead) => {
                const bucket = byCompany.get(lead.company) ?? [];
                bucket.push(lead);
                byCompany.set(lead.company, bucket);
              });

              const companyList = container.querySelector(
                'section[aria-label="Qualified companies"]'
              ) as HTMLElement;
              expect(companyList.querySelectorAll("button")).toHaveLength(byCompany.size);
              expect(statTile(container, "Companies")).toBe(String(byCompany.size));

              const seen = new Set<string>();
              for (const [company, members] of byCompany) {
                await user.click(
                  within(companyList).getByText(company).closest("button") as HTMLElement
                );
                const list = await waitFor(() => {
                  const section = container.querySelector(
                    'section[aria-label="Decision makers"]'
                  ) as HTMLElement;
                  expect(within(section).getByText(members[0]!.contact.name)).toBeTruthy();
                  return section;
                });
                expect(
                  list.querySelectorAll("button"),
                  `${company} listed a different number of decision-makers`
                ).toHaveLength(members.length);
                members.forEach((lead) => {
                  expect(within(list).getByText(lead.contact.name)).toBeTruthy();
                  seen.add(lead.contact.name);
                });
              }

              expect([...seen].sort()).toEqual([...expectedNames].sort());
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
      expect(mounted()).toBe(0);
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 8 — the three absence kinds
// ══════════════════════════════════════════════════════════════════════════════

function unknownFact(): ObservedFact {
  return {
    value: null,
    isUnknown: true,
    sourceSurface: null,
    observedAt: null,
    isStale: false,
    isDerived: false,
  };
}

/** One queue row, built whole so a payload change is a compile error and not a lie. */
function queueRow(leadId: string): ActionQueueItem {
  return {
    leadId,
    recommendationId: `rec-${leadId}`,
    profileId: null,
    profileUrl: null,
    name: unknownFact(),
    headline: unknownFact(),
    company: unknownFact(),
    journeyState: unknownFact(),
    relationshipState: unknownFact(),
    actionType: "SEND_LINKEDIN_WARMUP",
    channel: "LINKEDIN",
    executionVerb: "SEND_MESSAGE",
    executable: true,
    unexecutableReason: null,
    actionScore: {
      score: 72,
      scoreKind: "RECOMMENDATION_SCORE",
      scoreDisclaimer:
        "A prioritisation signal, not a predicted probability of conversion.",
      isDerived: true,
    },
    actionConfidence: 61,
    stateConfidence: 58,
    priorityTier: "TODAY",
    urgency: 64,
    expectedSuccessProbability: 47,
    businessValue: 55,
    signalFreshness: 80,
    whyNow: [],
    expiresAt: null,
    computedAt: ISO,
  };
}

const overlayStateArb: fc.Arbitrary<OverlayState> = fc.oneof(
  fc.constant<OverlayState>({ kind: "none" }),
  fc.constant<OverlayState>({ kind: "unknown" }),
  fc.constant<OverlayState>({ kind: "failed" }),
  fc
    .constantFrom(...PEOPLE.map((person) => person.gtm))
    .map<OverlayState>((leadId) => ({ kind: "row", item: queueRow(leadId) }))
);

/**
 * Not a sentence: the phrasings R18.3 bans and the shapes that are not statements at all.
 *
 * A whitespace-only string is non-empty and is not a sentence, which is why "produce a
 * non-empty sentence" is read as trimmed content rather than as `length > 0`.
 */
const NOT_A_SENTENCE = ["", " ", "—", "-", "N/A", "n/a", "No data available", "null", "undefined"];

describe("Feature: sales-workflow-frontend-restructure, Property 8: The three absence kinds yield three distinct sentences", () => {
  // The instrument. Three distinct sentences is only a property if all four kinds are
  // reachable, and `overlayFor` is the one thing that decides which one a prospect gets.
  it("reaches all four kinds through overlayFor", () => {
    const present: QueueOverlay = {
      byLead: new Map([[PEOPLE[0].gtm, queueRow(PEOPLE[0].gtm)]]),
      complete: true,
    };
    const truncated: QueueOverlay = { byLead: new Map(), complete: false };
    const complete: QueueOverlay = { byLead: new Map(), complete: true };

    expect(overlayFor(PEOPLE[0].gtm, present, false).kind).toBe("row");
    // The queue was read to its end and this prospect is not on it: nothing is ranked.
    expect(overlayFor(PEOPLE[1].gtm, complete, false).kind).toBe("none");
    // The page we took was not the whole queue, so we did not look at this one.
    expect(overlayFor(PEOPLE[1].gtm, truncated, false).kind).toBe("unknown");
    // A read that errored is our failure, not the prospect's absence.
    expect(overlayFor(PEOPLE[0].gtm, present, true).kind).toBe("failed");
    // And an unread overlay is "we haven't looked", never "there is nothing".
    expect(overlayFor(PEOPLE[0].gtm, null, false).kind).toBe("unknown");
  });

  it("gives every absent kind a sentence, and the three absences three different ones", () => {
    fc.assert(
      fc.property(overlayStateArb, (state) => {
        const short = absenceShort(state);
        const sentence = absenceSentence(state);

        if (state.kind === "row") {
          // Not an absence. A live recommendation exists and the card states it, so both
          // projections answer `null` rather than composing a sentence to put beside it.
          expect(short).toBeNull();
          expect(sentence).toBeNull();
          return;
        }

        [short, sentence].forEach((text) => {
          expect(text, `${state.kind} produced no sentence`).not.toBeNull();
          expect((text ?? "").trim().length, `${state.kind} produced a blank`).toBeGreaterThan(0);
          expect(
            NOT_A_SENTENCE,
            `${state.kind} produced a generic placeholder rather than a statement`
          ).not.toContain((text ?? "").trim());
        });
      }),
      { numRuns: 100 }
    );
  });

  // The distinctness itself, over the whole of the three-kind space rather than over a
  // sample of it: there are exactly three absent kinds, so the pairwise claim is finite and
  // is asserted exhaustively instead of being generated towards.
  it("keeps absent, unknown and failed pairwise distinct in both projections", () => {
    const absences: OverlayState[] = [{ kind: "none" }, { kind: "unknown" }, { kind: "failed" }];

    const shorts = absences.map(absenceShort);
    const sentences = absences.map(absenceSentence);

    expect(new Set(shorts).size).toBe(absences.length);
    expect(new Set(sentences).size).toBe(absences.length);

    // The three subjects, named, so a future edit that collapses two of them fails here with
    // the reason rather than with a set-size mismatch: `none` is about the prospect,
    // `unknown` is about the page of the queue we read, `failed` is about us.
    expect(absenceSentence({ kind: "none" })).toBe(PROSPECT_GTM_LABELS.noRecommendation);
    expect(absenceSentence({ kind: "unknown" })).toBe(PROSPECT_GTM_LABELS.notOnQueuePage);
    expect(absenceSentence({ kind: "failed" })).toBe(PROSPECT_GTM_LABELS.overlayFailed);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 9 — a secondary read failure leaves the prospect legible
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The three reads of one `Promise.allSettled`, failed in every combination.
 *
 * These are the secondaries §2.3 names and the three flags the page carries per read —
 * `decision.readFailed`, `selected.stateFailed`, `decision.rankingFailed`. The page-wide
 * queue read is a fourth secondary; its failure is stated on the row chips and in the
 * dossier's EPS slot, and the sentences it uses are Property 8's above.
 */
const failureArb: fc.Arbitrary<Scene> = fc
  .record({
    failDetail: fc.boolean(),
    failState: fc.boolean(),
    failRanking: fc.boolean(),
    activated: fc.boolean(),
    stateVersion: fc.nat({ max: 3 }),
    recommended: fc.boolean(),
    observedActivity: fc.boolean(),
  })
  .map((partial) => ({ ...DEFAULT_SCENE, ...partial }));

describe("Feature: sales-workflow-frontend-restructure, Property 9: A secondary read failure leaves the prospect legible", () => {
  // The instrument: the worst case, all three refused, read as an example so the property's
  // counterexamples are about combinations rather than about whether the harness can fail a
  // read at all.
  it("still names the company, the person and the status when all three reads are refused", async () => {
    const gtm = PEOPLE[0].gtm;
    scenes.set(gtm, {
      ...DEFAULT_SCENE,
      activated: true,
      stateVersion: 3,
      failDetail: true,
      failState: true,
      failRanking: true,
    });
    const leads = [
      qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: gtm, events: 1 }),
    ];

    const { container } = await openPage(leads);
    const dossier = await waitFor(() => {
      const root = container.querySelector(DOSSIER) as HTMLElement;
      expect(within(root).getByText(GTM_ABSENCE_LABELS.prospectReadFailed)).toBeTruthy();
      return root;
    });

    expect(within(dossier).getByText(COMPANIES[0].name)).toBeTruthy();
    expect(within(dossier).getByText(PEOPLE[0].name)).toBeTruthy();
    const status = dossier.querySelector('[data-gtm-section="status"]') as HTMLElement;
    expect(retries(status)).not.toHaveLength(0);
  });

  it(
    "keeps the company, the person and the current status on screen for any subset of failed secondary reads, and puts a retry beside every failure it states",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(failureArb, fc.nat({ max: 1 }), async (scene, events) => {
          // The retry assertion below reads the log as a delta, so it survives an
          // accumulating log — but the reset keeps a counterexample's numbers about the run
          // that produced them rather than about every run before it.
          resetWire();
          const gtm = PEOPLE[0].gtm;
          scenes.set(gtm, scene);
          queueLeads = [];
          const leads = [
            qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: gtm, events }),
          ];
          const stage = stageOfScene(scene);

          const { container, user } = await openPage(leads);

          try {
            expect(mounted()).toBe(1);

            // Band 3 is the settle point: it renders the stage once the reads land, or the
            // prospect read's own failure sentence. Waiting on it rather than on a timer is
            // what makes each run start from the same page.
            const dossier = await waitFor(() => {
              const root = container.querySelector(DOSSIER) as HTMLElement;
              expect(root).not.toBeNull();
              const band = root.querySelector('[data-gtm-section="status"]');
              expect(band).not.toBeNull();
              if (scene.failDetail) {
                expect(within(root).getByText(GTM_ABSENCE_LABELS.prospectReadFailed)).toBeTruthy();
              } else {
                expect(stageOf(root)).toBe(stage);
              }
              return root;
            });

            // ── R3.9: the prospect stays legible ──
            // Band 1, band 2 and band 3, by content and not merely by presence: a band that
            // rendered empty would satisfy an attribute query and tell a rep nothing.
            const company = dossier.querySelector('[data-gtm-section="company"]') as HTMLElement;
            expect(company, whatThePageSaid(dossier)).not.toBeNull();
            expect(within(company).getByText(COMPANIES[0].name)).toBeTruthy();

            const prospect = dossier.querySelector('[data-gtm-section="prospect"]') as HTMLElement;
            expect(prospect).not.toBeNull();
            expect(within(prospect).getByText(PEOPLE[0].name)).toBeTruthy();
            expect(within(prospect).getByText(PEOPLE[0].role, { exact: false })).toBeTruthy();

            const status = dossier.querySelector('[data-gtm-section="status"]') as HTMLElement;
            expect(status).not.toBeNull();
            expect((status.textContent ?? "").trim().length).toBeGreaterThan(0);

            // ── R18.5: a retry beside each failure that is stated ──
            //
            // Stated in R18.5's own form — "IF a backend read fails, THEN present a retry
            // control **alongside the failure statement**" — rather than as an unconditional
            // "every failed read has a retry". The two differ in exactly one case and the
            // narrower one is right: a belief read that fails on an un-activated prospect has
            // no statement on screen, because band 6 does not render before activation and
            // its only content there would be an absence above the decision. Nothing is
            // claimed and nothing is missing, so there is nothing to retry beside.
            const failures: { failed: boolean; statement: string; where: HTMLElement | null }[] = [
              {
                failed: scene.failDetail,
                statement: GTM_ABSENCE_LABELS.prospectReadFailed,
                where: status,
              },
              {
                failed: scene.failRanking,
                statement: GTM_ABSENCE_LABELS.rankingReadFailed,
                where: dossier.querySelector('[data-gtm-section="why-this-matters"]'),
              },
              {
                failed: scene.failState,
                statement: PROSPECT_GTM_LABELS.intentUnavailable,
                where: dossier.querySelector('[data-gtm-section="buying-intent"]'),
              },
            ];

            let stated = 0;
            failures.forEach(({ failed, statement, where }) => {
              const said = (dossier.textContent ?? "").includes(statement);
              if (!said) {
                // A statement nobody made needs no control, and a statement about a read
                // that did not fail would be the page inventing a failure.
                if (failed) return;
                return;
              }
              expect(
                failed,
                `the dossier stated ${JSON.stringify(statement)} for a read that did not fail`
              ).toBe(true);
              stated += 1;
              expect(where, `${statement} has no band to sit in`).not.toBeNull();
              expect(
                retries(where!),
                `${statement} was stated with no retry beside it`
              ).not.toHaveLength(0);
            });

            // The prospect read's failure always earns both: band 3 renders in every case,
            // which is what R3.9 asks of it, and the sentence there is the one place that
            // failure is stated with a control.
            if (scene.failDetail) {
              expect(dossier.textContent).toContain(GTM_ABSENCE_LABELS.prospectReadFailed);
              expect(retries(status)).not.toHaveLength(0);
            }

            // ── One retry, three reads ──
            // The three land in one `Promise.allSettled`, so the control beside any of their
            // sentences re-reads all three. That is what makes a single retry the retry for
            // *each* failed read rather than for the one it happens to sit under.
            if (stated > 0) {
              const before = {
                detail: readsOn(ROUTE.detail).length,
                state: readsOn(ROUTE.state).length,
                ranking: readsOn(ROUTE.ranking).length,
              };
              await user.click(retries(dossier)[0]!);
              await waitFor(() => {
                expect(readsOn(ROUTE.detail).length).toBe(before.detail + 1);
                expect(readsOn(ROUTE.state).length).toBe(before.state + 1);
                expect(readsOn(ROUTE.ranking).length).toBe(before.ranking + 1);
              });
            }

            // ── R3.9's fourth clause, where it is true ──
            // The requirement also names the decision controls, and the page suppresses them
            // on a failed prospect read by design: offering a paid choice about a record that
            // could not be read would spend an operator's credits on a guess. So the clause
            // is asserted for the failures that leave the record readable, which is the
            // scope task 13.6 states the property in.
            if (!scene.failDetail && showsDecision(stage)) {
              expect(
                dossier.querySelector('[data-gtm-section="decision"]'),
                `the decision controls went missing at ${stage}. ${whatThePageSaid(dossier)}`
              ).not.toBeNull();
            }
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
      expect(mounted()).toBe(0);
    }
  );
});

// ── The replacement is a replacement (design §15.2, R20.7) ────────────────────
//
// This suite stands in for `GTMProspect.compose.test.tsx`, which was written against the page
// this feature stops rendering. Task 13.1 deleted that file and its three siblings, and
// `__tests__/routes.test.tsx` now holds the import scan R20.7 asks for; what this asserts is
// that nothing here reaches for the retired page, so the coverage above is genuinely the
// dossier's.
describe("the dossier's composition suite is written against the dossier", () => {
  it("stands the seven-section disclosure inventory up on the dossier itself", async () => {
    const gtm = PEOPLE[0].gtm;
    scenes.set(gtm, { ...DEFAULT_SCENE, activated: true, stateVersion: 2 });
    const leads = [
      qualifiedLead({ person: 0, company: 0, status: "qualified", gtmLeadId: gtm, events: 0 }),
    ];

    const { dossier } = await openDossier(leads, "ACTIVE");

    [...FETCHING_DISCLOSURES.map((entry) => entry.summary), ...FREE_DISCLOSURES].forEach(
      (summary) => expect(disclosure(dossier, summary)).toBeTruthy()
    );
    expect(within(dossier).getByText(PROSPECT_INTELLIGENCE_SECTIONS.regionHeading)).toBeTruthy();
    // Band 3's stage vocabulary is the dossier's own table, not the retired page's.
    expect(dossier.textContent).toContain(PROSPECT_STAGE_LABELS.ACTIVE!.label);
  });
});
