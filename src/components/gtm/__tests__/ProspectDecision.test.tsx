// components/gtm/__tests__/ProspectDecision.test.tsx
//
// The decision surface, tested for the two claims it makes about *choice* rather than for
// its markup:
//
//   Property 10  the panel offers exactly the Contact Directly and Activate Intelligence
//                affordances and no third, and neither is favoured over the other
//                (R4.2, R4.3)
//   Property 12  the Activate Intelligence card reads identically for a resolved and an
//                unresolved identity — same text, same control, same icon (R4.6)
//
// The harness below the imports — the prop-space generator, `renderDecision`, the control
// sweep, the `mounted()` leak sentinel, and the variant/size resolver — is shared by both,
// so the second block adds assertions rather than a second copy of the setup.
//
// ── Every query in this file is scoped to its own render ───────────────────────
//
// A file whose whole subject is *how many* controls there are cannot afford a
// document-scoped query, and RTL hands you two by default: `screen`, and the queries on
// `render`'s own return value, both of which bind to `document.body`. One render
// outliving the test that made it would then move every count in the file at once. So
// each mount is unmounted by whatever mounted it — at the end of the property run, not
// the start of the next one — queries go through `renderDecision`'s `panel`, and
// `mounted()` asserts one panel on the page so a leak fails as a leak.
//
// ── Why "affordance" and not "button" ──────────────────────────────────────────
//
// R4.2 asks for exactly two controls. The panel does not always render two *buttons*:
// when `contactUnavailableReason` holds a value, the Contact control is replaced by the
// sentence that says why, in the control's place (R5.8), because a disabled button with
// no explanation tells the operator they cannot do something and not why. So the claim
// this file asserts is about the affordance *set* — one Contact affordance, either a
// control or the sentence standing in for it, plus one Activate control, and nothing
// else interactive anywhere on the panel. A fixed button count of two would be a
// weaker statement that also happened to be false half the time.
//
// The Activate side has no such branch: `activateUnavailableReason` renders *below* a
// live control rather than instead of it, since a lookup is what changes the answer.
//
// ── Why the two names are written out here ─────────────────────────────────────
//
// `CONTACT_CONTROL` and `ACTIVATE_CONTROL` are R4.2's own words, copied rather than
// imported from `PROSPECT_DECISION_LABELS`. Reading the component's table would make
// the property compare the panel against itself and pass through any renaming, and the
// requirement names these two controls exactly. The busy label is the one string taken
// from the table, because *that* wording is a design decision and not a pinned one —
// what matters here is only that the Activate affordance is still the same single
// control while it is starting.
//
// ── Why prominence is read through `buttonVariants` ────────────────────────────
//
// R4.3 is about equal prominence and about neither control being the default. A
// rendered button carries no `variant` attribute, so the treatment has to be recovered
// from its classes — and matching a literal class string would break on any theme edit
// while saying nothing about equality. Instead the six variants and four sizes are read
// out of `buttonVariants` itself, reduced to what each one *contributes* over the shared
// base, and each button is resolved to whichever treatment contributes the most classes
// still on it. That survives `cn`'s tailwind-merge dropping the overridden ones (the
// Activate button re-colours its border and background), and it lets the assertion be
// the real claim: both controls resolve to the *same* treatment, that treatment is not
// the one a `<Button>` takes by default, and neither has had the default's accent
// classes put back through `className`.

import { cleanup, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ProspectDecision } from "../ProspectDecision";
import { GTM_IDENTITY_LABELS, PROSPECT_DECISION_LABELS } from "../labels";
import { buttonVariants } from "@/components/ui/button";

// ─── The two controls R4.2 names ──────────────────────────────────────────────

const CONTACT_CONTROL = "Contact Directly";
const ACTIVATE_CONTROL = "Activate Intelligence";
/** What the one Activate control reads while a press is in flight. */
const ACTIVATE_BUSY = PROSPECT_DECISION_LABELS.activate.starting;

