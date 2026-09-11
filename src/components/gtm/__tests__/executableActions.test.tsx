//
// The three things the backend started telling us, tested for the properties that make
// them honest rather than for their markup.
//
// 1. **The outreach translation.** `ActionCard` used to hold a
//    `Partial<Record<CandidateActionType, ActionType>>` — the backend's domain, restated in
//    a component where nothing tested it. The server now answers per candidate, and the
//    card reads the answer. The property that matters is not "the mapping is right" (the
//    backend's suite owns that) but "the card believes the server": a send control appears
//    exactly when `executable`, posts exactly `executionVerb`, and when it is absent the
//    reason is said out loud instead of the card going quiet.
//
//    The failure this prevents is specific and bad in both directions. Offering the control
//    for `STOP_OUTREACH` records an approach the engine advised against; hiding it for
//    `CONNECT_LINKEDIN` removes the opening move for every cold prospect. A stale
//    client-side table did both, silently, and could not be caught anywhere.
//
// 2. **Credits.** A price tag renders the server's number or nothing at all. Nothing is
//    the honest fallback for an unread price list — a control that looks free and charges
//    two credits is the one outcome worth writing a test to prevent.
//
// 3. **The contact block.** It exists to be readable *before* anything has been observed,
//    and to stay distinguishable from the observed identity. So the tested property is that
//    a plain asserted value and an `ObservedFact` never render as the same kind of claim.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import gtmAPI, {
  type CandidateAction,
  type CandidateActionType,
  type CreditBalance,
  type ProspectContact,
  type UnexecutableReason,
} from "@/services/gtmAPI";
import { ActionCard, UNEXECUTABLE_REASON_LABELS } from "../NextActionPanel";
import {
  CREDIT_LABELS,
  CreditBalanceBadge,
  CreditLedgerPanel,
  CreditPriceTag,
  priceOf,
} from "../CreditBalance";
import { ContactPanel, CONTACT_PANEL_LABELS } from "../ContactPanel";
import { InsufficientCreditsAlert } from "../InsufficientCreditsAlert";
import { GTM_NBA_ACTION_LABELS } from "../labels";

const BRAND = "brand-1";
const LEAD = "11111111-2222-3333-4444-555555555555";
const NOW = "2024-05-01T12:00:00.000Z";

const API_METHODS = Object.keys(gtmAPI) as (keyof typeof gtmAPI)[];

/**
 * A candidate with every field the card reads.
 *
 * `executable` and `executionVerb` are supplied per test rather than defaulted to a
 * working pair: what each test is about is which combination the server sent.
 */
function candidate(overrides: Partial<CandidateAction> = {}): CandidateAction {
  return {
    recommendationId: "rec-1",
    actionType: "CONNECT_LINKEDIN",
    channel: "LINKEDIN",
    executionVerb: "CONNECT",
    executable: true,
    unexecutableReason: null,
    rank: 1,
    isRecommended: true,
    actionScore: {
      score: 72,
      scoreKind: "RECOMMENDATION_SCORE",
      scoreDisclaimer: "Derived from the persisted terms.",
      isDerived: true,
    },
    actionConfidence: 64,
    stateConfidence: 58,
    terms: [],
    unavailableTerms: [],
    availableWeightMass: 80,
    exclusionReason: null,
    explanation: null,
    expiresAt: null,
    computedAt: NOW,
    ...overrides,
  };
}

function credits(overrides: Partial<CreditBalance> = {}): CreditBalance {
  return {
    brandId: BRAND,
    balance: 23,
    prices: [
      { action: "ENRICH", credits: 1 },
      { action: "CONTACT", credits: 1 },
      { action: "ACTIVATE", credits: 2 },
    ],
    history: [],
    ...overrides,
  };
}

/** Spy the whole API surface so nothing reaches the network and every call is visible. */
function harness(overrides: Partial<Record<keyof typeof gtmAPI, unknown>> = {}) {
  const apiCalls: { name: string; args: unknown[] }[] = [];
  API_METHODS.forEach((name) => {
    vi.spyOn(gtmAPI, name).mockImplementation(((...args: unknown[]) => {
      apiCalls.push({ name, args });
      const override = overrides[name];
      if (typeof override === "function") {
        return Promise.resolve((override as (...a: unknown[]) => unknown)(...args));
      }
      if (override !== undefined) return Promise.resolve(override);
      return Promise.resolve(null);
    }) as never);
  });
  vi.spyOn(window, "open").mockImplementation(() => null);
  return { apiCalls, user: userEvent.setup() };
}

