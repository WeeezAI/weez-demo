// components/gtm/__tests__/insufficientCredits.test.tsx
//
// Property 41 — every payment refusal is explained by the server's own sentence.
//
//   *For any* priced control and any `402` body, the insufficient-credit alert renders the
//   server's detail, the stage does not advance and no spinner is left running. (R17.6)
//
// ─── Why this is asserted against the page and not only against the component ──
//
// R17.6 is a claim about what happens *when the backend refuses*, and nothing in
// `InsufficientCreditsAlert` can keep it. The component renders whatever sentence it is
// handed; whether it is handed one at all is decided in the `catch` beside each priced
// write. So the three clauses are read where each one lives:
//
//   the server's own sentence   the `402` body travels the real transport. The response is
//                               served to `fetch`, `gtmAPI`/`evaAPI` turn it into their own
//                               error carrying the server's `detail`, and the page decides
//                               what to do with it. Nothing in this file constructs an
//                               error object, because the mapping from body to sentence is
//                               part of what R17.6 promises.
//   the stage does not advance  read off `data-gtm-stage`, the dossier's own marker, before
//                               and after the press. A refusal is not progress.
//   no spinner is left running  every busy indicator inside the dossier is gone and the
//                               control is operable again, because the rep's next move is
//                               to top up and press it a second time.
//
// The three priced controls are generated rather than fixed, and each is pressed exactly as
// a rep would reach it:
//
//   Activate Intelligence     `POST /prospect/{id}/track`, reached through the identity
//                             lookup the press runs first (R6.5) — the one press that turns
//                             into two writes.
//   Send Connection Request   `POST /prospect/{id}/action/request`, behind the Relationship
//                             & connection disclosure on an activated prospect.
//   Enrich Now                `POST /lead/enrich`, on the dossier's prospect band, for a
//                             prospect whose email the waterfall has not found yet.
//
// Each control gets its own 100-run property. The claim is one universal statement over
// (control, body) pairs, and the conjunction of three per-control properties says exactly
// that while naming which control broke it — a single mixed property would stop at the
// first counterexample and leave the other two controls unmeasured.
//
// ─── What this found, on the first run ─────────────────────────────────────────
//
// Enrich Now keeps R17.6 over a hundred bodies. The two GTM-side controls keep it for none
// of them, and the body is irrelevant — the branch is never entered.
// `ProspectIntelligence.tsx` imports `isInsufficientCredits` from `services/evaAPI`, whose
// predicate is `error instanceof EvaApiError`, and the refusals raised by
// `gtmAPI.trackProspect` and `gtmAPI.requestAction` are `GtmApiError`s. So both land in the
// `else`: an activation-failed notice and an error toast, which is the one wrong answer for a
// paywall — it tells a rep something broke and invites them to retry a call that will be
// refused identically, and it never says the words that make a refusal survivable ("this
// action was not performed and nothing was charged"). `gtmAPI` exports its own
// `isInsufficientCredits` (gtmAPI.ts) and the page does not import it.
//
// The properties are left as R17.6 states them rather than relaxed to the current behaviour.
//
// ─── Every query is scoped, and every run cleans up after itself ───────────────
//
// RTL binds both `screen` and the queries on `render`'s return value to `document.body`, so
// a mount that outlived its run would answer every later query in the file. Every read here
// goes through the run's own `container`, `mounted()` asserts exactly one dossier on the
// page, and `cleanup()` runs in a `finally` at the *end* of each run — including the failing
// one, which fast-check re-enters while it shrinks.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { toast } from "sonner";

import { InsufficientCreditsAlert } from "../InsufficientCreditsAlert";
import { CREDIT_LABELS } from "../CreditBalance";
import {
  GTM_CONNECTION_LABELS,
  PROSPECT_DECISION_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
} from "../labels";
import type { ProspectStage } from "../prospectStage";
import ProspectIntelligence from "@/pages/ProspectIntelligence";
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
const PERSON = "Ada Lovelace";
const COMPANY = "Analytical Engines";
const LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
const ISO = "2024-05-01T12:00:00.000Z";

