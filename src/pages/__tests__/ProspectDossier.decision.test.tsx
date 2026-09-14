// pages/__tests__/ProspectDossier.decision.test.tsx
//
// The decision the dossier exists to support, and the one path that leads out of it without
// activating anything.
//
//   Property 15  Contact Directly is gated on its reason alone — across every stage, verdict
//                and profile presence, the control is offered iff the reason is null, the
//                reason renders in the control's place otherwise, and for every enriched lead
//                with no profile row the reason evaluates to null
//                (R5.4, R5.5, R5.8)
//
//   plus the R5.6 / R5.7 examples: draft → review → copy → open-channel on an enriched,
//   unactivated prospect, with no intervening identity step and no additional choice between
//   the Contact press and the composer.
//
// This file is one of the four that replace the retired `GTMProspect.*` suites (design
// §15.2). Nothing here imports `pages/GTMProspect`.
//
// ─── What Property 15's subject actually is ───────────────────────────────────
//
// `contactUnavailableReason` is **not a wire field**. Task 11 resolved that open item as
// option (a): it stays a client derivation, `contactGateOf(lead, detail)` in
// `pages/ProspectIntelligence.tsx` is the authority rather than a fallback for a backend
// value, and R5.4 is satisfied in substance because the derivation reads backend-supplied
// facts only — `gtmLeadId`, the enriched contact's two addresses, and
// `profile.profileUrl`. The activation stage is not one of its inputs and `prospectStage`
// appears nowhere in it.
//
// So the property has three clauses and they are decidable in two different places:
//
//   the iff, and the reason in the control's place   on the page, where `ProspectDecision`
//                                                    renders one or the other
//   independence from stage, verdict and profile row in the derivation, which is the only
//                                                    place a *stage* can be crossed against
//                                                    a *profile row* at all
//
// The second is not a convenience. A profile row is the activation flag, so a payload
// carrying one produces `WAITING` / `ACTIVE` / `RECOMMENDED` and `showsDecision()` correctly
// takes the whole card off the screen — there is no page state in which the card is up *and*
// the profile row exists. Crossing "every stage" against "every profile presence" on the DOM
// is therefore impossible, and asserting it against `contactGateOf` directly is what the
// clause means rather than a weaker stand-in for it. The page clause carries the profile-row
// dimension as far as it goes: an activated payload must not produce a *gated* control, and
// the derivation is checked inside the same run so the two halves cannot drift.
//
// The load-bearing clause is the third one. The profile-guard relaxation (§5.3) is what makes
// pre-activation contact possible at all, so a lead that is enriched and unactivated must not
// be gated — and `CONTACT_DIRECTLY_LABELS.needsActivation`, the sentence that used to gate it,
// is asserted absent from the label table rather than merely unused.
//
// ─── The one carve-out, stated rather than hidden ─────────────────────────────
//
// Design §4.1 words the third clause as "for every enriched, unactivated lead it evaluates to
// `null`". Read against a lead with no email, no `contact.linkedinUrl` and no profile row that
// is false: the answer is `CONTACT_DIRECTLY_LABELS.noChannel`, which the same design section
// declares as one of the two remaining gates. Both statements are in the design and only one
// of them can be literal.
//
// Resolved here the way §4.1 resolves it in substance: the sentence an enriched lead can be
// gated with is *never about activation*. So the clause asserted below is
//
//   for every enriched lead, `contactGateOf` is null whenever the lead is reachable, whether
//   or not a profile row exists; and the only reason it is ever non-null is `noChannel` —
//   having nowhere to open, which is not the same fact as not being tracked.
//
// Stating it as the bare "always null" would fail on a lead the product is right to gate,
// which is a false alarm and not a finding.
//
// ─── Every query is scoped, and every run cleans up after itself ──────────────
//
// RTL binds both `screen` and the queries on `render`'s return value to `document.body`, so
// one mount outliving its run would answer every later query in the file — and a file whose
// subject is *whether a control exists* cannot afford that. Every read goes through the run's
// own `container`, `mounted()` asserts exactly one page on the body, and `cleanup()` runs in a
// `finally` at the *end* of each run, including the failing one fast-check re-enters while it
// shrinks.
//
// The served world is reset on the same boundary, not in `beforeEach`, which runs once per
// `it` while fast-check runs the predicate a hundred times inside one. The sharp edge is the
// same one the identity suite hit: writes mutate `served`, so a run that activated would hand
// the next run a prospect with no decision card at all. See `resetWire()`.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import fc from "fast-check";

import ProspectIntelligence, { contactGateOf } from "@/pages/ProspectIntelligence";
import {
  CONTACT_DIRECTLY_LABELS,
  GTM_ABSENCE_LABELS,
  GTM_ACTION_LABELS,
  PROSPECT_DECISION_LABELS,
} from "@/components/gtm/labels";
import { COMPOSER_SEND_NOTE } from "@/components/gtm/MessageComposer";
import { VERIFICATION_STATUSES } from "@/components/gtm/IdentityPanel";
import {
  prospectStageOf,
  showsDecision,
  type ProspectStage,
} from "@/components/gtm/prospectStage";
import { CreditsProvider } from "@/hooks/useCredits";
import gtmAPI from "@/services/gtmAPI";
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

