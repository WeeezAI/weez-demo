// pages/__tests__/ProspectDossier.a11y.test.tsx
//
// The two accessibility statements that are about the *dossier* rather than about any one
// panel, and neither of which an automated audit can make.
//
//   Property 25  An expanded disclosure has a name and its six evidence slots — every
//                `<details>` on the dossier exposes a non-empty accessible name and its
//                expansion state, and once opened the evidence region presents the evidence,
//                the signal, the source, the timestamp, the strength and the reason, each
//                either populated from the payload or carrying the unknown treatment
//                (R8.9, R8.11, R19.2)
//   Property 43  A replaced region announces itself — for any reachable stage transition the
//                band-3 region is a polite live region whose content after the change is the
//                new stage's statement and not the old one, and every control on the dossier
//                is reachable and operable by keyboard alone (R19.5, R19.1)
//
// ─── Why this is not task 21.3's job ──────────────────────────────────────────
//
// Task 21.3 runs `jest-axe` over four surfaces in four states. `jest-axe` is not imported
// here and deliberately so: none of the four claims below is expressible as a rule violation.
// axe can tell you a `<details>` exists; it cannot tell you the six slots R8.9 enumerates are
// on screen, that an absent one carries the shared unknown treatment rather than a blank, that
// the sentence in a live region is *the new stage's* sentence, or that Tab walks every control
// without skipping one. Those are claims about content and about sequence, and they are what
// this file asserts. Where the two overlap — "the region is `aria-live`" — axe would pass a
// region announcing the wrong sentence, which is the failure that actually costs a rep.
//
// ─── Why the page is mounted, and through the real transport ──────────────────
//
// The disclosure inventory is a property of `ProspectIntelligence.tsx`: which seven sections
// exist, that `IntelligenceSection.children` is a function so a collapsed section mounts
// *nothing*, and that the inventory renders only while `isIntelligenceActive(stage)`. The live
// region is band 3 of the same file. Neither survives being tested against a component.
//
// So `fetch` is served by route, the genuine `gtmAPI` normalisers run from wire to DOM, and the
// six slots are read off the DOM that `SignalRow` and `StateSnapshotRow` actually produce from
// a served payload. Only Eva's workspace read is mocked, whose wire format is `evaAPI`'s
// business — the same split `ProspectDossier.compose.test.tsx` makes, and this file reuses its
// `serve()` / `resetWire()` / `openDossier()` / `mounted()` / `disclosure()` / `PEOPLE` idiom
// rather than reinventing it.
//
// **An `ENRICHED` dossier has no `<details>` at all.** The inventory is gated on
// `isIntelligenceActive(stage) && intelligence.gtmLeadId`, i.e. `WAITING | ACTIVE |
// RECOMMENDED`, so every run of Property 25 serves a `li_gtm_profiles` row before it looks for
// a disclosure. Two earlier attempts at this file lost time to expecting one on a prospect
// that was correctly showing the decision card instead.
//
// ─── Which stages a transition can actually reach from here ───────────────────
//
// Four of the seven come off payloads: `ENRICHED` (no profile row), and `WAITING` / `ACTIVE` /
// `RECOMMENDED` (profile row, then state version and recommendation). Those are reached by
// *selecting* a prospect, which is a genuine region replacement — the same live region element
// gets new content.
//
// Two more come off `busy`, so they need a press. `RESOLVING` is an Activate press on a
// prospect with no verdict: the route enqueues a lookup, `awaitingIdentity` latches, and the
// banner stays there. `ACTIVATING` is an Activate press on a *verified* prospect, held open by
// gating the track response — see `trackGate`. Both are asserted here rather than assumed.
//
// **`ENRICHING` is unreachable on this page and is not generated.** `prospectStageOf` reads it
// from `busy: "enriching"`, and the only expression that feeds `busy` is
// `activating ? "activating" : resolvingIdentity || awaitingIdentity ? "resolving" : null`.
// Nothing on this surface can produce it, so a run that expected it would be asserting against
// a stage the page has no way to enter. `PROSPECT_STAGE_LABELS.ENRICHING` still exists because
// `prospectStage.ts` keeps the seven-value union (R7.8), and §12.1's regression suite is what
// covers the derivation itself.
//
// ─── jsdom has no accessible-name algorithm ───────────────────────────────────
//
// `nameOf()` composes the sources a name can come from on this surface — `aria-label`, the
// `aria-labelledby` target's text, the visible text, `title` — exactly as
// `ProspectDossier.identity.test.tsx`'s does, and for the same reason. It is an approximation,
// stated as one: what it can prove is that a disclosure is *not nameless*, which is the R19.2
// failure. It cannot prove which of several sources a real AT would prefer.
//
// The same limit applies to keyboard *activation*. jsdom implements `<summary>`'s activation
// behaviour for a click but neither jsdom nor `user-event` translates Enter or Space on a
// `<summary>` into one — `user-event`'s keypress behaviour does that for `button`, `a[href]`
// and a handful of input types only. So "operable" is asserted as: the control is a native
// element whose activation the platform owns, it holds a tab stop, Tab reaches it, and its
// activation behaviour does what it claims. A `<div onClick>` with no tab stop — the defect
// R19.1 exists to catch — fails the first two clauses.
//
// ─── The five counterexamples the first executions produced, and their triage ─
//
// None of the five was a defect in `ProspectIntelligence.tsx`. Recorded here because each one
// is a fact about this surface that the next person to touch the file will otherwise rediscover.
//
//   A  "'What Weez has seen' is open but built nothing" — `<summary>`'s activation sets `open`
//      synchronously while `IntelligenceSection`'s `onToggle` builds the panel a step later, so
//      a wait on `open` alone returns while every section is still empty. Fixed in the harness:
//      `openEverySection` waits on the body having children. See it.
//   B  "no evidence slot and no absence sentence", on a scene with no signals — the sections
//      were built but `SignalList` and `StateHistoryPanel` fetch on mount, so the sweep was
//      reading their skeletons. Fixed in the harness: the property waits for the served row
//      counts before reading the slots.
//   C  same symptom on the `RESOLVING` run — `resolveIdentity` posts to
//      `/gtm/lead/{id}/resolve-identity`, not `/prospect/...`, so `parseCall` sent it to the
//      `{}` fallback. Fixed in the harness: two prefixes. See `parseCall`.
//   D  "expected RESOLVING, received WAITING" — the run's payload already read `VERIFIED`, and
//      a payload verdict *is* the lookup's answer, so the poll effect settles it on the spot and
//      finishes the activation the press asked for (R6.5). The page is right; the fixture was
//      wrong. Fixed in the fixture: `RESOLVING` needs `verdict: null`.
//   E  "Tab skipped past SUMMARY 'View why'" — `user-event`'s focusable selector carries no
//      `summary` entry, so `tab()` steps over one however correct the page is. `<summary>` is
//      tabbable in a browser, and jsdom agrees it is focusable. Scoped, not fixed: the tab-order
//      clause excludes `<summary>` and says so; every other clause keeps it.
//
// ─── Every query is scoped, and every run cleans up after itself ──────────────
//
// RTL binds both `screen` and the queries on `render`'s return value to `document.body`, so a
// mount outliving its run would answer every later query in the file. Every read here goes
// through the run's own `container`, `mounted()` asserts exactly one page on the body, and
// `cleanup()` runs in a `finally` at the *end* of each run, including the failing one that
// fast-check re-enters while it shrinks. `resetWire()` is called at the top of each run rather
// than in `beforeEach`, which runs once per `it` while fast-check runs the predicate dozens of
// times inside one — and the track route *mutates* `served`, so a run that activated would hand
// the next run a prospect that is already tracked and has no decision card at all.
//
// Run counts are deliberately modest. This page is ~4,700 lines and mounts a dozen panels; the
// statements below are universal over small payloads and 40–60 runs measure them as well as
// 500 would while still finishing.

