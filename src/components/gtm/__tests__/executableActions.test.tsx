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

// 4. **Property 40 — an unaffordable or blocked control does not execute and says why.**
//    The two example groups above read one payload at a time; R17.5 and R17.8 are universal
//    statements over (balance, price) pairs and over every unavailability reason the backend
//    can send, so they are asserted as a property at the end of this file.
//
//    Property 41 — what happens when the *server* refuses a press with a `402` — belongs to
//    `insufficientCredits.test.tsx` and is not restated here. Property 40 is about the state
//    before the press: whether the control should be pressable at all, and what stands in its
//    place when it should not.

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import fc from "fast-check";

import gtmAPI, {
  type CandidateAction,
  type CandidateActionType,
  type CreditBalance,
  type CreditReason,
  type ProspectContact,
  type UnexecutableReason,
} from "@/services/gtmAPI";
import { CreditsProvider, useCredits } from "@/hooks/useCredits";
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
import {
  NextBestActionCard,
  NEXT_BEST_ACTION_CARD_LABELS,
} from "../NextBestActionCard";
import { ProspectDecision } from "../ProspectDecision";
import { GTM_NBA_ACTION_LABELS, PROSPECT_DECISION_LABELS } from "../labels";

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

// ══════════════════════════════════════════════════════════════════════════════
// 4. Property 40: An unaffordable or blocked control does not execute and says why
// ══════════════════════════════════════════════════════════════════════════════
//
//   *For any* balance and price pair, the control executes if and only if the balance is
//   known and at least the price, and the shortfall is presented otherwise (R17.5); and
//   *for any* backend-supplied unavailability reason, that reason is rendered where the
//   control would be (R17.8).
//
// ─── The reference rule, and why "unknown" is not "you cannot afford it" ───────
//
// Design §11 states the check as `balance !== null && balance < price`, and the `null` half
// carries real weight. An unread balance blocks nothing: the workspace may well have the
// credits, the client simply has not asked, and a client that refused a control on that
// basis would stop a rep who could afford the action. The same argument applies to an
// unread *price* — nothing to compare against is not a shortfall. So the rule generated
// against below is
//
//     blocked  ⇔  balance is known ∧ price is known ∧ balance < price
//
// and every other combination has to leave the control pressable.
//
// ─── The subjects ─────────────────────────────────────────────────────────────
//
// Both clauses are read against the components that actually render priced and blocked
// controls, mounted on their own rather than through a page:
//
//   R17.5   `ProspectDecision`, which carries the two priced controls a rep chooses
//           between — Contact Directly (`CONTACT`) and Activate Intelligence (`ACTIVATE`) —
//           wired the way §11 prescribes: `priceOf(credits, REASON)` from the workspace
//           read, never a literal. The balance reaches the surface through
//           `CreditsProvider`, which is the one place it lives.
//   R17.8   `ActionCard` and `NextBestActionCard`, the two cards that carry
//           `unexecutableReason`. "Where the control would be" is read literally: the same
//           action is rendered twice, once executable and once not, and the reason has to
//           land at the DOM address the control occupied.
//
// ─── Every query is scoped, and every run cleans up after itself ──────────────
//
// RTL binds `screen` and the queries on `render`'s return value to `document.body`, not to
// `container`, so a mount that outlived its run would answer every later query in the file.
// Every read below goes through the run's own `container`, and `cleanup()` runs in a
// `finally` at the end of each run — including the failing one, which fast-check re-enters
// while it shrinks.