// The sidebar owns its own conversation read and nothing here is about it. It is also this
// file's leak sentinel: exactly one `<nav>` per mounted page, present in every state
// including a failed prospect read, which `[data-gtm-stage]` is not.
vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ══════════════════════════════════════════════════════════════════════════════
// The workspace, and the one prospect in it
// ══════════════════════════════════════════════════════════════════════════════

/** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
/** Eva's document id, and the `sales_leads.id` Enrich Now promoted it to. */
const EVA_LEAD = "lead_ada7f1";
const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
const PROFILE_ID = "profile-1";

const PERSON = "Ada Lovelace";
const ROLE = "Head of Engineering";
const COMPANY = "Analytical Engines";
const DOMAIN = "analyticalengines.com";
const EMAIL = "ada@analyticalengines.com";
/** The enriched contact's own address — `sales_leads.linkedin_url`, not the profile row's. */
const CONTACT_LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
/** `li_gtm_profiles.profile_url`. Exists only once activation created the row. */
const PROFILE_URL = "https://www.linkedin.com/in/ada-observed";

/**
 * The headline, and the only string on screen that can only have come from `getProspect`.
 *
 * Waiting on it is what tells a run the prospect payload has landed — which matters here
 * because `contactGateOf` reads `detail.profile.profileUrl`, so the gate's answer before the
 * read lands is not the answer under test.
 */
const HEADLINE = "Head of Data Platform";
const ISO = "2024-05-01T12:00:00.000Z";
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

/** What the generate route writes, and the exact bytes the copy control must produce. */
const DRAFT =
  "Ada — three data-platform roles in six weeks reads like a build decision, not a backfill.";
/** What `action/request` hands back as the place to go. */
const DESTINATION = "https://www.linkedin.com/messaging/thread/ada";
const ACTION_ID = "action-7f1c";

/** The four ways an enriched lead can be reachable, and the one way it cannot. */
type Channel = "email" | "linkedin" | "both" | "none";

/**
 * The whole served world, swapped per run and mutated by the writes themselves.
 *
 * `activated` is the `li_gtm_profiles` row: the activation flag, the only source of
 * `profile_url`, and the input `prospectStageOf` reads to decide whether the decision card is
 * on the screen at all.
 */
interface Served {
  /** `sales_leads.id`. Null, blank and whitespace are the un-promoted cases. */
  gtmLeadId: string | null | undefined;
  channel: Channel;
  activated: boolean;
  /** `linkedin_verification_status` on the lead row, which both identity reads answer with. */
  verdict: string | null;
  /** `ProspectStateFull.stateVersion`. */
  stateVersion: number;
  /** The ranking carries a winner, which is what makes an activated prospect `RECOMMENDED`. */
  recommended: boolean;
  /** `GET /gtm/prospect/{id}` refused, so the page holds no payload for this prospect. */
  detailFailed: boolean;
}

function baseServed(): Served {
  return {
    gtmLeadId: GTM_LEAD,
    channel: "both",
    activated: false,
    verdict: null,
    stateVersion: 0,
    recommended: false,
    detailFailed: false,
  };
}

let served: Served = baseServed();

const emailOf = (channel: Channel) =>
  channel === "email" || channel === "both" ? EMAIL : "";
const linkedinOf = (channel: Channel) =>
  channel === "linkedin" || channel === "both" ? CONTACT_LINKEDIN : "";
/** The profile row's address: present only when the row exists *and* the read landed. */
const profileUrlOf = (state: Served) =>
  state.detailFailed || !state.activated ? null : PROFILE_URL;

function qualifiedLead(): QualifiedLead {
  return {
    id: EVA_LEAD,
    entityId: "ent-1",
    company: COMPANY,
    domain: DOMAIN,
    website: `https://${DOMAIN}`,
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
      email: emailOf(served.channel),
      emailVerified: emailOf(served.channel) !== "",
      linkedinUrl: linkedinOf(served.channel),
    },
    enrichment: { website: `https://${DOMAIN}`, status: "enriched" },
    handoffState: "enriched",
    status: "qualified",
    notes: "",
    createdAt: ISO,
    updatedAt: ISO,
    gtmLeadId: served.gtmLeadId,
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
      emailsFound: emailOf(served.channel) === "" ? 0 : 1,
      handedToMax: 0,
      byTier: { low: 0, medium: 1, high: 0 },
      bySignalType: {},
    },
    // Discovery has landed, so no silent re-read is armed behind these mounts.
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

/** The verdict triple, identical on both reads so no poll can mistake one for the other. */
const verdictAt = () => (served.verdict === "VERIFIED" ? ISO : null);
const verdictConfidence = () => (served.verdict === null ? null : 93);

/**
 * `MessageOut` for an unpersisted, pre-activation draft.
 *
 * `persisted: false` with `message_id: null` is what `_lead_message_out` returns for a lead
 * with no `li_gtm_profiles` row: `li_gtm_messages.conversation_id` is NOT NULL and its FK
 * chain terminates at a profile row this prospect does not have, so there is nothing to
 * address and nothing to key `PATCH /message/{id}` or `POST /message/{id}/regenerate` on.
 */
function wireMessage() {
  return {
    message_id: null,
    conversation_id: null,
    persisted: false,
    direction: "OUTBOUND",
    message_purpose: "WARMUP",
    version: 1,
    generated_content: DRAFT,
    edited_content: null,
    sent_content: null,
    generation_failure_reason: null,
    char_limit: 300,
    created_at: ISO,
  };
}

