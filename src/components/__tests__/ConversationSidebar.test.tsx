// components/__tests__/ConversationSidebar.test.tsx
//
// The navigation suite. Three properties live here, each in its own block:
//
//   Property 1  every destination targets its templated path
//   Property 2  no presented affordance targets a retired destination
//   Property 3  exactly one navigation entry is marked current       (task 10.6)
//
// The harness above the first block — the destination declarations, the space-identifier
// generator, the location probe and `renderSidebar` — is deliberately shared, so each
// later block adds assertions rather than a second copy of the setup. Property 2's
// retired-path vocabulary (`RETIRED_PREFIXES`, `isRetiredTarget`) is shared the same way.
//
// ── Why the target is read off a real navigation rather than a mocked `useNavigate` ──
//
// A sidebar entry is a `<button>` whose handler calls `navigate(item.path)`. There is no
// `href` to inspect, so "what does this entry target" can only be answered by pressing it
// and reading where the router ended up. Partially mocking `react-router-dom` to spy on
// `useNavigate` would answer a weaker question — what argument the component passed —
// and would keep passing if the router ever stopped honouring it. Pressing the entry
// inside a `MemoryRouter` and reading `useLocation()` back is the whole path: handler,
// router, resulting location.
//
// The probe reads `pathname + search + hash`, not `pathname` alone. A target that
// smuggled a query string or a fragment onto the path would otherwise compare equal to
// the declared template, and the requirement is an exact destination.
//
// `AuthContext` is mocked because `useAuth()` throws outside its provider and the real
// provider reaches for the network on mount. The only thing the sidebar takes from it is
// `exitSpace`, for the Spaces button. That button is not one of the seven presented
// destinations, so Property 1 leaves it alone; Property 2 presses it anyway, because its
// subject is where nothing on the surface goes rather than where the seven go.
//
// This is the first suite that mounts `ConversationSidebar` for real; every page suite
// stubs it as chrome.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import fc from "fast-check";

import ConversationSidebar from "../ConversationSidebar";
import { retiredPathsFor } from "@/routes/retired";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ exitSpace: vi.fn() }),
}));

// ─── The declared destinations ────────────────────────────────────────────────
//
// An independent copy of R1.1–R1.3 and R1.7, written out here rather than imported from
// the component. Importing the component's own tables would make the property a tautology
// — it would compare the sidebar against itself and pass through any renaming or
// re-pathing. These lists are the requirement; the component is the thing under test.

/** The four Primary_Destinations, in the order R1.1 fixes, with the R1.3 targets. */
const JOURNEY_DESTINATIONS = [
  { label: "Market Intelligence", template: (id: string) => `/eva/${id}` },
  { label: "Prospect Intelligence", template: (id: string) => `/prospect-intelligence/${id}` },
  { label: "Action Queue", template: (id: string) => `/action-queue/${id}` },
  { label: "Nina", template: (id: string) => `/ninna/${id}` },
] as const;

/** The three Supporting_Destinations, in the order R1.2 fixes. Analytics is R1.7's. */
const WORKSPACE_DESTINATIONS = [
  { label: "Meetings", template: (id: string) => `/sales-workspace/${id}` },
  { label: "Analytics", template: (id: string) => `/analytics/${id}` },
  { label: "Settings", template: (id: string) => `/connections/${id}` },
] as const;

/** The presented list, in presentation order: journey first, then workspace. */
const PRESENTED_DESTINATIONS = [...JOURNEY_DESTINATIONS, ...WORKSPACE_DESTINATIONS];

/** The two groups' accessible names, which is how the suite finds each list. */
const JOURNEY_NAV = "Go-to-market journey";
const WORKSPACE_NAV = "Workspace";

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * A workspace identifier, constrained to what can actually arrive here and no narrower.
 *
 * `spaceId` reaches the sidebar as a route parameter the page read out of the path, so it
 * is always a single URL path segment: the identifier formats the product issues (uuid,
 * ulid, hex object identifier), plus the general alphanumeric-with-separators shape, plus
 * the short hand-written ones the fixtures use.
 *
 * Deliberately excluded: identifiers carrying `/`, `?`, `#` or a percent escape. Those are
 * not space identifiers — a path separator or a query delimiter inside the segment would
 * make "the template filled with the identifier" a different *route*, not a different
 * target, and the assertion would be about URL parsing rather than about navigation.
 */
const SPACE_ID_UNIT = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".split(""),
);

const spaceIdArb: fc.Arbitrary<string> = fc.oneof(
  fc.uuid(),
  fc.ulid(),
  fc.string({ unit: SPACE_ID_UNIT, minLength: 1, maxLength: 40 }),
  fc.constantFrom("brand-1", "b21005a0", "1", "space_2", "a"),
);

// ─── Harness ──────────────────────────────────────────────────────────────────

const LOCATION_PROBE = "location-probe";

/** Renders the location the router actually settled on, target and all. */
const LocationProbe = () => {
  const location = useLocation();
  return (
    <span data-testid={LOCATION_PROBE}>
      {`${location.pathname}${location.search}${location.hash}`}
    </span>
  );
};

/**
 * Mounts the sidebar under a real router at `at`, with a probe for the current location.
 *
 * @param spaceId - The workspace the entries are templated with.
 * @param at - The starting location. `/spaces` by default, which is none of the seven, so
 *   nothing is current until something is pressed.
 */