import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import ProspectIntelligence from "@/pages/ProspectIntelligence";
import {
  DIMENSION_LABEL,
  GTM_JOURNEY_LABELS,
  GTM_UI_LABELS,
  PROSPECT_DECISION_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  PROSPECT_STAGE_LABELS,
  SURFACE_LABEL,
  absTime,
} from "@/components/gtm/labels";
import { SIGNAL_LIST_LABELS, TIMESTAMP_PRECISION_LABELS } from "@/components/gtm/SignalList";
import { STATE_HISTORY_LABELS } from "@/components/gtm/StateHistoryPanel";
import { NEXT_BEST_ACTION_CARD_LABELS } from "@/components/gtm/NextBestActionCard";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import {
  isIntelligenceActive,
  prospectStageOf,
  type ProspectStage,
} from "@/components/gtm/prospectStage";
import { CreditsProvider } from "@/hooks/useCredits";
import { GTM_BASE_URL } from "@/services/gtmAPI";
import { evaAPI, type EvaWorkspace, type QualifiedLead } from "@/services/evaAPI";

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

// The sidebar owns its own conversation read and neither property is about it. It is also
// this file's leak sentinel: exactly one `<nav>` per mounted page, present in every state
// including the ones with no dossier, which `[data-gtm-stage]` is not.
vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ══════════════════════════════════════════════════════════════════════════════
// The workspace
// ══════════════════════════════════════════════════════════════════════════════

/** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ISO = "2024-05-01T12:00:00.000Z";
const EARLIER = "2024-04-18T08:30:00.000Z";
const PROFILE_ID = "profile-1";
const LINKEDIN = "https://www.linkedin.com/in/observed";

/**
 * Two prospects' worth of identity, in the same company so both are selectable without
 * leaving the decision-maker list — which is what makes a *selection* a stage transition.
 *
 * Same table and same ids as `ProspectDossier.compose.test.tsx`, trimmed to the two this file
 * needs. `icpFit` descends with the index so `groupByCompany`'s sort keeps the generated order,
 * which is what makes "the first prospect is selected on load" true rather than lucky.
 */
const PEOPLE = [
  {
    eva: "lead_ada7f1",
    gtm: "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20",
    name: "Ada Lovelace",
    role: "Head of Engineering",
  },
  {
    eva: "lead_gra3c2",
    gtm: "1b7d90ae-2c55-4a83-b0d1-6e4f7a9c2b31",
    name: "Grace Hopper",
    role: "VP Platform",
  },
] as const;

const COMPANY = { name: "Analytical Engines", domain: "analyticalengines.com" };

/** The one string on screen that can only have come from `getProspect`. See `openDossier`. */
const HEADLINE = "Observed headline";

