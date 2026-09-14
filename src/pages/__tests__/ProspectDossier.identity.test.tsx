// pages/__tests__/ProspectDossier.identity.test.tsx
//
// Identity verification as plumbing: the four statements the dossier makes about work the
// rep never asked to do and must never be handed.
//
//   Property 11  the decision copy contains no identity vocabulary — across blocked,
//                unblocked, resolving and settled props and every verdict, nothing the
//                dossier renders and nothing it announces names LinkedIn URL entry,
//                LinkedIn profile finding, profile lookup or identity resolution
//                (R4.5, R6.6)
//   Property 18  activation never starts unasked and never tracks unverified — no
//                resolution request when a payload becomes enriched, one Activate control
//                that starts the lookup with no separate control beside it, and no track
//                request for any verdict other than a verified person (R6.1, R6.2, R6.4)
//   Property 19  the identity poll is bounded — for any number of verdict-free responses,
//                the re-read happens at the declared interval, for at most the declared
//                limit, and stops there (R6.8)
//   Property 20  activation keeps the prospect in place — the router location is unchanged
//                and the same prospect stays selected after a successful activation
//                (R7.1), plus the R6.3 stopped sentence and the R6.9 still-running
//                statement as examples
//
// ─── Why all four are asserted against the page ───────────────────────────────
//
// Not one of them is a claim `ProspectDecision` can keep. The card renders one button and
// routes a press; *what that press does* — whether a lookup is asked for at all, whether a
// track request follows the verdict, how many times the page goes back for an answer, and
// whether the surface stays put — lives in `ProspectIntelligence.tsx`, in
// `onActivateIntelligence`, `onResolveIdentity` and the poll effect between them.
// `components/gtm/__tests__/ProspectDecision.test.tsx` already owns Properties 10 and 12 at
// the component layer (the two controls, and the Activate card's invariance under the
// verdict), and nothing here restates them.
//
// So the transport is real, exactly as `insufficientCredits.test.tsx` mounts this same page:
// `fetch` is stubbed by URL, the genuine `gtmAPI` normalisers run from wire to DOM, and
// "issues no track request" is a claim about requests that were never made rather than about
// a spy that was never called. Eva's workspace read is the one thing mocked at the service
// boundary — its wire format is not this file's business.
//
// ─── What "identity vocabulary" means, and what it deliberately does not ──────
//
// R4.5 and R6.6 ban four kinds of thing: LinkedIn URL entry, LinkedIn profile finding,
// profile lookup, identity resolution. All four are the same failure — identity work
// presented as the rep's task, on the one surface where they are choosing between two
// product outcomes. The vocabulary table below is written against that, and not against the
// word "LinkedIn", because R6.3 *pins* a sentence containing it: "Activation stopped — We
// couldn't verify this person on LinkedIn. Intelligence was not activated." A sweep that
// banned the word would fail on the one sentence the requirements mandate.
//
// The same reasoning spares Weez's own progress reports, and one of them is a counterexample
// this file found rather than a case it anticipated: `PROSPECT_STAGE_LABELS.RESOLVING.label`
// is "Finding their profile", it renders in band 3 after an Activate press, and design §3.2
// fixes it as that exact string. See `PROGRESS_REPORTS` for the triage — the banner is not
// card copy and not a control, so it is spared by name, and control names are swept with no
// exemption at all. `GTM_IDENTITY_LABELS.resolveQueued`
// — "Looking for their LinkedIn profile. The result lands on the next read." — is rendered
// in the stage band under `aria-live="polite"` after an Activate press, and §4.3 requires
// it: the route queues a job, the verdict lands on a later read, and a rep who pressed a
// priced control is owed a sentence saying what is happening. That is Weez reporting its own
// work, not the product asking the rep to do any. The `it` below the table pins both halves
// of this scope — the patterns bite on the three strings that were the real offenders, and
// spare every sentence a requirement pins — so the reading is stated rather than implied.
//
// ─── Every query is scoped, and every run cleans up after itself ──────────────
//
// RTL binds both `screen` and the queries on `render`'s return value to `document.body`, so
// one mount outliving its run would answer every later query in the file — and a file whose
// subject is *how many* controls carry a forbidden name cannot afford that. Every read here
// goes through the run's own `container`, `mounted()` asserts exactly one dossier on the
// page, and `cleanup()` runs in a `finally` at the *end* of each run, including the failing
// one that fast-check re-enters while it shrinks.
//
// The served world is reset on the same boundary and for a sharper reason: the *track route*
// sets `served.activated`, so a run that activated would hand the next run a prospect that is
// already tracked and has no decision card at all. See `resetWire()`.

import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import ProspectIntelligence, {
  IDENTITY_POLL_LIMIT,
  IDENTITY_POLL_MS,
} from "@/pages/ProspectIntelligence";
import {
  GTM_IDENTITY_CONFIRM_LABELS,
  GTM_IDENTITY_LABELS,
  GTM_PAGE_LABELS,
  PROSPECT_DECISION_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  PROSPECT_STAGE_LABELS,
} from "@/components/gtm/labels";
import { CreditsProvider } from "@/hooks/useCredits";
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

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── The workspace, and the one prospect in it ────────────────────────────────

/** A real brand id: `evaAPI` refuses to talk to the network for anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
/** Eva's document id, and the `sales_leads.id` Enrich Now promoted it to. */
const EVA_LEAD = "lead_ada7f1";
const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
const PROFILE_ID = "profile-1";
const PERSON = "Ada Lovelace";
const COMPANY = "Analytical Engines";
const ROLE = "Head of Engineering";
/**
 * The headline, and the only string on screen that can only have come from `getProspect`.
 *
 * Deliberately not the Eva lead's role: `ProspectHeader` renders from `detail.profile` and
 * nothing else mounts it, so waiting for this text is what tells a run that the prospect
 * payload has actually landed. Waiting for the stage would not — band 3 renders `ENRICHED`
 * from the first paint, because a prospect whose read is still in flight genuinely is
 * enriched, so a run could otherwise press Activate against a dossier holding no payload.
 */
const HEADLINE = "Head of Data Platform";
const LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
const CANDIDATE = "https://www.linkedin.com/in/a-possible-ada";
const ISO = "2024-05-01T12:00:00.000Z";
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

/**
 * One enriched prospect, whose reachability the caller decides.
 *
 * `hasChannel: false` empties both contact fields, which is the blocked half of the decision
 * card: `contactGateOf` then answers `CONTACT_DIRECTLY_LABELS.noChannel` and the Contact
 * control is replaced by that sentence. Nothing about it touches the identity gate, which is
 * the point — both halves of the card are generated so the vocabulary sweep runs over the
 * blocked and the unblocked surface alike.
 */
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
    signals: [],
    contact: {
      name: PERSON,
      role: ROLE,
      email: served.hasChannel ? "ada@analyticalengines.com" : "",
      emailVerified: served.hasChannel,
      linkedinUrl: "",
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

function workspace(): EvaWorkspace {
  const leads = [qualifiedLead()];
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
      enrichedLeads: leads.length,
      emailsFound: served.hasChannel ? 1 : 0,
      handedToMax: 0,
      byTier: { low: 0, medium: 1, high: 0 },
      bySignalType: {},
    },
    // Discovery has landed, so the page arms no silent re-read behind these mounts.
    sweepState: "complete",
    isDemo: false,
  };
}