/**
 * Everything a user could act on.
 *
 * Wider than `button` on purpose: "no third control" has to fail for a link, a field or
 * anything given a tab stop, not only for a fourth `<button>`. The price tags render as
 * `Badge` divs and are correctly invisible to this sweep.
 */
const INTERACTIVE =
  'button, a, input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [tabindex]';

// ─── The prop space ───────────────────────────────────────────────────────────

interface DecisionSpec {
  contactUnavailableReason: string | null;
  contactPrice: number | null;
  activateUnavailableReason: string | null;
  activatePrice: number | null;
  activating: boolean;
  resolving: boolean;
  /** Whether the caller supplies `onResolveIdentity` — which is what `needsIdentity` reads. */
  canResolveIdentity: boolean;
}

/**
 * A refusal sentence, or a plausible stand-in for one.
 *
 * The real refusals dominate the distribution because they are what actually arrives:
 * `activateUnavailableReason` is `trackRefusal()`'s output verbatim. `fc.lorem` covers
 * the rest of the space — a reason this screen has never seen must not be able to add or
 * remove a control — and its word alphabet cannot accidentally contain either control's
 * name, which would make the sweep below lie.
 */
const reasonArb = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...Object.values(GTM_IDENTITY_LABELS.cannotTrack)) },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      "This lead has not been enriched yet.",
      "There is no channel to reach this person on.",
    ),
  },
  { weight: 2, arbitrary: fc.lorem({ maxCount: 14 }) },
);

/**
 * The whole prop space, at the width the panel can actually be handed.
 *
 * `freq: 2` on both reasons so blocked and unblocked are each about half the runs rather
 * than the 1-in-6 `fc.option` defaults to — the blocked Contact branch is where the
 * affordance stops being a button, which is the case worth generating a lot of.
 *
 * Prices include `0`, which is a real answer ("Included") and not an absence, and `null`,
 * which renders no tag at all. Neither is a control, and the property is what proves it.
 *
 * There is no `resolveLabel` in this space because there is no longer such a prop. It was
 * declared, destructured and rendered nowhere — dead before this feature — and task 12.1
 * removed it from `ProspectDecisionProps`, from the component and from the one call site
 * that handed it `GTM_IDENTITY_LABELS.resolve`. Generating a value the panel cannot accept
 * would be asserting over a way in that no longer exists.
 */
const specArb: fc.Arbitrary<DecisionSpec> = fc.record({
  contactUnavailableReason: fc.option(reasonArb, { nil: null, freq: 2 }),
  contactPrice: fc.option(fc.nat({ max: 99 }), { nil: null }),
  activateUnavailableReason: fc.option(reasonArb, { nil: null, freq: 2 }),
  activatePrice: fc.option(fc.nat({ max: 99 }), { nil: null }),
  activating: fc.boolean(),
  resolving: fc.boolean(),
  canResolveIdentity: fc.boolean(),
});

// ─── Harness ──────────────────────────────────────────────────────────────────

const noop = () => {};

/** The panel's own root, so "how many controls" cannot be answered by someone else's DOM. */
const PANEL = '[data-gtm-section="decision"]';

/**
 * Mounts the panel for one spec and hands back its interactive elements.
 *
 * Everything this returns is scoped to the render's own `container`. That is deliberate
 * and it is not what `render` gives you by default: RTL binds both `screen` and the
 * queries on its own return value to `baseElement`, which is `document.body`. A
 * document-scoped `getAllByRole("button")` in a file that mounts this panel a hundred
 * times answers "how many buttons are on the page", and the moment one render outlives
 * the test that made it every count in the file is wrong at once — which is a confusing
 * count mismatch rather than a legible "something leaked". So the queries below are
 * `within(container)`, and `mounted()` is the sentinel that says so out loud.
 */
