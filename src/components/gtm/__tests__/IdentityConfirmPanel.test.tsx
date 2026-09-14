// components/gtm/__tests__/IdentityConfirmPanel.test.tsx
//
// The candidate-confirmation block, tested for the thing it exists to protect:
// **that a human actually looked.**
//
// Why this panel is worth its own file. Every other panel on the prospect page
// renders a fact somebody else established. This one *collects* the fact that
// settles an identity — and an identity is the anchor every later signal, belief and
// recommendation hangs off. Confirm the wrong profile and the whole prospect is
// about a stranger, and you would act on it.
//
// So the assertions are shaped around the ways this could go wrong:
//
//   1. **It shows the evidence before the buttons.** The url, the confidence, which
//      attributes matched, and why the machine stopped. A confirm button with no
//      evidence beside it is a button people press without reading.
//   2. **It asks the operator to open the profile.** `confirmHint` is an
//      instruction, and its presence is asserted — a panel that merely implies
//      checking is a panel that collects unchecked answers.
//   3. **The url is a real link that opens in a new tab.** They have to be able to
//      go and look, and it must not navigate the page away from the prospect.
//   4. **Rejection is a distinct answer, not a cancel.** It calls `onConfirm(false)`
//      rather than dismissing, because "a human looked and it is not him" is a
//      finding worth recording.
//   5. **It renders nothing without a candidate.** Visibility follows the server's
//      own signal, so a `POSSIBLE_MATCH` that reached no candidate shows no prompt
//      instead of an empty one.
//   6. **Unreadable evidence degrades instead of crashing.** Malformed JSON must
//      cost the attribute chips and nothing else — the url and confidence are still
//      enough to judge on.
//
// ─── What the restructure changes (R20.8, §15.3) ──────────────────────────────
//
// This is now **the only identity surface the dossier can show**. `IdentityPanel` — the
// block with LinkedIn URL entry, profile finding and identity resolution — is not
// rendered on this page at all (R6.6); the one thing the page imports from that module
// is `trackRefusal()`. So the question "does an identity prompt appear" has exactly one
// answer on the folded dossier, and that answer is `hasCandidateToSettle(profile)`.
//
// Claim 5 above already states that at the component: no candidate, no render. What it
// cannot state is that the *page* asks the same question, and asks nothing else — a page
// that mounted this panel on `linkedinVerificationStatus === "POSSIBLE_MATCH"` would
// satisfy every assertion above while putting an empty prompt in front of a rep for a
// search that reached no candidate. So the last block in this file mounts the real
// dossier through the real transport, the way
// `components/gtm/__tests__/insufficientCredits.test.tsx` does, and varies the one field
// the server's answer lives in.

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ObservedFact, ProspectProfile } from "@/services/gtmAPI";
import ProspectIntelligence from "@/pages/ProspectIntelligence";
import { CreditsProvider } from "@/hooks/useCredits";
import { evaAPI, type EvaWorkspace, type QualifiedLead } from "@/services/evaAPI";
import {
  IDENTITY_CONFIRM_SECTION,
  IdentityConfirmPanel,
  hasCandidateToSettle,
  matchedAttributes,
} from "../IdentityConfirmPanel";
import { IDENTITY_SECTION } from "../IdentityPanel";
import { GTM_IDENTITY_CONFIRM_LABELS as L } from "../labels";

// The page under test in the last block pulls both of these in. Neither is any of this
// file's business: the sidebar owns a conversation read of its own, and nothing here
// asserts on a toast.
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

const CANDIDATE = "https://www.linkedin.com/in/karanchaudhry";
//: The evidence shape the resolver really wrote for the attempt this panel exists for.
const EVIDENCE = '{"name":"exact","company":"compact","email_domain":"domain"}';

const UNKNOWN_FACT: ObservedFact = {
  value: null,
  isUnknown: true,
  sourceSurface: null,
  observedAt: null,
  isStale: false,
  isDerived: false,
};