const renderSidebar = (spaceId: string, at = "/spaces") => {
  const utils = render(
    <MemoryRouter initialEntries={[at]}>
      <ConversationSidebar spaceId={spaceId} onNewChat={() => {}} onSelectConversation={() => {}} />
      <LocationProbe />
    </MemoryRouter>,
  );

  /** The seven entry buttons, journey group first, in rendered order. */
  const entryButtons = () => [
    ...within(utils.getByRole("navigation", { name: JOURNEY_NAV })).getAllByRole("button"),
    ...within(utils.getByRole("navigation", { name: WORKSPACE_NAV })).getAllByRole("button"),
  ];

  return {
    ...utils,
    entryButtons,
    currentPath: () => utils.getByTestId(LOCATION_PROBE).textContent ?? "",
  };
};

// ─── Property 1 ───────────────────────────────────────────────────────────────

describe("Feature: sales-workflow-frontend-restructure, Property 1: Every destination targets its templated path", () => {
  it(
    "sends every presented entry to its declared template filled with the space identifier",
    // A hundred mounts and seven hundred presses do not fit the 5s default.
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(spaceIdArb, (spaceId) => {
          // `cleanup()` per run rather than per test: the automatic one in
          // `test/setup.ts` fires between tests, and a property mounts the sidebar a
          // hundred times inside one.
          cleanup();
          const { entryButtons, currentPath } = renderSidebar(spaceId);
          // Captured once. Pressing an entry re-renders the sidebar, but the entry keys
          // are stable, so React keeps the same button nodes and these references stay
          // live — and one accessible-name pass per mount rather than one per press
          // keeps a hundred runs inside a few seconds.
          const buttons = entryButtons();

          PRESENTED_DESTINATIONS.forEach((destination, index) => {
            // The path and the label have to belong to the same entry, or "Analytics
            // targets the analytics route" could pass while Analytics targeted Meetings.
            expect(buttons[index].textContent).toContain(destination.label);

            fireEvent.click(buttons[index]);
            expect(currentPath()).toBe(destination.template(spaceId));
          });
        }),
        { numRuns: 100 },
      );
    },
  );

  it("fills the template rather than matching a prefix of it", () => {
    // One concrete workspace, spelled out, as the readable regression: an entry that
    // dropped the identifier or appended a suffix fails here with the actual string
    // rather than with a generated one.
    const { entryButtons, currentPath } = renderSidebar("brand-1");

    const targets = PRESENTED_DESTINATIONS.map((_, index) => {
      fireEvent.click(entryButtons()[index]);
      return currentPath();
    });

    expect(targets).toEqual([
      "/eva/brand-1",
      "/prospect-intelligence/brand-1",
      "/action-queue/brand-1",
      "/ninna/brand-1",
      "/sales-workspace/brand-1",
      "/analytics/brand-1",
      "/connections/brand-1",
    ]);
  });

  it("presents exactly the four primary destinations, in order", () => {
    const { getByRole } = renderSidebar("brand-1");
    const journey = within(getByRole("navigation", { name: JOURNEY_NAV })).getAllByRole("button");

    expect(journey).toHaveLength(JOURNEY_DESTINATIONS.length);
    JOURNEY_DESTINATIONS.forEach((destination, index) => {
      expect(journey[index].textContent).toContain(destination.label);
    });
  });

  it("presents exactly the three supporting destinations, in order", () => {
    const { getByRole } = renderSidebar("brand-1");
    const workspace = within(getByRole("navigation", { name: WORKSPACE_NAV })).getAllByRole(
      "button",
    );

    expect(workspace).toHaveLength(WORKSPACE_DESTINATIONS.length);
    WORKSPACE_DESTINATIONS.forEach((destination, index) => {
      expect(workspace[index].textContent).toContain(destination.label);
    });
  });

  it("presents seven entries and no eighth", () => {
    // The count is the claim R1.1 and R1.2 make together, and it is what a
    // re-introduced Learning or Outreach entry would break first.
    const { entryButtons } = renderSidebar("brand-1");
    expect(entryButtons()).toHaveLength(PRESENTED_DESTINATIONS.length);
  });
});
// ─── Property 2 ───────────────────────────────────────────────────────────────
//
// "No presented affordance targets a retired destination" is a claim about a whole
// surface, not about one table, so it is asserted in two halves that answer different
// questions and fail for different reasons.
//
// **The rendered half** presses every control the sidebar puts on screen — the seven
// entries and the Spaces button — inside a real router and reads the resulting location,
// exactly as Property 1 does, and checks it against `retiredPathsFor()`. It also reads
// every `href` in the subtree, because a cross-link is an anchor rather than a handler.
// This half is exhaustive for the sidebar and says nothing about any other surface.
//
// **The source half** answers the part the rendered half cannot reach. R2.4's subject is
// every in-page control, cross-link and empty-state call to action on the restructured
// surfaces, and mounting all six of them here would mean six pages' worth of mocks in a
// navigation suite — and each of those surfaces has, or will have, its own suite. What is
// cheap and exact is reading their sources and extracting what their `navigate()` calls
// and their `to` / `href` attributes actually target. That is a weaker instrument than a
// render (it sees a literal, not a click) but it is a wider one, and it is the same
// instrument `services/__tests__/gtmAPI.test.ts` uses for its credential prohibition.
//
// Comments are stripped before the scan for the reason that suite gives: several of these
// files discuss the retired paths on purpose — `ConversationSidebar.tsx` names all three
// removals in prose, `routes/retired.ts` is nothing but prose about them — and a scan that
// could not tell a comment from a target would fail on the text explaining the rule.
//
// ── The outstanding-removal ledger ──
//
// The ledger below records the retired targets that still exist because the restructure task
// that removes one has not landed, and the scan asserts that every retired target it finds is
// *in* the ledger — a subset, not an equality. That shape is deliberate: it fails the moment
// a surface gains a retired target nobody signed off on, and it keeps passing as each
// acknowledged one is removed, so it never has to be relaxed to let the removals land. When a
// surface is cleaned, its row comes out with the same commit; the property is complete when
// the ledger is empty.
//
// **It is now empty, which is that completion condition.** Every restructured surface targets
// only live destinations, and the subset assertion below has become an emptiness assertion
// over the whole scan.
//
// **`GTMActionQueue.tsx`'s row is out.** Task 16.1 re-sourced the checklist from the
// attention feed, and selecting a task now follows `AttentionItem.route` — the server's own
// string — instead of building a `/relationship-intelligence/…` path. The page targets no
// retired destination, so its ledger row came out with that change.
//
// **`Meetings.tsx`'s row is out, and it was the last one.** Its `/sales/` target was
// `NoMeetingsYet`'s empty-state call to action, via `openMax`. Task 18.1 re-sourced the page
// from the GTM reads and deleted that component, the funnel it animated and the `maxAPI`
// import behind all of it; selecting a meeting now goes to the dossier through
// `prospectRoute()`. So the row came out with that change.
//
// **`ProspectIntelligence.tsx`'s row is out, and it was the last of §1.3's two named
// removals.** `onOpenRelationshipIntelligence` went with task 12.3; its two remaining call
// sites — the pre-activation contact handler and the take-action handler, both
// `navigate("/relationship-intelligence/…")` — went with task 12.4, which replaced the
// navigation with the `Contextual_Outreach_Surface` inside the dossier. `onOpenMax` and its
// `/sales/` target went with 12.3. The file targets no retired destination now, and the
// third assertion below is what holds it there.

