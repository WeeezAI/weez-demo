import { useEffect, useRef } from "react";

/**
 * AsciiForest — a self-contained, animated ASCII-art background rendered with
 * Canvas2D, inspired by the "Forest" effect from 21st.dev/community/ascii.
 *
 * It reimplements the recipe (no external image needed — the luminance field is
 * generated procedurally so there are no CORS/asset dependencies):
 *   • a grid of `cellSize` cells, each sampled for luminance
 *   • renderMode "characters": a glyph from a ramp, sized/shaded by luminance
 *   • grayscale + contrast colour adjustment
 *   • "shimmer" animation over time
 *   • post-fx: chromatic aberration, halftone, film dust
 *   • a tilt-shift style focus band (brightest through the middle)
 *
 * Performance: renders in device pixels (DPR capped), throttled to ~30fps,
 * pauses when off-screen or the tab is hidden, and honours reduced-motion.
 */

// Dark → light luminance ramp (the classic ASCII gradient).
const CHAR_RAMP = " .:-=+*#%@";

interface AsciiForestProps {
  className?: string;
  /** CSS px size of each cell. Larger = fewer glyphs (faster), coarser look. */
  cellSize?: number;
  /** Contrast boost applied to the luminance field (recipe: 128 ≈ ~1.6x). */
  contrast?: number;
  /** Chromatic aberration strength (0 disables). Recipe intensity ~20. */
  chromatic?: number;
  /** Glyph colour (grayscale look uses a cool off-white). */
  color?: string;
}

