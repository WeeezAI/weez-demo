// components/gtm/__tests__/nextAction.test.tsx
//
// The next-action panel and the composer, tested for the claims they are allowed to
// make rather than for the markup they emit.
//
// The centre of this file is the `Open LinkedIn & Send` control, and it is not
// tested by asserting that a button exists. It is tested by spying on every method
// of `gtmAPI`, running the click, and reading back two things:
//
//   • the **order** of side effects — `requestAction`, then the clipboard, then
//     `window.open` with `noopener,noreferrer`, then `markOpened`, then the toast
//     (R12.3, R13.3)
//   • the **set** of API methods that ran, which must be exactly
//     `{requestAction, markOpened}`. That is the no-state-write invariant stated as
//     an equality rather than as a list of absences: nothing can write
//     `conversation_state`, create a message-sent record, or write `sent_content`
//     without appearing in that set, so a future edit that adds such a call fails
//     here instead of shipping.
//
// The rest follows the same rule. Editing asserts that `saveEdit` carries the edited
// text and that `generatedContent` is never mutated (R7.3); regenerating asserts the
// predecessor stays selectable (R7.4); `sent_content` asserts the block appears only
// when the server reported it observed (R7.5); the counter asserts the wiring that
// makes it readable (R18.9).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import gtmAPI, {
  type Action,
  type CandidateAction,
  type Message,
  type NextAction,
  type NextBestAction,
} from "@/services/gtmAPI";
import { MessageComposer } from "../MessageComposer";
import { NextActionPanel, actionCardTestId } from "../NextActionPanel";
import { NextBestActionCard, NEXT_BEST_ACTION_CARD_LABELS } from "../NextBestActionCard";
import {
  CONTACT_DIRECTLY_LABELS,
  GTM_ACTION_LABELS,
  GTM_ACTION_TOASTS,
  GTM_NBA_ACTION_LABELS,
  GTM_SIGNAL_TYPE_LABELS,
} from "../labels";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BRAND = "brand-1";
const LEAD = "11111111-2222-3333-4444-555555555555";
const DESTINATION = "https://www.linkedin.com/messaging/thread/abc/";
const DRAFT = "Saw your post on retention loops — how are you measuring week 4?";
const NOW = "2024-05-01T12:00:00.000Z";