function profileOf(over: Partial<ProspectProfile> = {}): ProspectProfile {
  return {
    leadId: "lead-1",
    profileId: null,
    profileUrl: null,
    publicIdentifier: null,
    name: UNKNOWN_FACT,
    headline: UNKNOWN_FACT,
    company: UNKNOWN_FACT,
    role: UNKNOWN_FACT,
    location: UNKNOWN_FACT,
    seniority: UNKNOWN_FACT,
    icpMatch: UNKNOWN_FACT,
    intentSignal: UNKNOWN_FACT,
    acvTier: UNKNOWN_FACT,
    leadScore: {
      score: null,
      scoreKind: "RECOMMENDATION_SCORE",
      scoreDisclaimer: "",
      isDerived: true,
    },
    linkedinVerificationStatus: "POSSIBLE_MATCH",
    linkedinVerifiedAt: null,
    linkedinMatchConfidence: 80,
    identityCandidateUrl: CANDIDATE,
    identityMatchEvidence: EVIDENCE,
    identityFailureReason: "PROFILE_IDENTITY_UNREADABLE",
    ...over,
  };
}

function panel(over: Partial<ProspectProfile> = {}, props: Record<string, unknown> = {}) {
  const onConfirm = vi.fn();
  const result = render(
    <IdentityConfirmPanel profile={profileOf(over)} onConfirm={onConfirm} {...props} />,
  );
  return { onConfirm, ...result };
}

// ══════════════════════════════════════════════════════════════════════════════
// The pure helpers
// ══════════════════════════════════════════════════════════════════════════════

describe("matchedAttributes", () => {
  it("reads the resolver's evidence into labelled attributes", () => {
    expect(matchedAttributes(EVIDENCE)).toEqual([
      { key: "name", label: "Name", kind: "exact" },
      { key: "company", label: "Company", kind: "close" },
      { key: "email_domain", label: "Email domain", kind: "domain" },
    ]);
  });

  it("returns nothing for absent or malformed evidence rather than throwing", () => {
    // An unparseable blob must cost the chips and not the panel: the url and the
    // confidence are still enough for a human to judge on.
    expect(matchedAttributes(null)).toEqual([]);
    expect(matchedAttributes("")).toEqual([]);
    expect(matchedAttributes("not json")).toEqual([]);
    expect(matchedAttributes("[1,2,3]")).toEqual([]);
    expect(matchedAttributes("null")).toEqual([]);
  });

  it("passes an unmapped attribute or kind through as itself", () => {
    // A new attribute the resolver starts matching on should appear the day it ships,
    // spelled its own way, rather than vanish until somebody adds a label.
    expect(matchedAttributes('{"tenure":"overlapping"}')).toEqual([
      { key: "tenure", label: "tenure", kind: "overlapping" },
    ]);
  });

  it("drops entries whose kind is not a usable string", () => {
    expect(matchedAttributes('{"name":"exact","company":null,"role":""}')).toEqual([
      { key: "name", label: "Name", kind: "exact" },
    ]);
  });
});

