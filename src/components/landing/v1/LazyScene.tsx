import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/* Hosts a lazy WebGL scene over a still of the same picture.
   - the scene renders on screens ≥ 768px with WebGL available and motion allowed,
   - the still shows everywhere else and underneath while the scene loads (crossfade, no jump),
   - the scene only renders frames while on screen. */

export type SceneProps = { active: boolean; onReady?: () => void; onPhase?: (phase: number) => void };

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

export default function LazyScene({ load, still, aspect = "aspect-[4/3]", className = "", onPhase, onMode }: { load: () => Promise<{ default: ComponentType<SceneProps> }>; still: ReactNode; aspect?: string; className?: string; onPhase?: (phase: number) => void; onMode?: (mode: "still" | "3d") => void }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15 });
  const [mode, setMode] = useState<"still" | "3d">("still");
  const [ready, setReady] = useState(false);
  const Scene = useMemo(() => lazy(load), [load]);

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
  useEffect(() => onMode?.(mode === "3d" && ready ? "3d" : "still"), [mode, ready, onMode]);

  const live = mode === "3d" && ready;
  return (
    <div ref={ref} className={`relative w-full select-none ${aspect} ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] bottom-[6%] h-[32%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(11,110,105,0.16),transparent_70%)] blur-2xl" />
      <div className={`absolute inset-0 transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`}>{still}</div>
      {mode === "3d" && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary
            onError={() => {
              setReady(false);
              setMode("still");
            }}
          >
            <Suspense fallback={null}>
              <Scene active={inView} onReady={() => setReady(true)} onPhase={onPhase} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