function qualifiedLead(index: number): QualifiedLead {
  const person = PEOPLE[index];
  return {
    id: person.eva,
    entityId: `ent-${index}`,
    company: COMPANY.name,
    domain: COMPANY.domain,
    website: `https://${COMPANY.domain}`,
    industry: "B2B SaaS",
    employeeRange: "51-200",
    hqLocation: "London",
    acvTier: "medium",
    identityVerified: true,
    enrichable: true,
    icpFit: 90 - index * 5,
    recommendedAction: "queued_review",
    escalation: "none",
    qualificationReason: "Hiring for a data platform team.",
    primaryEvent: "Posted three data-platform roles",
    eventType: "job_posting",
    signals: [],
    contact: {
      name: person.name,
      role: person.role,
      email: `${person.name.split(" ")[0].toLowerCase()}@${COMPANY.domain}`,
      emailVerified: true,
      linkedinUrl: "",
    },
    enrichment: { website: `https://${COMPANY.domain}`, status: "enriched" },
    handoffState: "enriched",
    status: "qualified",
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    gtmLeadId: person.gtm,
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
    // Discovery has landed, so the page arms no silent re-read behind these mounts.
    sweepState: "complete",
    isDemo: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// The evidence payload, which is Property 25's whole input space
// ══════════════════════════════════════════════════════════════════════════════

/**
 * One `gtm_signals` row, at the width the six slots are read from.
 *
 * `eventTimestamp` and `decayProfile` are nullable *because that is the point*: they are the
 * two slots whose absence has to arrive as the shared unknown treatment rather than as a blank
 * or a zero. `sourceSurface` covers both branches of the provenance lookup — a key
 * `SURFACE_LABEL` carries, and one it does not, which renders raw.
 */
interface SignalSpec {
  signalType: string;
  sourceSurface: string;
  eventTimestamp: string | null;
  precision: string;
  effectiveStrength: number;
  decayProfile: string | null;
  atFloor: boolean;
}

/** One `gtm_state_snapshots` row: where the reason slot and the trigger live. */
interface SnapshotSpec {
  recordedAt: string | null;
  stateVersion: number;
  changedDimensions: string[];
  confidence: number;
  journeyState: string | null;
  triggeringSignalId: string | null;
  triggeringActionId: string | null;
}

/** The whole GTM-side world for one prospect, swapped per run. */
interface Scene {
  /** `li_gtm_profiles` exists — the activation flag, and the gate on the whole inventory. */
  activated: boolean;
  /** `ProspectStateFull.stateVersion`. `0` with a profile row is `WAITING`. */
  stateVersion: number;
  /** The ranking carries a winner, which is what makes an activated prospect `RECOMMENDED`. */
  recommended: boolean;
  /** `sales_leads.linkedin_verification_status`, which gates the Activate control. */
  verdict: string | null;
  /** What `POST /resolve-identity` answers with. An address is what lets a press track. */
  resolvedVerdict: string | null;
  resolvedUrl: string | null;
  signals: SignalSpec[];
  snapshots: SnapshotSpec[];
}

const DEFAULT_SCENE: Scene = {
  activated: false,
  stateVersion: 0,
  recommended: false,
  verdict: null,
  resolvedVerdict: null,
  resolvedUrl: null,
  signals: [],
  snapshots: [],
};

/** The stage the page derives from a scene with no press in flight. */
function stageOfScene(scene: Scene): ProspectStage {
  return prospectStageOf({
    profileId: scene.activated ? PROFILE_ID : null,
    stateVersion: scene.stateVersion,
    hasRecommendation: scene.recommended,
    busy: null,
  });
}

// ── The wire, as `schemas/gtm.py` serialises it ───────────────────────────────

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

function wireDetail(gtmLeadId: string, scene: Scene) {
  return {
    lead_id: gtmLeadId,
    profile: {
      lead_id: gtmLeadId,
      profile_id: scene.activated ? PROFILE_ID : null,
      // `api/gtm.py` sends no address while there is no profile row, which is why a verified
      // prospect still reads as un-trackable until the resolve response supplies one.
      profile_url: scene.activated ? LINKEDIN : null,
      public_identifier: scene.activated ? "observed" : null,
      linkedin_verification_status: scene.verdict,
      linkedin_verified_at: scene.verdict === null ? null : ISO,
      linkedin_match_confidence: scene.verdict === null ? null : 93,
      identity_candidate_url: null,
      name: fact("Observed Name"),
      headline: fact(HEADLINE),
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
    activity: { level: fact(null) },
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

/**
 * `ProspectStateFull`, at the width band 3 and the free disclosures read.
 *
 * `journey_state` is deliberately absent: `JourneyStateBadge` mounts inside the band-3 region
 * when there is one, and Property 43 reads that region's whole text as "what was announced".
 * Leaving it out keeps the region's content the stage's statement and nothing else, so the
 * assertion is about the sentence rather than about which badge happened to render beside it.
 */
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

/** The signal id one spec renders under, and the row's own address in the DOM. */
const signalIdOf = (index: number) => `sig-evidence-${index}`;
const snapshotIdOf = (index: number) => `snap-evidence-${index}`;

function wireSignalPage(scene: Scene) {
  return {
    items: scene.signals.map((spec, index) => ({
      signal_id: signalIdOf(index),
      signal_type: spec.signalType,
      source: "OBSERVED",
      source_surface: spec.sourceSurface,
      event_timestamp: spec.eventTimestamp,
      event_timestamp_precision: spec.precision,
      ingested_at: ISO,
      strength: 40,
      confidence: 80,
      relevance: 70,
      effective_strength: spec.effectiveStrength,
      decay_profile: spec.decayProfile,
      // Left absent throughout: an expiry adds a third clause to the strength line and the
      // slot being measured there is `effective_strength`, not the horizon.
      expires_at: null,
      at_floor: spec.atFloor,
      origin_table: null,
      origin_id: null,
      payload: {},
    })),
    next_cursor: null,
    has_more: false,
  };
}

function wireStateHistoryPage(scene: Scene) {
  return {
    items: scene.snapshots.map((spec, index) => ({
      snapshot_id: snapshotIdOf(index),
      recorded_at: spec.recordedAt,
      state_version: spec.stateVersion,
      changed_dimensions: spec.changedDimensions,
      confidence: spec.confidence,
      journey_state: spec.journeyState,
      triggering_signal_id: spec.triggeringSignalId,
      triggering_action_id: spec.triggeringActionId,
      state: {},
    })),
    next_cursor: null,
    has_more: false,
  };
}

/** `IdentityResolutionOut` — the verdict as the server has it now, plus the address. */
function wireResolution(scene: Scene) {
  return {
    outcome: "ENQUEUED",
    job_id: 4101,
    deduped: false,
    reason: null,
    verification_status: scene.resolvedVerdict,
    verified_at: scene.resolvedVerdict === null ? null : ISO,
    match_confidence: scene.resolvedVerdict === null ? null : 93,
    linkedin_url: scene.resolvedUrl,
    attempt_id: null,
    stage: null,
    engine_used: null,
    candidate_count: null,
    failure_reason: null,
    attempted_at: null,
  };
}

/** `TrackProspectOut` for a successful activation. */
function wireTracking() {
  return {
    outcome: "TRACKED",
    tracking_state: "TRACKING",
    profile_id: PROFILE_ID,
    profile_url: LINKEDIN,
    created_profile: true,
    created_relationship: true,
    signal_id: "signal-genesis",
    state_version: 0,
    nba_marked: true,
    observation_job_id: 8801,
    observation_outcome: "QUEUED",
    activity_job_id: 8802,
    activity_outcome: "QUEUED",
    credit: { charged: true, action: "ACTIVATE", credits: 2, balance: 48, idempotent_replay: false },
  };
}

/** The ledger: a balance that can afford everything, and the server's price list. */
function wireCredits() {
  return {
    brand_id: BRAND,
    balance: 50,
    prices: [
      { action: "ENRICH", credits: 1 },
      { action: "CONTACT", credits: 1 },
      { action: "ACTIVATE", credits: 2 },
    ],
    history: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Transport
// ══════════════════════════════════════════════════════════════════════════════

interface Call {
  method: string;
  url: string;
  /** `"/action-queue"`, `"/credits"`, or `"prospect:{tail}"` — empty tail for the detail read. */
  route: string;
  leadId: string | null;
}

/**
 * One request, with the lead id lifted out of the path.
 *
 * Parsed once up front rather than matched with `includes()` at each branch, so
 * `/prospect/{id}/state` and `/prospect/{id}/state/history` cannot answer for one another —
 * the mistake that would silently feed a snapshot page to the belief read.
 *
 * **Two prefixes, not one.** The identity search is `POST /gtm/lead/{id}/resolve-identity`,
 * not `/prospect/...`: it acts on `sales_leads` before any GTM prospect row exists. Parsing
 * only the prospect prefix sent it to the `{}` fallback, which answered a verdict-free
 * resolution — counterexample C in the header, and a harness fault rather than the page's.
 */
function parseCall(url: string, method: string): Call {
  const path = url.startsWith(GTM_BASE_URL) ? url.slice(GTM_BASE_URL.length) : url;
  const [bare] = path.split("?");
  for (const prefix of ["prospect", "lead"] as const) {
    const match = new RegExp(`^/${prefix}/([^/]+)(.*)$`).exec(bare ?? "");
    if (match) {
      return {
        method,
        url,
        route: `${prefix}:${(match[2] ?? "").replace(/^\//, "")}`,
        leadId: decodeURIComponent(match[1]),
      };
    }
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
  track: "prospect:track",
  /** `/gtm/lead/{id}/resolve-identity` — the one route on the lead rather than the prospect. */
  resolve: "lead:resolve-identity",
  channel: "prospect:recommend-channel",
  queue: "/action-queue",
  credits: "/credits",
} as const;

/** The seven sections of the inventory, and the four of them that read on open. */
const INVENTORY = [
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.standing, route: null },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.reach, route: null },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.relationship, route: null },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.stateHistory, route: ROUTE.history },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.signals, route: ROUTE.signals },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.timeline, route: ROUTE.timeline },
  { summary: PROSPECT_INTELLIGENCE_SECTIONS.learned, route: ROUTE.debug },
] as const;

let fetchMock: ReturnType<typeof vi.fn>;
let log: Call[] = [];
/** The GTM-side scene per `sales_leads.id`, swapped per run. */
let scenes = new Map<string, Scene>();

/**
 * A latch the track response waits on, so `ACTIVATING` can be observed rather than raced.
 *
 * `ACTIVATING` is `busy` while the track write is in flight, and the write returns in a
 * microtask — so without holding it open the stage flashes once inside the same `act()` and
 * there is nothing to assert. Held, the transition is deterministic: press, assert
 * `ACTIVATING`, release, assert `WAITING`. No timers and no polling.
 */
let trackGate: { wait: Promise<void>; release: () => void } | null = null;

function openGate() {
  let release: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { wait, release };
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const sceneFor = (leadId: string) => scenes.get(leadId) ?? DEFAULT_SCENE;

/**
 * A clean wire, called at the top of **every property run**.
 *
 * Not `beforeEach`: that runs once per `it` while fast-check runs the predicate dozens of times
 * inside one, and both halves of the world leak silently without this. `log` accumulates, and
 * `scenes` carries `activated`, which the *track route* sets — so a run that activated leaves
 * the next run's prospect already tracked, at `WAITING`, with no decision card and no Activate
 * control to press. The identity and compose suites each lost runs to exactly that.
 */
function resetWire() {
  log = [];
  scenes = new Map();
  trackGate = null;
}

/** Every route the dossier can reach, answered from the scene the path names. */
function serve() {
  fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const call = parseCall(url, (init?.method ?? "GET").toUpperCase());
    log.push(call);

    const lead = call.leadId ?? "";
    const scene = sceneFor(lead);

    switch (call.route) {
      case ROUTE.track: {
        if (trackGate) await trackGate.wait;
        // The row the track route creates. Everything downstream reads it from the payload,
        // which is what makes the stage change real rather than staged.
        scenes.set(lead, { ...scene, activated: true });
        return ok(wireTracking());
      }
      case ROUTE.resolve:
        return ok(wireResolution(scene));
      case ROUTE.channel:
        return ok({ lead_id: lead, channels: [], recommended_channel: null });
      case ROUTE.detail:
        return ok(wireDetail(lead, sceneFor(lead)));
      case ROUTE.state:
        return ok(wireState(lead, sceneFor(lead)));
      case ROUTE.ranking:
        return ok(wireRanking(lead, sceneFor(lead)));
      case ROUTE.history:
        return ok(wireStateHistoryPage(scene));
      case ROUTE.signals:
        return ok(wireSignalPage(scene));
      case ROUTE.timeline:
        return ok({ entries: [], next_cursor: null, has_more: false });
      case ROUTE.debug:
        return ok({ lead_id: lead, learning_updates: [] });
      case ROUTE.queue:
        return ok({ items: [], next_cursor: null, has_more: false });
      case ROUTE.credits:
        return ok(wireCredits());
      default:
        // Every `gtmAPI` normaliser defaults its collections, so a panel this file does not
        // fixture renders its own absence statement rather than throwing.
        return ok({});
    }
  });
}

const readsOn = (route: string) => log.filter((call) => call.route === route);

// ══════════════════════════════════════════════════════════════════════════════
// Harness
// ══════════════════════════════════════════════════════════════════════════════

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker, which carries the stage. Exactly one per rendered dossier. */
const STAGE = "[data-gtm-stage]";
/** Band 3's region — the one Property 43 is about. Task 12.6 made it `aria-live`. */
const STATUS_REGION = '[data-gtm-section="status"]';

/**
 * How many pages are on the body. Exactly one, or a run leaked its mount.
 *
 * The sidebar's `<nav>` rather than `[data-gtm-stage]`: the band-3 marker is absent while the
 * prospect read has failed, and a sentinel that can legitimately be zero is not a sentinel.
 */
const mounted = () => document.body.querySelectorAll('nav[aria-label="Conversations"]').length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

const statusRegionOf = (root: ParentNode) => root.querySelector(STATUS_REGION) as HTMLElement;

/** One stage's banner copy, or a loud failure — a silently empty expectation is no expectation. */
function stageCopy(stage: string): { label: string; body: string } {
  const meta = PROSPECT_STAGE_LABELS[stage];
  if (!meta) throw new Error(`no stage banner copy for ${stage}`);
  return meta;
}

/**
 * The `<summary>` of one disclosure, found by the section's own label.
 *
 * Same helper as `ProspectDossier.compose.test.tsx`'s, matching on the nested `<span>` that
 * `IntelligenceSection` puts the summary string in, so the note beside it cannot answer.
 */
function disclosure(root: ParentNode, summary: string): HTMLElement {
  const match = Array.from(root.querySelectorAll("summary")).find((element) =>
    Array.from(element.querySelectorAll("span")).some(
      (span) => (span.textContent ?? "").trim() === summary
    )
  );
  if (!match) throw new Error(`no disclosure labelled ${JSON.stringify(summary)}`);
  return match as HTMLElement;
}

/**
 * What a screen reader announces for one element, near enough for a "not nameless" claim.
 *
 * Not the full accessible-name algorithm — jsdom has no implementation of one — but every
 * source a name can come from on this surface: the override, the referenced label, the visible
 * text, and the two attributes that can hide copy from a reader. Same composition as
 * `ProspectDossier.identity.test.tsx`'s `nameOf()`, and stated as the approximation it is.
 */
function nameOf(el: Element): string {
  const referenced = (el.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => el.ownerDocument?.getElementById(id)?.textContent ?? "");

  return [
    el.getAttribute("aria-label") ?? "",
    ...referenced,
    el.textContent ?? "",
    el.getAttribute("title") ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Everything a user could act on, at the width R19.1 is stated over.
 *
 * Wider than `button`: "every interactive control" has to include a link, a field and a
 * `<summary>`, because a disclosure is a control with a name and an expansion state. Deliberately
 * *not* the bare `[tabindex]` selector — that would sweep in the focus-management containers
 * Radix marks `tabindex="-1"`, which are not controls and are correctly outside the tab order.
 */
const CONTROLS =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary,' +
  ' [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="tab"]';

/** The tags whose keyboard activation the platform owns, so no key handler of ours can be missing. */
const NATIVE = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);

const controlsIn = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter(
    (el) => el.closest('[aria-hidden="true"]') === null
  );

const isDisabled = (el: HTMLElement) =>
  (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";

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
 * The loaded dossier, waited for on a string only the prospect payload can supply.
 *
 * The stage is not a usable anchor on its own: band 3 reads `ENRICHED` from the first paint,
 * because a prospect whose read is still in flight genuinely is enriched — so a run could
 * otherwise press Activate against a dossier holding no payload. The headline can only come
 * from `getProspect`.
 */
async function openDossier(leads: QualifiedLead[], stage: ProspectStage) {
  vi.mocked(evaAPI.getWorkspace).mockResolvedValue(workspace(leads));
  const { container } = renderPage();
  const dossier = await waitFor(() => {
    const root = container.querySelector(DOSSIER) as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.textContent ?? "").toContain(HEADLINE);
    return root;
  });
  await waitFor(() => expect(stageOf(container)).toBe(stage));
  return { container, dossier };
}

/** The prospect card for one person, inside the decision-maker list. */
function prospectCard(container: ParentNode, name: string): HTMLElement {
  const list = container.querySelector('section[aria-label="Decision makers"]') as HTMLElement;
  const label = within(list).getByText(name);
  return label.closest("button") as HTMLElement;
}

/** The one Activate control, by the name R4.2 gives it. */
const activateIn = (root: ParentNode) =>
  within(root as HTMLElement).getByRole("button", {
    name: PROSPECT_DECISION_LABELS.activate.label,
  });

/**
 * A number as `SignalRow` and `StateSnapshotRow` print it.
 *
 * Restated rather than imported: `formatNumber` is module-private in both, deliberately so, and
 * a test that reached inside for it would be asserting the implementation against itself. The
 * generators below stay inside integers and exact 2-dp values so this restatement cannot drift
 * on a rounding edge the panels never see.
 */
const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** What the region said, for a counterexample that names it rather than a null. */
function whatWasSaid(root: ParentNode | null): string {
  if (!root) return "<no region>";
  return JSON.stringify((root.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 400));
}

beforeEach(() => {
  resetWire();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  serve();
  // Eva's workspace read is the one thing mocked at the service boundary — its wire format is
  // `evaAPI`'s business. Everything both properties touch goes through the transport unmocked.
  vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(workspace([]));
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 25 — a disclosure's name, its expansion state, and its six slots
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The six slots R8.9 enumerates, and where each one lives.
 *
 * ── Why the six are read off the region rather than off one section ──
 *
 * R8.9 asks for "the evidence, the signal, the source, the timestamp, the strength and the
 * reason **for that statement**". The statement is the dossier's, and the argument for it is
 * spread across the inventory by design (§2.2): the observation record and its provenance are
 * in "What Weez has seen", the reason the belief moved is in "What changed, and why". No single
 * `<details>` carries all six and none is meant to — asserting six slots inside one section
 * would fail the page for obeying its own design. So the sweep opens the inventory and reads
 * the six off it, and each slot is located by a *named* locator rather than by scanning text,
 * so a slot that vanished could not be answered by a neighbour.
 *
 * ── What "carrying the unknown treatment" is taken to mean ──
 *
 * For a *value* slot it is `ObservedValue`'s exported pair — the word `UNKNOWN_TEXT` with the
 * screen-reader-only `UNKNOWN_SR_NOTE` beside it (R9.6, R19.4). For a *collection* slot it is
 * the panel's own named absence sentence, because "no signals were recorded" is a different
 * claim from "this fact was not observed" and R18.1 requires each absence to say which. Both
 * are strings from a label table. Neither is a blank, an em dash, a zero or a substitute value,
 * and that is the failure both readings exist to catch.
 *
 *   evidence   the signal list, or `SIGNAL_LIST_LABELS.empty`
 *   signal     each row's `signalType`, and the snapshot's triggering ids or `noTrigger`
 *   source     the row's provenance line, `SURFACE_LABEL[surface]` or the raw enum
 *   timestamp  the row's `<time datetime>` with its absolute `title`, or the unknown pair
 *   strength   `effectiveStrength`, and `decayProfile` or the unknown pair
 *   reason     the snapshot's changed dimensions, or `STATE_HISTORY_LABELS.noChanged`
 */
const SLOTS = ["evidence", "signal", "source", "timestamp", "strength", "reason"] as const;

/** Surfaces `SURFACE_LABEL` maps, plus one it does not — both branches of the lookup. */
const SURFACES = [...Object.keys(SURFACE_LABEL), "PARTNER_WEBHOOK"] as const;
const PRECISIONS = Object.keys(TIMESTAMP_PRECISION_LABELS);
const DIMENSIONS = Object.keys(DIMENSION_LABEL);
const JOURNEYS = Object.keys(GTM_JOURNEY_LABELS);

/** Integers and exact 2-dp values, so `formatNumber` above cannot drift on a rounding edge. */
const measureArb = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 100 }) },
  { weight: 1, arbitrary: fc.constantFrom(0.5, 12.25, 66.75, 88.5) }
);

