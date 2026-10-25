import { useEffect, useRef } from "react";

/**
 * A faint workflow "circuit" behind the hero: node cards joined by orthogonal traces, with
 * signal pulses travelling along them and nodes blinking as pulses arrive. Plain Canvas 2D;
 * stops when off-screen or the tab is hidden; a single static frame under reduced motion.
 */

const TEAL = "59,191,175"; // dx-brand-night
const INK = "230,238,236"; // dx-night-ink

type Node = { x: number; y: number; w: number; h: number; heat: number };
type Edge = { a: number; b: number; pts: [number, number][]; len: number };
type Pulse = { e: number; s: number; v: number; fwd: boolean };

const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Orthogonal route between two node centres: out horizontally, then vertically, then in. */
const route = (a: Node, b: Node): [number, number][] => {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const mx = (ax + bx) / 2;
  return [
    [ax, ay],
    [mx, ay],
    [mx, by],
    [bx, by],
  ];
};

const polyLen = (pts: [number, number][]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
  return l;
};

const pointAt = (pts: [number, number][], d: number): [number, number] => {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, d / seg) : 1;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
};

export default function HeroCircuit({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry(7);

    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let pulses: Pulse[] = [];
    let time = 0;

    const build = () => {
      nodes = [];
      edges = [];
      pulses = [];
      // a loose grid of node cards, denser at the edges and sparse behind the headline
      const cols = Math.max(4, Math.round(w / 220));
      const rows = Math.max(3, Math.round(h / 150));
      const cw = w / cols;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = (c + 0.5) * cw;
          const cy = (r + 0.5) * rh;
          const centreness = 1 - Math.min(1, Math.hypot((cx - w / 2) / (w * 0.42), (cy - h / 2) / (h * 0.42)));
          if (rand() < 0.35 + centreness * 0.5) continue; // thin out, strongly near the middle
          const nw = 42 + rand() * 46;
          const nh = 18 + rand() * 12;
          nodes.push({ x: cx - nw / 2 + (rand() - 0.5) * cw * 0.5, y: cy - nh / 2 + (rand() - 0.5) * rh * 0.5, w: nw, h: nh, heat: 0 });
        }
      }
      // connect each node to one or two nearby nodes
      nodes.forEach((n, i) => {
        const near = nodes
          .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
          .filter((o) => o.j !== i && o.d < Math.max(cw, rh) * 1.8)
          .sort((p, q) => p.d - q.d)
          .slice(0, rand() < 0.4 ? 2 : 1);
        near.forEach(({ j }) => {
          if (edges.some((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))) return;
          const pts = route(n, nodes[j]);
          edges.push({ a: i, b: j, pts, len: polyLen(pts) });
        });
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduce) draw(0);
    };

    const spawn = () => {
      if (!edges.length || pulses.length > 18) return;
      const e = Math.floor(rand() * edges.length);
      pulses.push({ e, s: 0, v: 90 + rand() * 70, fwd: rand() < 0.5 });
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      // fine grid
      ctx.strokeStyle = `rgba(${INK},0.035)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < w; x += 48) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0.5; y < h; y += 48) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // traces
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${TEAL},0.22)`;
      ctx.beginPath();
      for (const e of edges) {
        ctx.moveTo(e.pts[0][0], e.pts[0][1]);
        for (let i = 1; i < e.pts.length; i++) ctx.lineTo(e.pts[i][0], e.pts[i][1]);
      }
      ctx.stroke();
      // trace corner vias
      ctx.fillStyle = `rgba(${TEAL},0.35)`;
      for (const e of edges) {
        for (let i = 1; i < e.pts.length - 1; i++) {
          ctx.beginPath();
          ctx.arc(e.pts[i][0], e.pts[i][1], 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // nodes: a small card with a title bar and two "field" lines
      for (const n of nodes) {
        n.heat = Math.max(0, n.heat - dt * 0.9);
        const a = 0.28 + n.heat * 0.6;
        ctx.strokeStyle = `rgba(${TEAL},${a})`;
        ctx.fillStyle = `rgba(12,19,21,0.85)`;
        ctx.beginPath();
        ctx.roundRect(n.x, n.y, n.w, n.h, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(${TEAL},${0.35 + n.heat * 0.5})`;
        ctx.fillRect(n.x + 5, n.y + 5, Math.min(14, n.w * 0.3), 2);
        ctx.fillStyle = `rgba(${INK},${0.18 + n.heat * 0.3})`;
        ctx.fillRect(n.x + 5, n.y + 10, n.w * 0.6, 1.5);
        if (n.h > 22) ctx.fillRect(n.x + 5, n.y + 15, n.w * 0.4, 1.5);
        if (n.heat > 0.02) {
          ctx.shadowColor = `rgba(${TEAL},${n.heat * 0.9})`;
          ctx.shadowBlur = 14;
          ctx.strokeStyle = `rgba(${TEAL},${n.heat * 0.9})`;
          ctx.beginPath();
          ctx.roundRect(n.x, n.y, n.w, n.h, 3);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // pulses with a short trailing comet
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const e = edges[p.e];
        p.s += (p.v * dt) / e.len;
        if (p.s >= 1) {
          nodes[p.fwd ? e.b : e.a].heat = 1;
          pulses.splice(i, 1);
          continue;
        }
        const d = (p.fwd ? p.s : 1 - p.s) * e.len;
        const [x, y] = pointAt(e.pts, d);
        for (let k = 1; k <= 6; k++) {
          const dd = d + (p.fwd ? -k * 5 : k * 5);
          if (dd < 0 || dd > e.len) continue;
          const [tx, ty] = pointAt(e.pts, dd);
          ctx.fillStyle = `rgba(${TEAL},${0.5 * (1 - k / 7)})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowColor = `rgba(${TEAL},0.9)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(${INK},0.95)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // a slow scan line, sci-fi but quiet
      if (!reduce) {
        const sy = ((time * 28) % (h + 200)) - 100;
        const g = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
        g.addColorStop(0, `rgba(${TEAL},0)`);
        g.addColorStop(0.5, `rgba(${TEAL},0.06)`);
        g.addColorStop(1, `rgba(${TEAL},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, sy - 60, w, 120);
      }
    };

    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let visible = true;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now - 16;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      acc += dt;
      while (acc > 0.35) {
        acc -= 0.35;
        spawn();
      }
      draw(dt);
    };
    const start = () => {
      if (running || reduce || !visible || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    if (reduce) {
      // seed a few lit nodes so the still frame has life
      nodes.slice(0, 4).forEach((n) => (n.heat = 0.6));
      draw(0);
    } else start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