/** A stand-in no real workspace identifier can collide with. */
const SPACE_ID_SENTINEL = "__SPACE_ID__";

/**
 * The retired path prefixes: `/gtm-dashboard/`, `/sales/`, `/sales-workspace-legacy/` and
 * `/relationship-intelligence/`.
 *
 * Read back out of `retiredPathsFor()` by templating it with a sentinel rather than
 * restated as literals. §1.3's whole point is one vocabulary, and a second copy here would
 * let the module and the scan disagree about what "retired" means — which is the one
 * failure this property cannot afford, since it would fail open.
 */
const RETIRED_PREFIXES: readonly string[] = retiredPathsFor(SPACE_ID_SENTINEL).map((path) =>
  path.slice(0, path.indexOf(SPACE_ID_SENTINEL)),
);

/**
 * Whether `target` addresses a retired destination, for any workspace.
 *
 * Prefix-matched rather than compared whole, because a target usually carries a query
 * string the retired path does not (`?lead_id=…`) and, in source, an interpolation instead
 * of an identifier. Prefixes cannot collide with a live path: `/sales-workspace/{id}` —
 * Meetings, and R1.2's second entry — does not begin with `/sales/`, and neither it nor
 * anything else presented begins with `/sales-workspace-legacy/`.
 */
const isRetiredTarget = (target: string) =>
  RETIRED_PREFIXES.some((prefix) => target.startsWith(prefix));

/** The names the three removed entries went by, for the rendered-text scan. */
const RETIRED_ENTRY_NAMES = ["Learning", "Outreach", "Relationship Intelligence"] as const;

// ─── The source half's inputs ─────────────────────────────────────────────────

/**
 * The restructured surfaces, as project-relative paths.
 *
 * `App.tsx` is deliberately absent: R2.2 requires it to keep registering all four retired
 * paths, so it is the one file where naming them is correct. Property 4 (task 10.7) is
 * what holds that registration in place.
 */
const RESTRUCTURED_SURFACES = [
  "src/components/ConversationSidebar.tsx",
  "src/pages/ProspectIntelligence.tsx",
  "src/pages/GTMActionQueue.tsx",
  "src/pages/Ninna.tsx",
  "src/pages/Meetings.tsx",
  "src/pages/Analytics.tsx",
] as const;

/** Every component the dossier fold-in composes from, scanned as a directory. */
const GTM_COMPONENT_DIR = "src/components/gtm";

/**
 * Retired targets that exist today and are owned by a later task.
 *
 * Each row is debt with a name against it. Remove the row in the commit that removes the
 * target; the scan tightens by itself. **Empty**, which is the completion condition the
 * comment above describes: no restructured surface offers a retired destination any more, so
 * the subset scan below now asserts that none of them does.
 */
const OUTSTANDING_RETIRED_TARGETS: Readonly<Record<string, readonly string[]>> = {};

// Resolved from the project root rather than from `import.meta.url`, for the reason
// `gtmAPI.test.ts` records: the jsdom environment gives a test module an http-scheme URL,
// which `readFileSync` refuses.
const sourceOf = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