const renderDecision = (spec: DecisionSpec) => {
  const utils = render(
    <ProspectDecision
      onContactDirectly={noop}
      contactUnavailableReason={spec.contactUnavailableReason}
      contactPrice={spec.contactPrice}
      onActivate={noop}
      activating={spec.activating}
      activateUnavailableReason={spec.activateUnavailableReason}
      activatePrice={spec.activatePrice}
      onResolveIdentity={spec.canResolveIdentity ? noop : undefined}
      resolving={spec.resolving}
    />,
  );

  return {
    ...utils,
    /** Every element on the panel a user could act on, in document order. */
    controls: () => Array.from(utils.container.querySelectorAll<HTMLElement>(INTERACTIVE)),
    /** Role and text queries, scoped to this render rather than to `document.body`. */
    panel: within(utils.container),
  };
};

/** How many decision panels are mounted anywhere. Exactly one, or something leaked. */
const mounted = () => document.body.querySelectorAll(PANEL).length;

const text = (el: Element) => el.textContent ?? "";
const isContactControl = (el: Element) => text(el).includes(CONTACT_CONTROL);
const isActivateControl = (el: Element) =>
  text(el).includes(ACTIVATE_CONTROL) || text(el).includes(ACTIVATE_BUSY);

// ─── Reading a button's treatment back out of `buttonVariants` ────────────────

const BUTTON_VARIANTS = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;
const BUTTON_SIZES = ["default", "sm", "lg", "icon"] as const;

type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
type ButtonSize = (typeof BUTTON_SIZES)[number];

const classSet = (classes: string) => new Set(classes.trim().split(/\s+/).filter(Boolean));

/**
 * What each option in one cva dimension contributes over the classes all of them share.
 *
 * The shared part is the recipe's base string, which says nothing about prominence. What
 * is left is the treatment: `bg-primary …` for the default variant, `border border-input
 * bg-background …` for the outline one.
 */
const contributions = <T extends string>(
  options: readonly T[],
  emit: (option: T) => string,
): Map<T, Set<string>> => {
  const emitted = new Map(options.map((option) => [option, classSet(emit(option))]));
  const shared = [...emitted.values()].reduce(
    (accumulator, current) => new Set([...accumulator].filter((c) => current.has(c))),
  );

  return new Map(
    options.map((option) => [
      option,
      new Set([...emitted.get(option)!].filter((c) => !shared.has(c))),
    ]),
  );
};

const VARIANT_CLASSES = contributions(BUTTON_VARIANTS, (variant) => buttonVariants({ variant }));
const SIZE_CLASSES = contributions(BUTTON_SIZES, (size) => buttonVariants({ size }));

/**
 * Which option a rendered button carries, or `null` when that cannot be told.
 *
 * "The most classes still present" rather than "all of them present", because a call site
 * may override part of a treatment: the Activate button re-colours its border and
 * background, and tailwind-merge drops the outline variant's `border-input`,
 * `bg-background` and `hover:bg-accent` on the way out. What survives — `border`,
 * `hover:text-accent-foreground` — still belongs to exactly one variant.
 *
 * `null` on a tie or on nothing matching is a failure the caller asserts against, not a
 * fallback: a button whose treatment cannot be identified is one whose prominence cannot
 * be compared, and quietly passing that would be the bug this property exists to catch.
 */
const resolveTreatment = <T extends string>(
  el: Element,
  catalogue: Map<T, Set<string>>,
): T | null => {
  const carried = new Set(el.classList);
  const scored = [...catalogue.entries()]
    .map(([option, classes]) => ({
      option,
      matched: [...classes].filter((c) => carried.has(c)).length,
    }))
    .sort((a, b) => b.matched - a.matched);

  if (scored[0].matched === 0) return null;
  if (scored[1] && scored[1].matched === scored[0].matched) return null;
  return scored[0].option;
};

const variantOf = (el: Element) => resolveTreatment(el, VARIANT_CLASSES);
const sizeOf = (el: Element) => resolveTreatment(el, SIZE_CLASSES);

/**
 * The variant a `<Button>` takes when the call site names none — cva's `defaultVariants`,
 * read through the same resolver rather than written down.
 *
 * This is what "neither control is the default choice" has to be measured against. If the
 * design system ever renames its primary treatment, this moves with it.
 */