/**
 * One enriched prospect, with no email on file.
 *
 * The empty email is what puts Enrich Now on the dossier and it is a real state: an
 * enrichment that *ran* and found nothing still promotes the lead, so a prospect can sit
 * here with a `gtmLeadId` and no address.
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
      role: "Head of Engineering",
      email: "",
      emailVerified: false,
      linkedinUrl: LINKEDIN,
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
      emailsFound: 0,
      handedToMax: 0,
      byTier: { low: 0, medium: 1, high: 0 },
      bySignalType: {},
    },
    // Discovery has landed, so the page arms no silent re-read behind these mounts.
    sweepState: "complete",
    isDemo: false,
  };
}

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
 * `ProspectOut` for this prospect, activated or not.
 *
 * `profile_id` is the activation flag — the `li_gtm_profiles` row — and `profile_url` is
 * that row's address, which is why both appear and disappear together: `api/gtm.py` sends
 * `profile_url=None` whenever there is no profile, so a lead that has never been activated
 * genuinely has a verified identity with no address on this payload.
 *
 * `relationship_state` is `NOT_CONNECTED`, one of `CONNECTABLE`'s two values, because that
 * is what puts Send Connection Request on screen.
 */
function wireDetail(activated: boolean) {
  return {
    lead_id: GTM_LEAD,
    profile: {
      lead_id: GTM_LEAD,
      profile_id: activated ? "profile-1" : null,
      profile_url: activated ? LINKEDIN : null,
      public_identifier: activated ? "ada-lovelace" : null,
      linkedin_verification_status: "VERIFIED",
      linkedin_verified_at: ISO,
      linkedin_match_confidence: 93,
      name: fact(PERSON),
      headline: fact("Head of Engineering"),
      company: fact(COMPANY),
      role: fact("Head of Engineering"),
      location: fact("London"),
      lead_score: {
        score: 82,
        score_kind: "RECOMMENDATION_SCORE",
        score_disclaimer: "A prioritisation signal, not a predicted probability of conversion.",
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

/**
 * `IdentityResolutionOut` for a prospect whose identity is already settled.
 *
 * This is the response that turns one Activate press into the track request: the verdict is
 * `VERIFIED` and it carries `sales_leads.linkedin_url`, the address `getProspect` cannot
 * supply before activation exists, so the press continues into the activation it was
 * always for (R6.5) instead of asking the rep to press the same button again.
 */
function wireResolution() {
  return {
    outcome: "ALREADY_VERIFIED",
    job_id: null,
    deduped: false,
    reason: null,
    verification_status: "VERIFIED",
    verified_at: ISO,
    match_confidence: 93,
    linkedin_url: LINKEDIN,
    attempt_id: null,
    stage: null,
    engine_used: null,
    candidate_count: null,
    failure_reason: null,
    attempted_at: null,
  };
}

/**
 * The ledger: a balance the client believes covers every price, and the server's price list.
 *
 * **It used to be `1`, which R17.5 now forbids pressing on.** The gate task 14.3 added —
 * `shortfallOf(balance, price)`, design §11 — takes a priced control off the screen when a
 * *known* balance is below a *known* price, so a fixture serving `balance: 1` against an
 * `ACTIVATE` price of `2` no longer has an Activate control to press, and this property could
 * never reach the `402` it exists to assert about.
 *
 * Raising it to `3` changes nothing about what is being tested. The refusal is served by
 * `serve()` on the priced route unconditionally — the balance on this payload has never been
 * what produces it — so all three clauses still run over the same hundred generated bodies.
 * What it fixes is the *client* state the press is made from, and R17.6 does not need a client
 * that already knows it cannot pay: a `402` arrives when the server's ledger disagrees with
 * the balance this client last read, which is a stale read, a concurrent spend, or a price
 * change between the read and the press. That is the state a rep is actually in when a
 * refusal surprises them, and it is the only state in which R17.5 and R17.6 both apply at
 * once.
 */
function wireCredits() {
  return {
    brand_id: BRAND,
    balance: 3,
    prices: [
      { action: "ENRICH", credits: 1 },
      { action: "CONTACT", credits: 1 },
      { action: "ACTIVATE", credits: 2 },
    ],
    history: [],
  };
}

// ─── The three priced controls ────────────────────────────────────────────────

type PricedControl = "activate" | "connect" | "enrich";

const PRICED: Record<
  PricedControl,
  {
    /** The route that answers `402`, matched against the request url. */
    route: string;
    /** Whether the prospect has to be activated for this control to be on screen. */
    activated: boolean;
    /** The stage this fixture's dossier stands in before the press, from `prospectStageOf`. */
    stage: ProspectStage;
    /** What the control reads while idle, so "operable again" is checkable. */
    label: RegExp;
  }
> = {
  activate: {
    route: `/prospect/${GTM_LEAD}/track`,
    activated: false,
    // Not activated, so the decision is on screen and this is the choice being made.
    stage: "ENRICHED",
    label: new RegExp(PROSPECT_DECISION_LABELS.activate.label),
  },
  connect: {
    route: `/prospect/${GTM_LEAD}/action/request`,
    activated: true,
    // Activated with nothing observed yet: `state_version` is 0 until a dimension moves.
    stage: "WAITING",
    label: new RegExp(GTM_CONNECTION_LABELS.send),
  },
  enrich: {
    route: "/lead/enrich",
    activated: false,
    stage: "ENRICHED",
    label: /Enrich Now/,
  },
};

const CONTROLS = Object.keys(PRICED) as PricedControl[];

// ─── The `402` body ───────────────────────────────────────────────────────────

/**
 * A refused response, as it arrives on the wire.
 *
 * `json: false` is a `402` whose body is not JSON at all — a gateway or proxy answering for
 * the app. It carries no sentence, and the property below asks only that the refusal still
 * be presented as one.
 */
interface Refusal {
  body: unknown;
  json: boolean;
}

/**
 * The sentences a refusal can carry.
 *
 * The ledger's own wording dominates the distribution because it is what actually arrives —
 * it is the only place the price and the balance appear together, which is what a rep needs
 * in order to know how much to top up by. The rest of the space is there to prove nothing on
 * screen depends on that wording: a sentence this product has never seen, markup-looking
 * text, other scripts, punctuation alone, whitespace alone, something far longer than any
 * layout expects, and the empty string.
 */
const sentenceArb: fc.Arbitrary<string> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .tuple(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 0, max: 8 }))
      .map(
        ([price, held]) =>
          `this action costs ${price} credit(s) and this workspace has ${held}`
      ),
  },
  { weight: 2, arbitrary: fc.lorem({ maxCount: 30 }) },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      "<script>alert('credits')</script>",
      "<b>Not enough</b> credits &mdash; top up to continue",
      "クレジットが不足しています",
      "crédits insuffisants — solde 0",
      "0",
      "   ",
      "\n\t",
      "…",
      ""
    ),
  },
  { weight: 1, arbitrary: fc.string({ minLength: 300, maxLength: 1200 }) },
  { weight: 1, arbitrary: fc.string() }
);