/** Block comments, and line comments that own their line. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");

/**
 * A navigation target: the first path literal after `navigate(`, `to=` or `href=`.
 *
 * Capture stops at the first quote or newline, so a template literal holding a nested
 * string (`` `/x/${id ?? ""}` ``) yields a truncated target. That is fine and intentional —
 * classification is by prefix, and the prefix is always ahead of the interpolation.
 */
const NAVIGATION_TARGET = /(?:navigate\(|\bto=\{?|\bhref=\{?)\s*[`"']([^`"'\n]*)/g;

/** The distinct retired prefixes `source` targets, sorted. */
const retiredTargetsIn = (source: string): string[] => {
  const found = new Set<string>();
  for (const [, target] of withoutComments(source).matchAll(NAVIGATION_TARGET)) {
    const prefix = RETIRED_PREFIXES.find((candidate) => target.startsWith(candidate));
    if (prefix) found.add(prefix);
  }
  return [...found].sort();
};

describe("Feature: sales-workflow-frontend-restructure, Property 2: No presented affordance targets a retired destination", () => {
  it(
    "sends no sidebar control and no sidebar link to a retired destination",
    // A hundred mounts and eight hundred presses do not fit the 5s default.
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(spaceIdArb, (spaceId) => {
          // Per run, not per test: the automatic cleanup fires between tests.
          cleanup();
          const { container, currentPath } = renderSidebar(spaceId);
          const retired = retiredPathsFor(spaceId);

          // Anchors first. The sidebar has none today — its entries are buttons — so this
          // is a guard rather than a measurement, and it is the half that would catch a
          // cross-link added later without a handler to press.
          Array.from(container.querySelectorAll("a[href]")).forEach((anchor) => {
            const href = anchor.getAttribute("href") ?? "";
            expect(retired).not.toContain(href);
            expect(isRetiredTarget(href)).toBe(false);
          });

          // Then every control the sidebar offers, Spaces included. Property 1 asserts
          // where the seven entries go; this asserts where nothing goes, over the whole
          // surface rather than over the seven the entry tables happen to declare.
          const controls = Array.from(container.querySelectorAll("button"));
          expect(controls.length).toBeGreaterThan(PRESENTED_DESTINATIONS.length);

          controls.forEach((control) => {
            fireEvent.click(control);
            const landed = currentPath();
            expect(retired).not.toContain(landed);
            // Prefix-matched as well as compared whole, so a target that reached a retired
            // path carrying a query string or a fragment cannot slip past the equality.
            expect(isRetiredTarget(landed)).toBe(false);
          });
        }),
        { numRuns: 100 },
      );
    },
  );

  it("keeps every presented destination clear of the retired vocabulary, on both sides", () => {
    fc.assert(
      fc.property(spaceIdArb, (spaceId) => {
        const retired = retiredPathsFor(spaceId);

        PRESENTED_DESTINATIONS.forEach((destination) => {
          const presented = destination.template(spaceId);
          expect(retired).not.toContain(presented);

          // Neither may be a segment prefix of the other. Equality alone would let
          // `/sales-workspace/{id}` and `/sales-workspace-legacy/{id}` — Meetings and a
          // Compatibility_Route — pass as unrelated while `matchesPath()` treated one as
          // the other, which is the collision §1.1 keeps the boundary match for.
          retired.forEach((path) => {
            expect(presented === path || presented.startsWith(`${path}/`)).toBe(false);
            expect(path.startsWith(`${presented}/`)).toBe(false);
          });
        });
      }),
      { numRuns: 100 },
    );
  });

  it("pins the retired vocabulary and keeps Meetings out of it", () => {
    // One workspace, spelled out: the readable regression under the generated property,
    // and the assertion that fails if `retiredPathsFor()` ever grows, shrinks or reorders.
    expect(retiredPathsFor("brand-1")).toEqual([
      "/gtm-dashboard/brand-1",
      "/sales/brand-1",
      "/sales-workspace-legacy/brand-1",
      "/relationship-intelligence/brand-1",
    ]);
    expect(RETIRED_PREFIXES).toEqual([
      "/gtm-dashboard/",
      "/sales/",
      "/sales-workspace-legacy/",
      "/relationship-intelligence/",
    ]);

    // Meetings is `/sales-workspace/:spaceId` and is *not* retired. It reads like the
    // legacy workspace and shares six characters with the retired `/sales/`, so it is the
    // one live path a careless scan would flag and a careless removal would delete.
    expect(retiredPathsFor("brand-1")).not.toContain("/sales-workspace/brand-1");
    expect(isRetiredTarget("/sales-workspace/brand-1")).toBe(false);
    expect(isRetiredTarget("/sales-workspace-legacy/brand-1")).toBe(true);
  });

  it("offers no Learning, Outreach or Relationship Intelligence entry", () => {
    // R1.4, R1.5 and R1.6 as names rather than as paths, which is how a re-introduced
    // entry would arrive: somebody adds the label back and points it at a new page.
    // R8.12 and R12.3 are the same statement one level up — neither learning nor outreach
    // is a destination at all now — and the sidebar is the whole destination list.
    const { container, entryButtons } = renderSidebar("brand-1");
    const labels = entryButtons().map((button) => button.textContent ?? "");

    RETIRED_ENTRY_NAMES.forEach((name) => {
      expect(labels.filter((label) => label.includes(name))).toEqual([]);
      expect(container.textContent ?? "").not.toContain(name);
    });
  });

  it("finds a retired target in source and is not fooled by prose or by a lookalike", () => {
    // The scan's own self-test. Without it a broken pattern would report every surface
    // clean and the source half would pass vacuously — the failure mode that matters most
    // for a scan whose expected result is an empty list.
    const fixture = [
      "// A comment naming /sales/ and /relationship-intelligence/ in prose.",
      "/* A block comment naming /gtm-dashboard/ and /sales-workspace-legacy/. */",
      "const live = () => navigate(`/sales-workspace/${spaceId}`);",
      'const alsoLive = <Link to="/analytics/brand-1" />;',
      "const retiredCall = () => navigate(`/sales/${spaceId}`);",
      "const retiredHref = <a href={`/gtm-dashboard/${spaceId}`} />;",
      "const retiredLegacy = () => navigate(`/sales-workspace-legacy/${spaceId}`);",
      "const retiredAttr = <Link to={`/relationship-intelligence/${spaceId}`} />;",
      "const throughAComment = () =>",
      "  navigate(",
      "    // the shape `ProspectIntelligence.tsx` uses today",
      '    `/sales/${spaceId ?? ""}?lead_id=1`',
      "  );",
    ].join("\n");

    expect(retiredTargetsIn(fixture)).toEqual(
      [
        "/gtm-dashboard/",
        "/sales/",
        "/sales-workspace-legacy/",
        "/relationship-intelligence/",
      ].sort(),
    );

    // And the live paths it must leave alone, stated as their own claim rather than
    // inferred from the absence of a fifth entry above.
    expect(retiredTargetsIn("navigate(`/sales-workspace/${id}`)")).toEqual([]);
    expect(retiredTargetsIn('<Link to="/analytics/brand-1" />')).toEqual([]);
    expect(retiredTargetsIn("// prose about /sales/ only")).toEqual([]);
  });

  it("targets no retired destination from any restructured surface, beyond the acknowledged removals", () => {
    const surfaces = [
      ...RESTRUCTURED_SURFACES,
      ...readdirSync(resolve(process.cwd(), GTM_COMPONENT_DIR))
        .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
        .map((entry) => join(GTM_COMPONENT_DIR, entry)),
    ];

    // Enough files to be a scan rather than a spot check, and the dossier's component
    // inventory is most of the count.
    expect(surfaces.length).toBeGreaterThan(RESTRUCTURED_SURFACES.length);

    surfaces.forEach((file) => {
      const source = sourceOf(file);
      // A file that had moved or emptied would report clean, which is the other way this
      // scan could fail open.
      expect(source.length).toBeGreaterThan(0);

      const acknowledged = OUTSTANDING_RETIRED_TARGETS[file] ?? [];
      const unacknowledged = retiredTargetsIn(source).filter(
        (prefix) => !acknowledged.includes(prefix),
      );

      // Reported as a pair so a failure names the file and the path it offered, rather
      // than only that some array was not empty.
      expect({ file, unacknowledged }).toEqual({ file, unacknowledged: [] });
    });
  });

  it("holds the dossier clean of the two named removals", () => {
    // §1.3 names `ProspectIntelligence`'s `onOpenRelationshipIntelligence` prop and its
    // `onOpenMax` control as the two call sites this rule removes. Both are gone — 12.3 took
    // the prop and the Max control, 12.4 took the two navigations that remained by replacing
    // them with the in-dossier outreach region — so the ledger row is gone with them and this
    // asserts the pair: neither name survives, and the file targets nothing retired.
    //
    // Stated as its own case rather than left to the subset scan above, because the subset
    // scan passes for a file with no row *and* for a file whose row was quietly re-added. This
    // one fails if either name comes back.
    const file = "src/pages/ProspectIntelligence.tsx";
    const source = sourceOf(file);
    const surviving = (["onOpenRelationshipIntelligence", "onOpenMax"] as const).filter((name) =>
      source.includes(name),
    );

    expect(surviving).toEqual([]);
    expect(retiredTargetsIn(source)).toEqual([]);
    expect(OUTSTANDING_RETIRED_TARGETS[file]).toBeUndefined();
  });
});
// ─── Property 3 ───────────────────────────────────────────────────────────────
//
// R1.8 marks the entry matching the active route as current "for both sighted and
// assistive-technology users", which is two channels and therefore two assertions:
//
//   the assistive channel   `aria-current="page"`, which `renderNavItem` sets on the
//                           active item and omits everywhere else (task 10.2).
//   the sighted channel     the active styling — the accent bar, the container tint, the
//                           icon tile and the label weight.
//
// Both are counted rather than merely located. "The expected entry is current" would pass
// while a second entry was current too, and that is the failure the interesting half of
// this property is about: **zero and two are both failures**, and they arrive from
// opposite directions. Zero is what a match that is too strict produces; two is what a
// match that is too loose produces, which is exactly what `location.pathname.includes()`
// used to do here.
//
// ── How the sighted channel is measured without pinning today's styling ──
//
// No requirement names a Tailwind class, so the property must not either — it would fail
// on a restyle that kept the distinction perfectly intact. What it measures instead is a
// *departure*: mount the sidebar where nothing is current, record each entry's class
// attributes, then mount at a route and ask which entries no longer look the way they
// looked when they were not current. Exactly one may have moved. That phrasing survives
// any restyle and still fails when the visual marking is dropped, weakened to nothing, or
// applied to two entries at once.
//
// The signature is class attributes only. It must not see `aria-current`, or the two
// channels would stop being independent and a dropped visual treatment could be masked by
// the assistive one that replaced it.
//
// ── Why the segment boundary is the load-bearing clause ──
//
// "And it is the segment-boundary match" is not a restatement of "exactly one" — it is what
// makes exactly one *achievable*. `matchesPath()` is `pathname === path ||
// pathname.startsWith(`${path}/`)`, and task 10.2 left it unchanged on purpose (§1.1)
// because each half of it is holding a different collision shut. This block covers all
// three ways it can be loosened, because they are not the same failure:
//
//   the boundary at the end      `/sales-workspace-legacy/{id}` is a Compatibility_Route
//                                (R2.2) and Meetings is `/sales-workspace/{id}`, differing
//                                only by a suffix on the first segment. Compare against the
//                                route's static prefix instead of the filled path — match
//                                `/sales-workspace`, not `/sales-workspace/{id}/` — and
//                                Meetings is current on a retired path.
//   the anchor at the start      `/linkedin-analytics/{id}` is a registered route in
//                                `App.tsx`. Match anywhere in the pathname rather than from
//                                its start and Analytics is current on every LinkedIn
//                                analytics page, because `analytics/{id}` sits inside
//                                `linkedin-analytics/{id}`.
//   containment of a whole path  `/analytics/{id}/eva/{id}` contains two destination paths
//                                entire, so a containment match marks *two* entries current.
//
// The first two are asserted as spelled-out regressions and generated as a family; the
// third is generated over every ordered pair of destinations, and it is the case no
// hand-written example would think to try. All three were checked against the component
// rather than assumed: each loosening was applied to `matchesPath()` in turn and each was
// caught. They are separate cases because they catch separate mutations —
// `pathname.includes(path)`, the matcher this file's history records, trips the nested-path
// property but *not* the two lookalike routes, since the character before the collision
// differs there (`-analytics` is not `/analytics`).
//
// **Validates: Requirements 1.8**

/** A location that is none of the seven, so nothing is current there. */
const NOWHERE = "/spaces";

/**
 * The class attributes of an entry and of everything inside it, joined.
 *
 * `getAttribute("class")` rather than `.className` because the icon is an `<svg>`, whose
 * `className` is an `SVGAnimatedString` rather than a string and would stringify to
 * `[object SVGAnimatedString]` for every entry alike — a signature that compared equal no
 * matter what happened to the icon.
 *
 * A signature is entry-specific even when nothing is current, because lucide stamps the
 * icon's own name into the `<svg>` class. So signatures are only ever compared
 * positionally, entry against its own inactive self, never against a sibling's.
 */
const styleSignatureOf = (button: Element): string =>
  [button, ...Array.from(button.querySelectorAll("*"))]
    .map((node) => node.getAttribute("class") ?? "")
    .join(" | ");

/** Whether assistive technology is told this entry is the current destination. */
const isAssistiveCurrent = (button: Element) => button.getAttribute("aria-current") === "page";

/**
 * The indices of the entries marked current at the mounted location, one list per channel.
 *
 * @param inactive - The same entries' presentation with nothing current, positionally.
 */
const currentIndices = (buttons: readonly Element[], inactive: readonly string[]) => ({
  assistive: buttons.flatMap((button, index) => (isAssistiveCurrent(button) ? [index] : [])),
  visual: buttons.flatMap((button, index) =>
    styleSignatureOf(button) === inactive[index] ? [] : [index],
  ),
});

/**
 * The seven entries' presentation with nothing current, measured by mounting at `at`.
 *
 * Measured rather than declared, and measured once per test rather than once per property
 * run. The class attributes carry no workspace identifier, so one measurement is valid for
 * every generated workspace — and if that ever stopped being true the comparison would
 * report all seven entries as changed and the property would fail, so the reuse cannot
 * hide a regression. It fails loudly in the safe direction.
 *
 * Cleans up after itself, so a caller can mount immediately afterwards.
 *
 * @param at - A location that is none of the seven. `NOWHERE` by default.
 */
const inactivePresentationFor = (spaceId: string, at: string = NOWHERE): string[] => {
  cleanup();
  const { entryButtons } = renderSidebar(spaceId, at);
  const signatures = entryButtons().map(styleSignatureOf);
  cleanup();
  return signatures;
};

/** The workspace the measured baseline is taken with. */
const BASELINE_SPACE_ID = "brand-1";

/** A further path segment under a destination, for the deep-path half of the property. */
const deepSegmentArb = fc.string({ unit: SPACE_ID_UNIT, minLength: 1, maxLength: 12 });

/**
 * Words that turn a destination's first segment into a plausible sibling route.
 *
 * `linkedin` + `analytics` is `App.tsx`'s real `/linkedin-analytics/:spaceId`, and
 * `sales-workspace` + `legacy` is the real Compatibility_Route. The rest are the shapes a
 * route like that usually arrives in.
 */
const LOOKALIKE_WORDS = ["linkedin", "legacy", "old", "internal", "v2", "beta"] as const;

/** The first path segment of a destination's target — `analytics` for `/analytics/{id}`. */
const firstSegmentOf = (path: string) => path.split("/")[1];

describe("Feature: sales-workflow-frontend-restructure, Property 3: Exactly one navigation entry is marked current", () => {
  it(
    "marks exactly one entry current, on both channels, at every presented route",
    // A hundred mounts, each with a seven-entry signature pass, do not fit the 5s default.
    { timeout: 60_000 },
    () => {
      const inactive = inactivePresentationFor(BASELINE_SPACE_ID);
      expect(inactive).toHaveLength(PRESENTED_DESTINATIONS.length);

      fc.assert(
        fc.property(
          spaceIdArb,
          fc.nat({ max: PRESENTED_DESTINATIONS.length - 1 }),
          // A destination is current at its own path and at anything under it — the second
          // half of what `matchesPath()` accepts, and the half a strict equality would drop.
          fc.option(deepSegmentArb, { nil: undefined }),
          (spaceId, index, deeper) => {
            const destination = PRESENTED_DESTINATIONS[index];
            const target = destination.template(spaceId);
            const at = deeper === undefined ? target : `${target}/${deeper}`;

            // Per run rather than per test: the automatic cleanup in `test/setup.ts` fires
            // between tests, and a property mounts the sidebar a hundred times inside one.
            cleanup();
            const { entryButtons } = renderSidebar(spaceId, at);
            // Captured once per mount, as Property 1 does: one accessible-name pass rather
            // than one per assertion.
            const buttons = entryButtons();

            const { assistive, visual } = currentIndices(buttons, inactive);

            // Reported as a pair so a failure names the route and both channels' verdicts
            // rather than only that one array was wrong.
            expect({ at, assistive, visual }).toEqual({
              at,
              assistive: [index],
              visual: [index],
            });
            // The marking and the label have to belong to the same entry, or "exactly one
            // entry is current" could hold with the wrong entry carrying it.
            expect(buttons[index].textContent).toContain(destination.label);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it("marks each of the seven, and only it, when that route is the location", () => {
    // The property picks one route per run; this walks all seven in one test, so "for every
    // route in the presented list" is exhaustive here rather than statistical there.
    const inactive = inactivePresentationFor(BASELINE_SPACE_ID);

    PRESENTED_DESTINATIONS.forEach((destination, index) => {
      const at = destination.template(BASELINE_SPACE_ID);
      cleanup();
      const { entryButtons } = renderSidebar(BASELINE_SPACE_ID, at);
      const { assistive, visual } = currentIndices(entryButtons(), inactive);

      expect({ at, assistive, visual }).toEqual({ at, assistive: [index], visual: [index] });
    });
  });

  it("marks nothing current at a location that is none of the seven", () => {
    // Zero is the correct count here, and asserting it is what stops the property above
    // from being satisfiable by an entry that is always current.
    //
    // The baseline is measured at a *different* non-destination location — `/leads/{id}`,
    // the route R2.5 retains — so this is not a comparison against itself. That makes it the
    // instrument check as much as the zero-count check: an entry's inactive presentation is
    // a property of the entry rather than of wherever the rep happens to be, so a departure
    // the property observes is attributable to that entry becoming current and not to the
    // location having moved under it.
    const elsewhere = inactivePresentationFor(BASELINE_SPACE_ID, `/leads/${BASELINE_SPACE_ID}`);
    const { entryButtons } = renderSidebar(BASELINE_SPACE_ID, NOWHERE);
    const buttons = entryButtons();

    expect(buttons.filter(isAssistiveCurrent)).toEqual([]);
    expect(currentIndices(buttons, elsewhere)).toEqual({ assistive: [], visual: [] });
  });

  it("marks the current entry with a treatment that is actually visible", () => {
    // The canary for the signature diff. A departure from the inactive presentation is
    // necessary but not sufficient: a change that swapped one invisible class for another
    // would satisfy every assertion above while leaving a sighted user with no highlight.
    // So the accent bar and the container treatment are pinned once, here, in one concrete
    // place that a deliberate restyle is expected to update.
    const selected = PRESENTED_DESTINATIONS.findIndex(
      (destination) => destination.label === "Prospect Intelligence",
    );
    const inactive = inactivePresentationFor(BASELINE_SPACE_ID);
    const { entryButtons } = renderSidebar(
      BASELINE_SPACE_ID,
      PRESENTED_DESTINATIONS[selected].template(BASELINE_SPACE_ID),
    );
    const buttons = entryButtons();
    const current = buttons[selected];

    expect(current.textContent).toContain("Prospect Intelligence");
    expect(currentIndices(buttons, inactive).visual).toEqual([selected]);
    // The container reads as selected rather than as hoverable.
    expect(current.className).toContain("bg-primary/5");
    expect(current.className).not.toContain("border-transparent");
    // And the accent bar has height and opacity, which is what makes it a bar at all.
    const accent = current.querySelector("span[aria-hidden='true']");
    expect(accent?.getAttribute("class")).toContain("opacity-100");
    expect(accent?.getAttribute("class")).not.toContain("h-0");

    // The six that are not current keep the inactive treatment, stated positively rather
    // than inferred from the count.
    const others = buttons.filter((_, index) => index !== selected);
    others.forEach((button) => {
      expect(button.className).not.toContain("bg-primary/5");
      expect(button.querySelector("span[aria-hidden='true']")?.getAttribute("class")).toContain(
        "opacity-0",
      );
    });
  });

  it(
    "marks nothing current on a route that only looks like a destination",
    { timeout: 60_000 },
    () => {
      const inactive = inactivePresentationFor(BASELINE_SPACE_ID);

      fc.assert(
        fc.property(
          spaceIdArb,
          fc.nat({ max: PRESENTED_DESTINATIONS.length - 1 }),
          fc.constantFrom(...LOOKALIKE_WORDS),
          fc.boolean(),
          (spaceId, index, word, prefixed) => {
            const segment = firstSegmentOf(PRESENTED_DESTINATIONS[index].template(spaceId));
            const at = prefixed
              ? `/${word}-${segment}/${spaceId}`
              : `/${segment}-${word}/${spaceId}`;

            // A lookalike that happened to *be* a destination would make the assertion
            // below a false alarm rather than a check, so say so explicitly.
            const presented = PRESENTED_DESTINATIONS.map((d) => d.template(spaceId));
            expect(presented).not.toContain(at);

            cleanup();
            const { entryButtons } = renderSidebar(spaceId, at);
            const { assistive, visual } = currentIndices(entryButtons(), inactive);

            expect({ at, assistive, visual }).toEqual({ at, assistive: [], visual: [] });
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it("leaves Analytics alone on the LinkedIn analytics route", () => {
    // The collision §1.1 keeps the boundary match for, spelled out. `/linkedin-analytics/
    // :spaceId` is a registered route in `App.tsx`, so this is a location a rep reaches and
    // not a hypothetical — and any match that is not anchored at the start of the pathname
    // lights Analytics up on every one of those pages, because `analytics/{id}` sits inside
    // `linkedin-analytics/{id}`.
    const inactive = inactivePresentationFor(BASELINE_SPACE_ID);
    const { entryButtons } = renderSidebar(
      BASELINE_SPACE_ID,
      `/linkedin-analytics/${BASELINE_SPACE_ID}`,
    );
    const buttons = entryButtons();

    expect(currentIndices(buttons, inactive)).toEqual({ assistive: [], visual: [] });
    // Named rather than positional, so the failure reads as "Analytics is lit on the wrong
    // page" instead of "index 5 differed".
    const analytics = buttons[PRESENTED_DESTINATIONS.findIndex((d) => d.label === "Analytics")];
    expect(analytics.textContent).toContain("Analytics");
    expect(isAssistiveCurrent(analytics)).toBe(false);
  });

  it("leaves Meetings alone on the legacy workspace route", () => {
    // The other end of the same rule. `/sales-workspace-legacy/{id}` is a
    // Compatibility_Route (R2.2) and Meetings is `/sales-workspace/{id}`, so the two differ
    // only by a suffix on the first segment. Matching the whole filled path is what keeps
    // them apart: match `/sales-workspace` as a bare prefix — which is what comparing
    // against the route template rather than the filled path amounts to — and Meetings is
    // current on a retired path, which is also the one place R1.8 and R2.3 meet.
    const inactive = inactivePresentationFor(BASELINE_SPACE_ID);
    const { entryButtons } = renderSidebar(
      BASELINE_SPACE_ID,
      `/sales-workspace-legacy/${BASELINE_SPACE_ID}`,
    );
    const buttons = entryButtons();

    expect(currentIndices(buttons, inactive)).toEqual({ assistive: [], visual: [] });
    const meetings = buttons[PRESENTED_DESTINATIONS.findIndex((d) => d.label === "Meetings")];
    expect(meetings.textContent).toContain("Meetings");
    expect(isAssistiveCurrent(meetings)).toBe(false);
  });

  it(
    "marks only the outer destination when another destination's path sits under it",
    { timeout: 60_000 },
    () => {
      // The two-at-once case, as a route. At `/analytics/{id}/eva/{id}` a substring match
      // finds both `/analytics/{id}` and `/eva/{id}` and marks two entries current — the
      // failure R1.8 rules out and the one no exhaustive walk over the seven can reach.
      // Boundary-matched, only the outer destination matches.
      const inactive = inactivePresentationFor(BASELINE_SPACE_ID);

      fc.assert(
        fc.property(
          spaceIdArb,
          fc.nat({ max: PRESENTED_DESTINATIONS.length - 1 }),
          fc.nat({ max: PRESENTED_DESTINATIONS.length - 2 }),
          (spaceId, outerIndex, offset) => {
            // Any ordered pair of distinct destinations, without a rejection filter.
            const innerIndex = offset >= outerIndex ? offset + 1 : offset;
            const outer = PRESENTED_DESTINATIONS[outerIndex].template(spaceId);
            const inner = PRESENTED_DESTINATIONS[innerIndex].template(spaceId);
            const at = `${outer}${inner}`;

            cleanup();
            const { entryButtons } = renderSidebar(spaceId, at);
            const { assistive, visual } = currentIndices(entryButtons(), inactive);

            expect({ at, assistive, visual }).toEqual({
              at,
              assistive: [outerIndex],
              visual: [outerIndex],
            });
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