function message(overrides: Partial<Message> = {}): Message {
  return {
    messageId: "msg-1",
    conversationId: "conv-1",
    // A saved draft, which is what every case below is about: a `li_gtm_messages` row
    // exists, so `PATCH /message/{id}` and `POST /message/{id}/regenerate` both have a
    // row to address and the composer offers Edit and Regenerate. The one case that is
    // *not* about the tracked path overrides this to `false` and drops the id with it —
    // see "the unpersisted pre-activation draft" below. Defaulting it here rather than
    // per-test is deliberate: `persisted` is a required field on `Message`, and a fixture
    // that omitted it would put every test in this file on the pre-activation path by
    // accident, which is precisely the reading `!active.persisted` gives an absent field.
    persisted: true,
    direction: "OUTBOUND",
    messagePurpose: "WARMUP",
    version: 1,
    generatedContent: DRAFT,
    editedContent: null,
    sentContent: null,
    generationFailureReason: null,
    charLimit: 300,
    editedByUserId: null,
    editedAt: null,
    observedText: null,
    replyClassification: null,
    replyConfidence: null,
    needsHumanReview: false,
    derivedNextAction: null,
    suggestedResponse: null,
    referralDetail: null,
    sourceSurface: null,
    observedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function action(overrides: Partial<Action> = {}): Action {
  return {
    actionId: "act-1",
    profileId: "prof-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    actionType: "SEND_MESSAGE",
    channel: "LINKEDIN",
    executionState: "ACTION_REQUESTED",
    confirmationStatus: "WAITING_FOR_CONFIRMATION",
    isVerified: false,
    requestedByUserId: "user-1",
    requestedAt: NOW,
    destinationUrl: DESTINATION,
    payloadText: DRAFT,
    instructions: null,
    linkedinOpenedAt: null,
    verificationAttempts: 0,
    verificationBudget: 5,
    attemptsRemaining: 5,
    nextVerificationAt: null,
    verifiedAt: null,
    outcomeEvidenceId: null,
    failureReason: null,
    // Null by default because this fixture stands for an action *read back*, and only
    // `requestAction` charges. A test about the charge overrides it.
    credit: null,
    ...overrides,
  };
}

function nextAction(overrides: Partial<NextAction> = {}): NextAction {
  return {
    actionType: "SEND_MESSAGE",
    channel: "LINKEDIN",
    recommendation: "Send the warm-up message on LinkedIn.",
    reasoning: ["Connected on LinkedIn", "Posted 3 days ago"],
    messageId: "msg-1",
    destinationUrl: DESTINATION,
    payloadText: DRAFT,
    instructions: null,
    latestAction: null,
    isSuppressed: false,
    ...overrides,
  };
}

/** Every method name on the API surface, so the spy net has no holes. */
const API_METHODS = Object.keys(gtmAPI) as (keyof typeof gtmAPI)[];

interface Harness {
  /** Side effects in the order they happened. */
  order: string[];
  /** The API methods that ran, in order. */
  apiCalls: string[];
  writeText: MockInstance;
  open: MockInstance;
  /**
   * The user-event instance every test drives the UI with.
   *
   * It is created *here*, and deliberately before the clipboard is stubbed:
   * `userEvent.setup()` installs a clipboard stub of its own over
   * `navigator.clipboard`, so a `setup()` call after this function would replace
   * the spy below and the ordering assertions would silently lose their
   * `clipboard` entry. Owning both in one place keeps that ordering a property of
   * the harness rather than of how each test happens to be written.
   */
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Spy on the whole API surface, the clipboard, `window.open`, and the toast, and
 * record every call into one ordered log. Nothing is left un-spied: a call this
 * harness does not know about would still land in `apiCalls`.
 */
function harness(overrides: Partial<Record<keyof typeof gtmAPI, unknown>> = {}): Harness {
  const order: string[] = [];
  const apiCalls: string[] = [];
  const user = userEvent.setup();

  API_METHODS.forEach((name) => {
    vi.spyOn(gtmAPI, name).mockImplementation(((...args: unknown[]) => {
      order.push(name);
      apiCalls.push(name);
      const override = overrides[name];
      if (typeof override === "function") return Promise.resolve((override as (...a: unknown[]) => unknown)(...args));
      if (override !== undefined) return Promise.resolve(override);
      return Promise.resolve(null);
    }) as never);
  });

  const writeText = vi.fn(() => {
    order.push("clipboard");
    return Promise.resolve();
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });

  const open = vi.spyOn(window, "open").mockImplementation(() => {
    order.push("window.open");
    return null;
  });

  (toast.success as unknown as MockInstance).mockImplementation(() => {
    order.push("toast");
    return "id";
  });
  (toast.error as unknown as MockInstance).mockImplementation(() => {
    order.push("toast.error");
    return "id";
  });

  return { order, apiCalls, writeText, open, user };
}

function renderPanel(props: Partial<React.ComponentProps<typeof NextActionPanel>> = {}) {
  return render(
    <NextActionPanel
      brandId={BRAND}
      leadId={LEAD}
      nextAction={nextAction()}
      confirmationStatus="NOT_APPLICABLE"
      messageVersions={[message()]}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Open LinkedIn & Send", () => {
  it("carries the label the requirement names and no control is labelled Send", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE })).toBeInTheDocument();

    const labels = screen
      .getAllByRole("button")
      .map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim());
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => expect(label).not.toBe("Send"));
  });

  it("runs requestAction, the clipboard, window.open, markOpened, then the toast, in that order", async () => {
    const bus = harness({
      requestAction: () => action(),
      markOpened: () => action({ executionState: "ACTION_IN_PROGRESS", linkedinOpenedAt: NOW }),
    });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(bus.order).toContain("toast"));
    expect(bus.order).toEqual(["requestAction", "clipboard", "window.open", "markOpened", "toast"]);
  });

  it("opens the destination with noopener and noreferrer so Weez holds no handle to the tab", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(bus.open).toHaveBeenCalled());
    expect(bus.open).toHaveBeenCalledWith(DESTINATION, "_blank", "noopener,noreferrer");
  });

  it("writes the prepared payload to the clipboard", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(bus.writeText).toHaveBeenCalledWith(DRAFT));
  });

  it("sets no state: the only API calls are requestAction and markOpened", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(bus.apiCalls).toContain("markOpened"));
    // An equality, not a list of absences. Nothing can write `conversation_state`,
    // create a message-sent record, or write `sent_content` without showing up here.
    expect(bus.apiCalls).toEqual(["requestAction", "markOpened"]);
    expect(gtmAPI.confirmAction).not.toHaveBeenCalled();
    expect(gtmAPI.saveEdit).not.toHaveBeenCalled();
    expect(gtmAPI.recordOutcome).not.toHaveBeenCalled();
  });

  it("records the click as an intent, with a message id and an idempotency key inside the server bound", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(gtmAPI.requestAction).toHaveBeenCalled());
    const [brandId, leadId, input] = (gtmAPI.requestAction as unknown as MockInstance).mock.calls[0];
    expect(brandId).toBe(BRAND);
    expect(leadId).toBe(LEAD);
    expect(input.actionType).toBe("SEND_MESSAGE");
    expect(input.messageId).toBe("msg-1");
    expect(input.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(input.idempotencyKey.length).toBeLessThanOrEqual(64);
  });

  it("reuses the same idempotency key for the same draft, so a second click is one request", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    const control = screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE });
    await user.click(control);
    await waitFor(() => expect(gtmAPI.markOpened).toHaveBeenCalledTimes(1));
    await user.click(control);
    await waitFor(() => expect(gtmAPI.requestAction).toHaveBeenCalledTimes(2));

    const calls = (gtmAPI.requestAction as unknown as MockInstance).mock.calls;
    expect(calls[0][2].idempotencyKey).toBe(calls[1][2].idempotencyKey);
  });

  it("claims LinkedIn was opened and never that a message was sent", async () => {
    const bus = harness({ requestAction: () => action(), markOpened: () => action() });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(GTM_ACTION_TOASTS.OPENED));
    expect(GTM_ACTION_TOASTS.OPENED).toContain("opened");
    expect(GTM_ACTION_TOASTS.OPENED).not.toMatch(/\bsent\b/i);
    expect(GTM_ACTION_TOASTS.OPENED).not.toMatch(/message sent/i);
  });

  it("reports the server's detail rather than a success claim when the request fails", async () => {
    const bus = harness();
    (gtmAPI.requestAction as unknown as MockInstance).mockImplementation(() => {
      bus.apiCalls.push("requestAction");
      return Promise.reject(new Error("Prospect not found"));
    });
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Prospect not found"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(bus.open).not.toHaveBeenCalled();
    expect(gtmAPI.markOpened).not.toHaveBeenCalled();
  });
});

