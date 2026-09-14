// components/gtm/__tests__/ConnectionPanel.test.tsx
//
// The connection flow, tested for the one thing it exists to get right: **a click is
// not a connection, and neither is coming back to the tab.**
//
// Why this panel needs its own file. Every other panel on the prospect page renders
// facts somebody else established. This one *collects* a fact — it is the only place
// in the product where `relationship_state` originates, because connection degree is
// account-relative and no logged-off reader can ever see it. That makes it the single
// easiest place in the codebase to accidentally fabricate state, and the assertions
// below are shaped around the ways it could happen:
//
//   1. **The return prompt is a question with a real "no".** Pressing "No, not yet"
//      must call nothing at all. A prompt whose only button confirms is a prompt that
//      manufactures its own answer, and an operator who closed the LinkedIn tab
//      without sending would be recorded as having sent.
//   2. **"Still awaiting" writes nothing.** Nothing was observed. The state is already
//      pending, and re-asserting it would refresh `state_observed_at` — the very clock
//      the age on screen is measured from — so a "nothing changed" answer would make
//      the invitation look newer than it is.
//   3. **A missing timestamp renders no age, not a zero.** `daysSince` returns `null`
//      rather than `0` for an absent `observedAt`, because zero would claim the
//      invitation went out today. This is the same rule the whole layer applies to
//      unknown values, applied to a duration.
//   4. **The send control is offered only where connecting is the next step.** Never
//      beside a pending invitation, which would invite a duplicate, and never beside a
//      confirmed connection.
//   5. **The state reaches the screen as a sentence, not as an enum member.** Through
//      `STATE_LABEL`, like every other dimension on the page.
//
// The two "writes nothing" claims are asserted as *negative* calls on the confirm
// spy, which is the only way to state them: the bug they guard against is an extra
// call, not a wrong argument.
//
// ─── Where this panel now sits (R20.8, §15.3) ─────────────────────────────────
//
// Everything above is a statement about the component's own props and stays exactly as
// it was. What the restructure changes is the composition around it: the panel is no
// longer a band on the retired `GTMProspect` page, it is the whole of the dossier's
// "Relationship & connection" disclosure, and `IntelligenceSection`'s `children` is a
// function — so a closed section never constructs it. Design §15.3 asks this file to
// assert that, which cannot be asserted from props: nothing a component is handed tells
// you whether anybody mounted it. So the last block in this file mounts the real
// dossier through the real transport, the same way
// `components/gtm/__tests__/insufficientCredits.test.tsx` does, and reads the DOM.
//
// It is deliberately about *mounting* and not about requests.
// `ProspectDossier.compose.test.tsx` owns the request budget (property 6, R3.8),
// including "a disclosure reads only when open"; this file adds no second count.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ObservedFact, RelationshipState } from "@/services/gtmAPI";
import ProspectIntelligence from "@/pages/ProspectIntelligence";
import { CreditsProvider } from "@/hooks/useCredits";
import { evaAPI, type EvaWorkspace, type QualifiedLead } from "@/services/evaAPI";
import {
  CONNECTABLE,
  CONNECTION_SECTION,
  ConnectionPanel,
  DECIDE_AFTER_DAYS,
  NUDGE_AFTER_DAYS,
  PENDING,
  daysSince,
  pendingLabel,
} from "../ConnectionPanel";
import {
  DIMENSION_LABEL,
  GTM_CONNECTION_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  STATE_LABEL,
} from "../labels";

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** An `ObservedFact` carrying a relationship value, asserted `daysAgo` ago. */
function rel(value: RelationshipState | null, daysAgo: number | null = 0): ObservedFact {
  return {
    value,
    isUnknown: value === null,
    sourceSurface: value === null ? null : "HUMAN_CONFIRMATION",
    observedAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    isStale: false,
    isDerived: false,
  };
}

interface Spies {
  onSendRequest: ReturnType<typeof vi.fn>;
  onConfirm: ReturnType<typeof vi.fn>;
  onDismissPrompt: ReturnType<typeof vi.fn>;
  onStillAwaiting: ReturnType<typeof vi.fn>;
}

function spies(): Spies {
  return {
    onSendRequest: vi.fn(),
    onConfirm: vi.fn(),
    onDismissPrompt: vi.fn(),
    onStillAwaiting: vi.fn(),
  };
}