const CVA_DEFAULT_VARIANT = (() => {
  const probe = document.createElement("button");
  probe.className = buttonVariants();
  return variantOf(probe);
})();

// ─── Property 10 ──────────────────────────────────────────────────────────────

describe("Feature: sales-workflow-frontend-restructure, Property 10: The decision offers exactly two controls with neither favoured", () => {
  it("resolves the design system's own default treatment, so 'not the default' means something", () => {
    // The resolver is the instrument the property reads with, and an instrument that
    // returned `null` for everything would make every assertion below vacuous.
    expect(CVA_DEFAULT_VARIANT).not.toBeNull();
  });

  it(
    "offers the two affordances and no third, on one shared non-default treatment",
    // A hundred mounts do not fit the 5s default, and this file shares a runner with a
    // slow axe sweep.
    { timeout: 60_000 },
    () => {
      // The treatment the pair actually carries, read off one live render rather than
      // written down as a variant name: the property is that the two *match* and that the
      // match is not the default, not that it is any particular one of the six.
      const baseline = renderDecision({
        contactUnavailableReason: null,
        contactPrice: 2,
        activateUnavailableReason: null,
        activatePrice: 2,
        activating: false,
        resolving: false,
        canResolveIdentity: false,
      });
      // Found by name, not by position: a stray third control must fail the count
      // assertion below with the count, rather than corrupting the reading it is
      // measured against.
      const referenceControl = baseline.controls().find(isContactControl);
      expect(referenceControl).toBeDefined();
      const reference = {
        variant: variantOf(referenceControl!),
        size: sizeOf(referenceControl!),
      };
      expect(reference.variant).not.toBeNull();
      expect(reference.variant).not.toBe(CVA_DEFAULT_VARIANT);

      // Read, then unmounted, before a single run starts. `reference` holds two resolved
      // variant names and not the element they came from, so nothing below can reach back
      // into a render that is no longer on the page — and the runs get an empty document
      // to start from instead of inheriting this one.
      cleanup();

      /** The classes that would mark a control as the default choice. */
      const accentClasses = [...VARIANT_CLASSES.get(CVA_DEFAULT_VARIANT as ButtonVariant)!];

      fc.assert(
        fc.property(specArb, (spec) => {
          // Cleanup belongs at the *end* of a run, not the start. The automatic cleanup in
          // `test/setup.ts` fires between tests and this property mounts the panel a
          // hundred times inside one, so each run unmounts what it mounted rather than
          // leaving it for the next run — or for the examples below — to trip over.
          const { container, controls, panel } = renderDecision(spec);
          try {
            // One panel on the page, so every count below is this run's answer. A leak
            // fails here, saying it leaked, instead of two runs downstream as an
            // inexplicable control count.
            expect(mounted()).toBe(1);

            const present = controls();
            const contact = present.filter(isContactControl);
            const activate = present.filter(isActivateControl);

            // Same sweep, read through the accessibility tree and scoped to this render:
            // `present` is the structural count and this is the count a user gets. They
            // agree, or one of them is measuring the wrong document.
            expect(panel.queryAllByRole("button")).toHaveLength(present.length);

            // ── Exactly two affordances ──
            if (spec.contactUnavailableReason === null) {
              // Unblocked: the Contact affordance is a control (R5.5 — this reason is its
              // only gate, so every other prop combination leaves it live).
              expect(contact).toHaveLength(1);
            } else {
              // Blocked: the control is gone and the sentence stands in its place, so the
              // affordance is still accounted for and the operator is told why (R5.8).
              expect(contact).toHaveLength(0);
              expect(container.textContent).toContain(spec.contactUnavailableReason);
            }

            // Always a control, whatever the identity verdict and whichever handler the
            // press routes to. A refusal is rendered under it, never instead of it.
            expect(activate).toHaveLength(1);

            // ── And no third ──
            // Every interactive element on the panel is one of those two. This is what a
            // re-introduced "Find their LinkedIn profile" control, a price tag that became
            // pressable, or a third card would break first.
            expect(present).toHaveLength(contact.length + activate.length);

            // ── Neither favoured ──
            // Same treatment, same size, on every control that is on screen — so the pair
            // is never one filled button beside one outlined one — and that treatment is
            // not the one a `<Button>` takes by default (R4.3).
            present.forEach((control) => {
              expect(variantOf(control)).toBe(reference.variant);
              expect(sizeOf(control)).toBe(reference.size);

              // No accent put back through `className`: carrying any of the default
              // treatment's classes would favour one control while still resolving to the
              // shared variant.
              accentClasses.forEach((c) => expect(control.classList.contains(c)).toBe(false));

              // Nor by HTML: a submit is a form's default answer, and an autofocused
              // control is the one the product has chosen for the operator.
              expect(control).toHaveAttribute("type", "button");
              expect(control).not.toHaveFocus();
            });
          } finally {
            // Including on the run that fails. fast-check shrinks by re-running the
            // predicate, so a failed run that left its panel mounted would hand the
            // shrinker a document with two panels in it and a counterexample that
            // describes the harness rather than the component.
            cleanup();
          }
        }),
        { numRuns: 100 },
      );

      // Nothing outlives the property. The examples below query by accessible name and
      // would otherwise be reading this test's hundredth render.
      expect(mounted()).toBe(0);
    },
  );

  // ── The readable examples ───────────────────────────────────────────────────
  //
  // The property above answers "how many, and equally prominent". These three answer
  // "which two", by accessible name, so a rename or a swapped handler fails with the
  // actual strings rather than with a generated spec.

  const spec = (overrides: Partial<DecisionSpec> = {}): DecisionSpec => ({
    contactUnavailableReason: null,
    contactPrice: 1,
    activateUnavailableReason: null,
    activatePrice: 2,
    activating: false,
    resolving: false,
    canResolveIdentity: false,
    ...overrides,
  });

  it("offers exactly Contact Directly and Activate Intelligence", () => {
    const { controls, panel } = renderDecision(spec());

    expect(mounted()).toBe(1);
    const buttons = panel.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName(new RegExp(`^${CONTACT_CONTROL}`));
    expect(buttons[1]).toHaveAccessibleName(ACTIVATE_CONTROL);

    // The price tags sit beside both controls and are not controls themselves.
    expect(controls()).toHaveLength(2);
  });

  it("states the reason in the Contact control's place and still offers Activate", () => {
    const reason = GTM_IDENTITY_LABELS.cannotTrack.noAddress;
    const { controls, panel } = renderDecision(spec({ contactUnavailableReason: reason }));

    expect(mounted()).toBe(1);
    expect(panel.queryByRole("button", { name: new RegExp(CONTACT_CONTROL) })).toBeNull();
    expect(panel.getByText(reason)).toBeInTheDocument();
    expect(controls()).toHaveLength(1);
    expect(panel.getByRole("button")).toHaveAccessibleName(ACTIVATE_CONTROL);
  });

  it("keeps the pair to one control each while a press is in flight", () => {
    // `resolving` is the identity lookup running behind the Activate button. It renames
    // that control and disables it; it must not add or remove one.
    const { controls, panel } = renderDecision(
      spec({ resolving: true, canResolveIdentity: true, activateUnavailableReason: "held" }),
    );

    expect(mounted()).toBe(1);
    const [contact, busy] = controls();
    expect(controls()).toHaveLength(2);
    expect(busy).toBe(panel.getByRole("button", { name: ACTIVATE_BUSY }));
    expect(busy).toBeDisabled();
    // Disabled is not favoured-against: the pair still carries one treatment.
    expect(variantOf(busy)).toBe(variantOf(contact));
  });
});