const AsciiForest = ({
  className = "",
  cellSize = 12,
  contrast = 1.6,
  chromatic = 20,
  color = "#dce4f0",
}: AsciiForestProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen buffers: the glyph layer + a reusable tint buffer for the
    // per-channel chromatic-aberration compositing.
    const ascii = document.createElement("canvas");
    const actx = ascii.getContext("2d")!;
    const tint = document.createElement("canvas");
    const tctx = tint.getContext("2d")!;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.35);

    let W = 0, H = 0;                 // device-pixel backing size
    let cell = 0;                     // device-pixel cell size
    let cols = 0, rows = 0;
    let halftonePattern: CanvasPattern | null = null;
    let running = true;
    let raf = 0;
    let last = 0;
    const startedAt = performance.now();

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      // Slightly larger cells on small screens keep the glyph count sane.
      const cs = cssW < 640 ? Math.max(10, cellSize - 2) : cellSize;

      W = Math.floor(cssW * dpr);
      H = Math.floor(cssH * dpr);
      cell = Math.max(6, Math.floor(cs * dpr));
      cols = Math.ceil(W / cell);
      rows = Math.ceil(H / cell);

      for (const c of [canvas, ascii, tint]) {
        c.width = W;
        c.height = H;
      }
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

      const font = `${cell}px "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace`;
      actx.font = font;
      actx.textAlign = "center";
      actx.textBaseline = "middle";

      halftonePattern = buildHalftone(cell);
    };

    // A cached dot tile for the subtle halftone post-effect.
    const buildHalftone = (size: number): CanvasPattern | null => {
      const tile = document.createElement("canvas");
      const step = Math.max(3, Math.floor(size * 0.5));
      tile.width = step;
      tile.height = step;
      const g = tile.getContext("2d");
      if (!g) return null;
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.beginPath();
      g.arc(step / 2, step / 2, Math.max(0.6, step * 0.14), 0, Math.PI * 2);
      g.fill();
      return ctx.createPattern(tile, "repeat");
    };

    // Procedural "forest" luminance field with a soft drifting focal subject.
    const luminance = (nx: number, ny: number, t: number): number => {
      let v = 0.5;
      v += 0.30 * Math.sin(nx * 6.0 + t * 0.25) * Math.cos(ny * 5.0 - t * 0.2);
      v += 0.20 * Math.sin((nx + ny) * 9.0 - t * 0.35);
      v += 0.15 * Math.sin(nx * 15.0 + t * 0.5) * Math.sin(ny * 13.0 + t * 0.4);
      v += 0.10 * Math.sin(nx * 26.0 - t * 0.6) * Math.cos(ny * 22.0 + t * 0.45);

      // Focal subject — a soft blob that slowly drifts, giving a "clear subject".
      const dx = nx - 0.5 - 0.12 * Math.sin(t * 0.15);
      const dy = ny - 0.5 - 0.08 * Math.cos(t * 0.12);
      const subject = Math.exp(-(dx * dx + dy * dy) * 5.5);
      v = v * 0.62 + subject * 0.7;

      // Contrast around mid-grey.
      v = (v - 0.5) * contrast + 0.5;
      return v < 0 ? 0 : v > 1 ? 1 : v;
    };

    // Tilt-shift focus: brightest through the middle band, fading top/bottom.
    const focus = (ny: number): number => {
      const d = Math.abs(ny - 0.5) / 0.5;      // 0 centre → 1 edge
      const f = 1 - Math.pow(d, 1.7) * 0.85;
      return f < 0.12 ? 0.12 : f;
    };

    const colorize = (src: HTMLCanvasElement, css: string) => {
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = 1;
      tctx.clearRect(0, 0, W, H);
      tctx.drawImage(src, 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = css;
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = "source-over";
    };

    const draw = (now: number) => {
      const t = reduceMotion ? 0 : (now - startedAt) / 1000;
      const rampMax = CHAR_RAMP.length - 1;

      // 1) Build the glyph layer (white glyphs, alpha = luminance).
      actx.clearRect(0, 0, W, H);
      actx.fillStyle = "#ffffff";
      for (let gy = 0; gy < rows; gy++) {
        const ny = (gy + 0.5) / rows;
        const ff = focus(ny);
        const py = gy * cell + cell / 2;
        for (let gx = 0; gx < cols; gx++) {
          const nx = (gx + 0.5) / cols;
          let v = luminance(nx, ny, t);
          // "shimmer": a travelling twinkle across the grid.
          if (!reduceMotion) {
            v *= 0.82 + 0.18 * Math.sin(t * 3 + (nx + ny) * 22);
          }
          v *= ff;
          if (v <= 0.06) continue; // skip near-black cells (perf + darkness)
          const idx = Math.min(rampMax, Math.max(0, Math.round(v * rampMax)));
          const ch = CHAR_RAMP[idx];
          if (ch === " ") continue;
          actx.globalAlpha = 0.25 + 0.75 * v;
          actx.fillText(ch, gx * cell + cell / 2, py);
        }
      }
      actx.globalAlpha = 1;

      // 2) Background wash (near-black with a faint brand-blue glow).
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, Math.max(W, H) * 0.6);
      glow.addColorStop(0, "rgba(60,166,255,0.14)");
      glow.addColorStop(1, "rgba(60,166,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // 3) Composite the glyph layer. With chromatic aberration we split it into
      //    R/G/B channels offset horizontally so the core reads white with cyan
      //    / red fringes; otherwise draw the tinted glyphs directly.
      if (chromatic > 0) {
        const off = Math.max(1, (chromatic / 20) * 1.6 * dpr);
        ctx.globalCompositeOperation = "lighter";
        colorize(ascii, "#ff2d2d");
        ctx.drawImage(tint, -off, 0);
        colorize(ascii, "#22ff6a");
        ctx.drawImage(tint, 0, 0);
        colorize(ascii, "#2d7bff");
        ctx.drawImage(tint, off, 0);
        ctx.globalCompositeOperation = "source-over";
      } else {
        colorize(ascii, color);
        ctx.drawImage(tint, 0, 0);
      }

      // 4) Halftone — a faint dot screen over the whole frame.
      if (halftonePattern) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = halftonePattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // 5) Film dust — a few transient specks / a rare scratch each frame.
      if (!reduceMotion) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 7; i++) {
          const x = Math.random() * W;
          const y = Math.random() * H;
          const r = Math.random() * 1.2 * dpr;
          ctx.globalAlpha = 0.06 + Math.random() * 0.10;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (Math.random() < 0.12) {
          const x = Math.random() * W;
          ctx.globalAlpha = 0.05;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(x, Math.random() * H * 0.4);
          ctx.lineTo(x + (Math.random() - 0.5) * 8 * dpr, Math.random() * H * 0.4 + H * 0.3);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      // Throttle to ~30fps — plenty for this look, half the glyph cost.
      if (now - last >= 33) {
        last = now;
        draw(now);
        if (reduceMotion) return; // one static frame is enough
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(performance.now());
    if (!reduceMotion) raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(parent);

    // Pause when the hero scrolls out of view.
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        if (visible && !running && !reduceMotion) {
          running = true;
          raf = requestAnimationFrame(loop);
        } else if (!visible) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduceMotion) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cellSize, contrast, chromatic, color]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default AsciiForest;
