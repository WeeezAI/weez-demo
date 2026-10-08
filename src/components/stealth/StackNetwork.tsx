import { useEffect, useRef, useState } from "react";

/**
 * "The GTM stack": eight named systems joined by the paths between them.
 *
 * Signals leave a system, travel an edge and, on arrival, either continue, split in two,
 * or simply end inside the receiving system. Every few seconds one path quietly fades
 * out and another appears, so the stack is never quite the same twice.
 *
 * SVG for crisp labels; a small rAF loop moves a fixed pool of signal elements by
 * attribute, so nothing re-renders through React while it runs. Paused off-screen and
 * static under prefers-reduced-motion.
 */

type P = [number, number];

const NODES = ["CRM", "Enrichment", "Outbound", "Marketing", "Conversation", "Customer success", "Data", "Revenue"];

const LAYOUT_WIDE: { view: [number, number]; pos: P[] } = {
  view: [1000, 560],
  pos: [
    [190, 160],
    [470, 80],
    [800, 150],
    [100, 390],
    [560, 290],
    [890, 400],
    [320, 480],
    [700, 490],
  ],
};

const LAYOUT_TALL: { view: [number, number]; pos: P[] } = {
  view: [360, 600],
  pos: [
    [70, 50],
    [270, 110],
    [80, 210],
    [280, 270],
    [130, 350],
    [270, 430],
    [70, 500],
    [250, 560],
  ],
};

// [a, b, startsActive]
const EDGES: [number, number, boolean][] = [
  [0, 1, true],
  [0, 2, true],
  [0, 3, true],
  [0, 4, true],
  [0, 6, true],
  [1, 2, true],
  [1, 6, true],
  [1, 3, false],
  [2, 4, true],
  [2, 5, true],
  [3, 6, true],
  [3, 4, false],
  [4, 7, true],
  [4, 5, true],
  [5, 7, true],
  [6, 7, true],
  [6, 4, false],
  [1, 4, false],
];

const POOL = 10;

interface Sig {
  edge: number;
  forward: boolean;
  s: number;
  speed: number;
  hops: number;
}