const signalSpecArb: fc.Arbitrary<SignalSpec> = fc.record({
  signalType: fc.constantFrom("JOB_POSTING", "PROFILE_VIEW", "POST_ENGAGEMENT", "UNCLASSIFIED"),
  sourceSurface: fc.constantFrom(...SURFACES),
  // Both branches of the timestamp slot, and `null` weighted up because the unknown treatment
  // is the half that a blank would silently satisfy.
  eventTimestamp: fc.oneof(
    { weight: 2, arbitrary: fc.constantFrom(ISO, EARLIER) },
    { weight: 1, arbitrary: fc.constant<string | null>(null) }
  ),
  precision: fc.constantFrom(...PRECISIONS),
  effectiveStrength: measureArb,
  decayProfile: fc.oneof(
    { weight: 2, arbitrary: fc.constantFrom("standard", "slow_burn") },
    { weight: 1, arbitrary: fc.constant<string | null>(null) }
  ),
  atFloor: fc.boolean(),
});

const snapshotSpecArb: fc.Arbitrary<SnapshotSpec> = fc.record({
  recordedAt: fc.oneof(
    { weight: 2, arbitrary: fc.constantFrom(ISO, EARLIER) },
    { weight: 1, arbitrary: fc.constant<string | null>(null) }
  ),
  stateVersion: fc.integer({ min: 1, max: 9 }),
  // The empty array is the `noChanged` branch and is in the space on purpose.
  changedDimensions: fc.uniqueArray(fc.constantFrom(...DIMENSIONS), { maxLength: 3 }),
  confidence: measureArb,
  journeyState: fc.oneof(
    { weight: 2, arbitrary: fc.constantFrom(...JOURNEYS) },
    { weight: 1, arbitrary: fc.constant<string | null>(null) }
  ),
  triggeringSignalId: fc.option(fc.constant("sig-trigger-a"), { nil: null }),
  triggeringActionId: fc.option(fc.constant("act-trigger-b"), { nil: null }),
});