/** `ActionOut` for the requested contact: a destination and a payload, nothing more. */
function wireAction() {
  return {
    action_id: ACTION_ID,
    profile_id: null,
    conversation_id: null,
    message_id: null,
    action_type: "SEND_MESSAGE",
    channel: "LINKEDIN",
    execution_state: "REQUESTED",
    confirmation_status: "AWAITING_CONFIRMATION",
    is_verified: false,
    requested_at: ISO,
    destination_url: DESTINATION,
    payload_text: DRAFT,
    instructions: null,
    credit: { charged: true, action: "CONTACT", credits: 1, balance: 49, idempotent_replay: false },
  };
}

/**
 * `ProspectOut`, read out of `served` at request time.
 *
 * `profile_id` and `profile_url` appear and disappear together, which is `api/gtm.py`'s own
 * behaviour: the url is the profile row's address, so before the first activation the lead
 * genuinely holds a verdict with nothing to point at.
 */
function wireDetail() {
  return {
    lead_id: GTM_LEAD,
    profile: {
      lead_id: GTM_LEAD,
      profile_id: served.activated ? PROFILE_ID : null,
      profile_url: served.activated ? PROFILE_URL : null,
      public_identifier: served.activated ? "ada-observed" : null,
      linkedin_verification_status: served.verdict,
      linkedin_verified_at: verdictAt(),
      linkedin_match_confidence: verdictConfidence(),
      // Null throughout: a candidate to settle is the one condition that mounts
      // `IdentityConfirmPanel`, and this file's claim is that no identity surface stands
      // between the Contact press and the draft.
      identity_candidate_url: null,
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
    activity: { level: fact(null) },
    state: {
      relationship_state: fact("NOT_CONNECTED"),
      conversation_state: fact("WARMUP_READY"),
      confirmation_status: "NOT_APPLICABLE",
      display_summary: "Not connected · warm-up ready",
      display_summary_is_derived: true,
    },
    // No retained drafts. `ContactDirectlyPanel` mounts the composer only once a row exists,
    // so an empty list is what puts the *generation* control on the surface — which is the
    // press R5.7 is a statement about.
    message_versions: [],
    latest_message: null,
    updated_at: ISO,
  };
}

function wireState() {
  return { lead_id: GTM_LEAD, state_version: served.stateVersion };
}

function wireRanking() {
  return {
    lead_id: GTM_LEAD,
    evaluation_id: `eval-${GTM_LEAD}`,
    computed_at: ISO,
    recommended: served.recommended
      ? {
          recommendation_id: `rec-${GTM_LEAD}`,
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
 * `IdentityResolutionOut`, echoing the verdict the server already has.
 *
 * Deliberately the *same* triple `wireDetail` reports, and with no address. That is what the
 * route actually answers — it queues a job and reports the current verdict — and it is what
 * keeps an Activate press in this file a press that reaches `RESOLVING` and stops there: the
 * poll compares the payload against this baseline, finds no change, and no track request
 * follows. Activation's own sequence is `ProspectDossier.identity.test.tsx`'s subject, not
 * this file's.
 */
function wireResolution() {
  return {
    outcome: "ENQUEUED",
    job_id: 4101,
    deduped: false,
    reason: null,
    verification_status: served.verdict,
    verified_at: verdictAt(),
    match_confidence: verdictConfidence(),
    linkedin_url: null,
    attempt_id: null,
    stage: null,
    engine_used: null,
    candidate_count: null,
    failure_reason: null,
    attempted_at: null,
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
// Transport, the request log, and the ordered side-effect log
// ══════════════════════════════════════════════════════════════════════════════

interface Call {
  url: string;
  method: string;
}

let fetchMock: ReturnType<typeof vi.fn>;
/** Every request the page made, in order, so an absence is checkable as an absence. */
let calls: Call[] = [];
/** Requests and browser effects interleaved, which is what "in that order" is read from. */
let order: string[] = [];
let writeText: ReturnType<typeof vi.fn>;
let openSpy: MockInstance<typeof window.open>;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status = 500) => ({
  ok: false,
  status,
  json: async () => ({ detail: `GTM backend error ${status}` }),
});
const emptyPage = () => ({ items: [], entries: [], next_cursor: null, has_more: false });

/**
 * Every route the dossier can reach, matched longest-first.
 *
 * `/prospect/{id}/message/generate`, `/prospect/{id}/state` and the bare `/prospect/{id}` all
 * contain `/prospect/`, so matching the read first would answer a write with a payload. The
 * `{}` fallback is deliberate: every `gtmAPI` normaliser defaults its collections, so a panel
 * this file does not fixture renders its own absence statement rather than throwing.
 */
function serve() {
  fetchMock.mockImplementation(async (input: unknown, init?: unknown) => {
    const url = String(input);
    const method = String((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
    calls.push({ url, method });

    if (url.includes("/message/generate")) {
      order.push("generate");
      return ok(wireMessage());
    }
    if (url.includes("/action/request")) {
      order.push("action/request");
      return ok(wireAction());
    }
    if (url.includes(`/action/${ACTION_ID}/opened`)) {
      order.push("action/opened");
      return ok(wireAction());
    }
    if (url.includes("/resolve-identity")) return ok(wireResolution());
    if (url.includes("/recommend-channel"))
      return ok({ lead_id: GTM_LEAD, channels: [], recommended_channel: null });
    if (url.includes("/credits")) return ok(wireCredits());
    if (url.includes("/action-queue")) return ok({ items: [], has_more: false });
    if (url.includes("/next-best-action")) return ok(wireRanking());
    if (url.includes("/state/history")) return ok(emptyPage());
    if (url.includes("/signals")) return ok(emptyPage());
    if (url.includes("/timeline")) return ok(emptyPage());
    if (url.includes("/debug")) return ok({ lead_id: GTM_LEAD, learning_updates: [] });
    if (url.includes("/state")) return ok(wireState());
    if (url.includes(`/prospect/${GTM_LEAD}`))
      return served.detailFailed ? failed() : ok(wireDetail());
    return ok({});
  });
}

const postsTo = (fragment: string) =>
  calls.filter((call) => call.method === "POST" && call.url.includes(fragment));

/**
 * A clean server, an empty request log and an empty effect log, called at the top of **every
 * property run** rather than in `beforeEach`.
 *
 * `beforeEach` runs once per `it` and fast-check runs the predicate a hundred times inside
 * one, so both halves of the world leak without this and both leaks are silent: `calls`
 * accumulates, and `served` carries flags the *writes* set. The identity suite lost runs to
 * exactly the second one — a run that activated left the next run's prospect already tracked,
 * stage `WAITING`, no decision card at all, and every later run failed looking for a control
 * that was correctly absent.
 */
function resetWire() {
  served = baseServed();
  calls = [];
  order = [];
  writeText.mockClear();
  openSpy.mockClear();
}

// ══════════════════════════════════════════════════════════════════════════════
// Harness
// ══════════════════════════════════════════════════════════════════════════════

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker, which carries the stage. Absent while the prospect read has failed. */
const STAGE = "[data-gtm-stage]";
/** Band 8. `ProspectDecision` marks it from inside the component. */
const DECISION = '[data-gtm-section="decision"]';
/** The `Contextual_Outreach_Surface`. A region, not one of the eight bands. */
const OUTREACH = '[data-gtm-region="contextual-outreach"]';
/** `ContactDirectlyPanel`'s own marker, inside the region. */
const CONTACT_PANEL = '[data-gtm-section="contact-directly"]';

/** How many pages are on the body. Exactly one, or a run leaked its mount. */
const mounted = () => document.body.querySelectorAll('nav[aria-label="Conversations"]').length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

/** The stage the served payloads put the page in, with no press in flight. */
function stageOfServed(): ProspectStage {
  return prospectStageOf({
    // A failed prospect read supplies no profile row, so it reads as un-activated — the
    // page's own behaviour, and the reason band 8 is absent on that failure for a second,
    // independent reason.
    profileId: profileUrlOf(served) === null ? null : PROFILE_ID,
    stateVersion: served.stateVersion,
    hasRecommendation: served.recommended,
    busy: null,
  });
}

/**
 * The reason Contact Directly cannot be offered, computed from the served facts alone.
 *
 * The reference implementation Property 15 compares against: `gtmLeadId` and the three
 * channel facts, and nothing else. No stage, no verdict, no profile *row* — only the row's
 * address, and only as a third channel.
 */
function expectedGate(state: Served): string | null {
  const id = (state.gtmLeadId ?? "").trim();
  if (id === "") return CONTACT_DIRECTLY_LABELS.needsEnrichment;
  const reachable =
    emailOf(state.channel) !== "" ||
    linkedinOf(state.channel) !== "" ||
    profileUrlOf(state) !== null;
  return reachable ? null : CONTACT_DIRECTLY_LABELS.noChannel;
}

/** Band 8's Contact Directly card, found by its own tagline. */
function contactCard(decision: HTMLElement): HTMLElement {
  const tagline = Array.from(decision.querySelectorAll("p")).find(
    (element) => (element.textContent ?? "").trim() === PROSPECT_DECISION_LABELS.contact.tagline
  );
  if (!tagline?.parentElement) {
    throw new Error("no Contact Directly card inside the decision panel");
  }
  return tagline.parentElement as HTMLElement;
}

/**
 * Every control that starts the Contact Directly path inside a root.
 *
 * By text rather than by role name so a *disabled* button counts too: R5.8 asks for the
 * reason in the control's place, and a greyed-out button beside a sentence would satisfy a
 * "cannot press it" reading while failing the requirement.
 */
const contactControls = (root: ParentNode) =>
  Array.from(root.querySelectorAll("button")).filter((button) =>
    (button.textContent ?? "").includes(PROSPECT_DECISION_LABELS.contact.label)
  );

const buttonNamed = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll("button")).filter((button) =>
    (button.textContent ?? "").includes(label)
  );

/** Where the router thinks it is, rendered from `useLocation` inside the router. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="router-location">{`${location.pathname}${location.search}`}</span>;
}

const locationOf = (container: Element) =>
  within(container as HTMLElement).getByTestId("router-location").textContent;

/**
 * A user-event instance with this file's clipboard spy attached — in that order, and the
 * order is the point.
 *
 * `userEvent.setup()` installs a clipboard stub of its own over `navigator.clipboard`, so a
 * spy defined before it is replaced and the copy assertion reads a stub this file cannot see.
 * The first execution of the draft→copy example failed exactly there: `writeText` was never
 * called because it was no longer the clipboard. Re-attaching after `setup()` keeps the
 * ordering a property of the harness rather than of how each test happens to be written —
 * `components/gtm/__tests__/nextAction.test.tsx` owns the same rule for the same reason.
 */
function newUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return user;
}

const START = `/prospect-intelligence/${BRAND}`;

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
 * The loaded dossier, settled on something only the prospect read can produce.
 *
 * The headline when the read landed, and the read's own failure sentence when it did not —
 * band 3 is the settle point either way, and waiting on the stage alone would not do: it
 * reads `ENRICHED` from the first paint, so a run could assert against a dossier holding no
 * payload and call the resulting gate the page's answer.
 */
async function openDossier() {
  vi.mocked(evaAPI.getWorkspace).mockImplementation(async () => workspace());
  const { container } = renderPage();
  const dossier = await waitFor(() => {
    const root = container.querySelector(DOSSIER) as HTMLElement;
    expect(root).not.toBeNull();
    const text = root.textContent ?? "";
    if (served.detailFailed) {
      expect(text).toContain(GTM_ABSENCE_LABELS.prospectReadFailed);
    } else {
      expect(text).toContain(HEADLINE);
    }
    return root;
  });
  return { container, dossier, user: newUser() };
}

/** What the card said, for a counterexample that names it rather than a null. */
function whatTheCardSaid(root: ParentNode): string {
  const statements = Array.from(root.querySelectorAll("p, h2, button"))
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text.length > 0)
    .slice(0, 12);
  return JSON.stringify(statements);
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  serve();
  writeText = vi.fn(async () => {
    order.push("clipboard");
  });
  openSpy = vi.spyOn(window, "open").mockImplementation(() => {
    order.push("window.open");
    return null;
  });
  resetWire();
  // The workspace read is Eva's own and its wire format is not this file's business.
  // Everything the contact gate touches goes through the transport unmocked, which is the
  // point. Read at call time so each run's `served` reaches the fixture.
  vi.spyOn(evaAPI, "getWorkspace").mockImplementation(async () => workspace());
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 15 — Contact Directly is gated on its reason alone
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Every verdict, including one no label table maps.
 *
 * `null` is nobody having looked, the three declared values are what the layer can reach, and
 * `PENDING_REVIEW` is a fourth the database could grow before the union does — `trackRefusal`
 * bands it as unrecognised. Every one of the five is a gate on *activation*; not one of them
 * is an input to the contact gate, which is the whole claim.
 */
const verdictArb = fc.constantFrom<string | null>(...VERIFICATION_STATUSES, null, "PENDING_REVIEW");

const channelArb = fc.constantFrom<Channel>("email", "linkedin", "both", "none");

/** The cross a served workspace can actually stand in, on the page. */
const pageArb = fc.record({
  channel: channelArb,
  activated: fc.boolean(),
  verdict: verdictArb,
  stateVersion: fc.nat({ max: 3 }),
  recommended: fc.boolean(),
  /**
   * The prospect read refused, which takes band 8 off the screen for a reason that is not the
   * contact gate.
   *
   * Weighted one-in-five rather than even. It is a real case and it is asserted, but a run
   * that lands on it settles in three lines and never reaches the card — and an even split
   * would spend half the budget there instead of on the iff, which is the property.
   */
  detailFailed: fc.oneof(
    { arbitrary: fc.constant(false), weight: 4 },
    { arbitrary: fc.constant(true), weight: 1 }
  ),
  /**
   * Press Activate, which is the one reachable way to a second stage with the card still up.
   *
   * `showsDecision()` admits `ENRICHED`, `RESOLVING` and `ENRICHING`. `ENRICHING` is not
   * reachable on this page — nothing feeds `busy: "enriching"` into `prospectStageOf` — so
   * `RESOLVING` is the second and last stage the card can be seen in, and it comes from a
   * press rather than from a field. Pre-activation `trackRefusal()` is non-null for every
   * verdict (there is no address to observe yet), so the press always routes to the identity
   * lookup and never to the track route.
   */
  pressActivate: fc.boolean(),
});

describe("Feature: sales-workflow-frontend-restructure, Property 15: Contact Directly is gated on its reason alone", () => {
  // The instrument. An iff read off the wrong root, or a card whose control this file cannot
  // find, would satisfy the property vacuously in one direction and fail it in the other.
  it("finds the control on an enriched, unactivated prospect and the reason in its place on an unreachable one", async () => {
    const { dossier } = await openDossier();
    const decision = dossier.querySelector(DECISION) as HTMLElement;

    expect(mounted()).toBe(1);
    expect(stageOf(dossier)).toBe("ENRICHED");
    expect(decision).not.toBeNull();
    expect(contactControls(contactCard(decision))).toHaveLength(1);
    expect(dossier.textContent).not.toContain(CONTACT_DIRECTLY_LABELS.noChannel);

    cleanup();

    // The same prospect with nowhere to open: no email, no `contact.linkedinUrl`, no profile
    // row. One sentence, no control.
    resetWire();
    served.channel = "none";
    const second = await openDossier();
    const card = contactCard(second.dossier.querySelector(DECISION) as HTMLElement);
    expect(contactControls(card)).toHaveLength(0);
    expect(within(card).getByText(CONTACT_DIRECTLY_LABELS.noChannel)).toBeTruthy();
  });

  it(
    "offers the control exactly when the reason is null, and renders the reason in its place otherwise",
    // A hundred mounts of a ~4700-line page do not fit the 5s default. Second argument, not
    // third: the options-as-third-argument form is deprecated in Vitest 4.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(pageArb, async (spec) => {
          const { pressActivate, ...payload } = spec;
          resetWire();
          served = { ...baseServed(), ...payload };

          const { container, dossier, user } = await openDossier();

          try {
            expect(mounted()).toBe(1);

            const reason = expectedGate(served);
            const cardOnScreen = !served.detailFailed && showsDecision(stageOfServed());

            // ── The derivation, checked in the same run as the DOM ──
            // The page hands `contactGateOf(selectedLead, selected.detail)` to the card, so
            // the two halves of this property are only one property if they are read off one
            // world. This is that join: the reference answer, the function's answer, and the
            // rendering below all describe the same served payload.
            const detail = served.detailFailed
              ? null
              : await gtmAPI.getProspect(BRAND, GTM_LEAD);
            expect(contactGateOf(qualifiedLead(), detail)).toBe(reason);

            if (!cardOnScreen) {
              // Band 8 is absent, and not because of the contact gate: either the record could
              // not be read at all, or the decision has already been made. Neither may leave a
              // gated control or a stray reason behind.
              expect(dossier.querySelector(DECISION)).toBeNull();
              expect(contactControls(dossier)).toHaveLength(0);
              return;
            }

            let decision = dossier.querySelector(DECISION) as HTMLElement;
            expect(decision, whatTheCardSaid(dossier)).not.toBeNull();

            // ── The second reachable stage, with the card still up ──
            if (pressActivate) {
              await user.click(
                within(decision).getByRole("button", {
                  name: new RegExp(PROSPECT_DECISION_LABELS.activate.label),
                })
              );
              await waitFor(() => expect(stageOf(dossier)).toBe("RESOLVING"));
              expect(postsTo(`/prospect/${GTM_LEAD}/track`)).toHaveLength(0);
              decision = dossier.querySelector(DECISION) as HTMLElement;
              expect(decision).not.toBeNull();
            } else {
              expect(stageOf(dossier)).toBe(stageOfServed());
            }

            const card = contactCard(decision);
            const controls = contactControls(card);

            // ── R5.5: offered iff the reason is null ──
            expect(controls, whatTheCardSaid(card)).toHaveLength(reason === null ? 1 : 0);
            // And nowhere else on the dossier either: a second entrance would make the gate
            // advisory.
            expect(contactControls(dossier)).toHaveLength(reason === null ? 1 : 0);

            if (reason === null) {
              // ── R5.4, the load-bearing clause ──
              // Every run that reaches here with no profile row is an enriched, unactivated
              // prospect being offered the control. That is what the profile-guard relaxation
              // bought, and it holds for every verdict and at both stages the card appears in.
              expect(controls[0]).toBeEnabled();
              expect(card.textContent).not.toContain(CONTACT_DIRECTLY_LABELS.needsEnrichment);
              expect(card.textContent).not.toContain(CONTACT_DIRECTLY_LABELS.noChannel);
              expect(card.textContent).not.toContain(CONTACT_DIRECTLY_LABELS.needsConversation);
            } else {
              // ── R5.8: the reason where the control would have been ──
              expect(within(card).getByText(reason)).toBeTruthy();
              // The only sentence an enriched lead can be gated with, and it is not about
              // being untracked.
              expect(reason).toBe(CONTACT_DIRECTLY_LABELS.noChannel);
            }

            // Nothing about the two presses this file does not make.
            expect(postsTo("/message/generate")).toHaveLength(0);
            expect(postsTo("/action/request")).toHaveLength(0);
            expect(locationOf(container)).toBe(START);
          } finally {
            // At the *end* of the run, including the failing one fast-check re-enters while
            // it shrinks. RTL binds `screen` to `document.body`, so a leaked mount would
            // answer every later run's query.
            cleanup();
          }
        }),
        // Above the declared minimum of 100 because two of the six dimensions decide whether
        // the card is on screen at all: 200 runs put roughly eighty of them on the iff itself.
        { numRuns: 200 }
      );

      expect(mounted()).toBe(0);
    }
  );

  it(
    "answers from the lead's channel alone — never the stage, the verdict or the profile row",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Every way `sales_leads.id` can be absent, including the two blanks: a
            // whitespace id would key every GTM route on nothing at all, so it is not
            // enrichment.
            gtmLeadId: fc.constantFrom<string | null | undefined>(
              GTM_LEAD,
              "",
              "   ",
              null,
              undefined
            ),
            channel: channelArb,
            activated: fc.boolean(),
            verdict: verdictArb,
            stateVersion: fc.nat({ max: 3 }),
            recommended: fc.boolean(),
          }),
          async (spec) => {
            resetWire();
            served = { ...baseServed(), ...spec };

            // Nothing is mounted for this clause and nothing needs to be: `contactGateOf` is
            // a pure function of two payloads, and a page mounted to reach a `return null`
            // would test the page's ability to reach a branch rather than the branch's answer.
            expect(mounted()).toBe(0);

            // A genuine `ProspectDetail` through the real normaliser rather than a cast: the
            // claim is about what `contactGateOf` reads off a served payload, and a
            // hand-built object would let this test agree with a mapping the page does not
            // have. One request per run, no mount.
            const detail = await gtmAPI.getProspect(BRAND, GTM_LEAD);
            const lead = qualifiedLead();

            // ── The answer is the reference answer ──
            expect(contactGateOf(lead, detail)).toBe(expectedGate(served));

            // ── Invariant under the verdict ──
            // Same lead, same channels, a different identity verdict on the payload: the
            // gate cannot move, because the verdict is a precondition of *activation* and
            // this path does not activate anything.
            for (const other of [...VERIFICATION_STATUSES, null, "PENDING_REVIEW"]) {
              if (other === served.verdict) continue;
              const held = served.verdict;
              served.verdict = other;
              const swapped = await gtmAPI.getProspect(BRAND, GTM_LEAD);
              served.verdict = held;
              expect(contactGateOf(lead, swapped)).toBe(expectedGate(served));
            }

            // ── Invariant under a missing read ──
            // A prospect read that failed or has not landed must not manufacture a gate: it
            // only removes the profile url from consideration, so a lead reachable through
            // its own contact keeps its live control.
            const withoutRead = contactGateOf(lead, null);
            const reachableByContact =
              emailOf(served.channel) !== "" || linkedinOf(served.channel) !== "";
            const enriched = (served.gtmLeadId ?? "").trim() !== "";
            expect(withoutRead).toBe(
              !enriched
                ? CONTACT_DIRECTLY_LABELS.needsEnrichment
                : reachableByContact
                  ? null
                  : CONTACT_DIRECTLY_LABELS.noChannel
            );

            // ── R5.4: an enriched lead with no profile row is not gated ──
            // The clause the relaxation exists for, asserted on the derivation because that
            // is where a profile row can be crossed against everything else. Stated as the
            // design means it: an enriched, reachable lead is offered the control whether or
            // not it is tracked, and the reason it is ever refused is having nowhere to open.
            if (enriched && reachableByContact) {
              served.activated = false;
              const unactivated = await gtmAPI.getProspect(BRAND, GTM_LEAD);
              expect(unactivated.profile.profileId).toBeNull();
              expect(contactGateOf(lead, unactivated)).toBeNull();
              served.activated = spec.activated;
            }

            // ── The two sentences, and the one that no longer exists ──
            const answer = contactGateOf(lead, detail);
            if (answer !== null) {
              expect([
                CONTACT_DIRECTLY_LABELS.needsEnrichment,
                CONTACT_DIRECTLY_LABELS.noChannel,
              ]).toContain(answer);
              expect(answer).not.toBe(CONTACT_DIRECTLY_LABELS.needsConversation);
            }
          }
        ),
        { numRuns: 100 }
      );

      // `needsActivation` is the sentence the relaxation made false, and leaving it in the
      // table would leave a contradiction for somebody to reuse. Asserted against the table
      // itself rather than against rendered output: nothing renders it today, which is
      // exactly why only a static check can keep it gone.
      expect(Object.keys(CONTACT_DIRECTLY_LABELS)).not.toContain("needsActivation");
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// R5.6 / R5.7 — the pre-activation contact path
// ══════════════════════════════════════════════════════════════════════════════
//
// Examples rather than a property, and deliberately: R5.6 and R5.7 are statements about one
// sequence — draft, review, copy, open — on one prospect, and a sequence has an order that a
// cross of payloads does not vary. Property 15 above already carries "which prospects get
// here".