const refusalArb: fc.Arbitrary<Refusal> = fc.oneof(
  // FastAPI's `HTTPException(402, detail="…")`, which is what the credit guard raises.
  { weight: 6, arbitrary: sentenceArb.map((detail) => ({ body: { detail }, json: true })) },
  // A structured `detail`. Both transports serialise it rather than dropping it.
  {
    weight: 1,
    arbitrary: fc
      .record({ msg: sentenceArb, code: fc.constantFrom("INSUFFICIENT_CREDITS", "NO_BALANCE") })
      .map((entry) => ({ body: { detail: [entry] }, json: true })),
  },
  // Bodies that carry no sentence at all.
  { weight: 1, arbitrary: fc.constant({ body: {}, json: true }) },
  { weight: 1, arbitrary: fc.constant({ body: { message: "payment required" }, json: true }) },
  { weight: 1, arbitrary: fc.constant({ body: null, json: false }) }
);

/**
 * The sentence a reader of this response is owed, or `null` when it carries none.
 *
 * FastAPI's contract is `detail`, and both transports read exactly that key: a string is
 * the sentence, a structure is serialised, and anything falsy is no sentence — for which the
 * honest outcome is the refusal still being reported, with no sentence invented for it.
 * Whitespace alone counts as none: it is not a sentence, and asserting that a blank string
 * appears somewhere is not an assertion.
 */