/**
 * An activated prospect with an evidence payload — the only shape that has an inventory.
 *
 * `activated: true` in every draw, because the inventory renders only while
 * `isIntelligenceActive(stage)`. What varies is which of the three active stages the prospect
 * stands in, and what the two evidence collections hold, including empty.
 */
const activeSceneArb: fc.Arbitrary<Scene> = fc
  .record({
    stateVersion: fc.nat({ max: 4 }),
    recommended: fc.boolean(),
    signals: fc.array(signalSpecArb, { maxLength: 3 }),
    snapshots: fc.array(snapshotSpecArb, { maxLength: 2 }),
  })
  .map((partial) => ({ ...DEFAULT_SCENE, ...partial, activated: true, verdict: "VERIFIED" }));

/**
 * Opens every `<details>` on the dossier, and waits until each one has actually *built* its
 * contents.
 *
 * The two are not the same event, and the difference is counterexample A in the header. `open`
 * is set synchronously by jsdom's own `<summary>` activation behaviour; the panel inside appears
 * one step later, when the queued `toggle` event reaches `IntelligenceSection`'s `onToggle`,
 * flips `opened`, and React calls `children()`. Waiting on `open` alone therefore returns while
 * every section is still empty — and a six-slot sweep against an empty section reports the page
 * as presenting nothing.
 *
 * So the wait is on the body: `<details>`'s last element child is the content div, and it holds
 * at least one element for all eight disclosures on this surface — the seven inventory sections
 * (each of whose `children()` returns a panel or a named absence sentence) and
 * `NextBestActionCard`'s "View why".
 *
 * `fireEvent.click` rather than `userEvent`: the activation behaviour is what toggles the
 * element either way, and the cheaper dispatch keeps dozens of mounts inside one timeout.
 */
async function openEverySection(dossier: HTMLElement) {
  const sections = Array.from(dossier.querySelectorAll("details"));
  sections.forEach((section) => {
    const summary = section.querySelector("summary");
    if (summary) fireEvent.click(summary);
  });
  await waitFor(() =>
    sections.forEach((section) => {
      expect(section.open).toBe(true);
      expect(
        section.lastElementChild?.childElementCount ?? 0,
        `"${nameOf(section.querySelector("summary") ?? section).slice(0, 60)}" is open but built nothing`
      ).toBeGreaterThan(0);
    })
  );
  return sections;
}

