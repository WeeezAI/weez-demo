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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import type { ObservedFact, ProspectProfile } from "@/services/gtmAPI";
import {
  IdentityConfirmPanel,
  hasCandidateToSettle,
  matchedAttributes,
} from "../IdentityConfirmPanel";
import { GTM_IDENTITY_CONFIRM_LABELS as L } from "../labels";

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
