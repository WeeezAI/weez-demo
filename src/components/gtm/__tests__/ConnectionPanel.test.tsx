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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import type { ObservedFact, RelationshipState } from "@/services/gtmAPI";
import {
  CONNECTABLE,
  ConnectionPanel,
  DECIDE_AFTER_DAYS,
  NUDGE_AFTER_DAYS,
  PENDING,
  daysSince,
  pendingLabel,
} from "../ConnectionPanel";
import { DIMENSION_LABEL, GTM_CONNECTION_LABELS, STATE_LABEL } from "../labels";

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