// ─── What the server is currently answering ───────────────────────────────────

/** The three verdict columns of `sales_leads`, which both reads answer with. */
interface Verdict {
  status: string | null;
  verifiedAt: string | null;
  confidence: number | null;
}

/**
 * The whole served world, swapped per run and mutated by the writes themselves.
 *
 * `activated` is flipped by the track route rather than set by the test, so a dossier that
 * activated is one whose `li_gtm_profiles` row exists because a request created it — which
 * is what makes the stage transition and the "stays in place" reading in Property 20 real
 * rather than staged.
 */
interface Served {
  /** `getProspect`'s verdict — re-read on every poll tick. */
  payload: Verdict;
  /** What `POST /resolve-identity` answers with, and the address only it can carry. */
  resolution: Verdict & { url: string | null; deduped: boolean; outcome: string };
  /** Set by the track route. Before that there is no profile row and no `profile_url`. */
  activated: boolean;
  /** `identity_candidate_url`: present only while the identity is unsettled *and* a
   *  candidate exists, which is the one condition that mounts `IdentityConfirmPanel`. */
  candidateUrl: string | null;
  /** `TrackProspectOut`, as far as the notice reads it. */
  tracking: {
    createdProfile: boolean;
    observationJobId: number | null;
    activityJobId: number | null;
    charged: boolean;
  };
  /** Whether the enriched lead has a channel, which is the Contact control's only gate. */
  hasChannel: boolean;
}

const NO_VERDICT: Verdict = { status: null, verifiedAt: null, confidence: null };

function baseServed(): Served {
  return {
    payload: { ...NO_VERDICT },
    resolution: { ...NO_VERDICT, url: null, deduped: false, outcome: "ENQUEUED" },
    activated: false,
    candidateUrl: null,
    tracking: {
      createdProfile: true,
      observationJobId: 8801,
      activityJobId: 8802,
      charged: true,
    },
    hasChannel: true,
  };
}

let served: Served = baseServed();

// ─── The wire, as `schemas/gtm.py` serialises it ──────────────────────────────

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

/**
 * `ProspectOut` for this prospect, read out of `served` at request time.
 *
 * `profile_id` is the activation flag — the `li_gtm_profiles` row — and `profile_url` is
 * that row's address, which is why both appear and disappear together: `api/gtm.py` sends
 * `profile_url=None` whenever there is no profile. So before the first activation a lead
 * genuinely holds a verdict with no address, and the address the track route needs comes
 * from `sales_leads.linkedin_url` on the resolve response instead.
 */