function panel(
  relationship: ObservedFact,
  over: Partial<React.ComponentProps<typeof ConnectionPanel>> = {},
): Spies {
  const s = spies();
  render(<ConnectionPanel relationship={relationship} {...s} {...over} />);
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// The pure helpers
// ══════════════════════════════════════════════════════════════════════════════

describe("daysSince", () => {
  it("returns null for a missing instant rather than zero", () => {
    // Zero would claim the invitation went out today, which is a fact nobody
    // recorded. This is the unknown-is-not-zero rule applied to a duration.
    expect(daysSince(null)).toBeNull();
    expect(daysSince("")).toBeNull();
  });

  it("returns null for an unparseable instant", () => {
    expect(daysSince("not a date")).toBeNull();
  });

  it("floors to whole days", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    expect(daysSince("2026-09-06T00:00:00Z", now)).toBe(0);
    expect(daysSince("2026-09-05T00:00:00Z", now)).toBe(1);
    expect(daysSince("2026-08-30T00:00:00Z", now)).toBe(7);
  });

  it("clamps a server clock ahead of the browser to today", () => {
    // Marginal skew must read "today", never "-1 days".
    const now = new Date("2026-09-06T12:00:00Z");
    expect(daysSince("2026-09-06T18:00:00Z", now)).toBe(0);
  });
});

