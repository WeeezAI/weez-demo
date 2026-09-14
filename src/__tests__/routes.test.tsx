// src/__tests__/routes.test.tsx
//
// The route-table suite. One property lives here today:
//
//   Property 4   the retired prospect path redirects to the dossier      (task 10.7)
//
// Task 10.8 adds Property 42 — the credit balance on every authenticated route — as a
// second block below this one, on the harness this file sets up. Three seams here exist
// for it, and Property 4 leans on none of them:
//
//   `PAGE_MODE`        flips the page mocks from sentinel to the real module, which
//                      Property 42 needs because the balance is rendered by the page's
//                      own chrome and a sentinel renders no chrome at all.
//   `serveCredits(n)`  takes a balance. Property 4 only ever calls it for its default,
//                      to keep the provider's read off the network; Property 42 is what
//                      the argument is for, since it has to assert a *known* number.
//   `view.query`       the mount-scoped queries, for reading that number back.
//
// ── What is under test: `App.tsx`'s own table, not a copy of it ──
//
// The claim is about the route table, so the table has to be the real one. Re-declaring
// the routes here and rendering them under a `MemoryRouter` would be cheaper and would
// answer a different question — whether *this file's* table redirects — and it would keep
// passing after `App.tsx` dropped the redirect or re-registered `GTMProspect`. Worse, the
// redirect element is not exported, so a copy would have to re-declare
// `RedirectToProspectIntelligence` too, and `replace` — the load-bearing half of R2.1 —
// would then be asserted about a duplicate of the thing that has to carry it.
//
// So this suite mounts `App` and swaps two router pieces underneath it:
//
//   `BrowserRouter` → `MemoryRouter`   fed from `harness.state`, which gives the suite an
//                                      initial location *and* an initial history stack, so
//                                      `replace` is observable. jsdom's `history.back()` is
//                                      asynchronous and would make the same assertion racy.
//   `Routes`        → a recording wrapper  which captures every `<Route>`'s path and
//                                      element type on the way through and then renders the
//                                      real `Routes` with the same children. This is what
//                                      makes "GTMProspect appears nowhere in the rendered
//                                      route table" an assertion about the table rather
//                                      than about the filesystem — `GTMProspect.tsx` is
//                                      still on disk on purpose (task 12.3 lifts the
//                                      fold-in out of it), so its absence can only be
//                                      measured where it is supposed to be absent.
//
// Nothing about the table itself is restated here. Every `path`/`element` pair asserted
// below is read back out of `App.tsx` at render time, so a route that is renamed, removed
// or re-pointed fails this suite instead of drifting past it.
//
// ── Why the pages are stubbed ──
//
// Six pages sit at the end of the paths under test, and each of them fetches on mount. A
// hundred runs over six paths is six hundred mounts, and a real `ProspectIntelligence` or
// `Max` in that loop would make this suite a page-load benchmark that happens to check a
// redirect. The stub keeps the subject on the router: what the table resolved, not what
// the resolved page renders. It is a *wrapper* rather than a replacement — the real module
// is imported behind it and `PAGE_MODE.pageMode = "real"` hands over to it, so task 10.8
// can mount the same routes for real without unpicking this.
//
// `GTMProspect` is deliberately **not** among the stubs, and this file imports it nowhere.
// Task 13.1 retired the four legacy `GTMProspect.*.test.tsx` suites and added the R20.7
// import scan at the foot of this file; a `vi.mock` for the retired page here would be a
// real reference for that scan to trip over, and it would be this suite manufacturing the
// violation it asserts against. Its absence from the table is read off the captured routes
// instead, which is the stronger instrument anyway. The scan below names the module as a
// *string* — a search subject, not a specifier — which is why it can name it at all.
//
// ── The timeout ──
//
// The two generated tests below mount the shell a hundred times each, so both carry an
// explicit `{ timeout: 60_000 }`. The 5s default is a per-test budget, and three other
// 100-run property suites in this frontend already exceed it for the same reason. The
// timeout is set per test rather than as a `testTimeout` in `frontend/vitest.config.ts`
// because raising the project default would relax the budget for every suite that
// currently holds itself to it.

import type { ReactNode } from "react";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import fc from "fast-check";

import App from "@/App";
import { CREDIT_LABELS } from "@/components/gtm/CreditBalance";

// ─── Harness state, hoisted above the module mocks that read it ───────────────

const harness = vi.hoisted(() => {
  /** One `<Route>` as it was declared, resolved down to what it renders. */
  interface DeclaredRoute {
    path: string;
    /** The element's component type, for identity comparison between two routes. */
    elementType: unknown;
    /** `displayName ?? name`, or a marker when there is no element at all. */
    elementName: string;
  }

  const routeTable: DeclaredRoute[] = [];
  /**
   * The distinct pages rendered since the last `renderAppAt()`, in first-render order.
   *
   * Distinct, because a render is not a mount: `AuthProvider` settles `loadingAuth` in an
   * effect, so the whole shell renders twice for every mount and a raw log would say every
   * page rendered twice. What the assertions need is *which* pages the table resolved, and
   * how many — not how many times React called them.
   */
  const pagesRendered: string[] = [];

  const state = {
    /** The `MemoryRouter` stack. The last entry is where the mount starts. */
    entries: ["/"] as string[],
    index: 0,
    /** `"stub"` renders a sentinel; `"real"` hands over to the page module. */
    pageMode: "stub" as "stub" | "real",
  };

  /**
   * Wraps one page module in a sentinel that records its own mount.
   *
   * The original is imported rather than discarded so the same mock can serve both modes,
   * and so the module still has to *exist* and still has to have a default export — a page
   * deleted out from under the route table fails here rather than passing quietly.
   *
   * Only the default export is replaced; every named export is passed through. Several of
   * these pages import helpers from each other — `Meetings.tsx` takes `readRangeParam` from
   * `Analytics.tsx`, and the sidebar helpers are exported from the pages that own them — so
   * a mock returning `{ default }` alone turns a *stubbed* page into a module error in the
   * page that imports from it. That error reads as "this route did not mount", which is a
   * verdict about this file rather than about the route table.
   */
  const pageStub = async (name: string, importOriginal: () => Promise<unknown>) => {
    const [react, original] = await Promise.all([import("react"), importOriginal()]);
    const Real = (original as {
      default: import("react").ComponentType<Record<string, unknown>>;
    }).default;

    const Page = (props: Record<string, unknown>) => {
      if (!pagesRendered.includes(name)) pagesRendered.push(name);
      return state.pageMode === "real"
        ? react.createElement(Real, props)
        : react.createElement("div", { "data-testid": `page:${name}` }, name);
    };
    Page.displayName = name;

    return { ...(original as Record<string, unknown>), default: Page };
  };

  return { routeTable, pagesRendered, state, pageStub };
});

