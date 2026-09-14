// components/gtm/__tests__/primitives.test.tsx
//
// The honesty primitives, tested for the properties that make them honest rather
// than for their markup.
//
// Four claims are checked:
//
// 1. **Unknown is unknown.** An `ObservedFact` with no value renders "Unknown" and
//    a screen-reader note, and never falls back to `0`, `false`, a dimension value,
//    or an em dash (R14.2).
// 2. **A known fact carries its provenance.** Surface and observation time are real
//    text beside the value, and `derived` / `stale` markers appear when set
//    (R14.3, R14.5, R2.6).
// 3. **No bare integer.** `DerivedScore` renders the number, the `derived` marker,
//    and the payload's disclaimer as DOM text — not a tooltip (R1.8, R9.6).
// 4. **Status is never colour alone.** Each confirmation status pairs a text label
//    with a distinct icon, and `UNKNOWN` reads "Couldn't confirm — check LinkedIn"
//    rather than a failure (R5.5, R13.5, R13.6, R18.9).
//
// Plus the label tables' own invariant: nothing in `GTM_ACTION_LABELS`, and nothing in the
// sixteen tables the state engine and the identity gate added, is `Send` or otherwise claims
// Weez sends (R12.2, R27.3). Those two sweeps came here from the retired
// `pages/__tests__/GTMProspect.labels.test.tsx` in task 13.1 — they are statements about the
// tables, with nothing about a page in them, so this is where they belong.
//
// ─── And two properties over the same primitives ───────────────────────────────
//
// The four claims above are examples. Two of the honesty rules are universal statements
// over payloads rather than over cases, so they are asserted as properties here:
//
// **Property 39 — prices and balances come from the server or are absent.** For any credits
// payload, including an unread one and a zero balance, every price tag equals the server's
// listed price for that action, no tag is rendered when the list is unread, and the badge
// renders the server's number including a genuine `0` (R17.2, R17.3, R17.4).
//
// **Property 22 — absence is stated, never zeroed and never blanked.** For any payload
// mixing null fields, genuinely-zero numbers and unknown facts, each null slot holds an
// absence statement, each genuine zero renders `0`, and each unknown renders
// `ObservedValue`'s shared treatment in both its visible text and its accessible name
// (R9.2, R9.3, R9.6, R17.7, R19.4).
//
// Both are mounted per run, so both follow the same two rules the page-level property
// suites follow. RTL binds `screen` and the queries on `render`'s return value to
// `document.body`, not to `container`, so a mount that outlived its run would answer every
// later query in the file: every read below is scoped with `within(container)`, and
// `cleanup()` runs in a `finally` at the end of each run — including the failing one, which
// fast-check re-enters while it shrinks.

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import gtmAPI, {
  type ConfirmationStatus,
  type CreditBalance as CreditBalancePayload,
  type CreditReason,
  type DerivedScore as DerivedScorePayload,
  type ObservedFact,
} from "@/services/gtmAPI";
import { CreditsProvider, useCredits } from "@/hooks/useCredits";
import { ConfirmationStatusBadge } from "../ConfirmationStatusBadge";
import {
  CREDIT_LABELS,
  CreditBalanceBadge,
  CreditPriceTag,
} from "../CreditBalance";
import { DerivedScore } from "../DerivedScore";
import { ObservedValue, UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "../ObservedValue";
import { ACTION_CARD_LABELS } from "../NextActionPanel";
import { ACTION_EXPLANATION_LABELS } from "../ActionExplanation";
import { BUYING_STAGE_PANEL_LABELS } from "../BuyingStagePanel";
import { CHANNEL_PANEL_LABELS } from "../ChannelIntelligencePanel";
import { ENGAGEMENT_TREND_PANEL_LABELS } from "../EngagementTrendPanel";
import { INTENT_PANEL_LABELS } from "../IntentPanel";
import { LEARNING_PANEL_LABELS } from "../LearningInsightsPanel";
import { SIGNAL_LIST_LABELS } from "../SignalList";
import { STATE_HISTORY_LABELS } from "../StateHistoryPanel";
import { TIMING_PANEL_LABELS } from "../TimingPanel";
import {
  CONFIRMATION_LABEL,
  GTM_ACTION_LABELS,
  GTM_ACTION_LABEL_BY_TYPE,
  GTM_EXCLUSION_LABELS,
  GTM_IDENTITY_LABELS,
  GTM_LIFECYCLE_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_TRACKING_STATE_LABELS,
  GTM_VERIFICATION_LABELS,
  STATE_LABEL,
} from "../labels";

const KNOWN: ObservedFact = {
  value: "CONNECTED",
  isUnknown: false,
  sourceSurface: "LINKEDIN_PROFILE_PAGE",
  observedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  isStale: false,
  isDerived: false,
};

const UNKNOWN: ObservedFact = {
  value: null,
  isUnknown: true,
  sourceSurface: null,
  observedAt: null,
  isStale: false,
  isDerived: false,
};

const SCORE: DerivedScorePayload = {
  score: 72,
  scoreKind: "RECOMMENDATION_SCORE",
  scoreDisclaimer: "A prioritisation signal, not a predicted probability of conversion.",
  isDerived: true,
};

/** Render inside a `<dl>` so the default `<dt>`/`<dd>` variant is well-formed. */
function renderFact(fact: ObservedFact, label = "Relationship") {
  return render(
    <dl>
      <ObservedValue label={label} fact={fact} />
    </dl>,
  );
}

describe("ObservedValue", () => {
  it("renders Unknown with a screen-reader note and no substitute value", () => {
    const { container } = renderFact(UNKNOWN);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(container.textContent).toContain("not yet observed");

    // The specific fallbacks the requirement forbids.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain("false");
    expect(text).not.toContain("NOT_CONNECTED");
    expect(text).not.toContain("Not connected");
    expect(text).not.toContain("—");
  });

  it("still reads unknown when the payload contradicts itself", () => {
    // A null value with `isUnknown` false: absence wins.
    renderFact({ ...UNKNOWN, isUnknown: false });
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders a known value with its surface and observation time", () => {
    const { container } = renderFact(KNOWN);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(container.textContent).toContain("LinkedIn profile");
    expect(screen.getByText("3h ago")).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("dateTime", KNOWN.observedAt!);
    expect(screen.queryByText("derived")).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });

  it("marks derived and stale facts", () => {
    renderFact({ ...KNOWN, isDerived: true, isStale: true });
    expect(screen.getByText("derived")).toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();
  });
});

describe("DerivedScore", () => {
  it("renders the score with the derived marker and the payload disclaimer as DOM text", () => {
    render(<DerivedScore score={SCORE} />);

    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("derived")).toBeInTheDocument();
    expect(screen.getByText(SCORE.scoreDisclaimer)).toBeInTheDocument();
    expect(screen.getByText("Recommendation score")).toBeInTheDocument();
  });

  it("associates the disclaimer with the number for assistive technology", () => {
    render(<DerivedScore score={SCORE} />);
    const describedBy = screen.getByText("72").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(SCORE.scoreDisclaimer);
  });

  it("renders Unknown rather than zero when no score was computed", () => {
    render(<DerivedScore score={{ ...SCORE, score: null }} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("ConfirmationStatusBadge", () => {
  const statuses: ConfirmationStatus[] = [
    "NOT_APPLICABLE",
    "WAITING_FOR_CONFIRMATION",
    "CONFIRMED",
    "UNKNOWN",
  ];

  it.each(statuses)("pairs %s with a text label and a hidden icon", (status) => {
    const { container } = render(<ConfirmationStatusBadge status={status} />);

    expect(container.textContent).toContain(CONFIRMATION_LABEL[status]);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("gives each status a distinct icon so colour is not the only signal", () => {
    const classes = statuses.map((status) => {
      const { container } = render(<ConfirmationStatusBadge status={status} />);
      return container.querySelector("svg")?.getAttribute("class") ?? "";
    });
    expect(new Set(classes).size).toBe(statuses.length);
  });

  it("reads the two states the requirement names verbatim", () => {
    render(<ConfirmationStatusBadge status="WAITING_FOR_CONFIRMATION" />);
    expect(screen.getByText("Waiting for confirmation")).toBeInTheDocument();

    render(<ConfirmationStatusBadge status="UNKNOWN" />);
    expect(screen.getByText("Couldn't confirm — check LinkedIn")).toBeInTheDocument();
  });

  it("does not render UNKNOWN as a failure", () => {
    const { container } = render(<ConfirmationStatusBadge status="UNKNOWN" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).not.toContain("rose");
    expect(chip.textContent).not.toContain("Failed");
  });
});

describe("accessibility", () => {
  // The composed surface is swept in `__tests__/a11y.audit.test.tsx`, which runs axe over
  // the dossier in every modelled state; these primitives are checked here so a violation
  // is attributed to the primitive rather than to whichever panel happened to mount it.
  it("is clean on a definition list of known and unknown facts", async () => {
    const { container } = render(
      <dl>
        <ObservedValue label="Relationship" fact={KNOWN} />
        <ObservedValue label="Conversation" fact={UNKNOWN} />
        <ObservedValue label="Activity" fact={{ ...KNOWN, value: "HIGH", isDerived: true, isStale: true }} />
      </dl>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean on a score and every confirmation status", async () => {
    const { container } = render(
      <div>
        <DerivedScore score={SCORE} />
        <DerivedScore score={{ ...SCORE, score: null }} />
        <ConfirmationStatusBadge status="NOT_APPLICABLE" />
        <ConfirmationStatusBadge status="WAITING_FOR_CONFIRMATION" />
        <ConfirmationStatusBadge status="CONFIRMED" />
        <ConfirmationStatusBadge status="UNKNOWN" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("GTM_ACTION_LABELS", () => {
  it("labels no control as sending by Weez", () => {
    Object.values(GTM_ACTION_LABELS).forEach((label) => expect(label).not.toBe("Send"));
  });

  it("carries the LinkedIn message label the requirement names", () => {
    expect(Object.values(GTM_ACTION_LABELS)).toContain("Open LinkedIn & Send");
    expect(GTM_ACTION_LABEL_BY_TYPE.SEND_MESSAGE).toBe("Open LinkedIn & Send");
  });

  it("keeps the by-type projection inside the single table", () => {
    Object.values(GTM_ACTION_LABEL_BY_TYPE).forEach((label) =>
      expect(Object.values(GTM_ACTION_LABELS)).toContain(label),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The rest of the label tables, swept for the same claim (R12.2, R27.3)
// ══════════════════════════════════════════════════════════════════════════════
//
// These two cases arrived here from `pages/__tests__/GTMProspect.labels.test.tsx`, which
// task 13.1 retired: they were the only clauses in that suite with nothing about the page
// in them. Both are statements about the exported label tables themselves, so they belong
// beside the `GTM_ACTION_LABELS` sweep above rather than on any surface — and leaving them
// on a page suite is what let one table's strings go unscanned for as long as they did.
//
// `GTM_ACTION_LABELS` is swept above; the sixteen tables below are the ones the state
// engine and the identity gate added. Walked with `Object.entries` rather than key by key,
// so a string added to any of them next month is covered without anybody remembering this
// file exists. That is the reason the strings live in exported objects at all.

/**
 * The exact string R12.2 forbids.
 *
 * Equality and not a substring match, as the requirement is written: `Open LinkedIn & Send`
 * contains the word and is the label R12.1 *mandates*. What is banned is a control that
 * claims Weez sends.
 */
const FORBIDDEN_LABEL = "Send";

/**
 * The claims a label is not allowed to make.
 *
 * Every pattern is about *who acts*, which is the only thing R27.3 is about: a bare `Send`
 * imperative, an imperative Weez appears to be carrying out itself, and any first-person
 * claim about sending. `Open LinkedIn & Send a warm-up` matches none of them and is the
 * form the requirement mandates — the conjunction names the tab Weez opens and leaves the
 * sending with the operator.
 */
const SENDING_CLAIM_PATTERNS: readonly [string, RegExp][] = [
  ["a bare send imperative", /^sending\b/i],
  ["an imperative with no channel to open", /^send\b/i],
  ["a first-person claim about sending", /\b(we|weez|i)\s+(send|sends|sent|will send|have sent)\b/i],
  ["a claim the message went out", /\b(message|it)\s+(was|has been)\s+sent\b/i],
  ["an automation claim", /\b(automatically|on your behalf)\s+(send|sent|sends)\b/i],
];

/**
 * The sixteen tables beyond `GTM_ACTION_LABELS`.
 *
 * The identity gate's three join the walk rather than getting a sweep of their own.
 * `GTM_IDENTITY_LABELS` carries two control labels, so it is exactly the kind of table
 * R12.2 is about, and the other two are the copy those controls sit beside: a verdict
 * sentence or a tracking state that implied Weez had sent something would be the same
 * violation one step removed.
 */
const SWEPT_LABEL_TABLES: readonly [string, Record<string, unknown>][] = [
  ["ACTION_CARD_LABELS", ACTION_CARD_LABELS],
  ["INTENT_PANEL_LABELS", INTENT_PANEL_LABELS],
  ["CHANNEL_PANEL_LABELS", CHANNEL_PANEL_LABELS],
  ["SIGNAL_LIST_LABELS", SIGNAL_LIST_LABELS],
  ["STATE_HISTORY_LABELS", STATE_HISTORY_LABELS],
  ["LEARNING_PANEL_LABELS", LEARNING_PANEL_LABELS],
  ["ACTION_EXPLANATION_LABELS", ACTION_EXPLANATION_LABELS],
  ["BUYING_STAGE_PANEL_LABELS", BUYING_STAGE_PANEL_LABELS],
  ["TIMING_PANEL_LABELS", TIMING_PANEL_LABELS],
  ["ENGAGEMENT_TREND_PANEL_LABELS", ENGAGEMENT_TREND_PANEL_LABELS],
  ["GTM_NBA_ACTION_LABELS", GTM_NBA_ACTION_LABELS],
  ["GTM_LIFECYCLE_LABELS", GTM_LIFECYCLE_LABELS],
  ["GTM_EXCLUSION_LABELS", GTM_EXCLUSION_LABELS],
  ["GTM_VERIFICATION_LABELS", GTM_VERIFICATION_LABELS],
  ["GTM_TRACKING_STATE_LABELS", GTM_TRACKING_STATE_LABELS],
  ["GTM_IDENTITY_LABELS", GTM_IDENTITY_LABELS],
];

/** Every string in a table, flattened, since some of them nest a `fields` object. */
function stringsIn(table: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(table).flatMap(([key, value]) => {
    if (typeof value === "string") return [[`${prefix}${key}`, value] as [string, string]];
    if (value && typeof value === "object") {
      return stringsIn(value as Record<string, unknown>, `${prefix}${key}.`);
    }
    return [];
  });
}

describe("the state engine's and the identity gate's label tables", () => {
  it("contains no entry equal to Send, and none that says Weez sends", () => {
    // A list that lost an entry would shrink the subject silently, so the count is part
    // of the claim rather than left to the loop.
    expect(SWEPT_LABEL_TABLES).toHaveLength(16);

    SWEPT_LABEL_TABLES.forEach(([tableName, table]) => {
      const entries = stringsIn(table);
      // A table that lost its strings would satisfy the loop below vacuously.
      expect(entries.length, tableName).toBeGreaterThan(0);

      entries.forEach(([key, label]) => {
        expect(label.trim(), `${tableName}.${key}`).not.toBe(FORBIDDEN_LABEL);
        SENDING_CLAIM_PATTERNS.forEach(([why, pattern]) => {
          expect(
            pattern.test(label.trim()),
            `${tableName}.${key} reads as ${why}: "${label}"`,
          ).toBe(false);
        });
      });
    });
  });

  it("catches a sending claim when one is planted", () => {
    // The sweep above reports nothing, and that reads identically whether the tables are
    // clean or the patterns never match anything. So one string of each banned shape is
    // put through the same predicate and has to come back flagged.
    const planted = [
      "Send",
      "Sending the message",
      "Weez sends the follow-up",
      "The message was sent",
      "We automatically send a warm-up",
    ];
    planted.forEach((label) => {
      const flagged =
        label.trim() === FORBIDDEN_LABEL ||
        SENDING_CLAIM_PATTERNS.some(([, pattern]) => pattern.test(label.trim()));
      expect(flagged, `"${label}" passed the sweep`).toBe(true);
    });

    // And the form R27.3 mandates is not caught by any of them, which is the other half:
    // a sweep that flagged the mandated label would have to be relaxed to ship.
    expect(
      SENDING_CLAIM_PATTERNS.some(([, pattern]) => pattern.test(GTM_ACTION_LABELS.SEND_MESSAGE)),
    ).toBe(false);
  });

  it("keeps the Open-and-Send form on every channel-touching recommendation", () => {
    // The form R27.3 mandates rather than tolerates: the conjunction names the tab Weez
    // opens and leaves the sending with the operator.
    ["SEND_LINKEDIN_WARMUP", "SEND_LINKEDIN_FOLLOWUP", "SEND_EMAIL", "SEND_EMAIL_FOLLOWUP"].forEach(
      (actionType) => {
        expect(GTM_NBA_ACTION_LABELS[actionType], actionType).toMatch(/^Open .+ & /);
      },
    );
    // And the two that touch no channel read as answers rather than as empty states.
    expect(GTM_NBA_ACTION_LABELS.WAIT).toBe("Wait — nothing to do yet");
    expect(GTM_NBA_ACTION_LABELS.RESEARCH_MORE).toBe("Find out more first");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 39: Prices and balances come from the server or are absent
// ══════════════════════════════════════════════════════════════════════════════
//
// The surface under test is the composition §11 prescribes and nothing else:
// `CreditsProvider` reads `GET /gtm/credits` once for the workspace, `priceFor(REASON)`
// projects the server's list, `CreditPriceTag` renders the projection, and
// `CreditBalanceBadge` renders the balance. No number is passed in by hand, which is the
// only way R17.4 can be read at all: a literal kept anywhere along that path shows up as a
// tag that disagrees with the payload.
//
// The prices are generated across `0…9` rather than fixed at the shipped 1 / 1 / 2, and that
// is the point. A component that had memorised "ACTIVATE costs 2" passes every example
// written against the real price list and fails here on the first payload that says
// otherwise.

/** A real workspace id: `CreditsProvider` will not read for anything else. */
const WORKSPACE = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/**
 * The three actions the server prices.
 *
 * `CreditReason` also carries the ledger's own reasons — `INITIAL_GRANT`, `PURCHASE`,
 * `ADJUSTMENT` — which are movements rather than priced controls and never reach a tag.
 */
const PRICED_REASONS: readonly CreditReason[] = ["ENRICH", "CONTACT", "ACTIVATE"];

/** What a tag reads for a price the server did list. The reference, stated once. */
function tagText(credits: number): string {
  return credits === 0 ? CREDIT_LABELS.free : `${credits} ${CREDIT_LABELS.unit(credits)}`;
}

const creditsArb = fc.record({
  // Includes `0` — a workspace nobody has granted anything to, which R17.7 calls a valid
  // read rather than an absent one.
  balance: fc.integer({ min: 0, max: 999 }),
  // Any subset of the three, at any price, including none of them at all: a payload whose
  // price list is empty is the server declining to price, and a tag must not appear for it.
  prices: fc.uniqueArray(
    fc.record({
      action: fc.constantFrom(...PRICED_REASONS),
      credits: fc.integer({ min: 0, max: 9 }),
    }),
    {
      selector: (price) => price.action,
      minLength: 0,
      maxLength: PRICED_REASONS.length,
    }
  ),
});

/** Every priced slot on one surface, each fed only by `useCredits()`. */
function PricedSurface() {
  const { balance, priceFor } = useCredits();
  return (
    <div>
      <div data-testid="chrome">
        <CreditBalanceBadge balance={balance} />
      </div>
      {PRICED_REASONS.map((reason) => (
        <div key={reason} data-testid={`price-${reason}`}>
          <CreditPriceTag credits={priceFor(reason)} />
        </div>
      ))}
    </div>
  );
}

describe("Feature: sales-workflow-frontend-restructure, Property 39: Prices and balances come from the server or are absent", () => {
  /** What `GET /gtm/credits` answers this run: a payload, or a failure (an unread list). */
  let served: CreditBalancePayload | Error;
  let reads = 0;

  beforeEach(() => {
    reads = 0;
    served = new Error("not configured");
    vi.spyOn(gtmAPI, "getCredits").mockImplementation(async () => {
      reads += 1;
      if (served instanceof Error) throw served;
      return served;
    });
  });

  function mountPricedSurface() {
    return render(
      <MemoryRouter>
        <CreditsProvider brandId={WORKSPACE}>
          <PricedSurface />
        </CreditsProvider>
      </MemoryRouter>
    );
  }

  it("puts the balance and the three priced slots on one surface, from one read", async () => {
    // The instrument, checked before anything is generated against it.
    served = {
      brandId: WORKSPACE,
      balance: 7,
      prices: [{ action: "ACTIVATE", credits: 2 }],
      history: [],
    };
    const { container } = mountPricedSurface();

    await waitFor(() => {
      expect(within(container).getByTestId("chrome").textContent).toContain("7");
    });
    expect(reads).toBe(1);
    PRICED_REASONS.forEach((reason) =>
      expect(within(container).getByTestId(`price-${reason}`)).toBeInTheDocument()
    );
  });

  it(
    "renders every price tag from the server's list and the badge from the server's balance",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(creditsArb, async (wire) => {
          served = {
            brandId: WORKSPACE,
            balance: wire.balance,
            prices: wire.prices,
            history: [],
          };
          const { container } = mountPricedSurface();

          try {
            const chrome = within(container).getByTestId("chrome");
            // The read has landed when the badge carries the server's number.
            await waitFor(() => {
              expect(within(chrome).getByText(String(wire.balance))).toBeInTheDocument();
            });

            // ── R17.2, R17.7: the badge is the server's number, and `0` is one of them ──
            expect(
              chrome.textContent,
              `the badge did not carry the server's balance ${wire.balance}`
            ).toContain(String(wire.balance));

            // ── R17.3, R17.4: each tag is the server's price for that action, or absent ──
            PRICED_REASONS.forEach((reason) => {
              const slot = within(container).getByTestId(`price-${reason}`);
              const listed = wire.prices.find((price) => price.action === reason);

              if (listed === undefined) {
                // Not a zero and not a dash. A control whose price the server did not
                // quote must not look free.
                expect(
                  slot,
                  `${reason}: a tag was rendered for a price the server did not list`
                ).toBeEmptyDOMElement();
                return;
              }

              expect(
                (slot.textContent ?? "").trim(),
                `${reason}: the tag disagreed with the server's price of ${listed.credits}`
              ).toBe(tagText(listed.credits));

              // The bite of R17.4. The only figure inside the slot is the one on the wire,
              // so a memorised price fails for every payload that does not happen to
              // repeat it.
              expect(
                slot.textContent?.match(/\d+/g) ?? [],
                `${reason}: the tag printed a figure the server did not send`
              ).toEqual(listed.credits === 0 ? [] : [String(listed.credits)]);
            });
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "renders no badge and no price tag while the list is unread",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ maxLength: 40 }), async (message) => {
          // An unread list, however the read failed. The whole claim is that "we have not
          // got an answer" renders nothing rather than a zero: a `0` badge would tell an
          // operator who has credits that they have none, and a `Free` tag would put an
          // untrue price on a control that charges.
          served = new Error(message);
          const before = reads;
          const { container } = mountPricedSurface();

          try {
            await waitFor(() => expect(reads).toBeGreaterThan(before));
            expect(within(container).getByTestId("chrome")).toBeEmptyDOMElement();
            PRICED_REASONS.forEach((reason) =>
              expect(
                within(container).getByTestId(`price-${reason}`),
                `${reason}: a tag was rendered from an unread price list`
              ).toBeEmptyDOMElement()
            );
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// Property 22: Absence is stated, never zeroed and never blanked
// ══════════════════════════════════════════════════════════════════════════════
//
// Three claims over one payload, because the payload is where they interfere. Read
// separately, "absent renders Unknown" and "zero renders 0" are each easy; mixed into one
// surface they are the two halves of a single decision a component gets wrong by collapsing
// them — `value || UNKNOWN_TEXT` turns a genuine zero into Unknown, and `value ?? 0` turns
// an absence into a measurement. So every run mounts all three kinds side by side and reads
// each slot on its own.
//
// R19.4's half is the one worth being careful about. The unknown treatment has to reach a
// screen reader as well as an eye, so each unknown slot is read twice: once with the
// screen-reader-only nodes stripped (what is visible) and once with only the nodes hidden
// from assistive technology stripped (what is announced). A value slot has no ARIA role that
// takes its name from its content — `dd` maps to `definition`, which is named by the author
// — so the accessible name of the treatment *is* that announced text, and the note has to be
// in it.

/**
 * What an assistive technology traverses: everything not hidden from it.
 *
 * `sr-only` is a clipping class, so its content stays in the accessibility tree and is
 * deliberately kept here. `aria-hidden` and `hidden` subtrees are removed, which is the
 * distinction that makes this a reading of the accessible name rather than of `textContent`:
 * a note marked `aria-hidden` would satisfy the second reading and fail this one.
 */
function accessibleText(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"], [hidden]').forEach((node) => node.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** What an eye reads: the same, less the screen-reader-only nodes. */
function visibleText(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll('[aria-hidden="true"], [hidden], .sr-only')
    .forEach((node) => node.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The dimension names, none of which carries a digit — see the no-figure assertion below. */
const FACT_LABELS = ["Relationship", "Conversation", "Activity", "Intent", "Journey"] as const;

/** A recent observation, so a known fact's provenance line reads as a real one. */
const RECENTLY = () => new Date(Date.now() - 3 * 3600_000).toISOString();

/** The disclaimer carried on every generated score. Deliberately digit-free. */
const DISCLAIMER = "Derived from the persisted terms.";

type FactKind = "absent" | "contradictory" | "zero" | "known";

const KNOWN_VALUES = ["CONNECTED", "NOT_CONNECTED", "HIGH"] as const;

const factSlotArb: fc.Arbitrary<FactSlot> = fc.oneof(
  fc.record({ kind: fc.constant<FactKind>("absent") }),
  // A null value with `isUnknown` false. The server should not send it; absence still wins.
  fc.record({ kind: fc.constant<FactKind>("contradictory") }),
  // A genuine measurement of zero, which is a fact and not a gap.
  fc.record({ kind: fc.constant<FactKind>("zero") }),
  fc.record({ kind: fc.constant<FactKind>("known"), value: fc.constantFrom(...KNOWN_VALUES) })
);

const absencePayloadArb = fc.record({
  facts: fc.array(factSlotArb, { minLength: 1, maxLength: FACT_LABELS.length }),
  // null — could not be computed; 0 — computed and came out zero; n — computed.
  score: fc.oneof(
    { arbitrary: fc.constant<number | null>(null), weight: 2 },
    { arbitrary: fc.constant<number | null>(0), weight: 2 },
    { arbitrary: fc.integer({ min: 1, max: 100 }).map<number | null>((n) => n), weight: 3 }
  ),
  // null — unread; 0 — a workspace with none (R17.7); n — a workspace with some.
  balance: fc.oneof(
    { arbitrary: fc.constant<number | null>(null), weight: 2 },
    { arbitrary: fc.constant<number | null>(0), weight: 2 },
    { arbitrary: fc.integer({ min: 1, max: 999 }).map<number | null>((n) => n), weight: 3 }
  ),
});

type FactSlot = { kind: FactKind; value?: string };

function factFrom(slot: FactSlot): ObservedFact {
  switch (slot.kind) {
    case "absent":
      return {
        value: null,
        isUnknown: true,
        // A fact nobody observed has no surface and no time. Both null, so the slot
        // carries no figure at all and the "never zeroed" reading below is unambiguous.
        sourceSurface: null,
        observedAt: null,
        isStale: false,
        isDerived: false,
      };
    case "contradictory":
      return {
        value: null,
        isUnknown: false,
        sourceSurface: null,
        observedAt: null,
        isStale: false,
        isDerived: false,
      };
    case "zero":
      return {
        value: "0",
        isUnknown: false,
        sourceSurface: "LINKEDIN_PROFILE_PAGE",
        observedAt: RECENTLY(),
        isStale: false,
        isDerived: false,
      };
    case "known":
      return {
        value: slot.value ?? "CONNECTED",
        isUnknown: false,
        sourceSurface: "LINKEDIN_PROFILE_PAGE",
        observedAt: RECENTLY(),
        isStale: false,
        isDerived: false,
      };
  }
}

describe("Feature: sales-workflow-frontend-restructure, Property 22: Absence is stated, never zeroed and never blanked", () => {
  it(
    "states each absence, renders each genuine zero, and announces the unknown treatment as well as showing it",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.property(absencePayloadArb, (payload) => {
          const score: DerivedScorePayload = {
            score: payload.score,
            scoreKind: "RECOMMENDATION_SCORE",
            scoreDisclaimer: DISCLAIMER,
            isDerived: true,
          };

          const { container } = render(
            <div>
              <dl>
                {payload.facts.map((slot, index) => (
                  <div key={index} data-testid={`fact-${FACT_LABELS[index]}`}>
                    <ObservedValue label={FACT_LABELS[index]} fact={factFrom(slot)} />
                  </div>
                ))}
              </dl>
              <div data-testid="score">
                <DerivedScore score={score} />
              </div>
              <div data-testid="balance">
                <CreditBalanceBadge balance={payload.balance} />
              </div>
            </div>
          );

          try {
            // ── Each fact slot, on its own ──
            payload.facts.forEach((slot, index) => {
              const name = FACT_LABELS[index];
              const element = within(container).getByTestId(`fact-${name}`);
              const visible = visibleText(element);
              const announced = accessibleText(element);
              const where = `${name} (${slot.kind})`;

              if (slot.kind === "absent" || slot.kind === "contradictory") {
                // R9.2, R9.6 — the shared treatment, visibly.
                expect(visible, `${where}: no absence statement in the visible text`).toContain(
                  UNKNOWN_TEXT
                );
                // R19.4 — and the same treatment in what is announced, note included. The
                // note is what turns a muted slot into a stated gap for a reader who cannot
                // see that it is muted.
                expect(announced, `${where}: the unknown treatment was not announced`).toContain(
                  UNKNOWN_TEXT
                );
                expect(
                  announced,
                  `${where}: the screen-reader note did not reach the accessibility tree`
                ).toContain(UNKNOWN_SR_NOTE.trim());

                // R9.3 — and never a stand-in. Not a zero, not a false, not a dash, and not
                // a neighbouring dimension's value borrowed to fill the slot.
                expect(announced, `${where}: an absence was rendered as a figure`).not.toMatch(
                  /\d/
                );
                expect(announced, `${where}: an absence was rendered as false`).not.toContain(
                  "false"
                );
                expect(announced, `${where}: an absence was rendered as an em dash`).not.toContain(
                  "—"
                );
                return;
              }

              if (slot.kind === "zero") {
                // The other half of the same decision. A measured zero is a measurement.
                expect(
                  within(element).getByText("0"),
                  `${where}: a genuine zero did not render as 0`
                ).toBeInTheDocument();
                expect(
                  visible,
                  `${where}: a genuine zero was reported as unknown`
                ).not.toContain(UNKNOWN_TEXT);
                return;
              }

              const label = STATE_LABEL[slot.value ?? ""] ?? slot.value ?? "";
              expect(visible, `${where}: the observed value was not rendered`).toContain(label);
              expect(visible, `${where}: an observed value was reported as unknown`).not.toContain(
                UNKNOWN_TEXT
              );
            });

            // ── The score: null is not zero, and zero is not null ──
            const scoreSlot = within(container).getByTestId("score");
            if (payload.score === null) {
              expect(
                visibleText(scoreSlot),
                "score: an uncomputed score was not stated as unknown"
              ).toContain(UNKNOWN_TEXT);
              expect(
                accessibleText(scoreSlot),
                "score: the unknown note did not reach the accessibility tree"
              ).toContain(UNKNOWN_SR_NOTE.trim());
              expect(
                accessibleText(scoreSlot),
                "score: an uncomputed score was rendered as a figure"
              ).not.toMatch(/\d/);
            } else {
              expect(
                within(scoreSlot).getByText(String(payload.score)),
                `score: ${payload.score} was not rendered`
              ).toBeInTheDocument();
              expect(
                visibleText(scoreSlot),
                `score: ${payload.score} was reported as unknown`
              ).not.toContain(UNKNOWN_TEXT);
            }

            // ── The balance: R17.7's zero, and the unread badge that is deliberately blank ──
            const balanceSlot = within(container).getByTestId("balance");
            if (payload.balance === null) {
              // The one slot on this surface where nothing rendered is the honest answer:
              // an unread balance is chrome with no number in it, not a workspace with none.
              expect(balanceSlot, "balance: an unread balance rendered something").toBeEmptyDOMElement();
            } else {
              expect(
                within(balanceSlot).getByText(String(payload.balance)),
                `balance: ${payload.balance} was not rendered as a read value`
              ).toBeInTheDocument();
            }
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 }
      );
    }
  );
});
