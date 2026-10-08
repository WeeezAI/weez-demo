import { useEffect, useRef } from "react";

/**
 * An abstract, slowly evolving picture of a GTM stack.
 *
 * Eight system clusters (a hub plus its satellites) drift on their own. Over a long
 * cycle the picture moves through three states:
 *
 *   fragmentation  — signals only circulate inside each cluster; some fade out mid-edge
 *   coordination   — bridges between clusters fade in; signals cross, split and merge
 *   intelligence   — hubs settle into an ordered ring and signals flow coherently
 *
 * then the clusters scatter to a new arrangement and the cycle repeats.
 *
 * Plain Canvas 2D: one draw pass per frame, glow from a pre-rendered sprite, no
 * per-frame allocations beyond a few gradients. The loop stops when the canvas is
 * off-screen or the tab is hidden, and renders a single static frame for users who
 * prefer reduced motion.
 */

export type NetworkPhase = 0 | 1 | 2;

interface Props {
  className?: string;
  /** Called when the visible state changes (0 fragmentation, 1 coordination, 2 intelligence). */
  onPhase?: (phase: NetworkPhase) => void;
}

const SYSTEMS = [
  "CRM",
  "Enrichment",
  "Sales engagement",
  "Marketing",
  "Conversation intel",
  "Customer success",
  "Data",
  "Revenue intel",
];

const CYCLE = 44; // seconds

// ── small utilities ─────────────────────────────────────────────────────────

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number, a: number, b: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

const makeGlowSprite = (size: number, rgb: string) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.16)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
};

// ── model ───────────────────────────────────────────────────────────────────

type EdgeKind = 0 | 1 | 2; // 0 intra-cluster, 1 bridge, 2 ring

interface Edge {
  a: number;
  b: number;
  kind: EdgeKind;
  delay: number; // stagger for fade-in so edges don't appear in unison
  alpha: number; // current, computed per frame
}

interface Signal {
  edge: number;
  forward: boolean; // a → b
  s: number; // 0..1 progress
  speed: number; // px per second
  hops: number;
  dieAt: number; // progress at which it fades out (>1 = never)
  fade: number; // 1 alive → 0 gone
}

interface Model {
  hubCount: number;
  nodeCount: number;
  cluster: Int16Array; // node → hub index
  // hub positions (normalised 0..1), smoothed toward a target
  hx: Float32Array;
  hy: Float32Array;
  scatterX: Float32Array;
  scatterY: Float32Array;
  ringX: Float32Array;
  ringY: Float32Array;
  // satellite offsets (unit-ish, scaled by cluster radius)
  ang: Float32Array;
  rad: Float32Array;
  spin: Float32Array;
  // rendered pixel positions + activation
  px: Float32Array;
  py: Float32Array;
  act: Float32Array;
  label: Float32Array; // per-hub label opacity
  edges: Edge[];
  adj: number[][];
  signals: Signal[];
}