// ─── The two router swaps ─────────────────────────────────────────────────────

vi.mock("react-router-dom", async (importOriginal) => {
  const [actual, react] = await Promise.all([
    importOriginal<typeof import("react-router-dom")>(),
    import("react"),
  ]);

  const nameOf = (type: unknown): string => {
    if (typeof type === "string") return type;
    if (typeof type === "function") {
      const fn = type as { displayName?: string; name?: string };
      return fn.displayName ?? (fn.name || "(anonymous)");
    }
    return "(no element)";
  };

  /**
   * The location the router actually settled on, plus a Back control.
   *
   * `pathname + search + hash`, not `pathname` alone: a redirect that smuggled a query
   * string onto the dossier path would otherwise compare equal to the bare template, and
   * R2.1 is about the same identifier arriving at the same place, nothing appended.
   */
  const Probe = () => {
    const location = actual.useLocation();
    const navigate = actual.useNavigate();
    return react.createElement(
      "div",
      null,
      react.createElement(
        "span",
        { "data-testid": "location-probe" },
        `${location.pathname}${location.search}${location.hash}`,
      ),
      react.createElement(
        "button",
        { type: "button", "data-testid": "probe-back", onClick: () => navigate(-1) },
        "Back",
      ),
    );
  };

  const BrowserRouter = ({ children }: { children?: ReactNode }) =>
    react.createElement(
      actual.MemoryRouter,
      { initialEntries: harness.state.entries, initialIndex: harness.state.index },
      children,
      react.createElement(Probe, { key: "location-probe" }),
    );

  /** Records the declared table, then renders the real `Routes` with the same children. */
  const Routes = (props: { children?: ReactNode }) => {
    harness.routeTable.length = 0;
    react.Children.toArray(props.children).forEach((child) => {
      if (!react.isValidElement(child)) return;
      const routeProps = child.props as { path?: string; element?: unknown };
      const elementType = react.isValidElement(routeProps.element)
        ? routeProps.element.type
        : undefined;
      harness.routeTable.push({
        path: routeProps.path ?? "(no path)",
        elementType,
        elementName: nameOf(elementType),
      });
    });
    return react.createElement(actual.Routes, props);
  };

  return { ...actual, BrowserRouter, Routes };
});

// ─── The pages at the end of the paths under test ─────────────────────────────
//
// One `vi.mock` per module, spelled out rather than generated: the path has to be a literal
// for the call to be hoisted above `App`'s imports.

vi.mock("@/pages/ProspectIntelligence", (io) => harness.pageStub("ProspectIntelligence", io));
vi.mock("@/pages/GTMDashboard", (io) => harness.pageStub("GTMDashboard", io));
vi.mock("@/pages/Max", (io) => harness.pageStub("Max", io));
vi.mock("@/pages/SalesWorkspace", (io) => harness.pageStub("SalesWorkspace", io));
vi.mock("@/pages/SalesAssistant", (io) => harness.pageStub("SalesAssistant", io));
vi.mock("@/pages/Connections", (io) => harness.pageStub("Connections", io));
vi.mock("@/pages/NotFound", (io) => harness.pageStub("NotFound", io));

// The five remaining surfaces of the restructure. Property 4 never mounts these paths, so
// wrapping them changes nothing for it; Property 42 mounts all of them, and the wrapper is
// what lets it name *which* page a route landed on — the difference between "this page's
// chrome carries no balance" and "this route fell through to the catch-all".
vi.mock("@/pages/Eva", (io) => harness.pageStub("Eva", io));
vi.mock("@/pages/Ninna", (io) => harness.pageStub("Ninna", io));
vi.mock("@/pages/GTMActionQueue", (io) => harness.pageStub("GTMActionQueue", io));
vi.mock("@/pages/Meetings", (io) => harness.pageStub("Meetings", io));
vi.mock("@/pages/Analytics", (io) => harness.pageStub("Analytics", io));

// ─── The routes, as the requirement states them ───────────────────────────────
//
// Templates and page names, not a table: what each entry declares is *which* route has to
// keep resolving and *what* it has to keep resolving to. Both halves are read back out of
// `App.tsx`'s captured table and out of a real mount, so neither is a second copy of it.

/** R2.1's retired path, and where it has to land. */
const RETIRED_PROSPECT_TEMPLATE = "/relationship-intelligence/:spaceId";
const retiredProspectPath = (spaceId: string) => `/relationship-intelligence/${spaceId}`;

const DOSSIER = {
  template: "/prospect-intelligence/:spaceId",
  path: (spaceId: string) => `/prospect-intelligence/${spaceId}`,
  page: "ProspectIntelligence",
} as const;

/** The component §1.2 names as the redirect. Not a page — that is the point of it. */
const REDIRECT_ELEMENT = "RedirectToProspectIntelligence";

/** R2.2's three Compatibility_Routes, each with the page it still resolves to. */
const COMPATIBILITY_ROUTES = [
  {
    template: "/gtm-dashboard/:spaceId",
    path: (spaceId: string) => `/gtm-dashboard/${spaceId}`,
    page: "GTMDashboard",
  },
  {
    template: "/sales/:spaceId",
    path: (spaceId: string) => `/sales/${spaceId}`,
    page: "Max",
  },
  {
    template: "/sales-workspace-legacy/:spaceId",
    path: (spaceId: string) => `/sales-workspace-legacy/${spaceId}`,
    page: "SalesWorkspace",
  },
] as const;

/** R2.5's two retained routes. Asserted with the same instrument, as examples. */
const RETAINED_ROUTES = [
  {
    template: "/leads/:spaceId",
    path: (spaceId: string) => `/leads/${spaceId}`,
    page: "SalesAssistant",
  },
  {
    template: "/connections/:spaceId",
    path: (spaceId: string) => `/connections/${spaceId}`,
    page: "Connections",
  },
] as const;

/** Every route that has to keep resolving to its own page, retired path excluded. */
const RESOLVING_ROUTES = [DOSSIER, ...COMPATIBILITY_ROUTES, ...RETAINED_ROUTES];

/**
 * A location that is not a registered route, used as the entry the rep came *from*.
 *
 * `/spaces` would be the realistic origin, but it is a real page that fetches on mount and
 * this appears in a hundred-run loop. What the Back assertion needs from the origin is only
 * that it is a distinguishable history entry, so a path that lands on the catch-all is both
 * cheaper and unambiguous — nothing else in the table can claim it.
 */
const NOWHERE = "/__where-the-rep-came-from__";

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * A workspace identifier, as one URL path segment.
 *
 * The formats the product issues (uuid, ulid), the general alphanumeric-with-separators
 * shape, and the short hand-written ones fixtures use. Identifiers carrying `/`, `?`, `#`
 * or a percent escape are excluded for the reason the sidebar suite gives: those would make
 * the filled template a different *route*, so the assertion would be about URL parsing
 * rather than about redirection.
 *
 * `fc.uuid()` matters more here than it looks: `CreditsProvider` only reads the balance when
 * the path's second segment is a uuid, so the uuid branch is the one that exercises the
 * provider's read on every route under test — and it is what task 10.8's property needs.
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

