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
// Plus the label table's own invariant: nothing in `GTM_ACTION_LABELS` is `Send`.

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import type { ConfirmationStatus, DerivedScore as DerivedScorePayload, ObservedFact } from "@/services/gtmAPI";
import { ConfirmationStatusBadge } from "../ConfirmationStatusBadge";
import { DerivedScore } from "../DerivedScore";
import { ObservedValue } from "../ObservedValue";
import { CONFIRMATION_LABEL, GTM_ACTION_LABELS, GTM_ACTION_LABEL_BY_TYPE } from "../labels";

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
  // The composed page is checked in `pages/__tests__/GTMProspect.a11y.test.tsx`;
  // these primitives are checked here so a violation is attributed to the
  // primitive rather than to whichever panel happened to mount it.
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