function wireDetail() {
  return {
    lead_id: GTM_LEAD,
    profile: {
      lead_id: GTM_LEAD,
      profile_id: served.activated ? PROFILE_ID : null,
      profile_url: served.activated ? LINKEDIN : null,
      public_identifier: served.activated ? "ada-lovelace" : null,
      linkedin_verification_status: served.payload.status,
      linkedin_verified_at: served.payload.verifiedAt,
      linkedin_match_confidence: served.payload.confidence,
      identity_candidate_url: served.candidateUrl,
      name: fact(PERSON),
      headline: fact(HEADLINE),
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

/** `IdentityResolutionOut` — the verdict as the server has it *now*, plus the address. */
function wireResolution() {
  return {
    outcome: served.resolution.outcome,
    job_id: served.resolution.outcome === "ENQUEUED" ? 4101 : null,
    deduped: served.resolution.deduped,
    reason: null,
    verification_status: served.resolution.status,
    verified_at: served.resolution.verifiedAt,
    match_confidence: served.resolution.confidence,
    linkedin_url: served.resolution.url,
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
    outcome: served.tracking.createdProfile ? "TRACKED" : "ALREADY_TRACKED",
    tracking_state: "TRACKING",
    profile_id: PROFILE_ID,
    profile_url: LINKEDIN,
    created_profile: served.tracking.createdProfile,
    created_relationship: served.tracking.createdProfile,
    signal_id: "signal-1",
    state_version: 0,
    nba_marked: true,
    observation_job_id: served.tracking.observationJobId,
    observation_outcome: served.tracking.observationJobId === null ? null : "QUEUED",
    activity_job_id: served.tracking.activityJobId,
    activity_outcome: served.tracking.activityJobId === null ? null : "QUEUED",
    credit: served.tracking.charged
      ? { charged: true, action: "ACTIVATE", credits: 2, balance: 48, idempotent_replay: false }
      : null,
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

// ─── Transport ────────────────────────────────────────────────────────────────

interface Call {
  url: string;
  method: string;
}

let fetchMock: ReturnType<typeof vi.fn>;
/** Every request the page made, in order, so an absence is checkable as an absence. */
let calls: Call[] = [];

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const emptyPage = () => ({ items: [], entries: [], next_cursor: null, has_more: false });

/**
 * Every route the dossier can reach.
 *
 * Ordered longest-first: `/prospect/{id}/track`, `/prospect/{id}/state` and the bare
 * `/prospect/{id}` all contain `/prospect/`, and matching the read first would answer a
 * write with a payload. The `{}` fallback is deliberate — every `gtmAPI` normaliser defaults
 * its collections, so a panel behind a disclosure this file does not fixture renders its own
 * absence statement rather than throwing.
 */
function serve() {
  fetchMock.mockImplementation(async (input: unknown, init?: unknown) => {
    const url = String(input);
    const method = String((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
    calls.push({ url, method });

    if (url.includes("/resolve-identity")) return ok(wireResolution());
    if (url.includes(`/prospect/${GTM_LEAD}/track`)) {
      // The row the track route creates. Everything downstream reads it from the payload.
      served.activated = true;
      return ok(wireTracking());
    }
    if (url.includes("/recommend-channel"))
      return ok({ lead_id: GTM_LEAD, channels: [], recommended_channel: null });
    if (url.includes("/identity/confirm")) return ok({ lead_id: GTM_LEAD, confirmed: true });
    if (url.includes("/credits")) return ok(wireCredits());
    if (url.includes("/action-queue")) return ok({ items: [], has_more: false });
    if (url.includes("/next-best-action")) return ok({ lead_id: GTM_LEAD });
    if (url.includes("/state/history")) return ok(emptyPage());
    if (url.includes("/signals")) return ok(emptyPage());
    if (url.includes("/timeline")) return ok(emptyPage());
    if (url.includes("/debug")) return ok({ lead_id: GTM_LEAD });
    if (url.includes("/state")) return ok({ lead_id: GTM_LEAD });
    if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail());
    return ok({});
  });
}

/** The three writes and the one read this file counts. */
const resolveRequests = () =>
  calls.filter((call) => call.method === "POST" && call.url.includes("/resolve-identity"));
const trackRequests = () =>
  calls.filter(
    (call) => call.method === "POST" && call.url.includes(`/prospect/${GTM_LEAD}/track`)
  );
/** `getProspect`, and not one of the two reads that share its prefix. */
const detailReads = () =>
  calls.filter((call) => call.url.includes(`/prospect/${GTM_LEAD}?`)).length;

/**
 * A clean server and an empty request log, called at the top of **every property run**.
 *
 * Not `beforeEach`, which runs once per `it` while fast-check runs the predicate a hundred
 * times inside one. Both halves of the world leak without this, and both leaks are silent:
 *
 *   `calls`   accumulates, so "one press asked for one search" reads the whole test's
 *             requests and fails on run two with four.
 *   `served`  carries `activated`, which the *track route* sets. A run that activated leaves
 *             the next run's prospect already tracked — stage `WAITING`, no decision card at
 *             all — and every later run fails looking for an Activate control that is
 *             correctly absent.
 *
 * The first execution of this file reported exactly those two failures across four
 * properties. Neither was the page.
 */
function resetWire() {
  served = baseServed();
  calls = [];
}

// ─── Harness ──────────────────────────────────────────────────────────────────

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker, which carries the stage. Exactly one per mounted dossier. */
const STAGE = "[data-gtm-stage]";
/** Band 8. `ProspectDecision` marks it from inside the component. */
const DECISION = '[data-gtm-section="decision"]';

/** How many dossiers are on the page. Exactly one, or a run leaked its mount. */
const mounted = () => document.body.querySelectorAll(STAGE).length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

/**
 * Everything a user could act on.
 *
 * Wider than `button` on purpose: R6.6 bans a *control* labelled with identity work, and
 * that has to fail for a link, a field or anything given a tab stop — not only for a
 * `<button>`. `<summary>` is in the sweep because a disclosure is a control with a name.
 */
const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="textbox"], [tabindex]';

const controlsIn = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>(INTERACTIVE));

/**
 * What a screen reader announces for one element, near enough for a vocabulary sweep.
 *
 * Not the full accessible-name algorithm — jsdom has no implementation of it — but every
 * source a name can come from on this surface: the override, the referenced label, the
 * visible text, and the two attributes a tooltip or a field can hide copy in.
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
    el.getAttribute("placeholder") ?? "",
    el.getAttribute("alt") ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Everything the dossier says, to a reader and to a screen reader both.
 *
 * `textContent` is what is painted; the attribute sweep is what is announced without being
 * painted. A control renamed through `aria-label` alone would pass a text-only scan while
 * telling a screen-reader user to go and find a LinkedIn profile.
 */
function everythingSaid(root: Element): string {
  const spoken = Array.from(root.querySelectorAll("[aria-label], [title], [placeholder], [alt]"))
    .map((el) =>
      [
        el.getAttribute("aria-label") ?? "",
        el.getAttribute("title") ?? "",
        el.getAttribute("placeholder") ?? "",
        el.getAttribute("alt") ?? "",
      ].join(" ")
    )
    .join("\n");

  return `${root.textContent ?? ""}\n${spoken}`;
}

/** The prospect-dossier root of a render, which every scoped query goes through. */
const dossierOf = (container: Element) => container.querySelector(DOSSIER) as HTMLElement;

/** The one Activate control, by the name R4.2 gives it. */
const activateIn = (root: ParentNode) =>
  within(root as HTMLElement).getByRole("button", {
    name: PROSPECT_DECISION_LABELS.activate.label,
  });

/** Where the router thinks it is, rendered from `useLocation` inside the router. */
function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="router-location">{`${location.pathname}${location.search}`}</span>
  );
}

const locationOf = (container: Element) =>
  within(container as HTMLElement).getByTestId("router-location").textContent;

/** The deep-linked entry: the prospect is named in the URL, so selection is checkable there too. */
const START = `/prospect-intelligence/${BRAND}?lead_id=${GTM_LEAD}`;

/** Mounts the page at this workspace's prospect surface, credits and all. */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={[START]}>
      <CreditsProvider brandId={BRAND}>
        <LocationProbe />
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
 * See `HEADLINE`: the stage is not a usable anchor here, because band 3 reads `ENRICHED`
 * from the first paint and a run that started there could press Activate against a dossier
 * whose read had not landed.
 */
async function openDossier() {
  serve();
  const { container } = renderPage();
  const dossier = await waitFor(() => {
    const root = dossierOf(container);
    expect(root).not.toBeNull();
    expect(root.textContent ?? "").toContain(HEADLINE);
    return root;
  });

  return { container, dossier };
}

/** Opens every disclosure on the dossier, so the sweep reaches the whole surface. */
async function openEveryDisclosure(dossier: HTMLElement) {
  const sections = Array.from(dossier.querySelectorAll("details"));
  // `fireEvent.click` rather than `userEvent`: jsdom's own `<summary>` activation behaviour
  // is what toggles the element either way, and the cheaper dispatch keeps a hundred mounts
  // inside one timeout. The instrument check below is what says the opening worked.
  sections.forEach((section) => {
    const summary = section.querySelector("summary");
    if (summary) fireEvent.click(summary);
  });

  await waitFor(() => {
    expect(sections.length).toBeGreaterThan(0);
    sections.forEach((section) => expect(section.open).toBe(true));
  });

  return sections;
}

beforeEach(() => {
  resetWire();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // The workspace read is Eva's own, with a wire format this file has no business
  // restating. Everything the identity gate touches goes through the transport unmocked,
  // which is the point. Read at call time so `served.hasChannel` reaches the fixture.
  vi.spyOn(evaAPI, "getWorkspace").mockImplementation(async () => workspace());
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// The forbidden vocabulary
// ══════════════════════════════════════════════════════════════════════════════

/**
 * The four kinds R4.5 and R6.6 name, as patterns over what a rep would be asked to do.
 *
 * Each is the *task* being handed over, which is why none of them is the bare word
 * "LinkedIn": R6.3 pins a sentence containing it, and R6.9's says a search is still running.
 * Weez saying what it is doing is not Weez asking the rep to do it.
 */
const FORBIDDEN: { kind: string; pattern: RegExp }[] = [
  {
    kind: "LinkedIn profile finding",
    pattern: /\bfind(?:s|ing)?\s+(?:their|the|this|a)\s+(?:linkedin\s+)?profile\b/i,
  },
  {
    kind: "profile lookup",
    pattern: /\blook(?:s|ing)?\s+up\s+(?:their|the|this|a)?\s*(?:linkedin\s+)?profile\b/i,
  },
  { kind: "profile lookup", pattern: /\bprofile\s+look-?up\b/i },
  { kind: "identity resolution", pattern: /\bidentity\s+resolution\b/i },
  {
    kind: "identity resolution",
    pattern: /\bresolv(?:e|es|ed|ing)\s+(?:their|the|this|an?\s)?\s*identit/i,
  },
  { kind: "LinkedIn URL entry", pattern: /\b(?:linkedin|profile)\s+(?:profile\s+)?(?:url|link)\b/i },
  { kind: "LinkedIn URL entry", pattern: /\bpaste\b/i },
  {
    kind: "LinkedIn URL entry",
    pattern: /\benter\s+(?:their|the|a|an)?\s*(?:linkedin|profile|url|link)\b/i,
  },
  {
    kind: "LinkedIn profile finding",
    pattern: /\bsearch\s+(?:linkedin|for\s+(?:their|the|this)\s+profile)\b/i,
  },
];

/** Which kind of forbidden vocabulary a string carries, or null when it carries none. */
function forbiddenIn(text: string): string | null {
  const hit = FORBIDDEN.find((entry) => entry.pattern.test(text));
  return hit ? hit.kind : null;
}

/** One stage's banner copy, or a loud failure — a silently empty mask is not a mask. */
function stageCopy(stage: string): { label: string; body: string } {
  const meta = PROSPECT_STAGE_LABELS[stage];
  if (!meta) throw new Error(`no stage banner copy for ${stage}`);
  return meta;
}

/**
 * Weez reporting its own work, which R4.5 and R6.6 do not reach — and the counterexample
 * that made stating it necessary.
 *
 * The first execution of the property below failed on `{verdict: null, press: true}` with
 * "the dossier's own copy carries LinkedIn profile finding". The string was
 * `PROSPECT_STAGE_LABELS.RESOLVING.label` — **"Finding their profile"** — in band 3's stage
 * banner, put there by the press the run had just made.
 *
 * That is not a defect in the page, and the requirements are what say so. R4.5 bans the
 * vocabulary from *the Contact Directly and Activate Intelligence card copy*; R6.6 bans a
 * *control labelled* with it as an alternative to Activate Intelligence. The banner is
 * neither: it is one line naming which stage the prospect is in, it is not pressable, and
 * design §3.2 fixes `RESOLVING`'s label as exactly this string in the same table that fixes
 * `ACTIVATING`'s and `WAITING`'s. Failing the page for rendering it would fail the page for
 * obeying the design — and "adjust the label" would break §3.2 and R7.2's neighbours in the
 * same table. So the scope is stated here rather than the product changed.
 *
 * Where the line falls: **Weez saying what it is doing is not Weez asking the rep to do it.**
 * Every sentence below is Weez in the first person about work already under way, reported
 * because the rep pressed a priced control and is owed a status. None of them is a task, and
 * none of them is reachable as a control's name — which is why the mask applies to the
 * *copy* sweep only and control names are swept unmasked.
 */
const PROGRESS_REPORTS: readonly string[] = [
  // The stage banner, on the one stage that is about the lookup. §3.2's own strings.
  stageCopy("RESOLVING").label,
  stageCopy("RESOLVING").body,
  // The notices §4.3 requires after a press, each of which names the search's state.
  GTM_IDENTITY_LABELS.resolveQueued,
  GTM_IDENTITY_LABELS.resolveDeduped,
  GTM_IDENTITY_LABELS.resolveStillRunning,
  GTM_IDENTITY_LABELS.resolveFailed,
  // R6.3's pinned sentence, which names LinkedIn because the requirement's text does.
  GTM_IDENTITY_LABELS.activationStopped,
];

/** The text with Weez's own progress reports lifted out, so the sweep reads only the rest. */
function withoutProgressReports(text: string): string {
  return PROGRESS_REPORTS.reduce(
    (rest, sentence) => rest.split(sentence).join(" "),
    text
  );
}

/**
 * The vocabulary sweep over rendered copy: strict, minus the declared progress reports.
 *
 * Removal is by exact sentence, so the mask cannot widen by accident — a *new* string
 * carrying identity work fails even when a progress report is on screen beside it, which the
 * instrument check below pins.
 */
const forbiddenInCopy = (text: string) => forbiddenIn(withoutProgressReports(text));

// ══════════════════════════════════════════════════════════════════════════════
// Property 11
// ══════════════════════════════════════════════════════════════════════════════

describe("Feature: sales-workflow-frontend-restructure, Property 11: The decision copy contains no identity vocabulary", () => {
  // The instrument, before anything is measured with it. Both halves matter: a table that
  // matched nothing would make every sweep below vacuous, and a table that matched the
  // sentences the requirements pin would fail the product for obeying them.
  it("bites on the vocabulary R4.5 and R6.6 name, and spares the sentences they require", () => {
    // The three strings that were the real offenders. `resolve` was the removed
    // `resolveLabel`'s value; the other two were rendered under the Activate button
    // whenever the identity was unresolved.
    expect(forbiddenIn(GTM_IDENTITY_LABELS.resolve)).toBe("LinkedIn profile finding");
    expect(forbiddenIn(GTM_IDENTITY_LABELS.resolving)).toBe("identity resolution");
    expect(forbiddenIn(GTM_IDENTITY_LABELS.trackLookingUp)).toBe("LinkedIn profile finding");
    expect(forbiddenIn(GTM_IDENTITY_LABELS.trackFirstStep)).toBe("LinkedIn profile finding");
    // And the shapes a re-introduction would most likely take.
    expect(forbiddenIn("Paste their LinkedIn URL")).not.toBeNull();
    expect(forbiddenIn("Enter a LinkedIn profile link")).not.toBeNull();
    expect(forbiddenIn("Identity resolution is pending")).not.toBeNull();

    // ── The mask, and how wide it is ──
    //
    // One sentence needs it — `RESOLVING`'s banner label, which the patterns do bite on and
    // which §3.2 fixes as that exact string. Stated as two readings rather than one so the
    // exemption is visible: the sweep would fail it, and the copy sweep deliberately does not.
    expect(forbiddenIn(stageCopy("RESOLVING").label)).toBe("LinkedIn profile finding");
    expect(forbiddenInCopy(stageCopy("RESOLVING").label)).toBeNull();

    // Every other progress report passes unaided, so the mask is one sentence wide rather
    // than a blanket over the identity block.
    PROGRESS_REPORTS.filter((sentence) => sentence !== stageCopy("RESOLVING").label).forEach(
      (sentence) =>
        expect(
          forbiddenIn(sentence),
          `masked a sentence the patterns already spare: ${JSON.stringify(sentence)}`
        ).toBeNull()
    );

    // And the mask does not neuter the sweep: a re-introduced control label still fails with
    // the banner's own sentence beside it.
    expect(
      forbiddenInCopy(`${stageCopy("RESOLVING").label} ${GTM_IDENTITY_LABELS.resolve}`)
    ).toBe("LinkedIn profile finding");

    // Every sentence a requirement pins, spared. R6.3's names LinkedIn because the
    // requirement's own text does; R6.9's says a search is still running; `resolveQueued`
    // and `resolveDeduped` are §4.3's progress reports, and the `cannotTrack` sentences are
    // the track route's five refusals in the server's words.
    [
      GTM_IDENTITY_LABELS.activationStopped,
      GTM_IDENTITY_LABELS.resolveStillRunning,
      GTM_IDENTITY_LABELS.resolveQueued,
      GTM_IDENTITY_LABELS.resolveDeduped,
      GTM_IDENTITY_LABELS.tracked,
      GTM_IDENTITY_LABELS.trackedNext,
      ...Object.values(GTM_IDENTITY_LABELS.cannotTrack),
      PROSPECT_DECISION_LABELS.activate.label,
      PROSPECT_DECISION_LABELS.activate.tagline,
      PROSPECT_DECISION_LABELS.activate.body,
      PROSPECT_DECISION_LABELS.activate.starting,
      PROSPECT_DECISION_LABELS.contact.label,
      PROSPECT_DECISION_LABELS.contact.tagline,
      PROSPECT_DECISION_LABELS.contact.body,
      // The one identity surface the design permits — a question the server asked, whose
      // controls are answers about a person and not instructions to go looking.
      GTM_IDENTITY_CONFIRM_LABELS.heading,
      GTM_IDENTITY_CONFIRM_LABELS.open,
      GTM_IDENTITY_CONFIRM_LABELS.confirm,
      GTM_IDENTITY_CONFIRM_LABELS.reject,
      GTM_IDENTITY_CONFIRM_LABELS.confirmHint,
      ...Object.values(PROSPECT_INTELLIGENCE_SECTIONS),
    ].forEach((sentence) =>
      expect(
        forbiddenIn(sentence),
        `the sweep would have failed a sentence the requirements pin: ${JSON.stringify(sentence)}`
      ).toBeNull()
    );
  });

  /**
   * The verdicts `sales_leads.linkedin_verification_status` can hold on this screen.
   *
   * `null` is "nobody has looked", which `models/lead.py` keeps distinct from `NO_MATCH` at
   * the column. `PENDING` stands for the fourth case — a value this screen has no rule for,
   * which `trackRefusal` answers with `unrecognised`.
   */
  const VERDICTS = [null, "VERIFIED", "POSSIBLE_MATCH", "NO_MATCH", "PENDING"] as const;

  interface DossierSpec {
    /** The payload's verdict. */
    verdict: (typeof VERDICTS)[number];
    /** Whether the server has a candidate to settle — the one identity surface allowed. */
    candidate: boolean;
    /** Whether the enriched lead has a channel: the Contact card blocked or unblocked. */
    hasChannel: boolean;
    /**
     * Whether the run presses Activate.
     *
     * This is how the resolving and settled states are reached, because both are page state
     * and neither can be handed in as a prop: a press either continues into activation (a
     * verdict already verified, with the address the resolve response carries) or queues a
     * lookup and leaves the dossier resolving with the notice §4.3 requires.
     */
    press: boolean;
  }

  const specArb: fc.Arbitrary<DossierSpec> = fc.record({
    verdict: fc.constantFrom(...VERDICTS),
    candidate: fc.boolean(),
    hasChannel: fc.boolean(),
    press: fc.boolean(),
  });

  /** Puts `served` into the state one spec describes. */
  function apply(spec: DossierSpec) {
    served.payload = {
      status: spec.verdict,
      verifiedAt: spec.verdict === "VERIFIED" ? ISO : null,
      confidence: spec.verdict === null ? null : 93,
    };
    // The resolve response reports the same three columns and adds the lead's own address,
    // which is the shape a settled verdict actually comes back in.
    served.resolution = {
      ...served.payload,
      url: LINKEDIN,
      deduped: false,
      outcome: spec.verdict === "VERIFIED" ? "ALREADY_VERIFIED" : "ENQUEUED",
    };
    served.candidateUrl = spec.candidate ? CANDIDATE : null;
    served.hasChannel = spec.hasChannel;
  }

  /**
   * Every forbidden phrase on this dossier, as a sentence naming where it was found.
   *
   * Two sweeps, deliberately at two strengths. Rendered copy is swept past the declared
   * progress reports, because Weez reporting its own work is not the failure R4.5 describes.
   * A **control's name** is swept unmasked: R6.6 is about a control, no progress report is
   * one, and an exemption there would be the hole the requirement exists to close.
   */
  function violations(dossier: HTMLElement): string[] {
    const found: string[] = [];

    const inText = forbiddenInCopy(everythingSaid(dossier));
    if (inText !== null) found.push(`the dossier's own copy carries ${inText}`);

    controlsIn(dossier).forEach((control) => {
      const name = nameOf(control);
      const kind = forbiddenIn(name);
      if (kind !== null) found.push(`a control named ${JSON.stringify(name)} carries ${kind}`);
    });

    return found;
  }

  it(
    "names no identity work anywhere on the dossier, across every verdict and both decisions",
    // A hundred mounts of a whole page do not fit the 5s default.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(specArb, async (spec) => {
          resetWire();
          apply(spec);
          const { container, dossier } = await openDossier();

          try {
            // One dossier on the page, so every reading below is this run's answer.
            expect(mounted()).toBe(1);

            if (spec.press) {
              // The press routes to the lookup or straight into activation, and the page
              // decides which — the same one control either way (R6.2).
              await userEvent.setup().click(activateIn(dossier));
              // Settled: either the activation notice or the queued-search notice is up.
              await waitFor(() =>
                expect(dossierOf(container).textContent ?? "").toMatch(
                  new RegExp(
                    [
                      GTM_IDENTITY_LABELS.tracked,
                      GTM_IDENTITY_LABELS.alreadyTracking,
                      GTM_IDENTITY_LABELS.resolveQueued,
                      GTM_IDENTITY_LABELS.resolveDeduped,
                    ]
                      .map((sentence) => sentence.replace(/[.*+?^${}()|[\]\\—·]/g, "\\$&"))
                      .join("|")
                  )
                )
              );
            }

            // The dossier is re-read from the container rather than reused: activation
            // re-renders band 3 and band 8, and the sweep must run over what is on screen
            // now.
            const settled = dossierOf(container);
            expect(violations(settled), `stage=${stageOf(settled)}`).toEqual([]);

            // And the decision card in particular, which is what R4.5 names. Present
            // whenever the stage still offers the choice; gone once activation happened,
            // which is itself the honest answer and not an omission.
            const decision = settled.querySelector(DECISION);
            if (decision) {
              // Unmasked, and it can be: every progress report renders in band 3's status
              // banner, and `ProspectDecision` has no notice prop to carry one into the card.
              // So R4.5's own subject is swept at full strength.
              expect(forbiddenIn(everythingSaid(decision as HTMLElement))).toBeNull();
            }
          } finally {
            // At the end of the run, including the failing one: fast-check shrinks by
            // re-running the predicate, and a run that left its dossier mounted would hand
            // the shrinker a page with two of them.
            cleanup();
          }
        }),
        { numRuns: 100 }
      );

      expect(mounted()).toBe(0);
    }
  );

  // The same sweep over the *whole* surface, disclosures and all.
  //
  // ── Why this one activates the prospect first ──
  //
  // The disclosure inventory is inside `isIntelligenceActive(stage)`, so an `ENRICHED`
  // dossier has no `<details>` on it at all — the first execution of this test failed on
  // `expect(sections.length).toBeGreaterThan(0)` for all five verdicts, which was the
  // fixture asking an un-activated prospect for panels that correctly do not exist. Serving
  // the profile row puts the dossier at `WAITING`, where the eight sections live. Between
  // this and the property above, the sweep has run over the decision surface *and* over the
  // intelligence surface, which is the whole of the dossier.
  //
  // Held out of the property rather than folded into it: none of the eight panels reads the
  // identity verdict, so multiplying an eight-section open by a hundred generated verdicts
  // would buy no coverage and cost the timeout. One mount per verdict is the space that
  // matters.
  it.each(VERDICTS)("names no identity work with every disclosure open (verdict %s)", async (
    verdict
  ) => {
    apply({ verdict, candidate: true, hasChannel: true, press: false });
    // The `li_gtm_profiles` row, which is what puts the intelligence region on screen.
    served.activated = true;
    const { dossier } = await openDossier();

    try {
      expect(mounted()).toBe(1);
      // The instrument: the region is there because intelligence is active, not because the
      // fixture said so.
      await waitFor(() => expect(stageOf(dossier)).toBe("WAITING"));
      const sections = await openEveryDisclosure(dossier);
      // The inventory, asserted as an instrument reading: a sweep over one opened section
      // would pass for the wrong reason.
      expect(sections.length).toBeGreaterThanOrEqual(5);
      expect(violations(dossier)).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 18
// ══════════════════════════════════════════════════════════════════════════════

/** The verdicts the resolve response can come back with, and the address it may carry. */
const RESOLUTION_VERDICTS = [null, "VERIFIED", "POSSIBLE_MATCH", "NO_MATCH", "PENDING"] as const;

interface ResolutionSpec {
  status: (typeof RESOLUTION_VERDICTS)[number];
  /**
   * Whether `sales_leads.linkedin_url` came back with the verdict.
   *
   * Two values and no whitespace-only third: a blank address is a different claim — §15.1's
   * "a whitespace-only profile identifier is not activation" — and it belongs to the stage
   * machine's own suite rather than here, where generating it would produce a counterexample
   * about a statement this property does not make.
   */
  hasUrl: boolean;
}

const resolutionArb: fc.Arbitrary<ResolutionSpec> = fc.record({
  status: fc.constantFrom(...RESOLUTION_VERDICTS),
  hasUrl: fc.boolean(),
});

/**
 * Whether R6.4 permits a track request for this verdict.
 *
 * Written out rather than taken from `trackRefusal()`, which is the rule the *page* applies:
 * reading the oracle out of the subject would make this property compare the page against
 * itself and pass through any change to either. R6.4 permits tracking exactly when
 * verification completed *with* a verified person, and the track route needs the address
 * that person's page lives at.
 */
const mayTrack = (spec: ResolutionSpec) => spec.status === "VERIFIED" && spec.hasUrl;

describe("Feature: sales-workflow-frontend-restructure, Property 18: Activation never starts unasked and never tracks unverified", () => {
  /** Serves one resolution verdict, with the payload reporting the same three columns. */
  function applyResolution(spec: ResolutionSpec) {
    // The payload's verdict is the *previous* answer and the resolve response is the current
    // one; here they agree, which is the ordinary case and the one that keeps the poll from
    // claiming a landing mid-run. The verdict that *changes* under the poll is Property 20's
    // stopped-sentence example.
    const verdict: Verdict = {
      status: spec.status,
      verifiedAt: spec.status === "VERIFIED" ? ISO : null,
      confidence: spec.status === null ? null : 93,
    };
    served.payload = { ...verdict };
    served.resolution = {
      ...verdict,
      url: spec.hasUrl ? LINKEDIN : null,
      deduped: false,
      outcome: spec.status === "VERIFIED" ? "ALREADY_VERIFIED" : "ENQUEUED",
    };
  }

  it(
    "starts no identity work on an enriched prospect, and offers one Activate control that starts it",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(resolutionArb, async (spec) => {
          resetWire();
          applyResolution(spec);
          const { container, dossier } = await openDossier();

          try {
            expect(mounted()).toBe(1);

            // ── R6.1: becoming enriched starts nothing ──
            // The prospect is enriched, selected, its payload read and its decision on
            // screen — and no identity work has been asked for. Nothing on this page calls
            // `resolveIdentity` from an effect, and the only thing that can is a press.
            expect(stageOf(dossier)).toBe("ENRICHED");
            expect(
              resolveRequests(),
              "an identity search was queued for a prospect nobody pressed Activate on"
            ).toHaveLength(0);
            expect(trackRequests()).toHaveLength(0);

            // ── R6.2: one control, and it is the Activate control ──
            const decision = dossier.querySelector(DECISION) as HTMLElement;
            expect(decision).not.toBeNull();
            const activate = activateIn(decision);
            // The Activate card carries exactly one control whatever the verdict says, so
            // there is no second button beside it to route the lookup through.
            const onActivateCard = controlsIn(decision).filter((control) =>
              nameOf(control).includes(PROSPECT_DECISION_LABELS.activate.label)
            );
            expect(onActivateCard).toEqual([activate]);
            // And no control anywhere on the dossier is *labelled* with the lookup, which is
            // R6.6's own wording for "no separate control exists".
            controlsIn(dossier).forEach((control) =>
              expect(forbiddenIn(nameOf(control)), nameOf(control)).toBeNull()
            );

            await userEvent.setup().click(activate);

            // The press starts the lookup, once. Every verdict routes through it before
            // activation, because the address the track route needs lives on
            // `sales_leads.linkedin_url` and only the resolve response carries it.
            await waitFor(() => expect(resolveRequests()).toHaveLength(1));
            expect(
              resolveRequests(),
              "one press asked for more than one identity search"
            ).toHaveLength(1);
            expect(locationOf(container)).toBe(START);
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );

      expect(mounted()).toBe(0);
    }
  );

  it(
    "issues a track request only for a verdict that came back a verified person",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(resolutionArb, async (spec) => {
          resetWire();
          applyResolution(spec);
          const { container, dossier } = await openDossier();

          try {
            expect(mounted()).toBe(1);
            await userEvent.setup().click(activateIn(dossier));
            await waitFor(() => expect(resolveRequests()).toHaveLength(1));

            if (mayTrack(spec)) {
              // The lookup had nothing to add and the press was an activation all along, so
              // it continues rather than asking for a second press (R6.5).
              await waitFor(() => expect(trackRequests()).toHaveLength(1));
              await waitFor(() =>
                expect(dossierOf(container).textContent ?? "").toContain(
                  GTM_IDENTITY_LABELS.tracked
                )
              );
            } else {
              // Everything else: the search is queued and the page says so. Waiting for
              // that sentence is what makes the absence below an absence *after* the
              // decision was taken rather than before it.
              await waitFor(() =>
                expect(dossierOf(container).textContent ?? "").toContain(
                  GTM_IDENTITY_LABELS.resolveQueued
                )
              );
              expect(
                trackRequests(),
                `tracked a prospect whose verdict was ${spec.status} with url=${spec.hasUrl}`
              ).toHaveLength(0);
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

// ══════════════════════════════════════════════════════════════════════════════
// Property 19
// ══════════════════════════════════════════════════════════════════════════════
//
// ─── Why this one is the regression test it is ────────────────────────────────
//
// The bound existed in the code and not in the behaviour. The poll's attempt counter used to
// be a variable inside the effect, and the effect's dependencies include `selected.detail` —
// which every tick replaces, because a tick *is* a re-read. So the counter went back to zero
// on each tick, `IDENTITY_POLL_LIMIT` was never reached, and a queued job that never
// completed left the tab re-reading for as long as it was open. Task 12.6 moved the count to
// `identityTriesRef`. This property is what would fail if it ever moved back.
//
// ─── Timers ───────────────────────────────────────────────────────────────────
//
// Real timers for the mount and fake ones from just before the press, which is the moment
// the interval is armed. That split is deliberate: `waitFor` only knows how to drive Jest's
// fake clock — it looks for a global `jest`, which Vitest does not provide — so under fake
// timers it falls back to a MutationObserver and its own faked interval, and a wait for
// something that needs a settled promise chain can hang. So the mount is waited for
// normally, and everything after the press advances the clock explicitly and flushes.
//
// `fireEvent.click` presses the control rather than `userEvent`, for the same reason: a
// plain dispatch involves no timers at all, and the realism `userEvent` buys is not what
// this property is measuring.

/** Flushes settled promises and lets React commit, without leaving fake time. */
async function flush(times = 6) {
  for (let index = 0; index < times; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

/** Advances the fake clock by `ms` and lets everything it started settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flush(3);
}

/**
 * A dossier with the poll running: pressed, queued, and watching for a verdict.
 *
 * Returns the read count at the moment watching began, so every count after it is the
 * poll's own and not the press's — `onResolveIdentity` re-reads once itself, before it
 * starts watching.
 */
async function startPolling() {
  const { container, dossier } = await openDossier();
  vi.useFakeTimers();

  fireEvent.click(activateIn(dossier));
  await flush(8);

  // The instrument: the search was queued, the page said so, and it is watching.
  expect(resolveRequests()).toHaveLength(1);
  expect(dossierOf(container).textContent ?? "").toContain(GTM_IDENTITY_LABELS.resolveQueued);
  expect(stageOf(dossierOf(container))).toBe("RESOLVING");

  return { container, base: detailReads() };
}

describe("Feature: sales-workflow-frontend-restructure, Property 19: The identity poll is bounded", () => {
  /**
   * A verdict-free answer, in each of the shapes one arrives in.
   *
   * "Verdict-free" is not "null verdict": what the poll compares is a *change* from the
   * baseline the resolve response set, so an unchanged `NO_MATCH` is as verdict-free as an
   * absent status. Both are generated, because treating any non-null verdict as the answer
   * is the other way this poll has been wrong.
   */
  const unchangedArb = fc.constantFrom<Verdict>(
    { ...NO_VERDICT },
    { status: "NO_MATCH", verifiedAt: null, confidence: null },
    { status: "POSSIBLE_MATCH", verifiedAt: null, confidence: 61 }
  );

  /**
   * How many intervals to sit through.
   *
   * Weighted towards the small counts because the cost of a run is the walk, and towards the
   * three values at the boundary because that is where the statement is falsifiable: the
   * limit itself, the tick that gives up, and one after it.
   */
  const ticksArb = fc.oneof(
    { weight: 4, arbitrary: fc.integer({ min: 1, max: 3 }) },
    {
      weight: 2,
      arbitrary: fc.constantFrom(
        IDENTITY_POLL_LIMIT - 1,
        IDENTITY_POLL_LIMIT,
        IDENTITY_POLL_LIMIT + 1,
        IDENTITY_POLL_LIMIT + 2
      ),
    },
    { weight: 1, arbitrary: fc.integer({ min: 4, max: IDENTITY_POLL_LIMIT + 2 }) }
  );

  it(
    "re-reads at the declared interval, never sooner, for at most the declared limit",
    // A hundred mounts, some of which sit through the whole two minutes of watching.
    { timeout: 180_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(unchangedArb, ticksArb, async (unchanged, ticks) => {
          resetWire();
          // The verdict the resolve response reports, and the same one every poll answer
          // repeats. Equal by construction, so nothing lands and the poll runs to its bound.
          served.payload = { ...unchanged };
          served.resolution = { ...unchanged, url: null, deduped: false, outcome: "ENQUEUED" };

          let polling: Awaited<ReturnType<typeof startPolling>> | null = null;
          try {
            polling = await startPolling();
            const { container, base } = polling;
            expect(mounted()).toBe(1);

            // ── At the interval, and not before it ──
            await advance(IDENTITY_POLL_MS - 1);
            expect(
              detailReads() - base,
              "the poll re-read before the declared interval had elapsed"
            ).toBe(0);
            await advance(1);
            expect(detailReads() - base).toBe(1);

            // ── For at most the limit, and then it stops ──
            for (let tick = 2; tick <= ticks; tick += 1) {
              // eslint-disable-next-line no-await-in-loop
              await advance(IDENTITY_POLL_MS);
              expect(
                detailReads() - base,
                `after ${tick} intervals the poll had made ${detailReads() - base} reads`
              ).toBe(Math.min(tick, IDENTITY_POLL_LIMIT));
            }

            // The bound, stated as the bound: whatever the tick count, the poll never
            // exceeds `IDENTITY_POLL_LIMIT` reads.
            expect(detailReads() - base).toBeLessThanOrEqual(IDENTITY_POLL_LIMIT);

            // And once it has given up it says so, and stops watching (R6.9). The tick after
            // the limit is the one that gives up: it is the attempt that finds the counter
            // already at the limit, so it reports rather than reads.
            const dossier = dossierOf(container);
            if (ticks > IDENTITY_POLL_LIMIT) {
              expect(dossier.textContent ?? "").toContain(
                GTM_IDENTITY_LABELS.resolveStillRunning
              );
              expect(stageOf(dossier)).toBe("ENRICHED");
            } else {
              expect(dossier.textContent ?? "").toContain(GTM_IDENTITY_LABELS.resolveQueued);
            }
          } finally {
            // Unmount first — it is what clears the interval — then hand the clock back, in
            // the same `finally`, so a failing run cannot leave fake time behind for the
            // next one.
            cleanup();
            vi.useRealTimers();
          }
        }),
        { numRuns: 100 }
      );

      expect(mounted()).toBe(0);
    }
  );

  // The readable walk. The property covers this whenever it draws a tick count past the
  // limit; this is the same statement in the numbers R6.8 actually names, so a regression
  // reads as "the poll made 34 requests" rather than as a generated counterexample.
  it("makes twenty reads six seconds apart and then stops asking", async () => {
    served.payload = { status: "NO_MATCH", verifiedAt: null, confidence: null };
    served.resolution = { ...served.payload, url: null, deduped: false, outcome: "ENQUEUED" };

    try {
      const { container, base } = await startPolling();

      for (let tick = 1; tick <= IDENTITY_POLL_LIMIT; tick += 1) {
        // eslint-disable-next-line no-await-in-loop
        await advance(IDENTITY_POLL_MS);
        expect(detailReads() - base).toBe(tick);
      }

      // The twenty-first interval is the one that gives up.
      await advance(IDENTITY_POLL_MS);
      expect(detailReads() - base).toBe(IDENTITY_POLL_LIMIT);
      expect(dossierOf(container).textContent ?? "").toContain(
        GTM_IDENTITY_LABELS.resolveStillRunning
      );

      // Five more minutes of fake time, and not one more request.
      await advance(IDENTITY_POLL_MS * 50);
      expect(
        detailReads() - base,
        "the poll was still re-reading after it had said it stopped"
      ).toBe(IDENTITY_POLL_LIMIT);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 20
// ══════════════════════════════════════════════════════════════════════════════

describe("Feature: sales-workflow-frontend-restructure, Property 20: Activation keeps the prospect in place", () => {
  /**
   * The acknowledgement space, at the width `TrackProspectOut` can actually come back in.
   *
   * All four combinations are real: a first activation and a repeat, and either of the two
   * first reads failing to queue for a prospect with no feed address. None of them is a
   * reason to move the operator, which is what the property says.
   */
  const ackArb = fc.record({
    createdProfile: fc.boolean(),
    observationJobId: fc.option(fc.integer({ min: 1, max: 9999 }), { nil: null }),
    activityJobId: fc.option(fc.integer({ min: 1, max: 9999 }), { nil: null }),
    charged: fc.boolean(),
  });

  it(
    "navigates nowhere and keeps the same prospect selected",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(ackArb, async (ack) => {
          resetWire();
          // A verdict already verified, with the address the resolve response carries: one
          // press, and the activation it was always for goes through (R6.5).
          served.payload = { status: "VERIFIED", verifiedAt: ISO, confidence: 93 };
          served.resolution = {
            ...served.payload,
            url: LINKEDIN,
            deduped: false,
            outcome: "ALREADY_VERIFIED",
          };
          served.tracking = ack;

          const { container, dossier } = await openDossier();

          try {
            expect(mounted()).toBe(1);
            const before = locationOf(container);
            expect(before).toBe(START);

            await userEvent.setup().click(activateIn(dossier));
            await waitFor(() => expect(trackRequests()).toHaveLength(1));

            // The settled surface: the profile row exists, so the stage has moved off the
            // decision and on to watching.
            await waitFor(() => expect(stageOf(dossierOf(container))).toBe("WAITING"));

            // ── R7.1: no navigation ──
            expect(
              locationOf(container),
              "activation moved the operator off the prospect's own surface"
            ).toBe(before);

            // ── R7.1: the same prospect, still selected ──
            // One dossier, still this person's: the name and the headline only
            // `getProspect` supplies are both on it.
            expect(mounted()).toBe(1);
            const settled = dossierOf(container);
            expect(settled.textContent ?? "").toContain(PERSON);
            expect(settled.textContent ?? "").toContain(HEADLINE);

            // And the transition is stated, from the acknowledgement rather than assumed:
            // a first activation reports the transition, a repeat reports that nothing
            // changed.
            expect(settled.textContent ?? "").toContain(
              ack.createdProfile
                ? GTM_IDENTITY_LABELS.tracked
                : GTM_IDENTITY_LABELS.alreadyTracking
            );
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );

      expect(mounted()).toBe(0);
    }
  );

  // ── R6.3 and R6.4, as one example ──
  //
  // The other order of events from Property 18's: the press queued a lookup, the lookup
  // finished, and the answer was not a person. The verdict lands on a poll read, which is
  // why the sentence is announced rather than returned.
  it("states R6.3's sentence and issues no track request when the verdict lands unverified", async () => {
    // Nobody has looked yet, so the baseline the poll compares against is empty.
    served.payload = { ...NO_VERDICT };
    served.resolution = { ...NO_VERDICT, url: null, deduped: false, outcome: "ENQUEUED" };

    try {
      const { container } = await startPolling();

      // The worker finishes and writes its answer: a search that ran and found nobody.
      served.payload = { status: "NO_MATCH", verifiedAt: null, confidence: null };
      await advance(IDENTITY_POLL_MS);

      const dossier = dossierOf(container);
      // The exact text R6.3 pins, both clauses: activation stopped, and nothing was
      // activated.
      expect(dossier.textContent ?? "").toContain(GTM_IDENTITY_LABELS.activationStopped);
      // R6.4: no tracking request for a prospect verification could not identify.
      expect(trackRequests()).toHaveLength(0);
      // Nothing is left spinning, and the prospect is back at its decision rather than
      // stranded mid-activation.
      expect(stageOf(dossier)).toBe("ENRICHED");
      expect(locationOf(container)).toBe(START);

      // And the page has stopped watching: the verdict landed, so there is nothing to
      // watch for.
      const settled = detailReads();
      await advance(IDENTITY_POLL_MS * 5);
      expect(detailReads()).toBe(settled);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  // ── R6.9, as one example ──
  //
  // Property 19 owns the bound. What this adds is the other half of the requirement: the
  // sentence is an Absence_Statement about *our* watching rather than about the search, and
  // it comes with a control that goes back for the answer.
  it("states R6.9's sentence beside a retry when the poll gives up", async () => {
    served.payload = { status: "NO_MATCH", verifiedAt: null, confidence: null };
    served.resolution = { ...served.payload, url: null, deduped: false, outcome: "ENQUEUED" };

    try {
      const { container } = await startPolling();
      await advance(IDENTITY_POLL_MS * (IDENTITY_POLL_LIMIT + 1));

      const dossier = dossierOf(container);
      expect(dossier.textContent ?? "").toContain(GTM_IDENTITY_LABELS.resolveStillRunning);
      // Not a failure: the search is still queued, so nothing claims it broke.
      expect(dossier.textContent ?? "").not.toContain(GTM_IDENTITY_LABELS.resolveFailed);

      // The retry, beside the one notice another read could answer.
      const retry = within(dossier).getByRole("button", { name: GTM_PAGE_LABELS.retry });
      const before = detailReads();
      fireEvent.click(retry);
      await flush(8);
      expect(detailReads(), "the retry asked nothing of the server").toBeGreaterThan(before);

      // Pressing it re-reads; it does not activate anything.
      expect(trackRequests()).toHaveLength(0);
      expect(locationOf(container)).toBe(START);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });
});