const buildModel = (lite: boolean, rand: () => number): Model => {
  const hubCount = SYSTEMS.length;
  const satPer = lite ? 3 : 7;
  const nodeCount = hubCount + hubCount * satPer;
  const cluster = new Int16Array(nodeCount);
  const ang = new Float32Array(nodeCount);
  const rad = new Float32Array(nodeCount);
  const spin = new Float32Array(nodeCount);
  const edges: Edge[] = [];

  for (let h = 0; h < hubCount; h++) cluster[h] = h;
  let n = hubCount;
  for (let h = 0; h < hubCount; h++) {
    const first = n;
    for (let k = 0; k < satPer; k++, n++) {
      cluster[n] = h;
      ang[n] = rand() * Math.PI * 2;
      rad[n] = 0.35 + rand() * 0.65;
      spin[n] = (rand() - 0.5) * 0.06;
      edges.push({ a: h, b: n, kind: 0, delay: 0, alpha: 0 });
    }
    // a couple of satellite ↔ satellite links per cluster
    for (let k = 0; k < Math.max(1, satPer - 4); k++) {
      const a = first + Math.floor(rand() * satPer);
      const b = first + Math.floor(rand() * satPer);
      if (a !== b) edges.push({ a, b, kind: 0, delay: 0, alpha: 0 });
    }
  }

  // bridges between hubs (and occasionally hub ↔ foreign satellite)
  const bridgeCount = lite ? 7 : 13;
  const seen = new Set<string>();
  for (let i = 0; i < bridgeCount * 4 && seen.size < bridgeCount; i++) {
    const a = Math.floor(rand() * hubCount);
    let b = Math.floor(rand() * hubCount);
    if (a === b) continue;
    if (!lite && rand() < 0.3) b = hubCount + b * satPer + Math.floor(rand() * satPer);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a, b, kind: 1, delay: rand(), alpha: 0 });
  }

  // ring (directed clockwise by slot; slots are assigned per arrangement)
  for (let h = 0; h < hubCount; h++) edges.push({ a: h, b: (h + 1) % hubCount, kind: 2, delay: rand() * 0.5, alpha: 0 });

  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  edges.forEach((e, i) => {
    adj[e.a].push(i);
    adj[e.b].push(i);
  });

  const m: Model = {
    hubCount,
    nodeCount,
    cluster,
    hx: new Float32Array(hubCount),
    hy: new Float32Array(hubCount),
    scatterX: new Float32Array(hubCount),
    scatterY: new Float32Array(hubCount),
    ringX: new Float32Array(hubCount),
    ringY: new Float32Array(hubCount),
    ang,
    rad,
    spin,
    px: new Float32Array(nodeCount),
    py: new Float32Array(nodeCount),
    act: new Float32Array(nodeCount),
    label: new Float32Array(hubCount),
    edges,
    adj,
    signals: [],
  };
  return m;
};

