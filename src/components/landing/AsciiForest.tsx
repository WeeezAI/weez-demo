import { useEffect, useRef } from "react";

/**
 * AsciiForest — the "Forest" mosaic effect from 21st.dev/community/ascii,
 * reimplemented with Canvas2D.
 *
 * Matches the reference look: a mountain-and-forest landscape rendered as a
 * blocky COLOUR mosaic grid — a pale sky, grey-blue peaks with warm side-light,
 * dark pine silhouettes, autumn foliage and a couple of blue accents, all
 * screened behind a fine mesh + halftone texture.
 *
 * No source photo is needed (avoids CORS/asset deps): the scene is generated
 * procedurally into a low-res colour field, then upscaled with nearest-neighbour
 * so each cell reads as a solid square, with the mesh/halftone drawn on top.
 *
 * Perf: the colour field is only cols×rows, upscaled in one drawImage; throttled
 * to ~30fps; pauses off-screen / when hidden; honours reduced motion.
 */

interface AsciiForestProps {
  className?: string;
  /** CSS px size of each mosaic cell. */
  cellSize?: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const tri = (nx: number, c: number, w: number) => {
  const d = Math.abs(nx - c) / w;
  return d < 1 ? 1 - d : 0;
};

// Tall pine silhouettes that rise above the treeline (near-black), including the
// prominent central spire and the pines on the right edge from the reference.
const TREES = [
  { cx: 0.6, top: 0.29, w: 0.012, taper: 0.05 },
  { cx: 0.94, top: 0.2, w: 0.01, taper: 0.05 },
  { cx: 0.9, top: 0.34, w: 0.014, taper: 0.055 },
  { cx: 0.05, top: 0.44, w: 0.022, taper: 0.06 },
  { cx: 0.48, top: 0.46, w: 0.014, taper: 0.05 },
];

const AsciiForest = ({ className = "", cellSize = 10 }: AsciiForestProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen low-res colour field (one pixel per mosaic cell).
    const field = document.createElement("canvas");
    const fctx = field.getContext("2d")!;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    let W = 0, H = 0, cell = 0, cols = 0, rows = 0;
    let img: ImageData | null = null;
    let mtnTop = new Float32Array(0);
    let forestTop = new Float32Array(0);
    let grid: CanvasPattern | null = null;
    let dots: CanvasPattern | null = null;

    let running = true;
    let raf = 0;
    let last = 0;
    const startedAt = performance.now();

    // Mesh grid tile — a thin dark line on the right/bottom of each cell.
    const buildGrid = (size: number): CanvasPattern | null => {
      const tile = document.createElement("canvas");
      tile.width = size;
      tile.height = size;
      const g = tile.getContext("2d");
      if (!g) return null;
      const lw = Math.max(1, Math.floor(dpr));
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(size - lw, 0, lw, size);
      g.fillRect(0, size - lw, size, lw);
      return ctx.createPattern(tile, "repeat");
    };

    // Fine halftone dot tile for the woven texture over the mosaic.
    const buildDots = (cellPx: number): CanvasPattern | null => {
      const step = Math.max(3, Math.floor(cellPx * 0.5));
      const tile = document.createElement("canvas");
      tile.width = step;
      tile.height = step;
      const g = tile.getContext("2d");
      if (!g) return null;
      g.fillStyle = "rgba(0,0,0,0.9)";
      g.beginPath();
      g.arc(step / 2, step / 2, Math.max(0.6, step * 0.16), 0, Math.PI * 2);
      g.fill();
      return ctx.createPattern(tile, "repeat");
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      const cs = cssW < 640 ? Math.max(7, cellSize - 2) : cellSize;

      W = Math.floor(cssW * dpr);
      H = Math.floor(cssH * dpr);
      cell = Math.max(5, Math.floor(cs * dpr));
      cols = Math.ceil(W / cell);
      rows = Math.ceil(H / cell);

      canvas.width = W;
      canvas.height = H;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      field.width = cols;
      field.height = rows;

      img = fctx.createImageData(cols, rows);

      // Precompute the mountain ridge + treeline per column (static silhouette).
      mtnTop = new Float32Array(cols);
      forestTop = new Float32Array(cols);
      for (let gx = 0; gx < cols; gx++) {
        const nx = (gx + 0.5) / cols;
        let m = 0.44;
        m -= 0.27 * tri(nx, 0.22, 0.11); // tall left peak
        m -= 0.21 * tri(nx, 0.58, 0.13); // right peak
        m -= 0.12 * tri(nx, 0.78, 0.09);
        m -= 0.07 * tri(nx, 0.4, 0.07);
        m -= 0.05 * tri(nx, 0.9, 0.06);
        m += 0.015 * Math.sin(nx * 47) + 0.01 * Math.sin(nx * 23 + 1);
        mtnTop[gx] = m;
        const f = 0.52 + 0.03 * Math.sin(nx * 18 + 0.7) + 0.02 * Math.sin(nx * 41);
        forestTop[gx] = Math.max(f, m + 0.05);
      }

      grid = buildGrid(cell);
      dots = buildDots(cell);
    };

    const draw = (now: number) => {
      if (!img) return;
      const t = reduceMotion ? 0 : (now - startedAt) / 1000;
      const data = img.data;

      for (let gy = 0; gy < rows; gy++) {
        const ny = (gy + 0.5) / rows;
        for (let gx = 0; gx < cols; gx++) {
          const nx = (gx + 0.5) / cols;
          const mt = mtnTop[gx];
          const ft = forestTop[gx];
          let r: number, g: number, b: number;

          if (ny < mt) {
            // Sky — pale blue, a touch deeper toward the ridge.
            const f = ny / (mt <= 0 ? 1e-3 : mt);
            r = 210 - 14 * f;
            g = 224 - 14 * f;
            b = 234 - 12 * f;
          } else if (ny < ft) {
            // Mountain — cool grey-blue with warm side-light on the left/upper.
            const span = ft - mt || 1e-3;
            const h = (ny - mt) / span;
            let mr = 70, mg = 82, mb = 99;
            const warm = clamp01((0.46 - nx) * 1.8) * clamp01(1 - h * 1.25) * 0.8;
            mr += (156 - mr) * warm;
            mg += (126 - mg) * warm;
            mb += (96 - mb) * warm;
            const dk = clamp01(h * 0.9) * 0.6;
            mr += (40 - mr) * dk;
            mg += (48 - mg) * dk;
            mb += (60 - mb) * dk;
            const s = 0.92 + 0.08 * Math.sin(nx * 140 + ny * 40);
            r = mr * s;
            g = mg * s;
            b = mb * s;
          } else {
            // Forest — dark base, autumn foliage, a couple of blue accents.
            const d = clamp01((ny - ft) / (1 - ft || 1e-3));
            let fr = 40 + (6 - 40) * d;
            let fg = 50 + (9 - 50) * d;
            let fb = 38 + (7 - 38) * d;
            const n =
              0.5 +
              0.5 *
                Math.sin(nx * 33 + Math.sin(ny * 17 + t * 0.05) * 2) *
                Math.cos(ny * 29 + nx * 11);
            const warmMask = clamp01(n - 0.4) * clamp01(1 - Math.abs(d - 0.32) / 0.34) * 0.85;
            fr += (156 - fr) * warmMask;
            fg += (122 - fg) * warmMask;
            fb += (46 - fb) * warmMask;
            const bl =
              clamp01(1 - Math.hypot((nx - 0.33) / 0.06, (d - 0.74) / 0.07)) * 0.6 +
              clamp01(1 - Math.hypot((nx - 0.42) / 0.04, (d - 0.78) / 0.05)) * 0.5;
            fr += (60 - fr) * bl;
            fg += (110 - fg) * bl;
            fb += (150 - fb) * bl;
            r = fr;
            g = fg;
            b = fb;
          }

          // Tall pine silhouettes (near-black) rising above the treeline.
          for (let i = 0; i < TREES.length; i++) {
            const T = TREES[i];
            if (ny > T.top && Math.abs(nx - T.cx) < T.w + T.taper * (ny - T.top)) {
              r = 11;
              g = 15;
              b = 11;
              break;
            }
          }

          // Gentle shimmer so the mosaic quietly breathes (photo-like).
          if (!reduceMotion) {
            const sh = 1 + 0.045 * Math.sin(t * 1.4 + nx * 26 + ny * 18);
            r *= sh;
            g *= sh;
            b *= sh;
          }

          const idx = (gy * cols + gx) * 4;
          data[idx] = clamp255(r);
          data[idx + 1] = clamp255(g);
          data[idx + 2] = clamp255(b);
          data[idx + 3] = 255;
        }
      }

      fctx.putImageData(img, 0, 0);

      // Upscale the colour field into crisp mosaic squares.
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(field, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell);

      // Mesh grid + halftone texture over the mosaic.
      if (grid) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = grid;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (dots) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = dots;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      if (now - last >= 33) {
        last = now;
        draw(now);
        if (reduceMotion) return;
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

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running && !reduceMotion) {
          running = true;
          raf = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting) {
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
  }, [cellSize]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default AsciiForest;