describe("pendingLabel", () => {
  it("has a distinct sentence for today, yesterday, and longer", () => {
    expect(pendingLabel(0)).toBe(GTM_CONNECTION_LABELS.pendingForToday);
    expect(pendingLabel(1)).toBe(GTM_CONNECTION_LABELS.pendingForOneDay);
    expect(pendingLabel(5)).toContain("5 days");
  });

  it("has nothing to say without an instant", () => {
    expect(pendingLabel(null)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The send control
// ══════════════════════════════════════════════════════════════════════════════

describe("the send control", () => {
  it.each(CONNECTABLE)("is offered from %s", (value) => {
    panel(rel(value as RelationshipState));
    expect(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    ).toBeInTheDocument();
  });

  it("says plainly that Weez never clicks inside LinkedIn", () => {
    panel(rel("NOT_CONNECTED"));
    expect(screen.getByText(GTM_CONNECTION_LABELS.sendHint)).toBeInTheDocument();
  });

  it("is not offered beside a pending invitation, which would invite a duplicate", () => {
    panel(rel(PENDING, 1));
    expect(
      screen.queryByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    ).not.toBeInTheDocument();
  });

  it("is not offered beside a confirmed connection", () => {
    panel(rel("CONNECTED", 1));
    expect(
      screen.queryByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    ).not.toBeInTheDocument();
  });

  it("asks the page to record the intent and open LinkedIn", async () => {
    const s = panel(rel("NOT_CONNECTED"));
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    );
    expect(s.onSendRequest).toHaveBeenCalledTimes(1);
    // And it asserts nothing about LinkedIn on the way.
    expect(s.onConfirm).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The return prompt — the load-bearing control of the whole flow
// ══════════════════════════════════════════════════════════════════════════════

describe("the prompt shown on returning from LinkedIn", () => {
  it("asks whether the request was sent, and says why it has to ask", () => {
    panel(rel("NOT_CONNECTED"), { awaitingSendAnswer: true });
    expect(screen.getByText(GTM_CONNECTION_LABELS.askOnReturn)).toBeInTheDocument();
    expect(screen.getByText(GTM_CONNECTION_LABELS.askOnReturnWhy)).toBeInTheDocument();
  });

  it("records CONNECTION_PENDING only when the operator says they sent it", async () => {
    const s = panel(rel("NOT_CONNECTED"), { awaitingSendAnswer: true });
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.didSend, "i") }),
    );
    expect(s.onConfirm).toHaveBeenCalledTimes(1);
    expect(s.onConfirm).toHaveBeenCalledWith(PENDING);
  });

  it("writes nothing at all when the operator says they did not send it", async () => {
    // The whole flow turns on this. "No" has to be a real answer that costs nothing,
    // or the prompt is manufacturing its own result and an operator who closed the
    // tab is recorded as having sent an invitation nobody sent.
    const s = panel(rel("NOT_CONNECTED"), { awaitingSendAnswer: true });
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.didNotSend, "i") }),
    );
    expect(s.onDismissPrompt).toHaveBeenCalledTimes(1);
    expect(s.onConfirm).not.toHaveBeenCalled();
  });

  it("hides the send control while the question is open, so there is one thing to answer", () => {
    panel(rel("NOT_CONNECTED"), { awaitingSendAnswer: true });
    expect(
      screen.queryByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    ).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The periodic status check
// ══════════════════════════════════════════════════════════════════════════════

describe("the status check", () => {
  it("stays quiet while the invitation is too fresh to have news", () => {
    panel(rel(PENDING, NUDGE_AFTER_DAYS - 1));
    expect(screen.queryByText(GTM_CONNECTION_LABELS.checkStatus)).not.toBeInTheDocument();
  });

  it("appears once the wait is long enough, and says why we cannot just look", () => {
    panel(rel(PENDING, NUDGE_AFTER_DAYS));
    expect(screen.getByText(GTM_CONNECTION_LABELS.checkStatus)).toBeInTheDocument();
    expect(screen.getByText(GTM_CONNECTION_LABELS.checkStatusWhy)).toBeInTheDocument();
  });

  it("records CONNECTED when the operator confirms an acceptance", async () => {
    const s = panel(rel(PENDING, NUDGE_AFTER_DAYS));
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.accepted, "i") }),
    );
    expect(s.onConfirm).toHaveBeenCalledWith("CONNECTED");
  });

  it("records REJECTED when the operator says it was declined", async () => {
    // A decline is invisible on every surface we can read, so the operator is its only
    // possible witness — which is why the reconciler gates REJECTED to
    // HUMAN_CONFIRMATION alone and why this control has to exist.
    const s = panel(rel(PENDING, NUDGE_AFTER_DAYS));
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.declined, "i") }),
    );
    expect(s.onConfirm).toHaveBeenCalledWith("REJECTED");
  });

  it("writes nothing when the answer is still awaiting", async () => {
    // Nothing was observed, so there is nothing to assert. Re-stamping the state would
    // refresh the instant the age is measured from and reset the very wait being
    // reported on.
    const s = panel(rel(PENDING, NUDGE_AFTER_DAYS));
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.stillAwaiting, "i") }),
    );
    expect(s.onStillAwaiting).toHaveBeenCalledTimes(1);
    expect(s.onConfirm).not.toHaveBeenCalled();
  });

  it("suggests closing it out only once the wait has gone on long enough", () => {
    panel(rel(PENDING, DECIDE_AFTER_DAYS - 1));
    expect(screen.queryByText(GTM_CONNECTION_LABELS.pendingLongEnough)).not.toBeInTheDocument();

    render(<ConnectionPanel relationship={rel(PENDING, DECIDE_AFTER_DAYS)} {...spies()} />);
    expect(screen.getByText(GTM_CONNECTION_LABELS.pendingLongEnough)).toBeInTheDocument();
  });

  it("is not offered for a connection that is not pending", () => {
    panel(rel("CONNECTED", 30));
    expect(screen.queryByText(GTM_CONNECTION_LABELS.checkStatus)).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// How the fact itself is rendered
// ══════════════════════════════════════════════════════════════════════════════

describe("the rendered state", () => {
  it("reads as a sentence rather than as an enum member", () => {
    panel(rel(PENDING, 2));
    expect(screen.getByText(STATE_LABEL.CONNECTION_PENDING)).toBeInTheDocument();
    expect(screen.queryByText("CONNECTION_PENDING")).not.toBeInTheDocument();
  });

  it("is labelled with the dimension's own name", () => {
    panel(rel("CONNECTED", 1));
    expect(
      screen.getByText(DIMENSION_LABEL.relationship_state, { exact: false }),
    ).toBeInTheDocument();
  });

  it("shows the age of a pending invitation", () => {
    panel(rel(PENDING, 4));
    expect(screen.getByText(/4 days/)).toBeInTheDocument();
  });

  it("shows no age at all when no instant was recorded", () => {
    // Not "0 days", not "today". The absence of a timestamp is not a duration.
    panel(rel(PENDING, null));
    expect(screen.queryByText(/pending for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(GTM_CONNECTION_LABELS.pendingForToday)).not.toBeInTheDocument();
  });

  it("exposes the state and the age as data attributes for the page to scope on", () => {
    const { container } = render(
      <ConnectionPanel relationship={rel(PENDING, 6)} {...spies()} />,
    );
    const block = container.querySelector('[data-gtm-block="connection"]');
    expect(block).not.toBeNull();
    expect(block).toHaveAttribute("data-relationship-state", PENDING);
    expect(block).toHaveAttribute("data-days-pending", "6");
  });

  it("announces what the last control did in its own polite region", () => {
    panel(rel(PENDING, 1), { notice: GTM_CONNECTION_LABELS.recordedPending });
    const live = screen.getByText(GTM_CONNECTION_LABELS.recordedPending);
    expect(live).toHaveAttribute("aria-live", "polite");
    // And not a second `role="status"`: the page owns exactly one.
    expect(live).not.toHaveAttribute("role", "status");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Accessibility
// ══════════════════════════════════════════════════════════════════════════════

describe("accessibility", () => {
  it("is clean under axe with every control on screen", async () => {
    const { container } = render(
      <ConnectionPanel
        relationship={rel(PENDING, DECIDE_AFTER_DAYS)}
        notice={GTM_CONNECTION_LABELS.recordedPending}
        {...spies()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean under axe while the return question is open", async () => {
    const { container } = render(
      <ConnectionPanel relationship={rel("NOT_CONNECTED")} awaitingSendAnswer {...spies()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("puts every control on the tab order", async () => {
    const { container } = render(
      <ConnectionPanel relationship={rel(PENDING, DECIDE_AFTER_DAYS)} {...spies()} />,
    );
    const buttons = within(container).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      // eslint-disable-next-line no-await-in-loop
      await userEvent.tab();
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Behind the "Relationship & connection" disclosure (R20.8, §15.3)
// ══════════════════════════════════════════════════════════════════════════════
//
// The one claim in this file that is not a function of the panel's props: on the folded
// dossier, `ConnectionPanel` exists only once the operator opens
// `PROSPECT_INTELLIGENCE_SECTIONS.relationship`. Before that the section is a collapsed
// `<details>` whose `children` has never been called, so the panel is not hidden — it has
// not been built, and none of the five controls above is anywhere on the page.
//
// That distinction is the whole reason the section takes a function. `<details>` already
// hides its contents; what the function buys is that nothing inside runs. This panel is
// one of the three "free" sections that read nothing on open, so the saving here is not a
// request — it is that a surface which collects the account-relative connection fact does
// not appear until somebody asks the question it answers.
//
// The page is mounted through the real transport, with only Eva's workspace read mocked,
// because its wire format is `evaAPI`'s business rather than this file's. The dossier's
// disclosure inventory renders only while `isIntelligenceActive(stage)` — `WAITING`,
// `ACTIVE`, `RECOMMENDED` — so the fixture serves a `li_gtm_profiles` row. An `ENRICHED`
// dossier has no `<details>` at all, which is the last case below rather than a trap.
//
// Every query is scoped to the run's own `container`: RTL binds `screen` *and* the queries
// on `render`'s return value to `document.body`, so "the panel is nowhere on the page" has
// to be read off this mount and not off whatever the file has mounted before it.

describe("on the dossier, behind the relationship disclosure", () => {
  /** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
  const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  /** Eva's document id, and the `sales_leads.id` enrichment promoted it to. */
  const EVA_LEAD = "lead_ada7f1";
  const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
  const PERSON = "Ada Lovelace";
  const COMPANY = "Analytical Engines";
  const LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
  const ISO = "2024-05-01T12:00:00.000Z";

  /** The relationship value the fixture serves: one of `CONNECTABLE`'s two. */
  const SERVED_RELATIONSHIP: RelationshipState = "NOT_CONNECTED";

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
        emailsFound: leads.length,
        handedToMax: 0,
        byTier: { low: 0, medium: 1, high: 0 },
        bySignalType: {},
      },
      // Discovery has landed, so the page arms no silent re-read behind these mounts.
      sweepState: "complete",
      isDemo: false,
    };
  }

  // ─── The wire, as `schemas/gtm.py` serialises it ────────────────────────────

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

  /**
   * `ProspectOut`, activated or not.
   *
   * `profile_id` is the activation flag — the `li_gtm_profiles` row — and it is what
   * decides whether the disclosure inventory is on screen at all.
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
        relationship_state: wireFact(SERVED_RELATIONSHIP),
        conversation_state: wireFact("WARMUP_READY"),
        confirmation_status: "NOT_APPLICABLE",
        display_summary: "Not connected · warm-up ready",
        display_summary_is_derived: true,
      },
      updated_at: ISO,
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

  let fetchMock: ReturnType<typeof vi.fn>;

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  /**
   * Every route the dossier can reach.
   *
   * Ordered longest-first: `/prospect/{id}/state/history` contains `/state`, and the bare
   * detail read has to come last or it would answer for all of them.
   */
  function serve(activated: boolean) {
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
      if (url.includes("/debug")) return ok({ lead_id: GTM_LEAD, learning_updates: [] });
      if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail(activated));
      return ok({});
    });
  }

  // ─── Harness ────────────────────────────────────────────────────────────────

  /** The dossier's own root, so nothing on the rest of the page answers for it. */
  const DOSSIER = 'section[aria-label="Prospect dossier"]';
  /** Band 3's marker, which carries the stage. */
  const STAGE = "[data-gtm-stage]";
  /** The panel's own block attribute, exported by the module it belongs to. */
  const BLOCK = `[data-gtm-block="${CONNECTION_SECTION}"]`;

  const stageOf = (root: ParentNode) =>
    root.querySelector(STAGE)?.getAttribute("data-gtm-stage") ?? null;

  /**
   * The `<summary>` of one disclosure, found by the section's own label.
   *
   * The label is a `<span>` inside the summary beside its note, so an equality on the
   * span's text is what picks the section rather than a substring of the whole summary —
   * the same reach `ProspectDossier.compose.test.tsx` uses.
   */
  function disclosure(root: ParentNode, summary: string): HTMLElement {
    const match = Array.from(root.querySelectorAll("summary")).find((element) =>
      Array.from(element.querySelectorAll("span")).some(
        (span) => (span.textContent ?? "").trim() === summary,
      ),
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
      </MemoryRouter>,
    );
  }

  /**
   * The loaded dossier, waited on the *stage* rather than on the marker carrying it.
   *
   * Band 3 renders from the first paint — a prospect whose read is still in flight reads
   * as `ENRICHED`, which is a real answer and not a placeholder — so waiting for the
   * element alone would let a case read the page before its payload landed. `WAITING` is
   * reachable only once the profile row is on the payload, which is what makes the wait
   * mean "the served detail is on screen".
   */
  async function openDossier(activated: boolean) {
    serve(activated);
    const { container } = renderPage();
    await waitFor(() => expect(stageOf(container)).toBe(activated ? "WAITING" : "ENRICHED"));
    return {
      container,
      dossier: container.querySelector(DOSSIER) as HTMLElement,
      user: userEvent.setup(),
    };
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

  // The instrument. A case that could not find the section would report an absence that
  // has nothing to do with whether the panel mounts.
  it("puts the relationship section on the dossier, collapsed, with every section closed", async () => {
    const { dossier } = await openDossier(true);

    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.relationship);
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    // The section says what is behind it before anything is opened, which is what makes
    // the disclosure a question rather than a mystery.
    expect(summary.textContent).toContain(PROSPECT_INTELLIGENCE_SECTIONS.relationshipNote);
    // And the whole inventory arrives closed: nothing in it is opened on the operator's
    // behalf, so the claim below is about all seven and not just this one.
    Array.from(dossier.querySelectorAll("details")).forEach((section) =>
      expect((section as HTMLDetailsElement).open).toBe(false),
    );
  });

  it("does not mount the panel while the section is closed", async () => {
    const { container, dossier } = await openDossier(true);

    // Not "hidden" — absent. `IntelligenceSection`'s `children` is a function and a
    // collapsed `<details>` never calls it, so there is no panel in the tree to hide.
    expect(container.querySelector(BLOCK)).toBeNull();

    // Stated a second way, through the panel's own surface: none of the five controls
    // and none of its copy is anywhere on this dossier. A future edit that rendered the
    // panel collapsed-but-present would pass the attribute check only if it also dropped
    // the attribute, and would still fail here.
    [
      GTM_CONNECTION_LABELS.send,
      GTM_CONNECTION_LABELS.accepted,
      GTM_CONNECTION_LABELS.declined,
      GTM_CONNECTION_LABELS.stillAwaiting,
      GTM_CONNECTION_LABELS.didSend,
      GTM_CONNECTION_LABELS.didNotSend,
    ].forEach((label) =>
      expect(
        within(dossier).queryByRole("button", { name: new RegExp(label, "i") }),
        `${label} was on the dossier with the relationship section closed`,
      ).toBeNull(),
    );
    [
      GTM_CONNECTION_LABELS.sendHint,
      GTM_CONNECTION_LABELS.askOnReturn,
      GTM_CONNECTION_LABELS.checkStatusWhy,
    ].forEach((sentence) => expect(within(dossier).queryByText(sentence)).toBeNull());

    // Deliberately *not* asserted through `DIMENSION_LABEL.relationship_state`: that label
    // belongs to `StateDimensionGrid`, which renders the same dimension in the always-open
    // grid above the inventory on every activated dossier. Its presence is what says the
    // dossier loaded, and the absences above are about this panel.
    expect(
      within(dossier).getAllByText(DIMENSION_LABEL.relationship_state, { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("mounts the panel, inside that section, once it is opened", async () => {
    const { container, dossier, user } = await openDossier(true);
    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.relationship);

    await user.click(summary);

    const block = await waitFor(() => {
      const found = container.querySelector(BLOCK);
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    // Inside *that* disclosure, not merely somewhere on the page: the panel is the
    // section's content, so a copy rendered elsewhere would be a second surface
    // collecting the same fact.
    expect(summary.closest("details")).toContainElement(block);

    // Fed from the payload the selection already holds, and reading as a sentence rather
    // than as the enum member the server sent.
    expect(block).toHaveAttribute("data-relationship-state", SERVED_RELATIONSHIP);
    expect(within(block).getByText(STATE_LABEL[SERVED_RELATIONSHIP]!)).toBeInTheDocument();
    expect(within(block).queryByText(SERVED_RELATIONSHIP)).toBeNull();

    // And the control the served state admits: `NOT_CONNECTED` is one of `CONNECTABLE`'s
    // two values, so this is where the rep is offered the connection request.
    expect(
      within(block).getByRole("button", { name: new RegExp(GTM_CONNECTION_LABELS.send, "i") }),
    ).toBeInTheDocument();
  });

  it("keeps the panel built after the section is closed again, so re-opening costs nothing", async () => {
    // The section latches on first open rather than tracking `open`. Documented here
    // because it is the behaviour, and because the alternative reading — that closing
    // unmounts — would be a claim this file could otherwise be read as making: closing a
    // section must not throw away work the operator already asked for.
    const { container, dossier, user } = await openDossier(true);
    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.relationship);
    const details = summary.closest("details") as HTMLDetailsElement;

    await user.click(summary);
    await waitFor(() => expect(container.querySelector(BLOCK)).not.toBeNull());

    await user.click(summary);

    expect(details.open).toBe(false);
    expect(container.querySelector(BLOCK)).not.toBeNull();
  });

  it("cannot be reached on an enriched dossier, which has no inventory at all", async () => {
    // The disclosure inventory renders only while `isIntelligenceActive(stage)`. Before
    // activation there is no belief to argue from, so there is no section to open and no
    // connection surface — and a case that expected one here would be measuring the
    // fixture rather than the page.
    const { container, dossier } = await openDossier(false);

    expect(container.querySelector(BLOCK)).toBeNull();
    expect(dossier.querySelectorAll("details")).toHaveLength(0);
    expect(
      within(dossier).queryByText(PROSPECT_INTELLIGENCE_SECTIONS.relationship),
    ).toBeNull();
    // The dossier is still a dossier: the prospect is named, which is what says the
    // absence above is the composition and not a failed read. `getAllByText`, because the
    // decision the enriched dossier is showing names the person in its own copy as well as
    // in band 2's heading.
    expect(within(dossier).getAllByText(PERSON).length).toBeGreaterThan(0);
  });
});