/** New scattered arrangement + the ring slots that keep hubs from crossing when they order. */
const arrange = (m: Model, rand: () => number, aspect: number, initial: boolean) => {
  const H = m.hubCount;
  const minD = 0.2;
  for (let h = 0; h < H; h++) {
    let x = 0.5;
    let y = 0.5;
    for (let tries = 0; tries < 40; tries++) {
      // wide fields bias rightward, away from the headline the canvas sits beside
      x = aspect > 1.1 ? 0.22 + rand() * 0.7 : 0.1 + rand() * 0.8;
      y = 0.12 + rand() * 0.76;
      let ok = true;
      for (let j = 0; j < h; j++) {
        const dx = (x - m.scatterX[j]) * aspect;
        const dy = y - m.scatterY[j];
        if (dx * dx + dy * dy < minD * minD) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }
    m.scatterX[h] = x;
    m.scatterY[h] = y;
  }

  // ring slots by angle around the centre, so the ordering motion is short and calm
  const order = Array.from({ length: H }, (_, h) => h).sort(
    (a, b) =>
      Math.atan2(m.scatterY[a] - 0.5, (m.scatterX[a] - 0.5) * aspect) -
      Math.atan2(m.scatterY[b] - 0.5, (m.scatterX[b] - 0.5) * aspect),
  );
  // a near-circular ring in pixel space, slightly widened
  const rx = (aspect >= 1 ? 0.32 / aspect : 0.32) * 1.15;
  const ry = aspect >= 1 ? 0.32 : 0.32 * aspect;
  const offset = rand() * Math.PI * 2;
  const cx = aspect > 1.1 ? 0.58 : 0.5;
  order.forEach((h, slot) => {
    const a = offset + (slot / H) * Math.PI * 2;
    m.ringX[h] = cx + Math.cos(a) * rx;
    m.ringY[h] = 0.5 + Math.sin(a) * ry;
  });
  // re-point ring edges to follow the slot order
  const ringEdges = m.edges.filter((e) => e.kind === 2);
  ringEdges.forEach((e, i) => {
    e.a = order[i];
    e.b = order[(i + 1) % H];
  });
  m.adj.forEach((list) => (list.length = 0));
  m.edges.forEach((e, i) => {
    m.adj[e.a].push(i);
    m.adj[e.b].push(i);
  });
  // ring changes invalidate in-flight ring signals
  m.signals = m.signals.filter((s) => m.edges[s.edge].kind !== 2);

  if (initial) {
    m.hx.set(m.scatterX);
    m.hy.set(m.scatterY);
  }
};

// ── component ───────────────────────────────────────────────────────────────

const GTMNetworkCanvas = ({ className, onPhase }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = mqReduce.matches;
    const interactive = mqFine.matches && !reduced;
    // Small screens and touch devices get the lightweight network.
    const lite = window.innerWidth < 768 || !mqFine.matches;
    const dprCap = lite ? 1.5 : 2;
    const frameMin = lite ? 1 / 32 : 0; // ~30fps on lite

    const rand = mulberry32(0x5eed);
    const model = buildModel(lite, rand);
    const glowSoft = makeGlowSprite(64, "140,150,255");
    const glowWhite = makeGlowSprite(64, "225,230,255");

    let w = 0;
    let h = 0;
    let dpr = 1;
    let arranged = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!arranged) {
        arrange(model, rand, w / h, true);
        arranged = true;
      }
      if (reduced) draw(0, 0.75, 0.45, 0);
    };

    // pointer (desktop only)
    const pointer = { x: -9999, y: -9999, on: false };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.on = pointer.x > -40 && pointer.y > -40 && pointer.x < w + 40 && pointer.y < h + 40;
    };
    const onLeave = () => (pointer.on = false);

    // ── per-frame layout ────────────────────────────────────────────────────
    const layout = (dt: number, time: number, order: number) => {
      const H = model.hubCount;
      const k = 1 - Math.exp(-dt / 3.2); // slow spring
      const unit = Math.min(w, h);
      const clusterR = unit * (lite ? 0.15 : 0.13) * (1 - 0.25 * order);
      for (let i = 0; i < H; i++) {
        const tx = model.scatterX[i] + (model.ringX[i] - model.scatterX[i]) * order;
        const ty = model.scatterY[i] + (model.ringY[i] - model.scatterY[i]) * order;
        model.hx[i] += (tx - model.hx[i]) * k;
        model.hy[i] += (ty - model.hy[i]) * k;
        // gentle drift, damped as the system orders itself
        const drift = (1 - order * 0.7) * unit * 0.012;
        model.px[i] = model.hx[i] * w + Math.sin(time * 0.11 + i * 1.7) * drift;
        model.py[i] = model.hy[i] * h + Math.cos(time * 0.09 + i * 2.3) * drift;
      }
      for (let n = H; n < model.nodeCount; n++) {
        model.ang[n] += model.spin[n] * dt;
        const c = model.cluster[n];
        const r = clusterR * model.rad[n];
        model.px[n] = model.px[c] + Math.cos(model.ang[n]) * r;
        model.py[n] = model.py[c] + Math.sin(model.ang[n]) * r * 0.82;
      }
      if (pointer.on) {
        const R = 130;
        for (let n = 0; n < model.nodeCount; n++) {
          const dx = model.px[n] - pointer.x;
          const dy = model.py[n] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) ** 2;
            model.px[n] += (dx / d) * f * 14;
            model.py[n] += (dy / d) * f * 14;
            model.act[n] = Math.max(model.act[n], f * 0.5);
          }
        }
      }
    };

    // ── signals ─────────────────────────────────────────────────────────────
    const maxSignals = lite ? 14 : 42;
    const spawnRate = lite ? 1.6 : 3.8; // per second
    let spawnAcc = 0;

    const edgeWeight = (e: Edge, fromNode: number, bridge: number, order: number) => {
      if (e.alpha < 0.015) return 0;
      if (e.kind === 0) return 1 - 0.5 * bridge;
      if (e.kind === 1) return 1.6 * bridge;
      // ring: strongly prefer the clockwise direction
      return (e.a === fromNode ? 2.6 : 0.2) * order;
    };

    const launch = (node: number, cameFrom: number, hops: number, bridge: number, order: number) => {
      if (model.signals.length >= maxSignals) return;
      const list = model.adj[node];
      let total = 0;
      for (const ei of list) if (ei !== cameFrom) total += edgeWeight(model.edges[ei], node, bridge, order);
      if (total <= 0) return;
      let r = rand() * total;
      for (const ei of list) {
        if (ei === cameFrom) continue;
        r -= edgeWeight(model.edges[ei], node, bridge, order);
        if (r <= 0) {
          const e = model.edges[ei];
          const vanish = rand() < 0.22 * (1 - bridge) && e.kind === 0;
          model.signals.push({
            edge: ei,
            forward: e.a === node,
            s: 0,
            speed: (lite ? 46 : 58) + rand() * 40 + order * 20,
            hops,
            dieAt: vanish ? 0.35 + rand() * 0.45 : 2,
            fade: 1,
          });
          return;
        }
      }
    };

    const stepSignals = (dt: number, bridge: number, order: number) => {
      spawnAcc += dt * spawnRate;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const fromHub = rand() < 0.25 + 0.5 * bridge;
        const node = fromHub
          ? Math.floor(rand() * model.hubCount)
          : model.hubCount + Math.floor(rand() * (model.nodeCount - model.hubCount));
        launch(node, -1, 2 + Math.floor(rand() * 4), bridge, order);
      }

      const sigs = model.signals;
      for (let i = sigs.length - 1; i >= 0; i--) {
        const sg = sigs[i];
        const e = model.edges[sg.edge];
        const a = sg.forward ? e.a : e.b;
        const b = sg.forward ? e.b : e.a;
        const dx = model.px[b] - model.px[a];
        const dy = model.py[b] - model.py[a];
        const len = Math.max(8, Math.hypot(dx, dy));
        sg.s += (sg.speed * dt) / len;
        if (sg.s >= sg.dieAt || e.alpha < 0.01) sg.fade -= dt * 2.5;
        if (sg.fade <= 0) {
          sigs.splice(i, 1);
          continue;
        }
        if (sg.s >= 1) {
          model.act[b] = Math.min(1, model.act[b] + (b < model.hubCount ? 0.7 : 0.5));
          sigs.splice(i, 1);
          if (sg.hops > 0) {
            launch(b, sg.edge, sg.hops - 1, bridge, order);
            // branching at hubs once systems start talking to each other
            if (b < model.hubCount && rand() < 0.28 * bridge) launch(b, sg.edge, sg.hops - 1, bridge, order);
          }
        }
      }
    };

    // ── draw ────────────────────────────────────────────────────────────────
    const draw = (dt: number, bridge: number, order: number, time: number) => {
      ctx.clearRect(0, 0, w, h);
      if (dt === 0 && time === 0) layout(10, 0, order); // static frame: settle positions

      // edges
      ctx.lineWidth = 1;
      for (const e of model.edges) {
        let a: number;
        if (e.kind === 0) a = 0.13 - 0.03 * order;
        else if (e.kind === 1) a = clamp01((bridge - e.delay * 0.45) / 0.55) * 0.15 * (1 - 0.35 * order);
        else a = clamp01((order - e.delay * 0.4) / 0.6) * 0.2;
        // occasional breathing so the network never looks frozen
        if (e.kind !== 0) a *= 0.8 + 0.2 * Math.sin(time * 0.4 + e.delay * 12);
        e.alpha = a;
        if (a < 0.006) continue;
        ctx.strokeStyle = e.kind === 2 ? `rgba(200,206,255,${a})` : `rgba(150,160,230,${a})`;
        ctx.beginPath();
        ctx.moveTo(model.px[e.a], model.py[e.a]);
        ctx.lineTo(model.px[e.b], model.py[e.b]);
        ctx.stroke();
      }

      // nodes
      ctx.globalCompositeOperation = "lighter";
      for (let n = 0; n < model.nodeCount; n++) {
        const isHub = n < model.hubCount;
        const act = model.act[n];
        if (act > 0.02) {
          const s = (isHub ? 46 : 28) * (0.6 + act * 0.6);
          ctx.globalAlpha = act * (isHub ? 0.9 : 0.6);
          ctx.drawImage(isHub ? glowWhite : glowSoft, model.px[n] - s / 2, model.py[n] - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        const r = isHub ? 2.4 + act * 1.2 : 1.1 + act * 0.6;
        const base = isHub ? 0.8 : 0.4;
        ctx.fillStyle = `rgba(222,228,255,${Math.min(1, base + act * 0.5)})`;
        ctx.beginPath();
        ctx.arc(model.px[n], model.py[n], r, 0, Math.PI * 2);
        ctx.fill();
        if (isHub) {
          ctx.strokeStyle = `rgba(190,198,255,${0.14 + act * 0.25})`;
          ctx.beginPath();
          ctx.arc(model.px[n], model.py[n], 7 + act * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // signals
      for (const sg of model.signals) {
        const e = model.edges[sg.edge];
        const a = sg.forward ? e.a : e.b;
        const b = sg.forward ? e.b : e.a;
        const ax = model.px[a];
        const ay = model.py[a];
        const dx = model.px[b] - ax;
        const dy = model.py[b] - ay;
        const len = Math.max(8, Math.hypot(dx, dy));
        const s = Math.min(1, sg.s);
        const tail = Math.max(0, s - 30 / len);
        const hx = ax + dx * s;
        const hy = ay + dy * s;
        const tx = ax + dx * tail;
        const ty = ay + dy * tail;
        const alpha = sg.fade * (e.kind === 0 ? 0.65 : 0.9);
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, "rgba(160,170,255,0)");
        grad.addColorStop(1, `rgba(215,222,255,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.drawImage(glowSoft, hx - 9, hy - 9, 18, 18);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = "source-over";

      // labels: faint once the system is ordered, clearer on hover
      ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";
      let hover = -1;
      if (pointer.on) {
        let best = 44 * 44;
        for (let i = 0; i < model.hubCount; i++) {
          const dx = model.px[i] - pointer.x;
          const dy = model.py[i] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) {
            best = d2;
            hover = i;
          }
        }
      }
      for (let i = 0; i < model.hubCount; i++) {
        const target = i === hover ? 0.85 : reduced ? 0.22 : 0.16 * order;
        model.label[i] += (target - model.label[i]) * (dt === 0 ? 1 : 1 - Math.exp(-dt / 0.25));
        const la = model.label[i];
        if (la < 0.02) continue;
        ctx.fillStyle = `rgba(214,220,255,${la})`;
        const text = SYSTEMS[i].toUpperCase();
        const right = model.px[i] > w * 0.82;
        ctx.textAlign = right ? "right" : "left";
        ctx.fillText(text, model.px[i] + (right ? -14 : 14), model.py[i]);
      }
    };

    // ── loop ────────────────────────────────────────────────────────────────
    let raf = 0;
    let last = 0;
    let time = 0;
    let lastPhase: NetworkPhase | -1 = -1;
    let visible = true;
    let running = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now - 16;
      const dtRaw = (now - last) / 1000;
      if (dtRaw < frameMin) return;
      last = now;
      const dt = Math.min(dtRaw, 0.05);
      time += dt;

      const prevCycle = Math.floor((time - dt) / CYCLE);
      const cycle = Math.floor(time / CYCLE);
      if (cycle !== prevCycle) arrange(model, rand, w / h, false); // reorganise
      const t = time % CYCLE;
      const bridge = smooth(t, 9, 16) * (1 - smooth(t, 38, 44));
      const order = smooth(t, 22, 30) * (1 - smooth(t, 37, 43));
      const phase: NetworkPhase = order > 0.5 ? 2 : bridge > 0.5 ? 1 : 0;
      if (phase !== lastPhase) {
        lastPhase = phase;
        onPhaseRef.current?.(phase);
      }

      for (let n = 0; n < model.nodeCount; n++) model.act[n] *= Math.exp(-dt / 0.9);
      layout(dt, time, order);
      stepSignals(dt, bridge, order);
      draw(dt, bridge, order, time);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
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

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    if (interactive) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }

    if (reduced) onPhaseRef.current?.(1);
    else start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default GTMNetworkCanvas;