describe("Feature: sales-workflow-frontend-restructure, Property 25: An expanded disclosure has a name and its six evidence slots", () => {
  /**
   * The instrument, in two halves, because both halves can make the property vacuous.
   *
   * An `ENRICHED` dossier has **no `<details>` at all** — the inventory is gated on
   * `isIntelligenceActive(stage)` — so a sweep over an un-activated prospect would report seven
   * named disclosures out of zero elements and pass. And a collapsed section mounts *nothing*,
   * `IntelligenceSection.children` being a function, so the six slots are genuinely absent
   * until something is opened rather than merely hidden.
   */
  it("renders no disclosure at all before activation, and seven collapsed ones after", async () => {
    const gtm = PEOPLE[0].gtm;
    scenes.set(gtm, { ...DEFAULT_SCENE, verdict: "VERIFIED" });

    const enriched = await openDossier([qualifiedLead(0)], "ENRICHED");
    expect(enriched.dossier.querySelectorAll("details")).toHaveLength(0);
    expect(mounted()).toBe(1);
    cleanup();

    resetWire();
    scenes.set(gtm, { ...DEFAULT_SCENE, activated: true, stateVersion: 3, verdict: "VERIFIED" });
    const { dossier } = await openDossier([qualifiedLead(0)], "ACTIVE");

    const sections = Array.from(dossier.querySelectorAll("details"));
    expect(sections).toHaveLength(INVENTORY.length);
    sections.forEach((section) => expect(section.open).toBe(false));
    INVENTORY.forEach(({ summary }) => expect(disclosure(dossier, summary)).toBeTruthy());
    // Nothing behind a collapsed section has been built, so nothing behind one has read.
    INVENTORY.forEach(({ summary, route }) => {
      if (route) expect(readsOn(route), `${summary} read while collapsed`).toHaveLength(0);
    });
    // R8.11: learning is inside the prospect, under its own heading, and not a destination.
    expect(disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.learned)).toBeTruthy();
    expect(PROSPECT_INTELLIGENCE_SECTIONS.learned).toBe("What we've learned");
  });

  it(
    "names every disclosure, exposes its expansion state, and presents the six evidence slots either populated or unknown",
    // Dozens of whole-page mounts, each opening every panel on the surface, do not fit the 5s
    // default. Second argument, not third: the options-as-third-argument form is deprecated.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(activeSceneArb, async (scene) => {
          // Top of the run, not `beforeEach`: see `resetWire`. The track route mutates
          // `scenes`, and `log` is what the "collapsed section read nothing" clause counts.
          resetWire();
          const gtm = PEOPLE[0].gtm;
          scenes.set(gtm, scene);
          const stage = stageOfScene(scene);
          // The generator guarantees this, and the guarantee is the reason the run has an
          // inventory to sweep at all.
          expect(isIntelligenceActive(stage)).toBe(true);

          const { dossier } = await openDossier([qualifiedLead(0)], stage);

          try {
            expect(mounted()).toBe(1);

            // ── R19.2, before anything is opened: a name, and a collapsed state ──
            const sections = Array.from(dossier.querySelectorAll("details"));
            expect(
              sections.length,
              `no disclosure on an active dossier at ${stage}`
            ).toBeGreaterThanOrEqual(INVENTORY.length);

            sections.forEach((section) => {
              const summary = section.querySelector("summary");
              expect(summary, "a <details> with no <summary> has no name at all").not.toBeNull();
              expect(
                nameOf(summary as Element),
                `a disclosure on the ${stage} dossier is nameless`
              ).not.toBe("");
              // The expansion state is the element's own, and *only* the element's own. An
              // authored `aria-expanded` on a native disclosure is a second source of truth
              // that can drift out of sync with `open`, which is the bug R19.2 would then hide.
              expect(section.open).toBe(false);
              expect(summary).not.toHaveAttribute("aria-expanded");
            });

            // The seven the inventory names are each present and each named by their own label.
            INVENTORY.forEach(({ summary }) => {
              const found = disclosure(dossier, summary);
              expect(nameOf(found)).toContain(summary);
            });

            // The sweep above is over *every* `<details>`, which at `RECOMMENDED` is eight:
            // `NextBestActionCard` puts the recommendation's own evidence behind one. Named
            // here so the extra element is accounted for rather than merely swept — a disclosure
            // this file did not know about is the case R19.2 would go unasserted on.
            if (stage === "RECOMMENDED") {
              expect(sections).toHaveLength(INVENTORY.length + 1);
              const names = sections.map((section) =>
                nameOf(section.querySelector("summary") as Element)
              );
              expect(
                names.some((name) => name.includes(NEXT_BEST_ACTION_CARD_LABELS.viewWhy)),
                `the recommendation card's disclosure is nameless. ${JSON.stringify(names)}`
              ).toBe(true);
            } else {
              expect(sections).toHaveLength(INVENTORY.length);
            }

            // ── Expanding flips the state the platform exposes ──
            const opened = await openEverySection(dossier);
            opened.forEach((section) => expect(section.open).toBe(true));
            expect(opened).toHaveLength(sections.length);

            // ── And then the panels have to have *read* ──
            // `openEverySection` waits for a section to be built; the two paged panels fetch on
            // mount, so a built section shows its skeleton before it shows its answer. Sweeping
            // the six slots against a skeleton reported "no evidence slot and no absence
            // sentence" on a page that was merely still loading — counterexample B in the
            // header, and the harness's rather than the page's.
            await waitFor(() => {
              expect(dossier.querySelectorAll("li[data-signal-type]")).toHaveLength(
                scene.signals.length
              );
              expect(dossier.querySelectorAll("li[data-snapshot-id]")).toHaveLength(
                scene.snapshots.length
              );
              if (scene.signals.length === 0)
                expect(dossier.textContent).toContain(SIGNAL_LIST_LABELS.empty);
              if (scene.snapshots.length === 0)
                expect(dossier.textContent).toContain(STATE_HISTORY_LABELS.empty);
            });

            // ── R8.9, the six slots, off the expanded region ──
            const slots = new Set<string>();

            // 1. evidence — the observation record, or the sentence saying there is none.
            const list = dossier.querySelector(
              `ol[aria-label="${SIGNAL_LIST_LABELS.list}"]`
            ) as HTMLElement | null;
            if (scene.signals.length === 0) {
              expect(list, "an empty signal page still rendered a list").toBeNull();
              expect(
                dossier.textContent,
                `no evidence slot and no absence sentence. ${whatWasSaid(dossier)}`
              ).toContain(SIGNAL_LIST_LABELS.empty);
            } else {
              expect(list, `no signal list for ${scene.signals.length} served signals`).not.toBeNull();
              expect(list.querySelectorAll("li[data-signal-type]")).toHaveLength(
                scene.signals.length
              );
            }
            slots.add("evidence");

            const signalRows = Array.from(
              dossier.querySelectorAll<HTMLElement>("li[data-signal-type]")
            );
            scene.signals.forEach((spec, index) => {
              const mine = signalRows[index];
              expect(mine, `served signal ${index} rendered no row`).not.toBeUndefined();
              const text = (mine.textContent ?? "").replace(/\s+/g, " ");

              // 2. signal — which fact this is. The raw enum is the documented fallback for a
              //    type no label table carries, and it is what the row prints.
              expect(
                text,
                `row ${index} did not name its signal. ${whatWasSaid(mine)}`
              ).toContain(spec.signalType);
              slots.add("signal");

              // 3. source — where the fact was seen. Mapped where the table has it, raw where
              //    it does not; never blank, and never a friendlier invention.
              expect(
                text,
                `row ${index} did not name its source. ${whatWasSaid(mine)}`
              ).toContain(SURFACE_LABEL[spec.sourceSurface] ?? spec.sourceSurface);
              slots.add("source");

              // 4. timestamp — the instant, with its absolute value beside the relative one,
              //    or the shared unknown pair.
              if (spec.eventTimestamp === null) {
                expect(text).toContain(UNKNOWN_TEXT);
                expect(
                  Array.from(mine.querySelectorAll("span.sr-only")).some((note) =>
                    (note.textContent ?? "").includes(UNKNOWN_SR_NOTE.trim())
                  ),
                  `row ${index} showed an unobserved timestamp with no screen-reader note`
                ).toBe(true);
              } else {
                const when = mine.querySelector(
                  `time[datetime="${spec.eventTimestamp}"]`
                ) as HTMLElement;
                expect(
                  when,
                  `row ${index} carried no timestamp for ${spec.eventTimestamp}`
                ).not.toBeNull();
                expect(when).toHaveAttribute("title", absTime(spec.eventTimestamp));
              }
              slots.add("timestamp");

              // 5. strength — the number the server recomputed, and the profile it decays on.
              expect(
                text,
                `row ${index} did not state its strength. ${whatWasSaid(mine)}`
              ).toContain(
                `${SIGNAL_LIST_LABELS.effectiveStrength}: ${formatNumber(spec.effectiveStrength)}`
              );
              expect(text).toContain(
                `${SIGNAL_LIST_LABELS.decayProfile}: ${spec.decayProfile ?? UNKNOWN_TEXT}`
              );
              // A retained signal says so in text rather than in a tone (R18.9).
              if (spec.atFloor) expect(text).toContain(SIGNAL_LIST_LABELS.atFloor);
              slots.add("strength");
            });

            // 6. reason — why the belief moved, from the snapshot that recorded it, plus the
            //    trigger that caused it. Both have a named absence rather than an empty row.
            scene.snapshots.forEach((spec, index) => {
              const row = dossier.querySelector(
                `li[data-snapshot-id="${snapshotIdOf(index)}"]`
              ) as HTMLElement;
              expect(row, `snapshot ${index} rendered no row`).not.toBeNull();
              const text = (row.textContent ?? "").replace(/\s+/g, " ");

              if (spec.changedDimensions.length === 0) {
                expect(
                  text,
                  `snapshot ${index} moved nothing and did not say so. ${whatWasSaid(row)}`
                ).toContain(STATE_HISTORY_LABELS.noChanged);
              } else {
                expect(text).toContain(
                  `${STATE_HISTORY_LABELS.changed}: ${spec.changedDimensions
                    .map((dimension) => DIMENSION_LABEL[dimension] ?? dimension)
                    .join(", ")}`
                );
              }

              // The trigger is the second half of "the signal for that statement": which fact
              // or action moved the belief, stated or stated absent.
              if (spec.triggeringSignalId === null && spec.triggeringActionId === null) {
                expect(text).toContain(STATE_HISTORY_LABELS.noTrigger);
              } else {
                if (spec.triggeringSignalId)
                  expect(text).toContain(
                    `${STATE_HISTORY_LABELS.triggeringSignal}: ${spec.triggeringSignalId}`
                  );
                if (spec.triggeringActionId)
                  expect(text).toContain(
                    `${STATE_HISTORY_LABELS.triggeringAction}: ${spec.triggeringActionId}`
                  );
              }

              // The snapshot's own strength and instant, on the same two rules.
              expect(text).toContain(formatNumber(spec.confidence));
              expect(text).toContain(GTM_UI_LABELS.confidence);
              if (spec.recordedAt === null) expect(text).toContain(UNKNOWN_TEXT);
              else
                expect(
                  row.querySelector(`time[datetime="${spec.recordedAt}"]`),
                  `snapshot ${index} carried no recorded instant`
                ).not.toBeNull();
              // The projection as it stood, or the unknown pair — never a blank badge.
              expect(text).toContain(
                spec.journeyState === null
                  ? UNKNOWN_TEXT
                  : GTM_JOURNEY_LABELS[spec.journeyState] ?? spec.journeyState
              );
              slots.add("reason");
            });
            if (scene.snapshots.length === 0) {
              expect(dossier.textContent).toContain(STATE_HISTORY_LABELS.empty);
              slots.add("reason");
            }
            if (scene.signals.length === 0) {
              // With no signal rows the four per-row slots have no populated case to show, and
              // the honest absence sentence is what stands in their place. Recorded as reached
              // so the coverage check below reads the same either way.
              slots.add("signal");
              slots.add("source");
              slots.add("timestamp");
              slots.add("strength");
            }

            // Every one of the six was located on this payload, by its own locator.
            SLOTS.forEach((slot) =>
              expect(
                slots.has(slot),
                `slot ${slot} was never presented at ${stage}. ${whatWasSaid(dossier)}`
              ).toBe(true)
            );
          } finally {
            // At the end of the run, including the failing one: fast-check shrinks by
            // re-running the predicate, and a run that left its page mounted would hand the
            // shrinker two of them and a counterexample describing this harness.
            cleanup();
          }
        }),
        { numRuns: 50 }
      );
      expect(mounted()).toBe(0);
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 43 — the replaced region, and the keyboard
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The transitions this page can actually make, and how each one is made.
 *
 * `select` replaces the region's content by selecting the other prospect in the company —
 * the same live region element, new content, which is exactly the R19.5 condition. The two
 * stages are drawn distinct, because a transition to the stage you were already in replaces
 * nothing and would make the "the old statement is gone" clause vacuous.
 *
 * `resolve` and `activate` are presses, because `RESOLVING` and `ACTIVATING` come off `busy`
 * and off no payload field. `activate` asserts two transitions in one run — into `ACTIVATING`
 * while the gated track write is in flight, then into `WAITING` when it lands.
 */