// ─── Transport ────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

/** The page-mode switch task 10.8 flips to mount the real pages. */
const PAGE_MODE = harness.state;

/**
 * Serves the workspace credit balance, and `{}` for anything else.
 *
 * Only `CreditsProvider` reaches the wire in this suite — every page is a stub — but it
 * does reach it, on every uuid-shaped workspace the generator produces. Left unstubbed that
 * would be a real request per run.
 */
function serveCredits(balance = 42) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    const body = url.includes("/credits")
      ? { brand_id: "brand-1", balance, prices: [], history: [] }
      : {};
    return { ok: true, status: 200, json: async () => body };
  });
}

/**
 * The one jsdom gap mounting the whole shell exposes: `window.matchMedia`.
 *
 * `App` renders Sonner's toaster, which asks for the reduced-motion preference on mount.
 * jsdom implements no media queries at all, so the call is a `TypeError` rather than a
 * missing answer. Stubbed here rather than in `test/setup.ts` because this is the only
 * suite that mounts the application chrome; a global polyfill would quietly change what
 * every other suite runs against.
 */
function stubMatchMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  stubMatchMedia();
  serveCredits();
  // Deliberately no session token. `AuthProvider` fetches the space list the moment it
  // sees one, and that response lands after the synchronous property body has finished —
  // a state update outside `act()` on every one of six hundred mounts. Nothing under test
  // here reads it: `gtmFetch` sends the `Authorization` header only when a token exists,
  // and the balance read works without one.
  PAGE_MODE.pageMode = "stub";
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ─── Harness ──────────────────────────────────────────────────────────────────

/**
 * Mounts the real `App` with the router starting at `path`.
 *
 * @param path - Where the browser opened. Becomes the last entry of the history stack.
 * @param from - An earlier entry, so Back has somewhere to go. `NOWHERE` by default.
 */
const renderAppAt = (path: string, from: string = NOWHERE) => {
  harness.state.entries = [from, path];
  harness.state.index = 1;
  harness.pagesRendered.length = 0;

  const utils = render(<App />);

  /**
   * Every query in this suite is scoped to the container this mount created.
   *
   * `screen` and the queries `render` returns are both bound to `document.body`, not to
   * the container, and two things in this suite make that the wrong scope. `App` renders
   * two toasters that portal *out* of the container and into the body, so a body-scoped
   * query is searching a tree wider than the mount. And a property run that threw before
   * its `cleanup()` would leave its container in the body for the next run to match
   * against, turning one failure into a misleading "found multiple elements" everywhere
   * after it.
   */
  const q = within(utils.container);

  return {
    ...utils,
    /** This mount's queries. Task 10.8 reads the balance out of the chrome through it. */
    query: q,
    /** Where the router settled: pathname, query and fragment. */
    location: () => q.getByTestId("location-probe").textContent ?? "",
    /** Presses Back, the way the rep would. */
    goBack: () => fireEvent.click(q.getByTestId("probe-back")),
    /** Whether `page` is on screen, within this mount. */
    rendered: (page: string) => q.queryByTestId(`page:${page}`) !== null,
  };
};

/** The route `App.tsx` declared for `template`, or `undefined` if it declared none. */
const declaredRoute = (template: string) =>
  harness.routeTable.find((route) => route.path === template);

// ─── Property 4 ───────────────────────────────────────────────────────────────
//
// Three claims in one statement, and they fail for different reasons, so each gets its own
// instrument:
//
//   the redirect            mount the retired path, read the location back. Plus the half
//                           R2.1 does not spell out but the restructure depends on:
//                           `replace`, so the retired path never enters the back stack and
//                           Back from the dossier goes where the rep actually came from.
//                           Without it, Back lands on the retired path, which redirects
//                           again — the rep is stuck on the dossier and Back looks broken.
//   the compatibility routes  mount each one, assert it resolved to its own page and that
//                           the location did not move. A route that had quietly become a
//                           redirect, or fallen through to the catch-all, fails here.
//   `GTMProspect` absent    read the captured table. Not the filesystem: the file is
//                           supposed to still be there.