describe("the panel's other controls", () => {
  it("shows the confirmation status beside the primary control", () => {
    renderPanel({
      confirmationStatus: "WAITING_FOR_CONFIRMATION",
      nextAction: nextAction({ latestAction: action() }),
    });
    expect(screen.getByText("Waiting for confirmation")).toBeInTheDocument();
  });

  it("copies the draft without recording an action", async () => {
    const bus = harness();
    const user = bus.user;
    renderPanel();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.COPY }));

    await waitFor(() => expect(bus.writeText).toHaveBeenCalledWith(DRAFT));
    expect(bus.apiCalls).toEqual([]);
    expect(bus.open).not.toHaveBeenCalled();
  });

  it("offers I sent it once an action has been requested, and routes it to confirmAction", async () => {
    const bus = harness({ confirmAction: () => action({ confirmationStatus: "CONFIRMED", isVerified: true }) });
    const user = bus.user;
    renderPanel({ nextAction: nextAction({ latestAction: action() }) });

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.CONFIRM_SENT }));

    await waitFor(() => expect(gtmAPI.confirmAction).toHaveBeenCalled());
    expect(bus.apiCalls).toEqual(["confirmAction"]);
    const [, actionId, input] = (gtmAPI.confirmAction as unknown as MockInstance).mock.calls[0];
    expect(actionId).toBe("act-1");
    expect(input.sentText).toBe(DRAFT);
    expect(toast.success).toHaveBeenCalledWith(GTM_ACTION_TOASTS.CONFIRMED_SENT);
  });

  it("hides I sent it until something has been requested", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: GTM_ACTION_LABELS.CONFIRM_SENT })).not.toBeInTheDocument();
  });

  it("renders the recommendation sentence and its reasoning", () => {
    renderPanel();
    expect(screen.getByText("Send the warm-up message on LinkedIn.")).toBeInTheDocument();
    expect(screen.getByText("Connected on LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Posted 3 days ago")).toBeInTheDocument();
  });

  it("withdraws the send affordance when outreach is suppressed", () => {
    renderPanel({ nextAction: nextAction({ isSuppressed: true }) });
    expect(screen.queryByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE })).not.toBeInTheDocument();
  });
});