/** A real workspace id for the provider. `brandId` is an override, so any id would do. */
const WORKSPACE = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/** What a `CreditPriceTag` reads for a price the server listed. The reference, stated once. */
function priceTagText(credits: number): string {
  return credits === 0 ? CREDIT_LABELS.free : `${credits} ${CREDIT_LABELS.unit(credits)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRICED_CONTROLS = [
  {
    reason: "CONTACT" as CreditReason,
    label: PROSPECT_DECISION_LABELS.contact.label,
  },
  {
    reason: "ACTIVATE" as CreditReason,
    label: PROSPECT_DECISION_LABELS.activate.label,
  },
] as const;

/**
 * The decision surface, with both prices read off the workspace payload and nothing else.
 *
 * `data-credits-read` is the run's own settling marker: the provider's read lands in a later
 * commit than the mount, and an assertion taken before it would read an unread surface and
 * call it a priced one.
 */
function DecisionSurface({
  onContact,
  onActivate,
}: {
  onContact: () => void;
  onActivate: () => void;
}) {
  const { credits } = useCredits();
  return (
    <div data-testid="decision-surface" data-credits-read={credits === null ? "no" : "yes"}>
      <ProspectDecision
        onContactDirectly={onContact}
        contactPrice={priceOf(credits, "CONTACT")}
        onActivate={onActivate}
        activatePrice={priceOf(credits, "ACTIVATE")}
      />
    </div>
  );
}

/** The whole surface as one normalised string, for a counterexample message. */
function surfaceText(root: HTMLElement): string {
  return (root.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Does the surface state the shortfall?
 *
 * A shortfall is the gap between what the workspace holds and what the control costs, so
 * stating it needs a figure the price tag alone does not carry: the deficit, or the balance
 * beside the price. The price tags are removed before the figures are collected — a tag says
 * what the action costs, which is equally true when it can be afforded, and counting it
 * would let every priced control claim to have explained a gap it never mentioned.
 */
function statesShortfall(
  root: HTMLElement,
  balance: number,
  price: number,
  tagged: readonly (number | null)[]
): boolean {
  let text = surfaceText(root);
  tagged.forEach((listed) => {
    if (listed !== null) text = text.split(priceTagText(listed)).join(" ");
  });
  const figures = new Set(text.match(/\d+/g) ?? []);
  return (
    figures.has(String(price - balance)) ||
    (figures.has(String(balance)) && figures.has(String(price)))
  );
}

const affordabilityArb = fc.record({
  /** `false` — the workspace read failed, so the balance is unread and blocks nothing. */
  read: fc.boolean(),
  balance: fc.integer({ min: 0, max: 9 }),
  /** `null` — the server did not price this action, so there is nothing to compare. */
  contact: fc.option(fc.integer({ min: 0, max: 9 }), { nil: null }),
  activate: fc.option(fc.integer({ min: 0, max: 9 }), { nil: null }),
});

const UNEXECUTABLE_REASONS = Object.keys(UNEXECUTABLE_REASON_LABELS) as UnexecutableReason[];
const CANDIDATE_TYPES = Object.keys(GTM_NBA_ACTION_LABELS) as CandidateActionType[];

const blockedArb = fc.record({
  actionType: fc.constantFrom(...CANDIDATE_TYPES),
  reason: fc.constantFrom(...UNEXECUTABLE_REASONS),
  /**
   * A blocked action may still carry its verb — the mapping is permanent, the channel
   * adapter is not — and `executable` is the only field a control may read. Generated on
   * both sides so a card that lit up from the verb is caught.
   */
  verb: fc.option(fc.constantFrom("SEND_MESSAGE" as const, "CONNECT" as const), { nil: null }),
});

/** The node's address inside `root`, as its chain of child indices. */
function slotPath(root: Element, node: Element): number[] {
  const path: number[] = [];
  let current: Element | null = node;
  while (current !== null && current !== root) {
    const parent: Element | null = current.parentElement;
    if (parent === null) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, current));
    current = parent;
  }
  return path;
}

describe("Feature: sales-workflow-frontend-restructure, Property 40: An unaffordable or blocked control does not execute and says why", () => {
  // ── R17.5 ───────────────────────────────────────────────────────────────────

  it("puts both priced controls on the decision surface, priced from the server's list", async () => {
    // The instrument, checked before anything is generated against it. A property that could
    // not find its controls would pass for reasons that have nothing to do with R17.5.
    vi.spyOn(gtmAPI, "getCredits").mockResolvedValue(
      credits({ balance: 9, prices: [{ action: "CONTACT", credits: 1 }, { action: "ACTIVATE", credits: 2 }] })
    );
    const { container } = render(
      <MemoryRouter>
        <CreditsProvider brandId={WORKSPACE}>
          <DecisionSurface onContact={() => {}} onActivate={() => {}} />
        </CreditsProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(within(container).getByTestId("decision-surface").dataset.creditsRead).toBe("yes")
    );
    PRICED_CONTROLS.forEach((control) =>
      expect(
        within(container).getByRole("button", {
          name: new RegExp(`^${escapeRegExp(control.label)}`),
        })
      ).toBeInTheDocument()
    );
  });

  it(
    "executes a priced control only when a known balance covers the server's price, and states the shortfall otherwise",
    { timeout: 60_000 },
    async () => {
      let served: CreditBalance | Error = new Error("not configured");
      let reads = 0;
      vi.spyOn(gtmAPI, "getCredits").mockImplementation(async () => {
        reads += 1;
        if (served instanceof Error) throw served;
        return served;
      });

      await fc.assert(
        fc.asyncProperty(affordabilityArb, async (wire) => {
          const payload = credits({
            balance: wire.balance,
            prices: [
              ...(wire.contact === null
                ? []
                : [{ action: "CONTACT" as CreditReason, credits: wire.contact }]),
              ...(wire.activate === null
                ? []
                : [{ action: "ACTIVATE" as CreditReason, credits: wire.activate }]),
            ],
          });
          served = wire.read ? payload : new Error("the balance could not be read");
          const balance = wire.read ? wire.balance : null;
          const before = reads;

          const pressed: CreditReason[] = [];
          const user = userEvent.setup();
          const { container } = render(
            <MemoryRouter>
              <CreditsProvider brandId={WORKSPACE}>
                <DecisionSurface
                  onContact={() => pressed.push("CONTACT")}
                  onActivate={() => pressed.push("ACTIVATE")}
                />
              </CreditsProvider>
            </MemoryRouter>
          );

          try {
            await waitFor(() => {
              expect(reads).toBeGreaterThan(before);
              expect(
                within(container).getByTestId("decision-surface").dataset.creditsRead
              ).toBe(wire.read ? "yes" : "no");
            });

            for (const control of PRICED_CONTROLS) {
              const price = wire.read ? priceOf(payload, control.reason) : null;
              // The rule, restated from §11 rather than read off the component.
              const blocked = balance !== null && price !== null && balance < price;
              const button = within(container).queryByRole("button", {
                name: new RegExp(`^${escapeRegExp(control.label)}`),
              });

              if (!blocked) {
                expect(
                  button,
                  `${control.label}: no control for an action the workspace can afford (balance=${balance}, price=${price})`
                ).not.toBeNull();
                await user.click(button!);
                expect(
                  pressed,
                  `${control.label}: an affordable control did not execute (balance=${balance}, price=${price})`
                ).toContain(control.reason);
                continue;
              }

              // ── Non-executing ──
              // Pressed on purpose. "Non-executing" is a claim about what a press does, and
              // a control that is present, enabled and wired to its handler satisfies no
              // reading of R17.5 however it is styled.
              if (button !== null) await user.click(button);
              expect(
                pressed,
                `${control.label}: the workspace holds ${balance} and the server prices this at ${price}, and the control executed anyway`
              ).not.toContain(control.reason);

              // ── And says why ──
              expect(
                statesShortfall(container, balance!, price!, [wire.contact, wire.activate]),
                `${control.label}: ${price! - balance!} credit(s) short — the workspace holds ${balance}, the server prices this at ${price} — and no shortfall was stated. surface=${JSON.stringify(
                  surfaceText(container)
                )}`
              ).toBe(true);
            }
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
    }
  );

  // ── R17.8 ───────────────────────────────────────────────────────────────────

  it(
    "renders the backend's own unavailability reason where the control would be",
    { timeout: 60_000 },
    async () => {
      harness();

      await fc.assert(
        fc.property(blockedArb, (wire) => {
          const blocked = candidate({
            actionType: wire.actionType,
            executionVerb: wire.verb,
            executable: false,
            unexecutableReason: wire.reason,
          });
          // The same recommendation the outreach layer *can* carry out, used only to find
          // the address the control occupies.
          const executable = candidate({
            actionType: wire.actionType,
            executionVerb: "SEND_MESSAGE",
            executable: true,
            unexecutableReason: null,
          });

          const sentence = UNEXECUTABLE_REASON_LABELS[wire.reason];
          const title = GTM_NBA_ACTION_LABELS[wire.actionType] ?? wire.actionType;

          const subjects = [
            {
              name: "ActionCard",
              control: title,
              node: (action: CandidateAction) => (
                <ActionCard brandId={BRAND} leadId={LEAD} action={action} />
              ),
            },
            {
              name: "NextBestActionCard",
              control: NEXT_BEST_ACTION_CARD_LABELS.takeAction,
              node: (action: CandidateAction) => (
                <NextBestActionCard action={action} onTakeAction={() => {}} />
              ),
            },
          ] as const;

          subjects.forEach((subject) => {
            // Where the control sits when the server says the action can be carried out.
            const live = render(subject.node(executable));
            let controlPath: number[] = [];
            try {
              const button = within(live.container).getByRole("button", {
                name: new RegExp(`^${escapeRegExp(subject.control)}`),
              });
              controlPath = slotPath(live.container, button);
            } finally {
              cleanup();
            }

            const { container } = render(subject.node(blocked));
            try {
              // No control, whatever the verb says. Reading the verb instead of
              // `executable` is exactly the bug this closes off.
              expect(
                within(container).queryByRole("button", {
                  name: new RegExp(`^${escapeRegExp(title)}`),
                }),
                `${subject.name}/${wire.actionType}: an open-channel control for an action the server marked unexecutable`
              ).toBeNull();

              // The backend's own sentence, rendered.
              const stated = within(container).getByText(sentence);
              expect(
                stated,
                `${subject.name}/${wire.actionType}: the reason ${wire.reason} was not stated`
              ).toBeInTheDocument();

              // And in the control's place, not tucked somewhere else on the card. Silence
              // in this slot reads as a broken recommendation; a sentence three sections
              // away is not an answer to "why can I not act on this".
              expect(
                slotPath(container, stated),
                `${subject.name}/${wire.actionType}: the reason did not land where the control would be`
              ).toEqual(controlPath);
            } finally {
              cleanup();
            }
          });
        }),
        { numRuns: 100 }
      );
    }
  );
});
