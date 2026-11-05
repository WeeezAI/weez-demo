import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import ControlPlaneStatic from "./ControlPlaneStatic";

/* Picks the right hero illustration for the visitor:
   - the WebGL scene on screens ≥ 768px with WebGL available and motion allowed,
   - the still everywhere else, and underneath the scene while it loads (crossfade, no layout shift).
   The scene only renders frames while the hero is on screen. */

const ControlPlaneScene = lazy(() => import("./ControlPlaneScene"));

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HeroVisual({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15 });
  const [mode, setMode] = useState<"still" | "3d">("still");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduce) {
      setMode("still");
      return;
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const decide = () => setMode(mq.matches && hasWebGL() ? "3d" : "still");
    decide();
    mq.addEventListener("change", decide);
    return () => mq.removeEventListener("change", decide);
  }, [reduce]);

  const live = mode === "3d" && ready;

  return (
    <div ref={ref} className={`relative aspect-[4/3] w-full select-none ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] bottom-[6%] h-[32%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(11,110,105,0.16),transparent_70%)] blur-2xl" />
      <ControlPlaneStatic className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`} />
      {mode === "3d" && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary
            onError={() => {
              setReady(false);
              setMode("still");
            }}
          >
            <Suspense fallback={null}>
              <ControlPlaneScene active={inView} onReady={() => setReady(true)} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