// ─── Reading one card, and the control on it ──────────────────────────────────
//
// Property 12's subject is narrower than Property 10's. R4.6 is a claim about the
// *Activate Intelligence card*, so the panel's heading and the whole Contact column have
// to be outside the comparison — otherwise a generated `contactUnavailableReason` would
// dominate every string this property compares and the assertions would be about the
// wrong card.

/** A control's visible text, normalised the way an accessible name is computed. */
const accessibleText = (el: Element) => text(el).trim().replace(/\s+/g, " ");

/**
 * The Activate Intelligence card: the subtree R4.6 makes its claim about.
 *
 * **Not found through the control**, which is the one thing this locator must not do.
 * Property 10 finds its controls by label — right for a claim about the affordance *set* —
 * but Property 12's claim is that the label does not change, and a locator that matched on
 * that label would only ever report a rename as a control that went missing. So the card
 * is anchored on the header paragraph that names it, which is rendered unconditionally and
 * independently of the button, and the control is then whatever is interactive inside.
 *
 * From there it climbs until one more step up would swallow the Contact card, marked by
 * the `CONTACT_CONTROL` its own header paragraph carries in every branch — including the
 * blocked one, where the Contact *button* is gone. Structural rather than positional: no
 * `nth-child` and no Tailwind class, so this survives a re-wrap or the two columns being
 * reordered.
 */