function serverSentence(refusal: Refusal): string | null {
  if (!refusal.json) return null;
  const detail = (refusal.body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail.trim().length > 0 ? detail : null;
  if (detail === undefined || detail === null) return null;
  return JSON.stringify(detail);
}

// ─── Transport ────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;
/** The refusal the priced route is answering with, swapped per run. */
let refusal: Refusal = { body: { detail: "not enough" }, json: true };

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const refused = () => ({
  ok: false,
  status: 402,
  json: async () => {
    if (!refusal.json) throw new SyntaxError("Unexpected token < in JSON at position 0");
    return refusal.body;
  },
});

/**
 * Every route the dossier can reach, with one of them refusing.
 *
 * Ordered longest-first: `/prospect/{id}/track` and `/prospect/{id}/state` both contain
 * `/prospect/`, and matching the bare read first would answer a write with a payload.
 */
function serve(control: PricedControl) {
  const { route, activated } = PRICED[control];
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.includes(route)) return refused();
    if (url.includes("/lead/enrich")) return ok({ status: "no_email", found: false });
    if (url.includes("/resolve-identity")) return ok(wireResolution());
    if (url.includes("/credits")) return ok(wireCredits());
    if (url.includes("/action-queue")) return ok({ items: [], has_more: false });
    if (url.includes("/next-best-action")) return ok({ lead_id: GTM_LEAD });
    if (url.includes("/state")) return ok({ lead_id: GTM_LEAD });
    if (url.includes("/timeline")) return ok({ entries: [], next_cursor: null, has_more: false });
    if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail(activated));
    return ok({});
  });
}

// ─── Harness ──────────────────────────────────────────────────────────────────

/** The dossier's own root, so nothing on the rest of the page answers for it. */
const DOSSIER = 'section[aria-label="Prospect dossier"]';
/** Band 3's marker, which carries the stage. Exactly one per mounted dossier. */
const STAGE = "[data-gtm-stage]";

/** How many dossiers are on the page. Exactly one, or a run leaked its mount. */
const mounted = () => document.body.querySelectorAll(STAGE).length;

const stageOf = (root: ParentNode) =>
  root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

/** Every busy indicator inside the dossier: the spinner every priced control shares. */
const spinners = (root: ParentNode) => Array.from(root.querySelectorAll(".animate-spin"));

/**
 * The insufficient-credit alert, found by its own title inside its own `role="alert"`.
 *
 * Deliberately not "any alert on the page": R17.6 names this component, and a refusal
 * rendered through the page's error slot would satisfy a looser query while telling the rep
 * that something went wrong.
 */
function paywall(root: ParentNode): HTMLElement | null {
  const title = Array.from(root.querySelectorAll("h3")).find(
    (heading) => (heading.textContent ?? "").trim() === CREDIT_LABELS.insufficientTitle
  );
  return (title?.closest('[role="alert"]') as HTMLElement | undefined) ?? null;
}

/** Whether some element in `root` is exactly this sentence, and nothing else. */
function saysVerbatim(root: ParentNode, sentence: string): boolean {
  return Array.from(root.querySelectorAll("p, h3, span, div")).some(
    (element) => element.textContent === sentence
  );
}