const StackNetwork = ({ className = "" }: { className?: string }) => {
  const [tall, setTall] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const layout = tall ? LAYOUT_TALL : LAYOUT_WIDE;

  const svgRef = useRef<SVGSVGElement>(null);
  const edgeRefs = useRef<(SVGLineElement | null)[]>([]);
  const haloRefs = useRef<(SVGCircleElement | null)[]>([]);
  const sigRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setTall(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pos = layout.pos;
    const active = EDGES.map((e) => (e[2] ? 1 : 0));
    const alpha = active.slice() as number[];
    const flash = EDGES.map(() => 0);
    const heat = NODES.map(() => 0);
    const sigs: Sig[] = [];

    const adj: number[][] = NODES.map(() => []);
    EDGES.forEach(([a, b], i) => {
      adj[a].push(i);
      adj[b].push(i);
    });

    const launch = (node: number, cameFrom: number, hops: number) => {
      if (sigs.length >= POOL) return;
      const options = adj[node].filter((ei) => ei !== cameFrom && active[ei] && alpha[ei] > 0.6);
      if (!options.length) return;
      const ei = options[Math.floor(Math.random() * options.length)];
      sigs.push({ edge: ei, forward: EDGES[ei][0] === node, s: 0, speed: 120 + Math.random() * 70, hops });
    };

    let raf = 0;
    let last = 0;
    let spawn = 0;
    let evolve = 0;
    let running = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;

      spawn += dt;
      if (spawn > 1.1) {
        spawn = 0;
        launch(Math.floor(Math.random() * NODES.length), -1, 1 + Math.floor(Math.random() * 3));
      }

      // the stack evolves: one path retires, a dormant one comes online
      evolve += dt;
      if (evolve > 7) {
        evolve = 0;
        const on = active.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        const off = active.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (on.length && off.length) {
          active[on[Math.floor(Math.random() * on.length)]] = 0;
          active[off[Math.floor(Math.random() * off.length)]] = 1;
        }
      }

      for (let i = 0; i < EDGES.length; i++) {
        alpha[i] += (active[i] - alpha[i]) * (1 - Math.exp(-dt / 1.4));
        flash[i] *= Math.exp(-dt / 0.6);
        const el = edgeRefs.current[i];
        if (el) el.style.opacity = String(alpha[i] * (0.55 + flash[i] * 0.45));
      }
      for (let n = 0; n < NODES.length; n++) {
        heat[n] *= Math.exp(-dt / 0.9);
        const el = haloRefs.current[n];
        if (el) el.style.opacity = String(heat[n] * 0.9);
      }

      for (let i = sigs.length - 1; i >= 0; i--) {
        const sg = sigs[i];
        const [ea, eb] = EDGES[sg.edge];
        const a = sg.forward ? ea : eb;
        const b = sg.forward ? eb : ea;
        const len = Math.hypot(pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]);
        sg.s += (sg.speed * dt) / len;
        flash[sg.edge] = Math.max(flash[sg.edge], 0.8);
        if (sg.s >= 1) {
          sigs.splice(i, 1);
          heat[b] = 1;
          if (sg.hops > 0) {
            const r = Math.random();
            if (r < 0.3) {
              // split
              launch(b, sg.edge, sg.hops - 1);
              launch(b, sg.edge, sg.hops - 1);
            } else if (r < 0.75) {
              launch(b, sg.edge, sg.hops - 1);
            }
            // otherwise: the signal ends inside this system
          }
        }
      }

      for (let i = 0; i < POOL; i++) {
        const el = sigRefs.current[i];
        if (!el) continue;
        const sg = sigs[i];
        if (!sg) {
          el.style.opacity = "0";
          continue;
        }
        const [ea, eb] = EDGES[sg.edge];
        const a = sg.forward ? ea : eb;
        const b = sg.forward ? eb : ea;
        const x = pos[a][0] + (pos[b][0] - pos[a][0]) * sg.s;
        const y = pos[a][1] + (pos[b][1] - pos[a][1]) * sg.s;
        el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        el.style.opacity = String(Math.min(1, Math.sin(Math.PI * Math.min(1, sg.s)) * 2));
      }
    };

    const start = () => {
      if (running || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    let inView = false;
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    });
    io.observe(svg);
    const onVis = () => (document.hidden ? stop() : inView && start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [layout]);

  const [vw, vh] = layout.view;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${vw} ${vh}`}
      className={className}
      role="img"
      aria-label="Eight GTM systems — CRM, enrichment, outbound, marketing, conversation intelligence, customer success, data and revenue — connected by many paths."
    >
      <defs>
        <radialGradient id="stack-halo">
          <stop offset="0%" stopColor="rgb(170,180,255)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(170,180,255)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="stack-sig">
          <stop offset="0%" stopColor="#eef1ff" stopOpacity="1" />
          <stop offset="40%" stopColor="#aab4ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#aab4ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g stroke="rgb(190,198,240)" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {EDGES.map(([a, b, on], i) => (
          <line
            key={i}
            ref={(el) => (edgeRefs.current[i] = el)}
            x1={layout.pos[a][0]}
            y1={layout.pos[a][1]}
            x2={layout.pos[b][0]}
            y2={layout.pos[b][1]}
            strokeOpacity="0.28"
            strokeDasharray={i % 4 === 3 ? "2 5" : undefined}
            style={{ opacity: on ? 0.55 : 0 }}
          />
        ))}
      </g>

      {layout.pos.map(([x, y], i) => (
        <circle key={`h${i}`} ref={(el) => (haloRefs.current[i] = el)} cx={x} cy={y} r={34} fill="url(#stack-halo)" style={{ opacity: 0 }} />
      ))}

      {Array.from({ length: POOL }, (_, i) => (
        <g key={`s${i}`} ref={(el) => (sigRefs.current[i] = el)} style={{ opacity: 0 }}>
          <circle r={9} fill="url(#stack-sig)" />
          <circle r={1.8} fill="#f4f6ff" />
        </g>
      ))}

      {layout.pos.map(([x, y], i) => {
        const labelRight = tall ? x < vw / 2 : x < vw * 0.68;
        return (
          <g key={`n${i}`}>
            <circle cx={x} cy={y} r={10} fill="#0b0c11" stroke="rgba(200,206,255,0.35)" />
            <circle cx={x} cy={y} r={3} fill="#e4e8ff" />
            <text
              x={labelRight ? x + 18 : x - 18}
              y={y + 4}
              textAnchor={labelRight ? "start" : "end"}
              className="fill-white/55 font-geist-mono"
              style={{ fontSize: tall ? 11 : 12, letterSpacing: "0.12em" }}
            >
              {NODES[i].toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default StackNetwork;