describe("MessageComposer", () => {
  function renderComposer(props: Partial<React.ComponentProps<typeof MessageComposer>> = {}) {
    return render(<MessageComposer brandId={BRAND} versions={[message()]} {...props} />);
  }

  it("opens on editedContent when there is one and on generatedContent otherwise", () => {
    const { unmount } = renderComposer();
    expect(screen.getByLabelText("Message draft")).toHaveValue(DRAFT);
    unmount();

    renderComposer({ versions: [message({ editedContent: "My own words." })] });
    expect(screen.getByLabelText("Message draft")).toHaveValue("My own words.");
  });

  it("is read-only until Edit is pressed", async () => {
    const bus = harness();
    const user = bus.user;
    renderComposer();

    expect(screen.getByLabelText("Message draft")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    expect(screen.getByLabelText("Message draft")).not.toHaveAttribute("readonly");
  });

  it("saves an edit to editedContent alone and leaves generatedContent untouched", async () => {
    const row = message();
    const bus = harness({ saveEdit: () => message({ editedContent: "My own words." }) });
    const user = bus.user;
    renderComposer({ versions: [row] });

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    const textarea = screen.getByLabelText("Message draft");
    await user.clear(textarea);
    await user.type(textarea, "My own words.");
    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SAVE }));

    await waitFor(() => expect(gtmAPI.saveEdit).toHaveBeenCalledWith(BRAND, "msg-1", "My own words."));
    // Only the edit endpoint ran, and the model's text is byte-identical.
    expect(bus.apiCalls).toEqual(["saveEdit"]);
    expect(row.generatedContent).toBe(DRAFT);
  });

  it("drops the edit on Cancel", async () => {
    const bus = harness();
    const user = bus.user;
    renderComposer();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    await user.type(screen.getByLabelText("Message draft"), " and more");
    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.CANCEL }));

    expect(screen.getByLabelText("Message draft")).toHaveValue(DRAFT);
    expect(bus.apiCalls).toEqual([]);
  });

  it("regenerates into a new version and keeps the predecessor selectable", async () => {
    const bus = harness({
      regenerate: () => message({ messageId: "msg-2", version: 2, generatedContent: "A second attempt." }),
    });
    const user = bus.user;
    renderComposer();

    await user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.REGENERATE }));

    await waitFor(() => expect(screen.getByLabelText("Message draft")).toHaveValue("A second attempt."));
    const selector = screen.getByLabelText("Version");
    expect(within(selector).getAllByRole("option")).toHaveLength(2);

    await user.selectOptions(selector, "msg-1");
    expect(screen.getByLabelText("Message draft")).toHaveValue(DRAFT);
  });

  it("offers Edit and Regenerate for every draft it shows", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.REGENERATE })).toBeInTheDocument();
  });

  it("wires the character counter through aria-describedby", () => {
    renderComposer();
    const textarea = screen.getByLabelText("Message draft");
    const describedBy = (textarea.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(describedBy.length).toBeGreaterThanOrEqual(2);
    const described = describedBy.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(described).toContain(`${DRAFT.length} of 300 characters`);
    expect(described).toContain("You paste it into LinkedIn");
  });

  it("marks the field invalid past the channel limit and not before it", () => {
    const { unmount } = renderComposer({ versions: [message({ charLimit: DRAFT.length })] });
    expect(screen.getByLabelText("Message draft")).toHaveAttribute("aria-invalid", "false");
    unmount();

    renderComposer({ versions: [message({ charLimit: DRAFT.length - 1 })] });
    const textarea = screen.getByLabelText("Message draft");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    const counterId = (textarea.getAttribute("aria-describedby") ?? "").split(" ")[0];
    expect(document.getElementById(counterId)?.textContent).toContain("over the LinkedIn limit");
  });

  it("shows sentContent read-only, and only when the server reported it observed", () => {
    const { unmount } = renderComposer();
    expect(screen.queryByLabelText("Seen in LinkedIn")).not.toBeInTheDocument();
    unmount();

    renderComposer({
      versions: [
        message({
          sentContent: "What actually went out.",
          sourceSurface: "LINKEDIN_MESSAGING_THREAD",
          observedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        }),
      ],
    });

    const block = screen.getByLabelText("Seen in LinkedIn");
    expect(within(block).getByText("What actually went out.")).toBeInTheDocument();
    expect(block.textContent).toContain("LinkedIn thread");
    expect(within(block).getByText("3h ago")).toBeInTheDocument();
    // Read-only means no control inside the block could rewrite it.
    expect(within(block).queryAllByRole("button")).toHaveLength(0);
    expect(within(block).queryAllByRole("textbox")).toHaveLength(0);
  });

  it("renders a failed generation as a record with its reason, not as an error banner", () => {
    renderComposer({
      versions: [message({ generatedContent: null, generationFailureReason: "FABRICATION_GUARD_DIRTY" })],
    });
    expect(screen.getByText("Couldn't draft this message")).toBeInTheDocument();
    expect(screen.getByText("FABRICATION_GUARD_DIRTY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.REGENERATE })).toBeInTheDocument();
  });

  it("hides the version selector when there is only one version", () => {
    renderComposer();
    expect(screen.queryByLabelText("Version")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The unpersisted pre-activation draft (R5.6, R20.8)
// ══════════════════════════════════════════════════════════════════════════════
//
// A draft written for an enriched-but-unactivated prospect arrives with
// `persisted: false` and no id, because no `li_gtm_messages` row was written for it.
// Two controls address a row by id — inline **Edit** through `PATCH /message/{id}` and
// **Rewrite**/Regenerate through `POST /message/{id}/regenerate` — so both are withheld
// and `CONTACT_DIRECTLY_LABELS.unpersistedNote` is printed where they would have been.
//
// **The point of this block is the positives, not the absences.** A composer that
// withheld every control and printed the note would satisfy "Edit is absent" and
// "Regenerate is absent" while breaking the requirement outright: the note is a note,
// not a refusal. So the two absences are asserted *as a set difference against the
// tracked render* — exactly two controls disappear and nothing else does — and the
// paths that must survive are each exercised for real: a second generated draft is
// accepted, the draft is on screen and readable, Copy writes it, and the open-channel
// chain runs end to end reporting a null message id rather than inventing one.
describe("the unpersisted pre-activation draft", () => {
  /**
   * What `_lead_message_out` returns before activation: no row, therefore no
   * `message_id` and no `conversation_id`, and `persisted` saying so as a claim of its
   * own rather than leaving a reader to infer it from two absences.
   */
  function unsaved(overrides: Partial<Message> = {}): Message {
    return message({ messageId: null, conversationId: null, persisted: false, ...overrides });
  }

  /** The button names on screen, however each one is labelled. */
  function buttonNames(): Set<string> {
    return new Set(
      screen
        .getAllByRole("button")
        .map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim()),
    );
  }

  it("withholds Rewrite and inline Edit, prints the note in their place, and keeps the draft readable", () => {
    render(<MessageComposer brandId={BRAND} versions={[unsaved()]} />);

    // Both spellings of the withheld control, so a rename cannot make this pass by
    // looking for a label nothing renders.
    expect(screen.queryByRole("button", { name: GTM_ACTION_LABELS.REGENERATE })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CONTACT_DIRECTLY_LABELS.regenerate })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: GTM_ACTION_LABELS.EDIT })).not.toBeInTheDocument();

    // The label table's sentence, read from the table rather than restated here: a copy
    // of the string in this file would keep passing after somebody edited the product's.
    expect(screen.getByText(CONTACT_DIRECTLY_LABELS.unpersistedNote)).toBeInTheDocument();

    // Reviewable: the text is on screen with its counter, and the note is part of the
    // field's description, so a screen-reader user hears it while still in the draft.
    const textarea = screen.getByLabelText("Message draft");
    expect(textarea).toHaveValue(DRAFT);
    const describedBy = (textarea.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    const described = describedBy.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(described).toContain(`${DRAFT.length} of 300 characters`);
    expect(described).toContain(CONTACT_DIRECTLY_LABELS.unpersistedNote);
  });

  it("withholds exactly those two controls and nothing else the tracked draft offered", () => {
    const tracked = renderPanel({ messageVersions: [message()] });
    const before = buttonNames();
    tracked.unmount();

    renderPanel({ nextAction: nextAction({ messageId: null }), messageVersions: [unsaved()] });
    const after = buttonNames();

    // A difference, not a list of absences: any other control this path dropped would
    // show up here, and a composer that had withheld everything fails on this line.
    expect([...before].filter((name) => !after.has(name)).sort()).toEqual(
      [GTM_ACTION_LABELS.EDIT, GTM_ACTION_LABELS.REGENERATE].sort(),
    );
    // And nothing pressable appeared in their place. The note is prose.
    expect([...after].filter((name) => !before.has(name))).toEqual([]);
  });

  it("accepts a second generated draft and keeps both selectable, so generating again is not blocked", async () => {
    const bus = harness();
    // Two unsaved rows both reporting version 1 — what two generations return when
    // neither was written. Neither has an id, so nothing can collapse them into one.
    render(
      <MessageComposer
        brandId={BRAND}
        versions={[unsaved(), unsaved({ generatedContent: "A second attempt." })]}
      />,
    );

    const selector = screen.getByLabelText("Version");
    expect(within(selector).getAllByRole("option")).toHaveLength(2);

    await bus.user.selectOptions(selector, within(selector).getAllByRole("option")[1]);
    expect(screen.getByLabelText("Message draft")).toHaveValue("A second attempt.");
    expect(screen.getByText(CONTACT_DIRECTLY_LABELS.unpersistedNote)).toBeInTheDocument();
    expect(bus.apiCalls).toEqual([]);
  });

  it("still copies the draft, with no API call and nothing written anywhere", async () => {
    const bus = harness();
    renderPanel({ nextAction: nextAction({ messageId: null }), messageVersions: [unsaved()] });

    await bus.user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.COPY }));

    await waitFor(() => expect(bus.writeText).toHaveBeenCalledWith(DRAFT));
    expect(bus.apiCalls).toEqual([]);
  });

  it("still opens the channel, in the same order, reporting a null message id", async () => {
    const bus = harness({
      requestAction: () => action({ messageId: null }),
      markOpened: () => action({ messageId: null, executionState: "ACTION_IN_PROGRESS", linkedinOpenedAt: NOW }),
    });
    renderPanel({ nextAction: nextAction({ messageId: null }), messageVersions: [unsaved()] });

    await bus.user.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }));

    await waitFor(() => expect(bus.order).toContain("toast"));
    expect(bus.order).toEqual(["requestAction", "clipboard", "window.open", "markOpened", "toast"]);
    expect(bus.writeText).toHaveBeenCalledWith(DRAFT);
    expect(bus.open).toHaveBeenCalledWith(DESTINATION, "_blank", "noopener,noreferrer");
    // Null, not a placeholder: there is no row, and the request says so.
    const [, , input] = (gtmAPI.requestAction as unknown as MockInstance).mock.calls[0];
    expect(input.messageId).toBeNull();
    expect(input.idempotencyKey.length).toBeGreaterThanOrEqual(8);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Band 7: the decision card beside the execution panel (R20.8, §15.3)