/** The digit runs in each element's own text, never across two of them. */
function numbersPerStatement(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll("p, h3")).flatMap((element) =>
    (element.textContent ?? "").match(/\d+/g) ?? []
  );
}

/** Mounts the page at this workspace's prospect surface, credits and all. */
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
 * The loaded dossier for one control's fixture, and the control itself.
 *
 * The wait is on the *stage*, not merely on the marker carrying it. Band 3 renders from the
 * first paint — a prospect whose read is still in flight is `ENRICHED`, which is a real
 * answer and not a placeholder — so waiting for the element alone would let a run press a
 * control on a dossier whose payload had not landed. Waiting for the fixture's own stage is
 * what makes each run start from the same page: `WAITING` is reachable only once the profile
 * row is on the payload.
 */
async function openDossier(control: PricedControl) {
  serve(control);
  const utils = renderPage();
  const container = utils.container;
  const expected = PRICED[control].stage;

  await waitFor(() => expect(stageOf(container)).toBe(expected));
  const dossier = container.querySelector(DOSSIER) as HTMLElement;

  const user = userEvent.setup();

  // Send Connection Request lives behind a disclosure, which is where the rep finds it: the
  // relationship section is closed on arrival and its panel is not constructed until it is
  // opened.
  if (control === "connect") {
    await user.click(
      await within(dossier).findByText(PROSPECT_INTELLIGENCE_SECTIONS.relationship)
    );
  }

  const press = () => within(dossier).getByRole("button", { name: PRICED[control].label });
  await within(dossier).findByRole("button", { name: PRICED[control].label });

  return { container, dossier, user, press };
}

/** What the page did instead, for a counterexample that names it rather than a null. */
function whatThePageSaid(root: ParentNode): string {
  const toasts = [
    ...vi.mocked(toast.error).mock.calls,
    ...vi.mocked(toast).mock.calls,
  ].map((call) => String(call[0]));
  const statements = Array.from(root.querySelectorAll("p"))
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text.length > 0)
    .slice(0, 12);
  return `toasts=${JSON.stringify(toasts)} statements=${JSON.stringify(statements)}`;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // The workspace read is Eva's own, with a wire format this file has no business restating.
  // Everything priced goes through the transport unmocked, which is the point.
  vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(workspace());
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 41
// ══════════════════════════════════════════════════════════════════════════════