describe("Feature: sales-workflow-frontend-restructure, Property 4: The retired prospect path redirects to the dossier", () => {
  it(
    "forwards the retired prospect path to the dossier for the same identifier, without entering the back stack",
    // A hundred mounts of the application shell do not fit the 5s default.
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(spaceIdArb, (spaceId) => {
          const view = renderAppAt(retiredProspectPath(spaceId));
          try {
            // The same identifier, at the dossier's path, with nothing appended.
            expect(view.location()).toBe(DOSSIER.path(spaceId));
            // And the dossier is what mounted — a location that changed without the page
            // following would be a redirect to nowhere.
            expect(view.rendered(DOSSIER.page)).toBe(true);
            expect(view.rendered("NotFound")).toBe(false);

            // `replace`: the retired entry is gone, so Back skips it entirely.
            view.goBack();
            expect(view.location()).toBe(NOWHERE);
            // Stated the other way round as well, because this is the assertion that
            // fails when `replace` is dropped: without it the retired path is still on
            // the stack, Back lands on it, and it forwards straight back to the dossier.
            expect(view.location()).not.toBe(retiredProspectPath(spaceId));
            expect(view.location()).not.toBe(DOSSIER.path(spaceId));
          } finally {
            // Per run, not per test: the automatic cleanup in `test/setup.ts` fires
            // between tests, and one property mounts the app a hundred times inside one.
            cleanup();
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    "keeps every compatibility and retained route resolving to its own page",
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(spaceIdArb, (spaceId) => {
          RESOLVING_ROUTES.forEach((route) => {
            const view = renderAppAt(route.path(spaceId));
            try {
              // Still its own destination: no redirect, no catch-all.
              expect(view.location()).toBe(route.path(spaceId));
              expect(view.rendered(route.page)).toBe(true);
              expect(view.rendered("NotFound")).toBe(false);

              // And nothing else resolved alongside it. Two pages on screen would mean
              // the table had grown an overlapping route.
              expect(harness.pagesRendered).toEqual([route.page]);
            } finally {
              cleanup();
            }
          });
        }),
        { numRuns: 100 },
      );
    },
  );

  it("registers the retired path against the redirect rather than against a page", () => {
    renderAppAt(NOWHERE);

    // The table was captured at all. Without this the three assertions below would pass
    // vacuously over an empty list, which is the way a scan like this fails open.
    expect(harness.routeTable.length).toBeGreaterThan(20);

    const retired = declaredRoute(RETIRED_PROSPECT_TEMPLATE);
    expect(retired).toBeDefined();
    expect(retired?.elementName).toBe(REDIRECT_ELEMENT);

    // The redirect and the dossier are different elements: the retired path forwards to
    // the dossier, it does not render a second copy of it.
    expect(retired?.elementType).not.toBe(declaredRoute(DOSSIER.template)?.elementType);
  });

  it("keeps GTMProspect out of the rendered route table", () => {
    renderAppAt(NOWHERE);

    harness.routeTable.forEach((route) => {
      // R3.3, as the claim it actually is: not "the file is gone" — it is not, task 12.3
      // lifts the fold-in out of it — but "no route renders it".
      expect({ path: route.path, element: route.elementName }).toEqual({
        path: route.path,
        element: expect.not.stringMatching(/GTMProspect/i) as unknown as string,
      });
      // A `<Route>` with no element would make the name check meaningless for that row.
      expect(route.elementName).not.toBe("(no element)");
    });

    // And the path GTMProspect used to own renders the redirect instead of a page, which
    // is the specific regression R2.1 and R3.3 describe together.
    expect(declaredRoute(RETIRED_PROSPECT_TEMPLATE)?.elementName).toBe(REDIRECT_ELEMENT);
  });

  it("gives each retained route an element of its own", () => {
    renderAppAt(NOWHERE);

    const elements = RESOLVING_ROUTES.map((route) => {
      const declared = declaredRoute(route.template);
      expect(declared).toBeDefined();
      return declared?.elementType;
    });

    // Distinct: a compatibility route re-pointed at the dossier "to simplify things" would
    // still resolve and still render a page, so equality is the only thing that catches it.
    expect(new Set(elements).size).toBe(elements.length);
  });

  it("lands the retired path on the dossier for one spelled-out workspace", () => {
    // The readable regression under the generated property: a redirect that dropped the
    // identifier, or kept it and appended something, fails here with the actual string.
    const view = renderAppAt("/relationship-intelligence/brand-1");

    expect(view.location()).toBe("/prospect-intelligence/brand-1");
    expect(view.query.getByTestId("page:ProspectIntelligence")).toBeInTheDocument();
  });

  it("still resolves the compatibility and retained routes for one spelled-out workspace", () => {
    const landings = RESOLVING_ROUTES.map((route) => {
      const view = renderAppAt(route.path("brand-1"));
      const landed = { path: view.location(), pages: [...harness.pagesRendered] };
      cleanup();
      return landed;
    });

    expect(landings).toEqual([
      { path: "/prospect-intelligence/brand-1", pages: ["ProspectIntelligence"] },
      { path: "/gtm-dashboard/brand-1", pages: ["GTMDashboard"] },
      { path: "/sales/brand-1", pages: ["Max"] },
      { path: "/sales-workspace-legacy/brand-1", pages: ["SalesWorkspace"] },
      { path: "/leads/brand-1", pages: ["SalesAssistant"] },
      { path: "/connections/brand-1", pages: ["Connections"] },
    ]);
  });

  it("distinguishes a resolved route from the catch-all", () => {
    // The harness's own self-test. Every assertion above reads "this page mounted" or
    // "NotFound did not", and both would be worthless if the catch-all never rendered or
    // if the stubs were not wired to the table at all.
    const view = renderAppAt(NOWHERE);

    expect(view.location()).toBe(NOWHERE);
    expect(view.rendered("NotFound")).toBe(true);
    expect(harness.pagesRendered).toEqual(["NotFound"]);

    // And the swap is in effect: a real `BrowserRouter` would have ignored the requested
    // entry and started at jsdom's own location.
    expect(view.location()).not.toBe("/");
  });
});
// ─── Property 42 ──────────────────────────────────────────────────────────────
//
// "For any route in the authenticated route table, mounting it presents the credit balance
// in the application chrome." (R17.1: *THE App_Chrome SHALL present the credit balance on
// every route inside the authenticated application.*)
//
// ── Why the pages mount for real here, and Property 4's stubs do not serve ──
//
// The balance is rendered by `CreditBalanceBadge`, and no shared frame renders it: each
// surface places the badge in its own header. So the only thing that can answer "does this
// route present the balance" is that route's page, rendered. `PAGE_MODE.pageMode = "real"`
// is the seam Property 4 left for exactly this.
//
// The cheap alternative — scan which page modules import `CreditBalanceBadge` — would be a
// claim about the filesystem, the same weakness this file's header rejects for
// `GTMProspect`. A module can import the badge and render it behind a condition that is
// false on load, and an import scan would call that a pass.
//
// ── Why the number, not the element ──
//
// `CreditBalanceBadge` renders **nothing at all** for `balance === null`, deliberately: an
// unread balance shown as `0` would tell a rep with credits that they have none. So
// `queryByTestId("credit-balance")`-style presence checks are worthless here — they pass on
// a page whose provider never read, which is the exact state R17.1 is about. The property
// therefore *serves* a known balance and reads that number back out of the badge. A genuine
// `0` is included in the generated balances because it is the case a page written
// `balance ? <Badge/> : null` gets wrong, and R17.7 makes `0` a valid read.
//
// ── Which routes are "inside the authenticated application" ──
//
// Read off `App.tsx`'s captured table by rule, not restated: **every route whose path
// carries `:spaceId`**, less the legacy Weez marketing surfaces named below. The rule is
// the structural one — `CreditsProvider` derives its workspace from the path's second
// segment, so a route with no `:spaceId` cannot have a balance to present. That is also why
// `/spaces` is outside this property despite being authenticated: the provider reads nothing
// there, by design, and a badge on it would have no workspace to be the balance *of*.
//
// Stating the *exclusions* rather than the inclusions is what makes this survive the table
// growing: a workspace-scoped route added to `App.tsx` later is in scope by default and the
// property covers it with no edit here. `accounts for every workspace-scoped route` below is
// the tripwire that makes such an addition visible rather than silent.
//
// The four registered-but-not-offered paths, decided and recorded:
//
//   `/relationship-intelligence/`  **in scope, asserted at its destination.** It renders a
//                                  redirect, not a page, so it has no chrome of its own —
//                                  the chrome the rep actually lands in is the dossier's,
//                                  and that is what the mount reads. Needs no special case:
//                                  mounting a redirect renders its target.
//   `/market-discovery/`,          **in scope, same mechanism.** Both redirect into
//   `/revenue-intelligence/`       `/leads/{id}?tab=…`, so both are read at `SalesAssistant`.
//                                  Treated identically to the one above rather than excused,
//                                  because "it is only a redirect" is not a reason for a rep
//                                  who followed a bookmark to lose the balance.
//   `/gtm-dashboard/`, `/sales/`,  **in scope.** They are off the sidebar (`retired.ts`) but
//   `/sales-workspace-legacy/`     still registered and still reachable by direct URL, which
//                                  makes them routes inside the authenticated application in
//                                  the only sense R17.1 uses. Excluding them would shrink the
//                                  requirement from a claim about the application to a claim
//                                  about five files.
//
// ── The two instruments, and why both ──
//
// `it.each` and a generated property answer different questions, so the enumeration and the
// property are split rather than merged:
//
//   the enumeration   is the load-bearing one. The route set is finite and known, and the
//                     useful report is *every* route that fails, at once — which a single
//                     `toEqual` over the collected array gives and a shrunk counterexample
//                     does not. fast-check would report the first failing route and hide the
//                     rest, and "the balance is missing on one route" is a very different
//                     bug report from "the balance is missing on six".
//   the property      earns its place on the two dimensions that are not enumerable: the
//                     balance (a genuine `0`, and any number) and the workspace identifier
//                     shape. Its route dimension is a `constantFrom` over the same set, so
//                     it is sampling within a space the enumeration already covers
//                     exhaustively — that is deliberate, not redundant.

/** The route parameter every workspace-scoped path in `App.tsx` is keyed on. */
const WORKSPACE_PARAM = ":spaceId";

/**
 * Workspace-scoped routes outside the sales workflow this spec restructures.
 *
 * The legacy Weez marketing surfaces. They are authenticated and they are workspace-scoped,
 * so the `:spaceId` rule catches them, but `App_Chrome` in R17.1 is the frame of the sales
 * workflow's surface map — none of these spends a credit and none of them is reached from
 * the restructured navigation. Named here so the exclusion is a decision on the record
 * rather than a gap in a hand-written list.
 */
const NON_WORKFLOW_WORKSPACE_ROUTES: readonly string[] = [
  "/chat/:spaceId",
  "/gallery/:spaceId",
  "/one-click-post/:spaceId",
  "/autonomous-marketing/:spaceId",
  "/linkedin-analytics/:spaceId",
  "/sales-intelligence/:spaceId",
  "/growth/:spaceId",
];

/** Every workspace-scoped path `App.tsx` declared, in table order. */
const workspaceScopedRoutes = (): string[] =>
  harness.routeTable.map((route) => route.path).filter((path) => path.includes(WORKSPACE_PARAM));

/** The subject of this property: the workspace-scoped table, less the exclusions above. */
const authenticatedRoutes = (): string[] =>
  workspaceScopedRoutes().filter((path) => !NON_WORKFLOW_WORKSPACE_ROUTES.includes(path));

/**
 * Fills a path template. `split`/`join` rather than `replaceAll` so this does not depend on
 * the lib target, and it handles a template carrying the parameter twice.
 */
const fillTemplate = (template: string, spaceId: string) =>
  template.split(WORKSPACE_PARAM).join(spaceId);

/** A `Response`-shaped answer. */
const stubResponse = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  statusText: ok ? "OK" : "Not Found",
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * Endpoints serving a metrics object whose fields the page dereferences.
 *
 * Answered as "no metrics for this workspace" — a 404 rather than an empty object — because
 * the pages that read these do arithmetic on the fields (`stats.reply_to_meeting_ready_rate
 * .toFixed(1)`), so `{}` is not an empty answer to them, it is a `TypeError`. Every one of
 * them already guards the render on the read having succeeded, which is the branch a new
 * workspace takes anyway.
 *
 * This is the "mock its service to resolve empty and say so" case, said here: no GTM
 * surface reads a `stats` endpoint, so this narrows nothing the property is about — it is
 * three legacy pages' metrics strip, and the balance is not in it.
 */
const METRICS_ENDPOINT = /\/stats(\?|$)/;

/**
 * Serves the balance, and a shallow empty envelope for every other read.
 *
 * Property 4's `serveCredits` answers `{}` to everything but `/credits`, which is enough for
 * a stubbed page and not enough for a real one: eleven pages fetch on mount and several map
 * a collection out of the response. The envelope carries the collection keys those mappers
 * reach for, all empty, so each page renders its own no-data state — which is the right
 * subject anyway. The claim is about chrome, so every page is deliberately given nothing to
 * put in its body; a page that can only show the balance when it has content would be
 * failing R17.1 in the state a new workspace is actually in.
 *
 * The envelope is an **array carrying those keys**, not an object, because the pages under
 * test disagree about the shape of a collection response: the GTM services read
 * `body.items`, while `SalesWorkspace` and `MarketDiscovery` `setState(body)` and then
 * `.map` it. One shape that answers both keeps this a single shallow stub instead of a
 * per-endpoint fixture table — which would be this file restating five services' contracts,
 * and would go stale against them silently.
 *
 * `text` and `headers` are here because the five service modules in play are not all written
 * against the same three Response members, and a missing method would surface as "did not
 * mount" — a failure about this stub rather than about the chrome.
 */
function servePages(balance: number) {
  /** Built per call, so a page that mutates what it was served cannot affect the next one. */
  const emptyEnvelope = () =>
    Object.assign([] as unknown[], {
      items: [],
      rows: [],
      results: [],
      data: [],
      leads: [],
      prospects: [],
      aggregates: [],
      signals: [],
      insights: [],
      conversations: [],
      messages: [],
      connections: [],
      spaces: [],
      transitions: [],
      candidates: [],
      history: [],
      summary: {},
      total: 0,
      count: 0,
      has_more: false,
      next_cursor: null,
    });

  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.includes("/credits")) {
      return stubResponse({ brand_id: "brand-1", balance, prices: [], history: [] });
    }
    if (METRICS_ENDPOINT.test(url)) return stubResponse({ detail: "no metrics" }, false);
    return stubResponse(emptyEnvelope());
  });
}