function renderCard(props: Partial<React.ComponentProps<typeof ActionCard>> = {}) {
  return render(
    <ActionCard brandId={BRAND} leadId={LEAD} action={candidate()} {...props} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. The outreach translation
// ══════════════════════════════════════════════════════════════════════════════

describe("the card acts on the server's own answer about executability", () => {
  it("offers the open-channel control when the server says the action is executable", () => {
    harness();
    renderCard({ action: candidate({ actionType: "CONNECT_LINKEDIN" }) });

    expect(
      screen.getByRole("button", { name: GTM_NBA_ACTION_LABELS.CONNECT_LINKEDIN })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("gtm-action-unexecutable")).not.toBeInTheDocument();
  });

  it("posts the verb the server named, not one derived from the action type", async () => {
    const { apiCalls, user } = harness({
      requestAction: { actionId: "act-1", destinationUrl: "https://linkedin.test/in/x" },
    });
    renderCard({
      action: candidate({
        actionType: "REQUEST_MEETING",
        executionVerb: "MEETING_REQUEST",
        executable: true,
      }),
      destinationUrl: "https://linkedin.test/in/x",
    });

    await user.click(
      screen.getByRole("button", { name: GTM_NBA_ACTION_LABELS.REQUEST_MEETING })
    );

    await waitFor(() => {
      expect(apiCalls.some((call) => call.name === "requestAction")).toBe(true);
    });
    const requested = apiCalls.find((call) => call.name === "requestAction");
    // Third argument is the input object; the verb on it is the server's.
    const input = requested?.args[2] as { actionType?: string } | undefined;
    expect(input?.actionType).toBe("MEETING_REQUEST");
  });

  it.each<[CandidateActionType, UnexecutableReason]>([
    ["WAIT", "ADVISORY"],
    ["RESEARCH_MORE", "ADVISORY"],
    ["NURTURE", "ADVISORY"],
    ["STOP_OUTREACH", "ADVISORY"],
    ["CALL", "NO_EXECUTION_VERB"],
    ["SEND_EMAIL", "CHANNEL_NOT_IMPLEMENTED"],
  ])(
    "offers no open-channel control for %s and says why (%s)",
    (actionType, reason) => {
      harness();
      renderCard({
        action: candidate({
          actionType,
          executable: false,
          // A channel-not-implemented action still carries its verb — the mapping is
          // permanent, the adapter is not — and the control must still be absent.
          executionVerb: reason === "CHANNEL_NOT_IMPLEMENTED" ? "SEND_MESSAGE" : null,
          unexecutableReason: reason,
        }),
      });

      const label = GTM_NBA_ACTION_LABELS[actionType] ?? actionType;
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      expect(screen.getByTestId("gtm-action-unexecutable")).toHaveTextContent(
        UNEXECUTABLE_REASON_LABELS[reason]
      );
    }
  );

  it("carries a verb but no control when the channel has no adapter yet", () => {
    harness();
    renderCard({
      action: candidate({
        actionType: "SEND_EMAIL",
        channel: "EMAIL",
        executionVerb: "SEND_MESSAGE",
        executable: false,
        unexecutableReason: "CHANNEL_NOT_IMPLEMENTED",
      }),
    });

    // The distinction this asserts: a verb exists, so this is not an undecided mapping —
    // but `executable` is false, so nothing may be opened. Reading the verb instead of
    // `executable` is exactly the bug, and it would light the control up here.
    expect(
      screen.queryByRole("button", { name: GTM_NBA_ACTION_LABELS.SEND_EMAIL })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("gtm-action-unexecutable")).toHaveTextContent(
      UNEXECUTABLE_REASON_LABELS.CHANNEL_NOT_IMPLEMENTED
    );
  });

  it("offers no control when the server answered nothing at all", () => {
    harness();
    // The additive case: a payload from before the translation existed. `executable`
    // normalises to false and there is no reason, so the card offers nothing and claims
    // nothing — which is the safe direction, because the alternative is guessing a verb.
    renderCard({
      action: candidate({
        actionType: "CONNECT_LINKEDIN",
        executionVerb: null,
        executable: false,
        unexecutableReason: null,
      }),
    });

    expect(
      screen.queryByRole("button", { name: GTM_NBA_ACTION_LABELS.CONNECT_LINKEDIN })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("gtm-action-unexecutable")).not.toBeInTheDocument();
  });

  it("has no client-side mapping table left to go stale", async () => {
    // The regression guard on the deletion itself. `NextActionPanel` used to translate the
    // thirteen candidate types onto the three verbs; if such a table comes back, this
    // module has re-acquired a copy of the backend's domain that nothing keeps in step.
    const source = await import("../NextActionPanel?raw").then(
      (mod) => (mod as { default: string }).default
    );
    expect(source).not.toMatch(/REQUEST_ACTION_TYPE/);
    expect(source).toMatch(/action\.executable/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Credits
// ══════════════════════════════════════════════════════════════════════════════

describe("the price tag says the server's number or says nothing", () => {
  it("renders the price when the server gave one", () => {
    render(<CreditPriceTag credits={2} />);
    expect(screen.getByText(/2 credits/)).toBeInTheDocument();
  });

  it("renders singular for one credit", () => {
    render(<CreditPriceTag credits={1} />);
    expect(screen.getByText(/1 credit$/)).toBeInTheDocument();
  });

  it("renders 'Included' for a free action rather than nothing", () => {
    // Message generation is genuinely free because it is part of the Contact Directly
    // credit. Saying so is better than leaving the operator to wonder.
    render(<CreditPriceTag credits={0} />);
    expect(screen.getByText(CREDIT_LABELS.free)).toBeInTheDocument();
  });

  it("renders nothing at all when the price is unknown", () => {
    const { container } = render(<CreditPriceTag credits={null} />);
    // The load-bearing assertion. A control whose price we have not read must not look
    // free: an untagged button is honest, a "free"-looking one that charges is not.
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the balance badge distinguishes unread from zero", () => {
  it("renders the number when it has been read", () => {
    render(<CreditBalanceBadge balance={23} />);
    expect(screen.getByText("23")).toBeInTheDocument();
  });

  it("renders zero as a real answer", () => {
    // Zero is what the server says about a workspace nobody has granted anything to.
    render(<CreditBalanceBadge balance={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders nothing before the balance has been read", () => {
    const { container } = render(<CreditBalanceBadge balance={null} />);
    // Showing 0 here would tell an operator who has credits that they have none.
    expect(container).toBeEmptyDOMElement();
  });
});

describe("priceOf reads the server's list and never guesses", () => {
  it("finds a priced action", () => {
    expect(priceOf(credits(), "ACTIVATE")).toBe(2);
    expect(priceOf(credits(), "CONTACT")).toBe(1);
  });

  it("answers null for an unread balance", () => {
    expect(priceOf(null, "ACTIVATE")).toBeNull();
  });

  it("answers null for a reason the server did not price", () => {
    // Not 0. "The server did not tell us" and "it is free" are different claims, and a
    // zero here would render as "Included" on a control that charges.
    expect(priceOf(credits({ prices: [] }), "ACTIVATE")).toBeNull();
  });
});

describe("the ledger shows a refund beside its debit rather than netting them away", () => {
  it("renders both movements and the balance each left behind", () => {
    render(
      <CreditLedgerPanel
        credits={credits({
          balance: 25,
          history: [
            {
              entryId: "e3",
              entryKind: "REFUND",
              reason: "ENRICH",
              delta: 1,
              balanceAfter: 25,
              leadId: null,
              note: "no enrichment attempt was consumed",
              createdAt: NOW,
            },
            {
              entryId: "e2",
              entryKind: "DEBIT",
              reason: "ENRICH",
              delta: -1,
              balanceAfter: 24,
              leadId: LEAD,
              note: null,
              createdAt: NOW,
            },
          ],
        })}
      />
    );

    // The operator who watched their balance dip and recover can see why. A netted pair
    // would be indistinguishable from a charge that never happened.
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText(/no enrichment attempt was consumed/)).toBeInTheDocument();
  });

  it("says so plainly when there is no activity", () => {
    render(<CreditLedgerPanel credits={credits({ history: [] })} />);
    expect(screen.getByText(CREDIT_LABELS.ledgerEmpty)).toBeInTheDocument();
  });
});

describe("the paywall says what did not happen", () => {
  it("reports the refusal as a no-op and renders the server's numbers", () => {
    render(
      <InsufficientCreditsAlert
        detail="this action costs 2 credit(s) and this workspace has 1"
        balance={1}
      />
    );

    expect(screen.getByText(CREDIT_LABELS.insufficientTitle)).toBeInTheDocument();
    // The important half: the operator is told nothing was charged and nothing was done.
    // Without it they will assume a half-completed action and a bill for it.
    expect(screen.getByText(CREDIT_LABELS.insufficientBody)).toBeInTheDocument();
    expect(
      screen.getByText(/costs 2 credit\(s\) and this workspace has 1/)
    ).toBeInTheDocument();
  });

  it("offers no top-up control when the caller gave nowhere to go", () => {
    render(<InsufficientCreditsAlert detail="nope" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is clean under axe", async () => {
    const { container } = render(
      <InsufficientCreditsAlert detail="nope" balance={0} onTopUp={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. The contact block
// ══════════════════════════════════════════════════════════════════════════════

function contact(overrides: Partial<ProspectContact> = {}): ProspectContact {
  return {
    name: "Karan Chaudhry",
    company: "Sprouts.ai",
    role: "Founder",
    email: "karan@sprouts.ai",
    linkedinUrl: "https://www.linkedin.com/in/karanchaudhry",
    ...overrides,
  };
}

describe("the contact block carries the enrichment without claiming an observation", () => {
  it("renders the email and the LinkedIn address", () => {
    render(<ContactPanel contact={contact()} verificationStatus="VERIFIED" />);
    expect(screen.getByText("karan@sprouts.ai")).toBeInTheDocument();
    expect(screen.getByText(/\/in\/karanchaudhry/)).toBeInTheDocument();
  });

  it("says where the values came from, so they are not read as observations", () => {
    render(<ContactPanel contact={contact()} />);
    expect(screen.getByText(CONTACT_PANEL_LABELS.provenance)).toBeInTheDocument();
  });

  it("labels an unverified LinkedIn address as a candidate", () => {
    // Null verification status is "nobody has tried", which is not NO_MATCH and is not
    // verified. Acting on an unmatched address is how a whole history gets attached to a
    // stranger, so the warning shows for both.
    render(<ContactPanel contact={contact()} verificationStatus={null} />);
    expect(screen.getByText(CONTACT_PANEL_LABELS.candidate)).toBeInTheDocument();
    expect(screen.queryByText(CONTACT_PANEL_LABELS.verified)).not.toBeInTheDocument();
  });

  it("marks a verified address as verified", () => {
    render(<ContactPanel contact={contact()} verificationStatus="VERIFIED" />);
    expect(screen.getByText(CONTACT_PANEL_LABELS.verified)).toBeInTheDocument();
    expect(screen.queryByText(CONTACT_PANEL_LABELS.candidate)).not.toBeInTheDocument();
  });

  it("reports absence as absence when there is no way to reach them", () => {
    render(<ContactPanel contact={null} />);
    expect(screen.getByText(CONTACT_PANEL_LABELS.empty)).toBeInTheDocument();
    // Not a block of dashes and not the word Unknown: `ObservedValue`'s "Unknown" is for a
    // fact nobody has observed, and this is not an observation at all.
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });

  it("omits a field the enrichment did not resolve rather than showing it empty", () => {
    render(<ContactPanel contact={contact({ email: null })} />);
    expect(screen.queryByText(CONTACT_PANEL_LABELS.email)).not.toBeInTheDocument();
    expect(screen.getByText(/\/in\/karanchaudhry/)).toBeInTheDocument();
  });

  it("is clean under axe", async () => {
    const { container } = render(
      <ContactPanel contact={contact()} verificationStatus="VERIFIED" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