describe("the pre-activation contact path on an enriched, unactivated prospect", () => {
  /** The dossier for the prospect this whole section is about: enriched, untracked, reachable. */
  async function openUnactivated() {
    const opened = await openDossier();
    expect(stageOf(opened.dossier)).toBe("ENRICHED");
    // Untracked, which is the entire point: no `li_gtm_profiles` row, and the contact path
    // available anyway.
    expect(opened.dossier.querySelector(DECISION)).not.toBeNull();
    return opened;
  }

  it("reaches the composer from the Contact press with no step in between", async () => {
    const { container, dossier, user } = await openUnactivated();
    const decision = dossier.querySelector(DECISION) as HTMLElement;

    expect(dossier.querySelector(OUTREACH)).toBeNull();
    const before = calls.length;

    await user.click(contactControls(contactCard(decision))[0]);

    // ── R5.7: one press, and the surface with the drafting control on it ──
    const region = await waitFor(() => {
      const found = dossier.querySelector(OUTREACH) as HTMLElement;
      expect(found).not.toBeNull();
      return found;
    });
    const panel = region.querySelector(CONTACT_PANEL) as HTMLElement;
    expect(panel).not.toBeNull();

    // The generation control is on screen in the same commit as the region. So the next press
    // available to the operator is their own request for a draft, and there is nothing of ours
    // in between.
    const generate = buttonNamed(panel, CONTACT_DIRECTLY_LABELS.generate);
    expect(generate).toHaveLength(1);
    expect(generate[0]).toBeEnabled();

    // Nothing to answer first: no confirmation, no modal, and the channel group arrives with
    // LinkedIn already selected, so the choice `chooseChannel` labels is a heading over a
    // settled default rather than a gate. (§4.1: the label stays as the composer's own
    // section label, inside the surface.)
    expect(document.body.querySelectorAll('[role="dialog"], [role="alertdialog"]')).toHaveLength(
      0
    );
    const linkedinChoice = within(panel).getByRole("button", {
      name: CONTACT_DIRECTLY_LABELS.linkedin,
    });
    expect(linkedinChoice).toHaveAttribute("aria-pressed", "true");

    // ── No intervening identity step (R5.6) ──
    // The press asked the server nothing, so nothing could have been an identity step; and no
    // identity surface mounted, because the server has no candidate to settle.
    expect(calls).toHaveLength(before);
    expect(postsTo("/resolve-identity")).toHaveLength(0);
    expect(postsTo(`/prospect/${GTM_LEAD}/track`)).toHaveLength(0);
    // A region inside the dossier, not a destination (R12.3).
    expect(locationOf(container)).toBe(START);
    expect(mounted()).toBe(1);
  });

  it("drafts, reviews, copies and opens the channel with no identity work anywhere in it", async () => {
    const { container, dossier, user } = await openUnactivated();

    await user.click(contactControls(contactCard(dossier.querySelector(DECISION) as HTMLElement))[0]);
    const panel = await waitFor(() => {
      const found = dossier.querySelector(CONTACT_PANEL) as HTMLElement;
      expect(found).not.toBeNull();
      return found;
    });

    // ── Draft ──
    await user.click(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.generate)[0]);
    const textarea = await waitFor(() => within(panel).getByLabelText("Message draft"));

    // ── Review ──
    // The model's text, read-only until the operator asks to edit it, counted against the
    // server's own cap, and under the note that says Weez sends nothing.
    expect(textarea).toHaveValue(DRAFT);
    expect(textarea).toHaveAttribute("aria-readonly", "true");
    expect(panel.textContent).toContain(`${DRAFT.length} of 300 characters`);
    expect(panel.textContent).toContain(COMPOSER_SEND_NOTE);

    // ── Copy ──
    await user.click(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.copy)[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(DRAFT));
    await waitFor(() =>
      expect(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.copied)).toHaveLength(1)
    );

    // ── Open the channel ──
    await user.click(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.openChannel)[0]);
    await waitFor(() => expect(postsTo(`/action/${ACTION_ID}/opened`)).toHaveLength(1));

    // The intent is filed before the tab opens, and the tab is opened with no handle back:
    // Weez records that somebody asked and cannot script the channel.
    expect(order).toEqual([
      "generate",
      "clipboard",
      "action/request",
      "window.open",
      "action/opened",
    ]);
    expect(openSpy).toHaveBeenCalledWith(DESTINATION, "_blank", "noopener,noreferrer");
    expect(postsTo("/message/generate")).toHaveLength(1);
    expect(postsTo(`/prospect/${GTM_LEAD}/action/request`)).toHaveLength(1);

    // ── R5.6: not one identity step in the whole sequence ──
    expect(postsTo("/resolve-identity")).toHaveLength(0);
    expect(postsTo(`/prospect/${GTM_LEAD}/track`)).toHaveLength(0);
    // Still untracked, still on the same surface, still at the decision.
    expect(dossier.querySelector(DECISION)).not.toBeNull();
    expect(locationOf(container)).toBe(START);
    expect(mounted()).toBe(1);
  });

  it("withholds the two id-keyed controls on the unsaved draft and says why in their place", async () => {
    const { dossier, user } = await openUnactivated();

    await user.click(contactControls(contactCard(dossier.querySelector(DECISION) as HTMLElement))[0]);
    const panel = await waitFor(() => {
      const found = dossier.querySelector(CONTACT_PANEL) as HTMLElement;
      expect(found).not.toBeNull();
      return found;
    });
    await user.click(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.generate)[0]);
    await waitFor(() => within(panel).getByLabelText("Message draft"));

    // `_lead_message_out` answers `persisted: false` with a null id for a lead with no profile
    // row, so `PATCH /message/{id}` and `POST /message/{id}/regenerate` have nothing to
    // address. Both controls are withheld rather than rendered as buttons that would 404.
    expect(buttonNamed(panel, GTM_ACTION_LABELS.EDIT)).toHaveLength(0);
    expect(buttonNamed(panel, GTM_ACTION_LABELS.REGENERATE)).toHaveLength(0);

    // The sentence in their place, and it is pointed at by the field's own description — so a
    // screen-reader user hears that the text is not being kept while they are still in it.
    const note = panel.querySelector('[data-gtm-note="unpersisted-draft"]') as HTMLElement;
    expect(note).not.toBeNull();
    expect(note.textContent).toBe(CONTACT_DIRECTLY_LABELS.unpersistedNote);
    expect(within(panel).getByLabelText("Message draft")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(note.id)
    );

    // Everything else on the path stays live, which is what makes this a note and not a
    // refusal.
    expect(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.copy)[0]).toBeEnabled();
    expect(buttonNamed(panel, CONTACT_DIRECTLY_LABELS.openChannel)[0]).toBeEnabled();
  });
});