/** What one route presented: the number, or the reason there was no number. */
interface RouteChrome {
  route: string;
  /** The balance the chrome showed, or a sentence naming what it showed instead. */
  balance: number | string;
}

/**
 * Reads every credit balance the chrome is presenting, within one mount.
 *
 * Found through the badge's own screen-reader label rather than a test id, so the instrument
 * is the thing an assistive user hears. `CREDIT_LABELS.balanceAria` is imported, never
 * restated — a renamed label moves this query with it instead of silently matching nothing.
 *
 * RTL's text matching compares each element's *direct* text children, so the label regex
 * matches only the `sr-only` span and not its ancestors. The number is then read from inside
 * that span's parent, which scopes it to the badge: a `42` printed elsewhere on the page
 * cannot stand in for a balance that is absent.
 */
const presentedBalances = (q: ReturnType<typeof within>): (number | string)[] =>
  q.queryAllByText(new RegExp(`^${CREDIT_LABELS.balanceAria}:$`)).map((label) => {
    const badge = label.parentElement;
    if (!badge) return "a balance label with no badge around it";
    const [number] = within(badge).queryAllByText(/^\d+$/);
    return number ? Number(number.textContent) : "a badge with no number in it";
  });

/**
 * Lets the provider's read land before the chrome is read back.
 *
 * The balance is `null` for the whole of the first commit — `CreditsProvider` fetches in an
 * effect — so a synchronous query after `render()` sees no badge on *every* route, including
 * the ones that carry it. That is the difference between measuring the chrome and measuring
 * React's first paint.
 *
 * Microtask flushes rather than `waitFor`, for two reasons. The read is a fixed chain of
 * awaits against a synchronous stub, so there is no clock to wait on and nothing to poll
 * for. And `waitFor` bills its full timeout on every route where the badge never appears —
 * with fourteen routes and a handful of them absent by design, the polling clock would
 * dominate the suite and, worse, would make "absent" and "slow" look alike.
 *
 * Returns as soon as a balance is on screen, so a route that presents it costs one or two
 * flushes; the bound is what makes a route that never will cost a fixed, tiny amount.
 */