// ══════════════════════════════════════════════════════════════════════════════
//
// The dossier's seventh band is two components rather than one: `NextBestActionCard`
// states the decision — what to do, why now, and a way through to the evidence — and
// `NextActionPanel` executes it, with the composer, the open-channel control and the
// confirm ladder. They sit side by side because they answer two different questions,
// and neither replaces the other.
//
// **They are one read.** `NextActionPanel` takes `nextAction` off `getProspect` and
// `nextBestAction` off `getNextBestAction`, and the card takes `NextBestAction.
// recommended` off that same payload. So mounting the pair costs the page nothing: the
// assertion below is an equality on the recorded API calls, not a list of methods that
// happen not to have run, and the one entry in it is a *write* — the `VIEWED` lifecycle
// position `ActionCard` records through route 10 for a recommendation it puts on screen.
// A future edit that made either component fetch its own copy of the ranking fails here.
describe("band 7: the decision card beside the execution panel", () => {
  const NBA_TITLE = GTM_NBA_ACTION_LABELS.SEND_LINKEDIN_WARMUP;
  const CARD_HEADING = `${NBA_TITLE} · LinkedIn`;
  const SIGNAL_AT = "2024-04-28T09:00:00.000Z";

  function candidate(overrides: Partial<CandidateAction> = {}): CandidateAction {
    return {
      recommendationId: "reco-1",
      actionType: "SEND_LINKEDIN_WARMUP",
      channel: "LINKEDIN",
      // The server's own answer about whether outreach can carry this out, never derived
      // here: `executable` gates the card's Take action and the panel's open control.
      executionVerb: "SEND_MESSAGE",
      executable: true,
      unexecutableReason: null,
      rank: 1,
      isRecommended: true,
      actionScore: {
        score: 77,
        scoreKind: "RECOMMENDATION_SCORE",
        scoreDisclaimer: "Derived from the persisted terms.",
        isDerived: true,
      },
      actionConfidence: 63,
      stateConfidence: 66,
      terms: [
        {
          factor: "expected_success_probability",
          available: true,
          weight: 20,
          value: 41,
          persistedValue: null,
          source: "evaluation",
          contributionHundredths: 820,
          direction: "RAISES",
          unavailableReason: null,
        },
      ],
      unavailableTerms: [],
      availableWeightMass: 88,
      explanation: {
        whyNow: [
          {
            signalId: "sig-1",
            signalType: "LINKEDIN_POST",
            eventTimestamp: SIGNAL_AT,
            effectiveStrength: 68,
            term: "timing_fit",
            contributionHundredths: 1200,
            evidenceId: null,
          },
        ],
        whyThisChannel: [],
        whyThisMessage: null,
        whyNotTheOtherChannels: [],
        scope: null,
        versions: null,
      },
      exclusionReason: null,
      expiresAt: null,
      computedAt: NOW,
      ...overrides,
    };
  }

  /** One `getNextBestAction` response — the single read both components are fed from. */
  function ranking(overrides: Partial<NextBestAction> = {}): NextBestAction {
    const recommended = overrides.recommended ?? candidate();
    return {
      leadId: LEAD,
      evaluationId: "eval-1",
      computedAt: NOW,
      expiresAt: null,
      recommended,
      candidates: [recommended],
      policyVersion: "policy-v3",
      modelVersion: "model-v2",
      learningVersion: "learning-v1",
      weightSetId: "weights-1",
      learningScopeApplied: "WORKSPACE",
      lifecycle: null,
      ...overrides,
    };
  }

  /** The band, as the dossier composes it: one payload, two components. */
  function renderBand(nba: NextBestAction = ranking(), onTakeAction: () => void = () => {}) {
    return render(
      <div>
        <NextBestActionCard action={nba.recommended as CandidateAction} onTakeAction={onTakeAction} />
        <NextActionPanel
          brandId={BRAND}
          leadId={LEAD}
          nextAction={nextAction()}
          nextBestAction={nba}
          confirmationStatus="NOT_APPLICABLE"
          messageVersions={[message()]}
        />
      </div>,
    );
  }

  it("renders the decision and its execution from the one ranking payload", () => {
    harness({ postLifecycle: () => null });
    const nba = ranking();
    renderBand(nba);

    // The decision: the action the ranking recommended, its channel, and the leading
    // why-now bullet read from the signal type the evaluation persisted.
    const decision = screen.getByRole("region", { name: CARD_HEADING });
    expect(within(decision).getByText(NEXT_BEST_ACTION_CARD_LABELS.eyebrow)).toBeInTheDocument();
    expect(within(decision).getByText(GTM_SIGNAL_TYPE_LABELS.LINKEDIN_POST)).toBeInTheDocument();
    expect(
      within(decision).getByRole("button", { name: NEXT_BEST_ACTION_CARD_LABELS.takeAction }),
    ).toBeInTheDocument();

    // The execution, beside it: the same recommendation by id, plus the panel's own
    // recommendation sentence, its composer and its primary control, all still here.
    const execution = screen.getByRole("region", { name: "Next action" });
    expect(
      within(execution).getByTestId(actionCardTestId((nba.recommended as CandidateAction).recommendationId)),
    ).toBeInTheDocument();
    expect(within(execution).getByRole("heading", { name: NBA_TITLE })).toBeInTheDocument();
    expect(within(execution).getByText("Send the warm-up message on LinkedIn.")).toBeInTheDocument();
    expect(within(execution).getByLabelText("Message draft")).toBeInTheDocument();
    expect(
      within(execution).getByRole("button", { name: GTM_ACTION_LABELS.SEND_MESSAGE }),
    ).toBeInTheDocument();
  });

  it("adds no request on mount beyond the VIEWED lifecycle write", async () => {
    const bus = harness({ postLifecycle: () => null });
    const nba = ranking();
    renderBand(nba);

    await waitFor(() => expect(bus.apiCalls).toContain("postLifecycle"));
    // The equality. Neither component re-reads the ranking the selection already made,
    // and the only call is route 10 recording that a recommendation was put on screen.
    expect(bus.apiCalls).toEqual(["postLifecycle"]);
    expect(gtmAPI.getNextBestAction).not.toHaveBeenCalled();
    expect(gtmAPI.getProspect).not.toHaveBeenCalled();
    expect(gtmAPI.getProspectState).not.toHaveBeenCalled();

    const [brandId, leadId, input] = (gtmAPI.postLifecycle as unknown as MockInstance).mock.calls[0];
    expect(brandId).toBe(BRAND);
    expect(leadId).toBe(LEAD);
    expect(input.position).toBe("VIEWED");
    expect(input.recommendationId).toBe((nba.recommended as CandidateAction).recommendationId);
  });

  it("routes Take action to the execution surface and posts nothing of its own", async () => {
    const bus = harness({ postLifecycle: () => null });
    const onTakeAction = vi.fn();
    renderBand(ranking(), onTakeAction);

    await waitFor(() => expect(bus.apiCalls).toEqual(["postLifecycle"]));
    await bus.user.click(screen.getByRole("button", { name: NEXT_BEST_ACTION_CARD_LABELS.takeAction }));

    expect(onTakeAction).toHaveBeenCalledTimes(1);
    // The card decides and hands off; it never files an action itself.
    expect(bus.apiCalls).toEqual(["postLifecycle"]);
    expect(gtmAPI.requestAction).not.toHaveBeenCalled();
    expect(bus.open).not.toHaveBeenCalled();
  });
});

describe("accessibility", () => {
  it("is clean with a draft ready to send", async () => {
    const { container } = renderPanel({
      confirmationStatus: "WAITING_FOR_CONFIRMATION",
      nextAction: nextAction({ latestAction: action() }),
      messageVersions: [message({ version: 2, editedContent: "My own words." }), message()],
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean with an observed sent message and a failed draft", async () => {
    const { container } = render(
      <div>
        <MessageComposer
          brandId={BRAND}
          versions={[
            message({
              sentContent: "What actually went out.",
              sourceSurface: "LINKEDIN_MESSAGING_THREAD",
              observedAt: NOW,
            }),
          ]}
        />
        <MessageComposer
          brandId={BRAND}
          versions={[message({ generatedContent: null, generationFailureReason: "MODEL_TIMEOUT" })]}
        />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean with no next action at all", async () => {
    const { container } = renderPanel({ nextAction: null, messageVersions: [] });
    expect(await axe(container)).toHaveNoViolations();
  });
});