type Transition =
  | { kind: "select"; from: ProspectStage; to: ProspectStage }
  | { kind: "resolve" }
  | { kind: "activate" };

/** The four a payload can stand in with no press in flight. */
const PAYLOAD_STAGES: readonly ProspectStage[] = ["ENRICHED", "WAITING", "ACTIVE", "RECOMMENDED"];

/** A scene that lands on one payload stage. `verdict` is fixed so the Activate gate is stable. */
function sceneForStage(stage: ProspectStage): Scene {
  switch (stage) {
    case "WAITING":
      return { ...DEFAULT_SCENE, activated: true, stateVersion: 0, verdict: "VERIFIED" };
    case "ACTIVE":
      return { ...DEFAULT_SCENE, activated: true, stateVersion: 3, verdict: "VERIFIED" };
    case "RECOMMENDED":
      return {
        ...DEFAULT_SCENE,
        activated: true,
        stateVersion: 3,
        recommended: true,
        verdict: "VERIFIED",
      };
    default:
      return { ...DEFAULT_SCENE, verdict: "VERIFIED" };
  }
}

const transitionArb: fc.Arbitrary<Transition> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .tuple(fc.constantFrom(...PAYLOAD_STAGES), fc.constantFrom(...PAYLOAD_STAGES))
      .filter(([from, to]) => from !== to)
      .map(([from, to]) => ({ kind: "select" as const, from, to })),
  },
  { weight: 1, arbitrary: fc.constant<Transition>({ kind: "resolve" }) },
  { weight: 1, arbitrary: fc.constant<Transition>({ kind: "activate" }) }
);

/**
 * The live-region claims that hold at every stage, asserted after each change.
 *
 * Three things, and the third is the one an audit would miss: the region is live, it is
 * *polite* rather than assertive — a stage change is news, not an emergency, and an assertive
 * region interrupts whatever the rep was reading — and what it now holds is the new stage's
 * statement, with the statement it replaced gone. A region that kept both sentences would
 * announce a prospect as two stages at once.
 */
function expectAnnounced(container: Element, from: string | null, to: string) {
  const region = statusRegionOf(container);
  expect(region, "band 3 rendered no region at all").not.toBeNull();
  expect(region).toHaveAttribute("aria-live", "polite");
  expect(region).not.toHaveAttribute("role", "alert");

  const banner = region.querySelector(STAGE) as HTMLElement;
  expect(banner, `no stage banner inside the announced region. ${whatWasSaid(region)}`).not.toBeNull();
  expect(banner).toHaveAttribute("data-gtm-stage", to);

  const arrived = stageCopy(to);
  const said = (region.textContent ?? "").replace(/\s+/g, " ");
  expect(said, `the region did not announce ${to}. ${whatWasSaid(region)}`).toContain(arrived.label);
  expect(said, `the region announced ${to} without its statement. ${whatWasSaid(region)}`).toContain(
    arrived.body
  );

  if (from !== null && from !== to) {
    const left = stageCopy(from);
    if (left.label !== arrived.label)
      expect(
        said,
        `the region still announces ${from} after moving to ${to}. ${whatWasSaid(region)}`
      ).not.toContain(left.label);
    if (left.body !== arrived.body) expect(said).not.toContain(left.body);
  }

  // The closest live ancestor owns the change, so nothing announces twice. The only other live
  // node the region may hold is the notice paragraph — the sentence carrying what a press
  // actually did — and it is announced *because* it is a separate statement.
  const live = Array.from(region.querySelectorAll("[aria-live]"));
  expect(
    live.length,
    `${live.length} nested live nodes inside band 3 would announce the same change twice`
  ).toBeLessThanOrEqual(1);
  live.forEach((node) => expect(node).toHaveAttribute("aria-live", "polite"));
}