const settleBalance = async (q: ReturnType<typeof within>) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (presentedBalances(q).length > 0) return;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};

/**
 * Mounts one authenticated route and reads the balance out of its chrome.
 *
 * A page that throws — on mount, or on a later commit once its own reads land — is reported
 * as its own outcome rather than allowed to abort the test, so one broken page does not hide
 * the verdict on the thirteen after it. The assertion is unchanged by this: every route still
 * has to produce the served number, and "did not mount" is a failure like any other.
 */
const mountAndReadBalance = async (template: string, spaceId: string): Promise<RouteChrome> => {
  const path = fillTemplate(template, spaceId);

  let view: ReturnType<typeof renderAppAt>;
  try {
    view = renderAppAt(path);
    await settleBalance(view.query);
  } catch (error) {
    cleanup();
    return {
      route: template,
      balance: `did not mount: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const found = presentedBalances(view.query);
    if (found.length === 0) {
      const landed = harness.pagesRendered.join(", ") || "an unrecorded page";
      return {
        route: template,
        balance: `no balance in the chrome of ${landed} at ${view.location()}`,
      };
    }
    // More than one badge is fine — a page may repeat it — but they have to agree. Two
    // different numbers on one surface would mean a second read had gone stale.
    const distinct = [...new Set(found)];
    return {
      route: template,
      balance: distinct.length === 1 ? distinct[0] : `disagreeing balances: ${distinct.join(", ")}`,
    };
  } finally {
    // Per mount, not per test: fourteen application mounts happen inside one `it`.
    cleanup();
  }
};

/**
 * Captures `App.tsx`'s route table without paying for a real page.
 *
 * The table is recorded on render, so it has to be read from a mount. This one lands on the
 * catch-all in stub mode, which costs a sentinel `div`.
 */
const captureRouteTable = (): string[] => {
  PAGE_MODE.pageMode = "stub";
  try {
    renderAppAt(NOWHERE);
    return authenticatedRoutes();
  } finally {
    cleanup();
  }
};

/**
 * A workspace identifier the provider will actually read for.
 *
 * `spaceIdArb` deliberately spans shapes the provider ignores — `brandIdFromPath` only
 * returns an id when the segment is a uuid — and a route that never read cannot present a
 * balance. That is a true fact about the provider, not about the chrome, so this property
 * generates only uuids and leaves the non-uuid shapes to Property 4.
 */
const readableSpaceIdArb: fc.Arbitrary<string> = fc.uuid();

/** Any balance the server might serve, with a genuine `0` weighted in. R17.7. */
const balanceArb: fc.Arbitrary<number> = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.nat({ max: 9999 }),
);

describe("Feature: sales-workflow-frontend-restructure, Property 42: The credit balance is present on every authenticated route", () => {
  it(
    "presents the served balance in the chrome of every authenticated route",
    // Fourteen real page mounts. The 5s default is a per-test budget.
    { timeout: 60_000 },
    async () => {
      const routes = captureRouteTable();
      // The set was derived at all. Without this the loop below would pass vacuously over
      // an empty list, which is how a table-driven scan fails open.
      expect(routes.length).toBeGreaterThan(10);

      const spaceId = "b21005a0-0000-4000-8000-000000000001";
      const balance = 7;

      PAGE_MODE.pageMode = "real";
      servePages(balance);

      const presented: RouteChrome[] = [];
      for (const template of routes) {
        // Sequential on purpose: two application mounts in the document at once would put
        // two chromes in scope, and the mount-scoped queries could not tell them apart.
        // eslint-disable-next-line no-await-in-loop
        presented.push(await mountAndReadBalance(template, spaceId));
      }

      // One assertion over the whole table, so the diff names every route that fails rather
      // than stopping at the first.
      expect(presented).toEqual(routes.map((route) => ({ route, balance })));
    },
  );

  it(
    "presents the server's own number, including a genuine zero, whatever the route and the workspace",
    { timeout: 60_000 },
    async () => {
      const routes = captureRouteTable();
      expect(routes.length).toBeGreaterThan(10);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...routes),
          balanceArb,
          readableSpaceIdArb,
          async (template, balance, spaceId) => {
            // At the top of each run, not in `beforeEach`: `beforeEach` fires once per
            // `it` and this predicate runs many times inside one, each with its own
            // balance to serve.
            PAGE_MODE.pageMode = "real";
            servePages(balance);

            // The served number, exactly — not "a number", and not "a badge". A page that
            // hid the badge at `0`, or rounded, or showed a stale read, fails here.
            expect(await mountAndReadBalance(template, spaceId)).toEqual({
              route: template,
              balance,
            });
          },
        ),
        // One real application mount per run. The route dimension is covered exhaustively
        // by the sibling test, so what these runs buy is the balance and identifier shapes.
        { numRuns: 25 },
      );
    },
  );

  it("accounts for every workspace-scoped route in the table", () => {
    renderAppAt(NOWHERE);

    const workspaceScoped = workspaceScopedRoutes();
    expect(workspaceScoped.length).toBeGreaterThan(15);

    // Nothing named out of scope has since left the table — a stale exclusion would quietly
    // shrink the property's subject.
    expect(workspaceScoped).toEqual(expect.arrayContaining([...NON_WORKFLOW_WORKSPACE_ROUTES]));

    // And the subject, spelled out in table order. This is the tripwire: a workspace-scoped
    // route added to `App.tsx` is in scope by default, and it fails *here* — forcing the
    // decision to be made and recorded rather than missed.
    expect(authenticatedRoutes()).toEqual([
      "/connections/:spaceId",
      "/sales/:spaceId",
      "/leads/:spaceId",
      "/sales-workspace/:spaceId",
      "/sales-workspace-legacy/:spaceId",
      "/ninna/:spaceId",
      "/eva/:spaceId",
      "/prospect-intelligence/:spaceId",
      "/relationship-intelligence/:spaceId",
      "/action-queue/:spaceId",
      "/gtm-dashboard/:spaceId",
      "/analytics/:spaceId",
      "/market-discovery/:spaceId",
      "/revenue-intelligence/:spaceId",
    ]);
  });

  it("reads no balance from a chrome whose provider never read one", async () => {
    // The instrument's own negative control. Every assertion above is "the number was
    // found", and that phrasing is only worth something if `presentedBalances` can come
    // back empty. `/spaces` is not workspace-scoped, so `brandIdFromPath` yields nothing,
    // the provider issues no read, the balance stays `null` and the badge renders nothing —
    // which is why `/spaces` is outside this property rather than a counterexample to it.
    PAGE_MODE.pageMode = "real";
    servePages(42);

    const view = renderAppAt("/spaces");
    try {
      // Settled the same way as every other mount, so "empty" here means the provider had
      // nothing to read rather than that the read had not landed yet.
      await settleBalance(view.query);
      expect(presentedBalances(view.query)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("presents the balance on the dossier for one spelled-out workspace", async () => {
    // The readable regression under the generated property: the number, at a real path,
    // with no generation in the way.
    PAGE_MODE.pageMode = "real";
    servePages(13);

    const view = renderAppAt("/prospect-intelligence/b21005a0-0000-4000-8000-000000000001");
    try {
      await settleBalance(view.query);
      expect(presentedBalances(view.query)).toEqual([13]);
    } finally {
      cleanup();
    }
  });
});
// ─── R20.7 ────────────────────────────────────────────────────────────────────
//
// "THE Test_Suite SHALL replace `GTMProspect.{a11y,compose,identity,labels}.test.tsx` with
// equivalent suites written against the Prospect_Dossier."
//
// The four suites are gone (task 13.1) and their five dossier equivalents are in
// `pages/__tests__/ProspectDossier.*.test.tsx`. What the requirement needs on top of that is
// the standing half: that no *later* suite, and no shipped module either, quietly reaches
// back for the retired page. A replacement that leaves one importer behind has not replaced
// anything — the retired page is still being exercised, and the next refactor of it has a
// test telling it what to keep.
//
// ── Why this file, and why a source scan ──
//
// The route-table claim (R3.3, above) and this one are the two halves of retiring a page:
// nothing renders it, and nothing imports it. They belong together, and this file is already
// the one that carries the first half.
//
// A source scan is the right instrument here in a way it is *not* for R3.3 or for Property
// 42. Those two are claims about behaviour — what the table resolved, what a page presented —
// and a filesystem scan would answer a different, weaker question about either. This one is a
// claim about the module graph itself: "nothing imports it" is *literally* a statement about
// import specifiers, so reading them is not a proxy for the claim, it is the claim. The
// alternative — mounting every module and watching for the page — cannot distinguish a module
// that imports it from one that never evaluated the branch that does.
//
// ── How it avoids answering vacuously ──
//
// Four ways a scan like this fails open, each closed below:
//
//   it walked nothing              the file count is asserted, and so is the count of
//                                  specifiers extracted across the tree.
//   it matched nothing, ever       the extractor is run against a fixture that *does* import
//                                  the retired page, four ways, and has to report all four.
//   it matched prose               comments are stripped before extraction, so the paragraphs
//                                  above — and this one — are not references. Only real
//                                  specifiers count.
//   the page was deleted instead   the module is asserted to still be **on disk**. R3.3 and
//                                  task 12.3 keep it there on purpose; a scan that passed
//                                  because the file vanished would be reporting a different,
//                                  unrequested change as success.
//
// ── The carve-out, and why it is a carve-out rather than an exclusion ──
//
// The positive control has to write down specifiers that *do* name the retired page, and this
// file is inside the tree it scans, so without something it reports itself. The obvious answer
// — skip the scanning file — would leave the one file in the repository that can never be
// caught reaching for the retired page, which is the wrong file to blind. So this file is
// swept like every other and the fixture region alone is carved out, bracketed by sentinels
// that are visible in the source and asserted below: exactly one file in the tree carries
// them, and the sweep still walks the rest of this file. A fixture that grew past its
// sentinel, or a sentinel that drifted, fails the sweep rather than widening the hole.

/** The retired module, as a repository path. A search subject, never a specifier. */
const RETIRED_PAGE = "src/pages/GTMProspect";

/** Roots to walk. Everything the application and its suites are made of. */
const SCANNED_ROOT = "src";

/** Extensions that can carry an import. */
const SCANNED_EXTENSIONS = [".ts", ".tsx"];

/**
 * Every module specifier in `source`.
 *
 * The four forms that create a real dependency: a static `import`/`export … from`, a bare
 * side-effect `import`, a dynamic `import()`, a CommonJS `require()`, and `vi.mock()` — which
 * is not an import in the language's sense but is one in vitest's, since the path has to
 * resolve for the mock to register.
 */
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*|\bvi\s*\.\s*mock\s*\(\s*)["']([^"'\n]+)["']/g;

/** Block comments, and line comments that own their line. `ConversationSidebar`'s idiom. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");

/** The sentinels bracketing this file's own positive-control material. */
const CARVE_OUT_START = "r20-7-fixture:start";
const CARVE_OUT_END = "r20-7-fixture:end";

/**
 * The bracketed regions removed.
 *
 * Runs *before* `withoutComments`, since the sentinels are themselves line comments. Applied
 * to every file rather than to this one by name, so the mechanism is uniform — and the test
 * below asserts that only one file in the tree uses it.
 */
const withoutCarveOuts = (source: string) =>
  source.replace(
    new RegExp(`//[ \\t]*${CARVE_OUT_START}[\\s\\S]*?//[ \\t]*${CARVE_OUT_END}`, "g"),
    "",
  );

/** One file's source, as it is scanned: carve-outs gone, then comments gone. */
const scannableSourceOf = (file: string) =>
  withoutComments(withoutCarveOuts(readFileSync(resolve(process.cwd(), file), "utf8")));

/** Every scanned file under `dir`, as repository-relative posix paths. */
function filesUnder(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

/**
 * What `specifier` resolves to, as a repository-relative path with no extension, or `null`
 * for a bare package name.
 *
 * `@/` is the alias `vite.config.ts` points at `src`. A relative specifier resolves against
 * the importing file's own directory, which is the only way `../GTMProspect` from
 * `src/pages/__tests__/` can be recognised as the retired page.
 */
function resolveSpecifier(specifier: string, importer: string): string | null {
  const withoutExtension = (path: string) => path.replace(/\.(tsx?|jsx?)$/, "");
  if (specifier.startsWith("@/")) return withoutExtension(posix.join("src", specifier.slice(2)));
  if (specifier.startsWith(".")) {
    return withoutExtension(posix.normalize(posix.join(posix.dirname(importer), specifier)));
  }
  return null;
}

/** Every resolved dependency `file` declares. */
function dependenciesOf(file: string): string[] {
  const resolved: string[] = [];
  for (const [, specifier] of scannableSourceOf(file).matchAll(SPECIFIER)) {
    const target = resolveSpecifier(specifier, file);
    if (target) resolved.push(target);
  }
  return resolved;
}

// r20-7-fixture:start
//
// The two carved constants, together and at module scope so the region is one place rather
// than three. Everything below refers to them by identifier, which is why no test body has to
// spell the retired page or its exports again.

/**
 * A source file that imports the retired page five ways, for the positive control.
 *
 * Written as text rather than planted on disk: a real file would have to be created and
 * removed around the assertion, and a run that died in between would leave the very importer
 * the sweep is looking for.
 */
const IMPORT_FIXTURE = [
  `import GTMProspect from "../GTMProspect";`,
  `import { SILENT_REFETCH_MS } from "@/pages/GTMProspect";`,
  `export { applySocketEvent } from "../GTMProspect.tsx";`,
  `vi.mock("@/pages/GTMProspect", () => ({ default: () => null }));`,
  `const lazy = () => import("../GTMProspect");`,
  // And one that must *not* be picked up: the module named in a comment, which is what every
  // paragraph in this file does.
  `// see ../GTMProspect for the fold-in`,
].join("\n");

/** The retired page's own named exports — the names only it can provide. */
const RETIRED_PAGE_EXPORTS = ["SILENT_REFETCH_MS", "applySocketEvent"];
// r20-7-fixture:end

describe("Feature: sales-workflow-frontend-restructure, R20.7: the retired prospect page has no importers left", () => {
  it("finds every form of import when they are there", () => {
    // The instrument's own positive control, and the reason the sweep below means anything.
    // A regex that had stopped matching, or an alias that had been renamed in
    // `vite.config.ts`, would report a clean tree — indistinguishable from the real thing.
    // So a fixture that imports the retired page five ways is put through the same
    // extractor, from a file in the directory the deleted suites used to sit in.
    const importer = "src/pages/__tests__/fixture.test.tsx";

    const found = [...withoutComments(IMPORT_FIXTURE).matchAll(SPECIFIER)]
      .map(([, specifier]) => resolveSpecifier(specifier, importer))
      .filter((target) => target === RETIRED_PAGE);

    // Five specifiers, not four: the commented one is stripped and contributes nothing.
    expect(found).toHaveLength(5);
    expect(withoutComments(IMPORT_FIXTURE)).not.toContain("the fold-in");
  });

  it("keeps the retired page on disk, so the scan is measuring importers and not a deletion", () => {
    // R3.3 is "no route renders it", not "the file is gone", and task 12.3 lifted the
    // fold-in out of it rather than removing it. A tree where the module had been deleted
    // would satisfy the sweep below for the wrong reason.
    expect(existsSync(resolve(process.cwd(), `${RETIRED_PAGE}.tsx`))).toBe(true);
  });

  it("retired the four legacy suites named in the requirement", () => {
    // The replacement's first half, stated as its own claim: the four files R20.7 names are
    // gone, and the five suites written against the dossier are there in their place.
    const legacy = ["a11y", "compose", "identity", "labels"].map(
      (kind) => `src/pages/__tests__/GTMProspect.${kind}.test.tsx`,
    );
    expect(legacy.filter((file) => existsSync(resolve(process.cwd(), file)))).toEqual([]);

    const replacements = ["a11y", "compose", "decision", "identity", "labels"].map(
      (kind) => `src/pages/__tests__/ProspectDossier.${kind}.test.tsx`,
    );
    expect(replacements.filter((file) => !existsSync(resolve(process.cwd(), file)))).toEqual([]);
  });

  it("imports the retired page from nowhere in the tree", () => {
    const files = filesUnder(SCANNED_ROOT);
    // A walk that found nothing, or a fraction of the tree, would pass the sweep below
    // vacuously. Both counts are the subject's size, so they are asserted rather than
    // assumed.
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(`${RETIRED_PAGE}.tsx`);
    expect(files).toContain("src/pages/ProspectIntelligence.tsx");

    const graph = files.map((file) => ({ file, dependencies: dependenciesOf(file) }));
    expect(graph.reduce((total, node) => total + node.dependencies.length, 0)).toBeGreaterThan(500);

    // Reported as the offending pairs rather than as a count, so a failure names the file
    // that reached back and not only that something did.
    const importers = graph
      .filter((node) => node.dependencies.includes(RETIRED_PAGE))
      .map((node) => node.file);
    expect(importers).toEqual([]);
  });

  it("imports nothing else out of the retired page's directory that only it provided", () => {
    // The near miss. `SILENT_REFETCH_MS` and `applySocketEvent` are the retired page's two
    // named exports, and a module that still wanted either would have to import the page to
    // get it — so a reference to one of those names anywhere but the page itself is the same
    // violation arriving under a different spelling, and it would survive a scan that only
    // looked at specifiers.
    const holders = filesUnder(SCANNED_ROOT)
      .filter((file) => file !== `${RETIRED_PAGE}.tsx`)
      .filter((file) => {
        const source = scannableSourceOf(file);
        return RETIRED_PAGE_EXPORTS.some((name) => source.includes(name));
      });

    expect(holders).toEqual([]);

    // And the two names really are the page's own, so the sweep above is not looking for
    // strings that stopped existing — which is how it would come to pass for free. Read off
    // the module rather than restated.
    const page = readFileSync(resolve(process.cwd(), `${RETIRED_PAGE}.tsx`), "utf8");
    expect(RETIRED_PAGE_EXPORTS.filter((name) => !page.includes(name))).toEqual([]);
  });

  it("carves out this file's fixture and nothing else in the tree", () => {
    // The carve-out is the one thing in this block that can widen silently, so it is the one
    // thing asserted about directly. Three clauses: only this file uses it, it takes the
    // fixture material out, and it leaves the rest of this file in the sweep.
    const users = filesUnder(SCANNED_ROOT).filter((file) =>
      readFileSync(resolve(process.cwd(), file), "utf8").includes(CARVE_OUT_START),
    );
    expect(users).toEqual(["src/__tests__/routes.test.tsx"]);

    const scanned = scannableSourceOf("src/__tests__/routes.test.tsx");
    // Gone: the specifiers the positive control needs, and the two export names.
    expect(scanned).not.toContain(`"@/pages/${RETIRED_PAGE.split("/").pop()}"`);
    RETIRED_PAGE_EXPORTS.forEach((name) => expect(scanned).not.toContain(name));
    // Still there: this file's real imports, so the carve-out removed a region and not the
    // file. `App` is the subject of every other property here, so its absence would be loud.
    expect(scanned).toContain(`from "@/App"`);
    expect(dependenciesOf("src/__tests__/routes.test.tsx")).toContain("src/App");
  });
});
