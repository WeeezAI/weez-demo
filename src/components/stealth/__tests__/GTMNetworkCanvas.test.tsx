// Smoke test for the hero network's animation loop.
//
// jsdom has no canvas, rAF scheduler, or layout, so all of them are faked here: a
// recording 2D context, a manual frame pump, and observers that report "visible". What
// is asserted is the part that can break silently in a browser — that frames actually
// draw on both the full and the lightweight (touch / small-screen) path, that every
// drawn coordinate is finite, that the phase callback fires, and that unmount stops
// the loop.

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GTMNetworkCanvas from "../GTMNetworkCanvas";

type Frame = (t: number) => void;

let frames: Map<number, Frame>;
let nextId: number;
let arcs: [number, number][];

const fakeCtx = () =>
  new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "arc") return (x: number, y: number) => arcs.push([x, y]);
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
        return () => {};
      },
      set: () => true,
    },
  );

const pump = (count: number, stepMs: number) => {
  let now = 1000;
  for (let i = 0; i < count; i++) {
    now += stepMs;
    const pending = [...frames.entries()];
    frames.clear();
    pending.forEach(([, f]) => f(now));
  }
};

const setup = ({ fine, width }: { fine: boolean; width: number }) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("pointer: fine") ? fine : false,
    addEventListener() {},
    removeEventListener() {},
  }));
};

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  arcs = [];
  vi.stubGlobal("requestAnimationFrame", (f: Frame) => {
    const id = nextId++;
    frames.set(id, f);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeCtx() as never);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
  } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GTMNetworkCanvas", () => {
  it.each([
    ["full (desktop pointer)", { fine: true, width: 1440 }],
    ["lite (touch, small screen)", { fine: false, width: 375 }],
  ])("draws finite frames on the %s path", (_label, env) => {
    setup(env);
    const onPhase = vi.fn();
    render(<GTMNetworkCanvas onPhase={onPhase} />);

    // ~60s of 60Hz frames: long enough to pass through every phase and one rearrangement
    pump(3600, 1000 / 60);

    expect(arcs.length).toBeGreaterThan(1000);
    expect(arcs.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    const phases = onPhase.mock.calls.map((c) => c[0]);
    expect(phases).toEqual(expect.arrayContaining([0, 1, 2]));
  });

  it("stops scheduling frames after unmount", () => {
    setup({ fine: true, width: 1440 });
    const view = render(<GTMNetworkCanvas />);
    pump(5, 16);
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
  });
});