describe("hasCandidateToSettle", () => {
  it("follows the server's own signal, not the verification status", () => {
    // A POSSIBLE_MATCH that reached no candidate has nothing to settle. Deriving
    // visibility from the status would show an empty prompt for exactly that case.
    expect(hasCandidateToSettle(profileOf())).toBe(true);
    expect(hasCandidateToSettle(profileOf({ identityCandidateUrl: null }))).toBe(false);
    expect(hasCandidateToSettle(profileOf({ identityCandidateUrl: "   " }))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The evidence, before the buttons
// ══════════════════════════════════════════════════════════════════════════════

describe("the evidence shown", () => {
  it("asks the question and says why a machine is asking", () => {
    panel();
    expect(screen.getByText(L.heading)).toBeInTheDocument();
    expect(screen.getByText(L.why)).toBeInTheDocument();
  });

  it("shows the candidate as a real link that opens in a new tab", () => {
    // The operator has to be able to go and look, and it must not navigate away from
    // the prospect they are judging.
    panel();
    const link = screen.getByRole("link", { name: new RegExp(L.open, "i") });
    expect(link).toHaveAttribute("href", CANDIDATE);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows the scorer's confidence", () => {
    panel();
    expect(screen.getByText(L.confidenceField)).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("shows which attributes matched and how", () => {
    const { container } = panel();
    for (const key of ["name", "company", "email_domain"]) {
      expect(container.querySelector(`[data-match-attribute="${key}"]`)).not.toBeNull();
    }
    expect(screen.getByText(/Email domain/)).toBeInTheDocument();
  });

  it("explains why the machine stopped, in a sentence", () => {
    panel();
    expect(
      screen.getByText(L.failureReason.PROFILE_IDENTITY_UNREADABLE),
    ).toBeInTheDocument();
  });

  it("omits an unmapped failure reason rather than printing a raw enum", () => {
    // A bare constant on screen tells an operator nothing they can act on.
    panel({ identityFailureReason: "SOME_NEW_REASON" });
    expect(screen.queryByText(/SOME_NEW_REASON/)).not.toBeInTheDocument();
    // The panel still renders and is still answerable.
    expect(
      screen.getByRole("button", { name: new RegExp(L.confirm, "i") }),
    ).toBeInTheDocument();
  });

  it("survives evidence it cannot parse, keeping the url and confidence", () => {
    panel({ identityMatchEvidence: "{oh no" });
    expect(screen.getByRole("link", { name: new RegExp(L.open, "i") })).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.queryByText(L.matchedField)).not.toBeInTheDocument();
  });

  it("omits the confidence rather than printing a zero when none was scored", () => {
    panel({ linkedinMatchConfidence: null });
    expect(screen.queryByText(L.confidenceField)).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The instruction, and the two answers
// ══════════════════════════════════════════════════════════════════════════════

describe("answering", () => {
  it("tells the operator to open the profile before answering", () => {
    // The load-bearing string. Without it this collects unchecked answers.
    panel();
    expect(screen.getByText(L.confirmHint)).toBeInTheDocument();
  });

  it("records a confirmation", async () => {
    const { onConfirm } = panel();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(L.confirm, "i") }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("records a rejection as an answer, not a dismissal", async () => {
    // `onConfirm(false)` and not a separate cancel: "a human looked and it is not
    // him" is a finding, and the only way that fact ever enters the system.
    const { onConfirm } = panel();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(L.reject, "i") }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("does not word the rejection as a cancel", () => {
    panel();
    const reject = screen.getByRole("button", { name: new RegExp(L.reject, "i") });
    expect(reject.textContent?.toLowerCase()).not.toMatch(/cancel|dismiss|skip/);
  });

  it("disables both answers while one is in flight", () => {
    panel({}, { submitting: true });
    for (const label of [L.confirming, L.reject]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeDisabled();
    }
  });

  it("announces what the answer did in its own polite region", () => {
    panel({}, { notice: L.confirmed });
    const live = screen.getByText(L.confirmed);
    expect(live).toHaveAttribute("aria-live", "polite");
    // Not a second `role="status"`: the page owns exactly one.
    expect(live).not.toHaveAttribute("role", "status");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Visibility and accessibility
// ══════════════════════════════════════════════════════════════════════════════

describe("visibility", () => {
  it("renders nothing at all without a candidate", () => {
    const { container } = panel({ identityCandidateUrl: null });
    expect(container.firstChild).toBeNull();
  });

  it("exposes the candidate url as a data attribute for the page to scope on", () => {
    const { container } = panel();
    const block = container.querySelector('[data-gtm-block="identity-confirm"]');
    expect(block).toHaveAttribute("data-candidate-url", CANDIDATE);
  });
});

describe("accessibility", () => {
  it("is clean under axe with the full evidence set", async () => {
    const { container } = panel({}, { notice: L.confirmed });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean under axe with evidence missing", async () => {
    const { container } = panel({
      identityMatchEvidence: null,
      identityFailureReason: null,
      linkedinMatchConfidence: null,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("puts the link and both answers on the tab order", async () => {
    const { container } = panel();
    const focusable = [
      ...within(container).getAllByRole("link"),
      ...within(container).getAllByRole("button"),
    ];
    expect(focusable.length).toBe(3);
    for (const element of focusable) {
      expect(element).not.toHaveAttribute("tabindex", "-1");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// On the dossier: the only identity surface, and only with a candidate (R20.8, §15.3)
// ══════════════════════════════════════════════════════════════════════════════
//
// One claim, stated over the five payloads that can produce it:
//
//     the prompt is on the dossier  ⟺  the server sent a candidate url
//
// Both directions matter and they fail differently. Missing the forward direction hides
// a question the server asked, and the resolver's own note is that a `POSSIBLE_MATCH` is
// a verdict "a human can settle" — nobody settles a prompt they never see. Missing the
// reverse puts a confirm button with no candidate behind it in front of a rep, which is
// the one thing a surface built to prove somebody looked must never do.
//
// The interesting case is the last one: `POSSIBLE_MATCH` **with no candidate**. It is a
// real verdict — a search that scored nothing worth offering — and it is exactly what a
// page deriving visibility from the status would get wrong. So it is generated here as a
// payload rather than described in a comment.
//
// Note what the fixture does *not* do: it never activates a prospect that has an
// unsettled candidate. The track route refuses anything unverified, so a
// `li_gtm_profiles` row and a candidate awaiting a verdict cannot coexist, and a case
// built on that pair would be asserting about a state the backend cannot reach. The
// prompt's home is therefore the pre-activation dossier, beside the decision — which is
// also why it sits outside the disclosure inventory and is asserted to.

describe("on the dossier, as the only identity surface", () => {
  /** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
  const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const EVA_LEAD = "lead_ada7f1";
  const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
  const PERSON = "Ada Lovelace";
  const COMPANY = "Analytical Engines";
  const ISO = "2024-05-01T12:00:00.000Z";

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
        email: "ada@analyticalengines.com",
        emailVerified: true,
        linkedinUrl: null,
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
        emailsFound: leads.length,
        handedToMax: 0,
        byTier: { low: 0, medium: 1, high: 0 },
        bySignalType: {},
      },
      sweepState: "complete",
      isDemo: false,
    };
  }

  // ─── The wire ───────────────────────────────────────────────────────────────

  function wireFact(value: string | null) {
    return {
      value,
      is_unknown: value === null,
      source_surface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
      observed_at: value === null ? null : ISO,
      is_stale: false,
      is_derived: false,
    };
  }

  /** What the identity attempt left on `sales_leads`, as the route projects it. */
  interface Verdict {
    status: string;
    /** `identity_candidate_url`. `null` and `"   "` are both "nothing to settle". */
    candidate: string | null;
  }

  function wireDetail(verdict: Verdict) {
    return {
      lead_id: GTM_LEAD,
      profile: {
        lead_id: GTM_LEAD,
        // Never activated: the track route refuses an unverified identity, so a profile
        // row and an unsettled candidate cannot be on the same payload.
        profile_id: null,
        profile_url: null,
        public_identifier: null,
        linkedin_verification_status: verdict.status,
        linkedin_verified_at: verdict.status === "VERIFIED" ? ISO : null,
        linkedin_match_confidence: 80,
        identity_candidate_url: verdict.candidate,
        identity_match_evidence: EVIDENCE,
        identity_failure_reason: "PROFILE_IDENTITY_UNREADABLE",
        name: wireFact(PERSON),
        headline: wireFact("Head of Engineering"),
        company: wireFact(COMPANY),
        role: wireFact("Head of Engineering"),
        location: wireFact("London"),
        lead_score: {
          score: 82,
          score_kind: "RECOMMENDATION_SCORE",
          score_disclaimer:
            "A prioritisation signal, not a predicted probability of conversion.",
          is_derived: true,
        },
      },
      state: {
        relationship_state: wireFact("NOT_CONNECTED"),
        conversation_state: wireFact("WARMUP_READY"),
        confirmation_status: "NOT_APPLICABLE",
        display_summary: "Not connected · warm-up ready",
        display_summary_is_derived: true,
      },
      updated_at: ISO,
    };
  }

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

  let fetchMock: ReturnType<typeof vi.fn>;

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  /** Ordered longest-first so the bare detail read cannot answer for the others. */
  function serve(verdict: Verdict) {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/credits")) return ok(wireCredits());
      if (url.includes("/action-queue")) return ok({ items: [], has_more: false });
      if (url.includes("/next-best-action")) return ok({ lead_id: GTM_LEAD });
      if (url.includes("/state/history"))
        return ok({ items: [], next_cursor: null, has_more: false });
      if (url.includes("/state")) return ok({ lead_id: GTM_LEAD, state_version: 0 });
      if (url.includes("/signals")) return ok({ items: [], next_cursor: null, has_more: false });
      if (url.includes("/timeline"))
        return ok({ entries: [], next_cursor: null, has_more: false });
      if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail(verdict));
      return ok({});
    });
  }

  // ─── Harness ────────────────────────────────────────────────────────────────

  const DOSSIER = 'section[aria-label="Prospect dossier"]';
  const STAGE = "[data-gtm-stage]";
  /** This panel's own block attribute, and the retired panel's, both read off their modules. */
  const PROMPT = `[data-gtm-block="${IDENTITY_CONFIRM_SECTION}"]`;
  const RETIRED = `[data-gtm-block="${IDENTITY_SECTION}"]`;

  const stageOf = (root: ParentNode) =>
    root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={[`/prospect-intelligence/${BRAND}`]}>
        <CreditsProvider brandId={BRAND}>
          <Routes>
            <Route path="/prospect-intelligence/:spaceId" element={<ProspectIntelligence />} />
          </Routes>
        </CreditsProvider>
      </MemoryRouter>,
    );
  }

  /**
   * The loaded dossier for one verdict.
   *
   * The wait is on the prospect's *name*, not on the stage: every payload here is
   * un-activated, so all five stand at `ENRICHED` and the stage is settled before the
   * detail read lands. The name comes from `getProspect`, so waiting for it is what makes
   * "the served profile is on screen" true — and an absence read before that would be an
   * absence of the read rather than of the prompt.
   */
  async function openDossier(verdict: Verdict) {
    serve(verdict);
    const { container } = renderPage();
    const dossier = await waitFor(() => {
      const found = container.querySelector(DOSSIER) as HTMLElement | null;
      expect(found).not.toBeNull();
      // `getAllByText`: the enriched dossier names the person in the decision's own copy as
      // well as in band 2's heading, and how many times it does so is not this file's claim.
      expect(within(found!).getAllByText(PERSON).length).toBeGreaterThan(0);
      return found!;
    });
    return { container, dossier, user: userEvent.setup() };
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(workspace());
    sessionStorage.setItem("token", "session-abc");
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("mounts the prompt with the server's candidate, and mounts it beside the decision", async () => {
    const { container, dossier } = await openDossier({
      status: "POSSIBLE_MATCH",
      candidate: CANDIDATE,
    });

    expect(stageOf(dossier)).toBe("ENRICHED");

    const prompt = container.querySelector(PROMPT) as HTMLElement;
    expect(prompt).not.toBeNull();
    // The server's own url, not a reconstruction: the page hands the payload's profile
    // block straight over, and the panel writes it back out as an attribute.
    expect(prompt).toHaveAttribute("data-candidate-url", CANDIDATE);
    expect(within(prompt).getByRole("link", { name: new RegExp(L.open, "i") })).toHaveAttribute(
      "href",
      CANDIDATE,
    );
    // The instruction reached the rep, which is the load-bearing string of the whole
    // surface and the reason a prompt is not just two buttons.
    expect(within(prompt).getByText(L.confirmHint)).toBeInTheDocument();

    // Beside the decision, not behind a disclosure and not in front of the choice: it is a
    // question the server asked, so both answers stay available while it is open.
    expect(prompt.closest("details")).toBeNull();
    expect(prompt.closest("[data-gtm-section]")).toBeNull();
    expect(dossier.querySelector('[data-gtm-section="decision"]')).not.toBeNull();

    // Exactly one prompt, so "the identity surface" is singular in fact as well as in
    // the design note.
    expect(container.querySelectorAll(PROMPT)).toHaveLength(1);
  });

  /**
   * The four payloads that carry no candidate.
   *
   * The two blanks are the case `hasCandidateToSettle` trims for — the server sending an
   * empty field is the server saying there is nothing to settle — and `POSSIBLE_MATCH`
   * with no candidate is the verdict a status-derived rule would get wrong.
   */
  const NOTHING_TO_SETTLE: [name: string, verdict: Verdict][] = [
    ["a settled identity", { status: "VERIFIED", candidate: null }],
    ["a verdict of a different person", { status: "NO_MATCH", candidate: null }],
    ["a possible match that reached no candidate", { status: "POSSIBLE_MATCH", candidate: null }],
    ["a candidate field that is blank", { status: "POSSIBLE_MATCH", candidate: "   " }],
  ];

  it.each(NOTHING_TO_SETTLE)("shows no prompt for %s", async (_name, verdict) => {
    const { container, dossier } = await openDossier(verdict);

    expect(container.querySelector(PROMPT)).toBeNull();
    // And nothing the prompt would have said: no question, no instruction, neither answer.
    expect(within(dossier).queryByText(L.heading)).toBeNull();
    expect(within(dossier).queryByText(L.confirmHint)).toBeNull();
    expect(
      within(dossier).queryByRole("button", { name: new RegExp(L.confirm, "i") }),
    ).toBeNull();
    expect(within(dossier).queryByRole("button", { name: new RegExp(L.reject, "i") })).toBeNull();
    // The dossier is still legible, which is what says the absence is the condition and
    // not a failed read.
    expect(within(dossier).getAllByText(PERSON).length).toBeGreaterThan(0);
  });

  /** Every verdict above, candidate or not. */
  const EVERY_VERDICT: Verdict[] = [
    { status: "POSSIBLE_MATCH", candidate: CANDIDATE },
    ...NOTHING_TO_SETTLE.map(([, verdict]) => verdict),
  ];

  it(
    "renders no IdentityPanel on the dossier, whatever the verdict says",
    // Five mounts of a whole page do not fit the 5s default. Second argument, not third:
    // the options-as-third-argument form is deprecated in Vitest 4.
    { timeout: 60_000 },
    async () => {
      // R6.6: `IdentityPanel` — LinkedIn URL entry, profile finding, identity resolution —
      // is not rendered on this surface at all. Asserted through that module's own exported
      // block attribute rather than through a label, so a relabelling of the retired panel
      // cannot make this pass by accident.
      for (const verdict of EVERY_VERDICT) {
        // eslint-disable-next-line no-await-in-loop
        const { container } = await openDossier(verdict);
        try {
          expect(
            container.querySelector(RETIRED),
            `IdentityPanel was rendered for ${JSON.stringify(verdict)}`,
          ).toBeNull();
        } finally {
          // At the end of each iteration, including a failing one: RTL binds every query
          // to `document.body`, so a mount left standing would answer for the next verdict.
          cleanup();
        }
      }
    },
  );
});