describe("Feature: sales-workflow-frontend-restructure, Property 43: A replaced region announces itself", () => {
  /**
   * The instrument. `expectAnnounced` reads a region found by `data-gtm-section="status"`; if
   * that attribute or the `aria-live` on it ever moved, every clause below would be asserting
   * against a `null` the harness would report rather than a page that stopped announcing.
   */
  it("puts the stage banner inside exactly one polite live region", async () => {
    scenes.set(PEOPLE[0].gtm, sceneForStage("ACTIVE"));
    const { container, dossier } = await openDossier([qualifiedLead(0)], "ACTIVE");

    const regions = dossier.querySelectorAll(STATUS_REGION);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAttribute("aria-live", "polite");
    expect(regions[0].querySelectorAll(STAGE)).toHaveLength(1);
    expectAnnounced(container, null, "ACTIVE");
    expect(mounted()).toBe(1);
  });

  it(
    "announces the new state's statement in the polite region on every reachable stage transition",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(transitionArb, async (transition) => {
          resetWire();
          const first = PEOPLE[0].gtm;
          const second = PEOPLE[1].gtm;

          if (transition.kind === "select") {
            scenes.set(first, sceneForStage(transition.from));
            scenes.set(second, sceneForStage(transition.to));
            const { container } = await openDossier(
              [qualifiedLead(0), qualifiedLead(1)],
              transition.from
            );
            const user = userEvent.setup();
            try {
              expect(mounted()).toBe(1);
              expectAnnounced(container, null, transition.from);

              await user.click(prospectCard(container, PEOPLE[1].name));
              await waitFor(() => expect(stageOf(container)).toBe(transition.to));

              expectAnnounced(container, transition.from, transition.to);
            } finally {
              cleanup();
            }
            return;
          }

          // Both press paths start from the same place: one enriched prospect, decision card on
          // screen, one Activate control. What differs is the *verdict on the payload*, which is
          // what decides whether the press waits for a lookup or continues into activation.
          //
          // `RESOLVING` needs a prospect nobody has looked for yet — `verdict: null`. A payload
          // that already reads `VERIFIED` is a lookup whose answer is *in*, and the poll effect
          // settles it on the spot and finishes the activation the operator pressed for (R6.5).
          // That is the page being right, and counterexample D in the header: a run fixtured
          // with `VERIFIED` reached `WAITING` and never stood at `RESOLVING`.
          const verified = transition.kind === "activate";
          scenes.set(first, {
            ...DEFAULT_SCENE,
            verdict: verified ? "VERIFIED" : null,
            resolvedVerdict: verified ? "VERIFIED" : null,
            resolvedUrl: verified ? LINKEDIN : null,
          });
          if (verified) trackGate = openGate();

          const { container, dossier } = await openDossier([qualifiedLead(0)], "ENRICHED");
          const user = userEvent.setup();
          try {
            expect(mounted()).toBe(1);
            expectAnnounced(container, null, "ENRICHED");

            await user.click(activateIn(dossier));

            if (!verified) {
              // The lookup was queued and its verdict lands on a later read, so the banner
              // stays here. Nothing about this is a timer — `awaitingIdentity` latches.
              await waitFor(() => expect(stageOf(container)).toBe("RESOLVING"));
              expectAnnounced(container, "ENRICHED", "RESOLVING");
              return;
            }

            // Held open by `trackGate`, so the transition is observed rather than raced.
            await waitFor(() => expect(stageOf(container)).toBe("ACTIVATING"));
            expectAnnounced(container, "ENRICHED", "ACTIVATING");

            trackGate.release();
            await waitFor(() => expect(stageOf(container)).toBe("WAITING"));
            expectAnnounced(container, "ACTIVATING", "WAITING");
          } finally {
            cleanup();
          }
        }),
        { numRuns: 40 }
      );
      expect(mounted()).toBe(0);
    }
  );

  /**
   * R19.1, the second conjunct of Property 43.
   *
   * Four clauses per control, and each one is a different way a control stops being operable
   * without a keyboard:
   *
   *   **In the tab order.** No `tabindex` below zero on anything a user acts on. The generic
   *   `[tabindex]` selector is deliberately not in `CONTROLS` — Radix marks focus-management
   *   containers `tabindex="-1"` and those are not controls.
   *   **Platform-owned activation.** A native element, so Enter and Space are handled by the
   *   browser and there is no key handler of ours that can be missing. A `<div onClick>` — the
   *   defect this clause exists for — fails here.
   *   **Focusable.** Focus actually lands, which in jsdom only succeeds for a focusable element.
   *   **Reachable in sequence.** Tab walks from the first control through every other one, in
   *   document order, skipping none and trapping on none.
   *
   * The walk starts at the dossier's first control rather than at `document.body`: the page
   * mounts a sidebar and a decision-maker list ahead of the dossier, and tabbing through those
   * on every run would measure their tab order rather than this one's. What is asserted is that
   * *within* the dossier the sequence is complete — and the third clause is what says the entry
   * point itself is focusable. `delay: null` because a run tabs through dozens of controls and
   * the inter-event wait is the whole cost.
   */
  it(
    "reaches and operates every dossier control by keyboard alone",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...PAYLOAD_STAGES),
          fc.boolean(),
          async (stage, openSections) => {
            resetWire();
            scenes.set(PEOPLE[0].gtm, {
              ...sceneForStage(stage),
              // One of each, so the two paged panels render a row with its own controls rather
              // than only an empty state.
              signals: [
                {
                  signalType: "JOB_POSTING",
                  sourceSurface: "LINKEDIN_PROFILE_PAGE",
                  eventTimestamp: ISO,
                  precision: "EXACT",
                  effectiveStrength: 42,
                  decayProfile: "standard",
                  atFloor: false,
                },
              ],
              snapshots: [
                {
                  recordedAt: ISO,
                  stateVersion: 2,
                  changedDimensions: ["relationship_state"],
                  confidence: 80,
                  journeyState: JOURNEYS[0],
                  triggeringSignalId: "sig-trigger-a",
                  triggeringActionId: null,
                },
              ],
            });

            const { dossier } = await openDossier([qualifiedLead(0)], stage);
            const user = userEvent.setup({ delay: null });

            try {
              expect(mounted()).toBe(1);
              // Both halves of the surface: the disclosures closed, which is what a rep first
              // meets, and open, which is where most of the controls are.
              if (openSections && dossier.querySelector("details")) {
                await openEverySection(dossier);
              }

              const controls = controlsIn(dossier);
              expect(controls.length, `no control at all on the ${stage} dossier`).toBeGreaterThan(0);

              controls.forEach((el) => {
                const explicit = el.getAttribute("tabindex");
                expect(
                  explicit === null || Number(explicit) >= 0,
                  `${el.tagName} "${nameOf(el).slice(0, 60)}" is out of the tab order`
                ).toBe(true);
                expect(
                  NATIVE.has(el.tagName),
                  `${el.tagName} "${nameOf(el).slice(0, 60)}" is not a native control, so its keyboard activation is nobody's`
                ).toBe(true);
              });

              const reachable = controls.filter((el) => !isDisabled(el));
              expect(reachable.length).toBeGreaterThan(0);

              // ── Focus lands, on every control including the disclosures ──
              reachable.forEach((el) => {
                el.focus();
                expect(
                  document.activeElement,
                  `focus would not land on ${el.tagName} "${nameOf(el).slice(0, 60)}"`
                ).toBe(el);
              });

              // ── Tab walks the whole sequence, in order ──
              //
              // `<summary>` is out of *this* clause and stays in every other one. It is
              // focusable in a browser and tabbable there, and jsdom agrees it is focusable —
              // the clause above proves focus lands on each one. What omits it is
              // `user-event`'s own tab implementation, whose focusable selector is
              // `input, button, select, textarea, [contenteditable], a[href], [tabindex]` and
              // carries no `summary` entry, so `tab()` steps straight over one however correct
              // the page is. Asserting through it would report the harness rather than the
              // dossier — counterexample E in the header, on `NextBestActionCard`'s "View why".
              const tabbable = reachable.filter((el) => el.tagName !== "SUMMARY");
              expect(tabbable.length).toBeGreaterThan(0);
              tabbable[0].focus();
              for (let step = 1; step < tabbable.length; step += 1) {
                // eslint-disable-next-line no-await-in-loop
                await user.tab();
                expect(
                  document.activeElement,
                  `Tab skipped from ${tabbable[step - 1].tagName} "${nameOf(
                    tabbable[step - 1]
                  ).slice(0, 40)}" past ${tabbable[step].tagName} "${nameOf(tabbable[step]).slice(
                    0,
                    40
                  )}"`
                ).toBe(tabbable[step]);
              }

              // ── Operation, where the platform's own behaviour is observable ──
              // A `<summary>`'s activation behaviour toggles its `<details>`; that is the
              // behaviour Enter and Space invoke in a browser, and neither jsdom nor
              // `user-event` translates those keys into it (see the header). So the activation
              // itself is exercised, and what the keyboard clauses above establish is that a
              // keyboard can reach the element that carries it.
              const summaries = Array.from(dossier.querySelectorAll("summary"));
              summaries.forEach((summary) => {
                const details = summary.parentElement as HTMLDetailsElement;
                const before = details.open;
                fireEvent.click(summary);
                expect(
                  details.open,
                  `activating "${nameOf(summary).slice(0, 60)}" did not change its expansion state`
                ).toBe(!before);
              });

              // Enter on a `<button>` is translated, so the one control kind whose keyboard
              // operation is fully observable here is asserted as such rather than assumed.
              const buttons = tabbable.filter((el) => el.tagName === "BUTTON");
              if (buttons.length > 0) {
                const retry = buttons.find((el) =>
                  (el.textContent ?? "").includes(STATE_HISTORY_LABELS.asOfApply)
                );
                if (retry) {
                  retry.focus();
                  await user.keyboard("{Enter}");
                  // It is `disabled` with no draft, so pressing it changes nothing — which is
                  // the point: the key reached the control and the control's own state decided.
                  expect(document.activeElement).toBe(retry);
                }
              }
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 40 }
      );
      expect(mounted()).toBe(0);
    }
  );
});