const activateCardOf = (root: Element): Element => {
  const headings = Array.from(root.querySelectorAll("p")).filter(
    (p) => text(p).trim() === ACTIVATE_CONTROL,
  );
  // Exactly one paragraph names the card. Two would mean the anchor is ambiguous and the
  // card this returns is a guess.
  expect(headings).toHaveLength(1);

  let node: Element = headings[0];
  while (
    node.parentElement &&
    node.parentElement !== root &&
    root.contains(node.parentElement) &&
    !text(node.parentElement).includes(CONTACT_CONTROL)
  ) {
    node = node.parentElement;
  }

  return node;
};

/** One render of the Activate card, reduced to the four things R4.6 constrains. */
interface ActivateProbe {
  /** Everything the card says, in document order. */
  card: string;
  /** What a screen reader announces for the control. */
  name: string;
  /**
   * The control's own markup.
   *
   * The icon is the reason this is compared as markup and not as text: §3.4 removed a
   * `Radar`-for-`Brain` swap on the unresolved branch, and an icon swap moves no text at
   * all. `disabled` rides along in the same string, which is the other attribute
   * `needsIdentity` still touches.
   */
  control: string;
  /** The whole panel's markup, for a prop that must not reach the DOM at all. */
  markup: string;
}

/**
 * Mounts the panel for one spec, reads the Activate card, and unmounts.
 *
 * Returns plain strings rather than elements, so a comparison between two renders is
 * never a comparison against a node that has left the page — and so the document is empty
 * again before the next render, which is what lets the `mounted()` sentinel mean
 * something when a run mounts the panel four times.
 */
const probeActivate = (spec: DecisionSpec): ActivateProbe => {
  const { container } = renderDecision(spec);

  try {
    // One panel, so `activateCardOf` is climbing this render's DOM and not the wreckage
    // of the previous probe.
    expect(mounted()).toBe(1);

    const card = activateCardOf(container);
    // The instrument, checked before anything is read through it: one card, and not the
    // panel it sits in.
    expect(text(card)).not.toContain(CONTACT_CONTROL);

    // The card's control, by what it is rather than by what it says. Property 10 owns the
    // count; this asserts it because reading "the" control off a card that had two would
    // silently compare the wrong element.
    const inside = Array.from(card.querySelectorAll<HTMLElement>(INTERACTIVE));
    expect(inside).toHaveLength(1);
    const control = inside[0];

    // The control's accessible name is its visible text — no `aria-label` naming a lookup
    // behind copy that does not. That equality is what makes comparing this string across
    // two renders a comparison of what is announced, not just of what is painted.
    const name = accessibleText(control);
    expect(control).toHaveAccessibleName(name);

    return {
      card: text(card),
      name,
      control: control.outerHTML,
      markup: container.innerHTML,
    };
  } finally {
    // At the end of the probe, including the failing one the shrinker re-enters.
    cleanup();
  }
};

// ─── Property 12 ──────────────────────────────────────────────────────────────