describe("Feature: sales-workflow-frontend-restructure, Property 41: Every payment refusal is explained by the server's own sentence", () => {
  // The instrument, checked before anything is generated against it. A property that could
  // not find its control would pass or fail for reasons that have nothing to do with R17.6.
  it.each(CONTROLS)("puts the %s control on the dossier, idle and operable", async (control) => {
    refusal = { body: { detail: "instrument" }, json: true };
    const { dossier, press } = await openDossier(control);

    expect(mounted()).toBe(1);
    expect(stageOf(dossier)).toBe(PRICED[control].stage);
    expect(press()).toBeEnabled();
    expect(spinners(dossier)).toHaveLength(0);
    expect(paywall(dossier)).toBeNull();
  });

  CONTROLS.forEach((control) => {
    it(
      `explains a refused ${control} with the server's own sentence, advancing no stage and leaving no spinner`,
      // A hundred mounts of a whole page do not fit the 5s default.
      { timeout: 60_000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(refusalArb, async (generated) => {
            refusal = generated;
            const sentence = serverSentence(generated);
            const { container, dossier, user, press } = await openDossier(control);

            try {
              // One dossier on the page, so every reading below is this run's answer.
              expect(mounted()).toBe(1);
              const before = stageOf(dossier);
              expect(before).not.toBeNull();

              await user.click(press());

              // The settled presentation of the refusal: the alert is up and nothing is
              // still spinning. Waited for rather than read straight after the click,
              // because the two writes behind an Activate press clear their busy flags in
              // separate commits.
              await waitFor(() => {
                expect(paywall(container)).not.toBeNull();
                expect(spinners(dossier)).toHaveLength(0);
              }).catch(() => {
                // Swallowed so the three assertions below can each say what they found.
              });

              // ── The refusal is the alert R17.6 names ──
              const alert = paywall(container);
              expect(
                alert,
                `${control}: no insufficient-credits alert. ${whatThePageSaid(container)}`
              ).not.toBeNull();
              // And it says the thing only this component says: the action did not happen
              // and nothing was charged.
              expect(alert!.textContent).toContain(CREDIT_LABELS.insufficientBody);

              // ── The server's own sentence, verbatim ──
              //
              // Only when the response carried one. A `402` with no `detail`, or with a body
              // that is not JSON at all, gives a reader nothing to be told — and the honest
              // outcome there is the refusal still being reported, which the assertions above
              // and below already require. Demanding a verbatim sentence for a response that
              // contains none would be asserting against the test's own invention.
              if (sentence !== null) {
                expect(
                  saysVerbatim(alert!, sentence),
                  `${control}: the alert did not carry the server's sentence verbatim. alert=${JSON.stringify(
                    alert!.textContent
                  )}`
                ).toBe(true);
                // Rendered as text. A body that looks like markup stays a sentence.
                expect(alert!.querySelectorAll("script, b, i, img, iframe, style")).toHaveLength(
                  0
                );
                // And no figure the server did not send. The alert's own copy carries none,
                // so every number on it came from the sentence or from the balance the page
                // read — never a price or a shortfall composed here. Scoped to the same
                // branch, because a response with no sentence is answered by the transport's
                // status line, and that line's status code is not a credit figure.
                const allowed = new Set([
                  ...(sentence.match(/\d+/g) ?? []),
                  String(wireCredits().balance),
                ]);
                numbersPerStatement(alert!).forEach((figure) =>
                  expect(
                    allowed.has(figure),
                    `${control}: the alert printed ${figure}, which the server did not send`
                  ).toBe(true)
                );
              }

              // ── The stage does not advance ──
              expect(
                stageOf(dossier),
                `${control}: the refusal moved the prospect from ${before}`
              ).toBe(before);

              // ── No spinner is left running, and the control can be pressed again ──
              expect(spinners(dossier)).toHaveLength(0);
              expect(
                press(),
                `${control}: the control is not pressable again after the refusal`
              ).toBeEnabled();
            } finally {
              // At the end of the run, including the failing one: fast-check shrinks by
              // re-running the predicate, and a run that left its dossier mounted would
              // hand the shrinker a page with two of them and a counterexample describing
              // this harness rather than the product.
              cleanup();
            }
          }),
          { numRuns: 100 }
        );
      }
    );
  });

  // The same clause at the component, over the same sentence space. It is the one place a
  // fallback could be composed, and this is what says it is not: whatever the caller was
  // given is what a reader sees, and every figure on screen came from the server.
  it(
    "renders any sentence the server sends verbatim and composes no figure of its own",
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(
          sentenceArb,
          fc.option(fc.nat({ max: 99 }), { nil: null }),
          (sentence, balance) => {
            const { container } = render(
              <InsufficientCreditsAlert detail={sentence} balance={balance} />
            );

            try {
              const alert = paywall(container);
              expect(alert).not.toBeNull();
              // The no-op statement, which is the reason a paywall is not an error box.
              expect(alert!.textContent).toContain(CREDIT_LABELS.insufficientBody);

              if (sentence.trim().length > 0) {
                expect(saysVerbatim(alert!, sentence)).toBe(true);
                expect(
                  alert!.querySelectorAll("script, b, i, img, iframe, style")
                ).toHaveLength(0);
              }

              const allowed = new Set([
                ...(sentence.match(/\d+/g) ?? []),
                ...(balance === null ? [] : [String(balance)]),
              ]);
              numbersPerStatement(alert!).forEach((figure) =>
                expect(
                  allowed.has(figure),
                  `the alert printed ${figure}, which nobody gave it`
                ).toBe(true)
              );
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