describe("Feature: sales-workflow-frontend-restructure, Property 12: The Activate card is invariant under the identity verdict", () => {
  it(
    "reads identically for a resolved and an unresolved identity",
    // Four mounts a run, a hundred runs.
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(specArb, reasonArb, (base, reason) => {
          // Three renders of one prop set, differing only in the identity verdict. The
          // component reads that verdict through two props at once —
          // `needsIdentity = activateUnavailableReason !== null && Boolean(onResolveIdentity)`
          // — so the three combinations that produce different behaviour are all here:
          //
          //   resolved    nothing is blocking activation; the press runs `onActivate`
          //   unresolved  blocked, and a lookup is what unblocks it. This is R4.6's
          //               "unresolved identity": `needsIdentity` is true, the press routes
          //               through `onResolveIdentity`, and the refusal is suppressed
          //               because there is a control that changes the answer
          //   stranded    the same refusal with no lookup on offer — `noAddress`,
          //               `unrecognised`. `needsIdentity` is false, so the server's
          //               sentence is shown (R17.8)
          //
          // Everything else — both prices, `contactUnavailableReason`, `activating` and
          // `resolving` — is held at whatever the generator drew, so the claim is about the
          // verdict and not about a tidy set of props.
          const resolved = probeActivate({ ...base, activateUnavailableReason: null });
          const unresolved = probeActivate({
            ...base,
            activateUnavailableReason: reason,
            canResolveIdentity: true,
          });
          const stranded = probeActivate({
            ...base,
            activateUnavailableReason: reason,
            canResolveIdentity: false,
          });

          // ── R4.6 ──
          // Byte-identical card text, not "the label still matches". `needsIdentity`
          // survived task 9.1 only to choose the handler, gate `disabled` and suppress the
          // refusal paragraph, so an unresolved prospect's card is the resolved one
          // character for character. This is what fails if the headline, the busy branch,
          // or a note under the button ever starts reading the verdict again.
          expect(unresolved.card).toBe(resolved.card);
          // Same control, announced the same way and rendered the same way — the second
          // assertion is where the icon lives.
          expect(unresolved.name).toBe(resolved.name);
          expect(unresolved.control).toBe(resolved.control);

          // ── The one difference a refusal is allowed to make ──
          // When no lookup can fix it, the server's sentence is appended below the
          // control, and *that is the whole delta*: the card's own copy is untouched and
          // the control is still the same control. Stated as an equation rather than as
          // "contains the reason", so a second string appearing anywhere on the card would
          // fail here.
          expect(stranded.card).toBe(resolved.card + reason);
          expect(stranded.name).toBe(resolved.name);
          expect(stranded.control).toBe(resolved.control);

          // There used to be a fourth probe here, holding `resolveLabel` at `undefined` and
          // asserting the markup did not move. The prop is gone from `ProspectDecisionProps`
          // as of task 12.1 — the panel cannot be handed the string at all now, which is a
          // stronger guarantee than a render that ignored it, and it is the type checker
          // that enforces it rather than a hundred runs of this property.
        }),
        { numRuns: 100 },
      );

      // Nothing outlives the property.
      expect(mounted()).toBe(0);
    },
  );

  // ── The readable examples ───────────────────────────────────────────────────
  //
  // The property above says "identical". These say *what* the identical thing is, by
  // accessible name, so a regression fails with the two strings rather than with a
  // generated spec.

  const spec = (overrides: Partial<DecisionSpec> = {}): DecisionSpec => ({
    contactUnavailableReason: null,
    contactPrice: 1,
    activateUnavailableReason: null,
    activatePrice: 2,
    activating: false,
    resolving: false,
    canResolveIdentity: false,
    ...overrides,
  });

  /** The refusal a lookup answers, and the one it cannot. */
  const UNRESOLVED = GTM_IDENTITY_LABELS.cannotTrack.unresolved;
  const NO_ADDRESS = GTM_IDENTITY_LABELS.cannotTrack.noAddress;

  it("calls the control Activate Intelligence on an unresolved prospect", () => {
    const unresolved = probeActivate(
      spec({ activateUnavailableReason: UNRESOLVED, canResolveIdentity: true }),
    );
    const resolved = probeActivate(spec());

    // Not "Find their LinkedIn profile", which is what this control used to say once the
    // identity was unresolved (§3.4). The card is called Activate Intelligence, so its
    // button is too — for both prospects.
    expect(unresolved.name).toBe(ACTIVATE_CONTROL);
    expect(resolved.name).toBe(ACTIVATE_CONTROL);
    expect(unresolved.card).toBe(resolved.card);

    // The refusal a lookup answers is not printed: the button is the answer.
    expect(unresolved.card).not.toContain(UNRESOLVED);
  });

  it("reads Starting intelligence in both busy branches", () => {
    // `resolving` is the identity lookup running behind this button; `activating` is the
    // track request. The card used to distinguish them — "Finding their profile" while
    // looking up, "Starting intelligence" while activating — which put the plumbing on
    // screen at the one moment the operator is watching it (R4.5, R6.6, §3.3 item 4).
    const looking = probeActivate(
      spec({ resolving: true, activateUnavailableReason: UNRESOLVED, canResolveIdentity: true }),
    );
    const starting = probeActivate(spec({ activating: true }));

    expect(looking.name).toBe(ACTIVATE_BUSY);
    expect(starting.name).toBe(ACTIVATE_BUSY);
    expect(looking.card).toBe(starting.card);
    expect(looking.card).not.toContain(GTM_IDENTITY_LABELS.trackLookingUp);
    expect(looking.card).not.toContain(GTM_IDENTITY_LABELS.trackFirstStep);
  });

  it("states a refusal a lookup cannot fix, below the unchanged control", () => {
    const { container, panel } = renderDecision(
      spec({ activateUnavailableReason: NO_ADDRESS, canResolveIdentity: false }),
    );

    try {
      expect(mounted()).toBe(1);

      const control = panel.getByRole("button", { name: ACTIVATE_CONTROL });
      const sentence = panel.getByText(NO_ADDRESS);

      // Below the control, never instead of it (R17.8): the operator is told why, and the
      // affordance the panel is built around does not move.
      expect(control.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
      expect(control).toBeEnabled();
      // And the card that holds both is still the Activate card, with the sentence on it
      // rather than in the Contact column.
      expect(text(activateCardOf(container))).toContain(NO_ADDRESS);
    } finally {
      cleanup();
    }
  });

  it("suppresses that sentence when a lookup is on offer, and nothing else changes", () => {
    // The same refusal, once with `onResolveIdentity` and once without. The paragraph is
    // the only thing allowed to differ — the label and the icon are not, which is the
    // asymmetry the property states as an equation.
    const withLookup = probeActivate(
      spec({ activateUnavailableReason: NO_ADDRESS, canResolveIdentity: true }),
    );
    const withoutLookup = probeActivate(
      spec({ activateUnavailableReason: NO_ADDRESS, canResolveIdentity: false }),
    );

    expect(withLookup.card).not.toContain(NO_ADDRESS);
    expect(withoutLookup.card).toBe(withLookup.card + NO_ADDRESS);
    expect(withoutLookup.control).toBe(withLookup.control);
  });

  it("never names the lookup on the unresolved card", () => {
    // What the deleted `resolveLabel` example was really guarding: `GTM_IDENTITY_LABELS
    // .resolve` — "Find their LinkedIn profile" — must not appear on the card that is about
    // to run one. It used to arrive through a prop, which is why the assertion was framed as
    // "the panel is unchanged by it"; the prop is gone, so the claim is stated directly
    // against the surface instead.
    const unresolved = probeActivate(
      spec({ activateUnavailableReason: UNRESOLVED, canResolveIdentity: true }),
    );

    expect(unresolved.markup).not.toContain(GTM_IDENTITY_LABELS.resolve);
    expect(unresolved.card).not.toContain(GTM_IDENTITY_LABELS.resolve);
  });
});
