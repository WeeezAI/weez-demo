import { useEffect, useRef } from "react";

/**
 * AsciiForest — the "Forest" effect from 21st.dev/community/ascii, reimplemented
 * with Canvas2D following the recipe in order:
 *
 *   1. source photo → a colour forest/mountain scene (procedural, so there are
 *      no CORS/asset deps — it stands in for "any photo with a clear subject").
 *   2. bgMode "blur": a blurred copy of the photo shows behind at ~bgOpacity.
 *   3. grid of cellSize cells; average luminance sampled per cell.
 *   4. renderMode "characters": a glyph from the ramp, inked by DARKNESS — bright
 *      cells (sky) stay clean, dark cells (mountains/forest) screen dark. So the
 *      colour comes from the photo behind and the grayscale glyphs form the mesh.
 *   5. colour adjustments: contrast (128) + grayscale (100 → neutral ink).
 *   6. post-fx: chromatic (20), halftone (20), filmDust (20).
 *   7. blurType "tilt": a central focus band; the screen eases off top/bottom.
 *   8. animated "shimmer".
 *
 * Perf: the photo + luminance are computed at cols×rows; ~30fps; pauses when
 * off-screen / hidden; honours reduced motion.
 */

interface AsciiForestProps {
  className?: string;
  cellSize?: number;
}

// "standard" ramp — index 0 = brightest (space), last = darkest (dense ink).
const RAMP = " .,:;irsXA253hMHGS#9B&@";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const tri = (nx: number, c: number, w: number) => {
  const d = Math.abs(nx - c) / w;
  return d < 1 ? 1 - d : 0;
};

// Tall pine silhouettes (near-black) rising above the treeline, incl. the
// central spire + right-edge pines from the reference photo.
const TREES = [
  { cx: 0.6, top: 0.29, w: 0.012, taper: 0.05 },
  { cx: 0.94, top: 0.2, w: 0.01, taper: 0.05 },
  { cx: 0.9, top: 0.34, w: 0.014, taper: 0.055 },
  { cx: 0.05, top: 0.44, w: 0.022, taper: 0.06 },
  { cx: 0.48, top: 0.46, w: 0.014, taper: 0.05 },
];

const AsciiForest = ({ className = "", cellSize = 11 }: AsciiForestProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen buffers.
    const photo = document.createElement("canvas");   // low-res colour scene
    const pctx = photo.getContext("2d")!;
    const ascii = document.createElement("canvas");    // white glyph mask (full res)
    const actx = ascii.getContext("2d")!;
    const tmp = document.createElement("canvas");       // reusable tint/mask buffer
    const tctx = tmp.getContext("2d")!;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1);

    let W = 0, H = 0, cell = 0, cols = 0, rows = 0;
    let img: ImageData | null = null;
    let lumBuf = new Float32Array(0);
    let mtnTop = new Float32Array(0);
    let forestTop = new Float32Array(0);
    let dots: CanvasPattern | null = null;

    let running = true;
    let raf = 0;
    let last = 0;
    const startedAt = performance.now();

    // Fine halftone dot tile.
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
      const cs = cssW < 640 ? Math.max(8, cellSize - 2) : cellSize;

      W = Math.floor(cssW * dpr);
      H = Math.floor(cssH * dpr);
      cell = Math.max(6, Math.floor(cs * dpr));
      cols = Math.ceil(W / cell);
      rows = Math.ceil(H / cell);

      for (const c of [canvas, ascii, tmp]) {
        c.width = W;
        c.height = H;
      }
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      photo.width = cols;
      photo.height = rows;

      img = pctx.createImageData(cols, rows);
      lumBuf = new Float32Array(cols * rows);

      actx.font = `${cell}px "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace`;
      actx.textAlign = "center";
      actx.textBaseline = "middle";

      // Static mountain ridge + treeline per column.
      mtnTop = new Float32Array(cols);
      forestTop = new Float32Array(cols);
      for (let gx = 0; gx < cols; gx++) {
        const nx = (gx + 0.5) / cols;
        let m = 0.44;
        m -= 0.27 * tri(nx, 0.22, 0.11);
        m -= 0.21 * tri(nx, 0.58, 0.13);
        m -= 0.12 * tri(nx, 0.78, 0.09);
        m -= 0.07 * tri(nx, 0.4, 0.07);
        m -= 0.05 * tri(nx, 0.9, 0.06);
        m += 0.015 * Math.sin(nx * 47) + 0.01 * Math.sin(nx * 23 + 1);
        mtnTop[gx] = m;
        const f = 0.52 + 0.03 * Math.sin(nx * 18 + 0.7) + 0.02 * Math.sin(nx * 41);
        forestTop[gx] = Math.max(f, m + 0.05);
      }

      dots = buildDots(cell);
    };

    // Mask helper: a full-canvas fill of `color` shaped by the white glyph mask.
    const maskFill = (color: string) => {
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = 1;
      tctx.clearRect(0, 0, W, H);
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(ascii, 0, 0);
      tctx.globalCompositeOperation = "source-over";
    };

    // Tilt focus: central band fully screened, easing off toward top/bottom.
    const focus = (ny: number) => {
      const d = Math.abs(ny - 0.5) / 0.5;
      return 0.6 + 0.4 * (1 - d * d); // 1.0 centre → 0.6 edges
    };

    const draw = (now: number) => {
      if (!img) return;
      const t = reduceMotion ? 0 : (now - startedAt) / 1000;
      const data = img.data;

      // ── 1) Paint the colour scene (the "photo") + record luminance per cell ──
      for (let gy = 0; gy < rows; gy++) {
        const ny = (gy + 0.5) / rows;
        for (let gx = 0; gx < cols; gx++) {
          const nx = (gx + 0.5) / cols;
          const mt = mtnTop[gx];
          const ft = forestTop[gx];
          let r: number, g: number, b: number;

          if (ny < mt) {
            const f = ny / (mt <= 0 ? 1e-3 : mt);
            r = 210 - 14 * f; g = 224 - 14 * f; b = 234 - 12 * f;
          } else if (ny < ft) {
            const span = ft - mt || 1e-3;
            const h = (ny - mt) / span;
            let mr = 70, mg = 82, mb = 99;
            const warm = clamp01((0.46 - nx) * 1.8) * clamp01(1 - h * 1.25) * 0.8;
            mr += (156 - mr) * warm; mg += (126 - mg) * warm; mb += (96 - mb) * warm;
            const dk = clamp01(h * 0.9) * 0.6;
            mr += (40 - mr) * dk; mg += (48 - mg) * dk; mb += (60 - mb) * dk;
            const s = 0.92 + 0.08 * Math.sin(nx * 140 + ny * 40);
            r = mr * s; g = mg * s; b = mb * s;
          } else {
            const d = clamp01((ny - ft) / (1 - ft || 1e-3));
            let fr = 40 + (6 - 40) * d, fg = 50 + (9 - 50) * d, fb = 38 + (7 - 38) * d;
            const n = 0.5 + 0.5 * Math.sin(nx * 33 + Math.sin(ny * 17 + t * 0.05) * 2) * Math.cos(ny * 29 + nx * 11);
            const warmMask = clamp01(n - 0.4) * clamp01(1 - Math.abs(d - 0.32) / 0.34) * 0.85;
            fr += (156 - fr) * warmMask; fg += (122 - fg) * warmMask; fb += (46 - fb) * warmMask;
            const bl = clamp01(1 - Math.hypot((nx - 0.33) / 0.06, (d - 0.74) / 0.07)) * 0.6
              + clamp01(1 - Math.hypot((nx - 0.42) / 0.04, (d - 0.78) / 0.05)) * 0.5;
            fr += (60 - fr) * bl; fg += (110 - fg) * bl; fb += (150 - fb) * bl;
            r = fr; g = fg; b = fb;
          }

          for (let i = 0; i < TREES.length; i++) {
            const T = TREES[i];
            if (ny > T.top && Math.abs(nx - T.cx) < T.w + T.taper * (ny - T.top)) {
              r = 11; g = 15; b = 11;
              break;
            }
          }

          const idx = (gy * cols + gx) * 4;
          data[idx] = clamp255(r); data[idx + 1] = clamp255(g); data[idx + 2] = clamp255(b); data[idx + 3] = 255;

          // Luminance → contrast → shimmer.
          let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          lum = clamp01((lum - 0.5) * 1.5 + 0.5); // contrast
          if (!reduceMotion) lum *= 0.94 + 0.06 * Math.sin(t * 1.6 + nx * 24 + ny * 16); // shimmer
          lumBuf[gy * cols + gx] = clamp01(lum);
        }
      }
      pctx.putImageData(img, 0, 0);

      // ── 2) Background: the blurred colour photo (bgMode "blur", ~90%) ──
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.filter = `blur(${Math.max(1, 2 * dpr)}px)`;
      ctx.drawImage(photo, 0, 0, cols, rows, 0, 0, W, H);
      ctx.filter = "none";
      // slight dim (the ~10% not shown) for glyph/text contrast
      ctx.fillStyle = "rgba(6,9,14,0.12)";
      ctx.fillRect(0, 0, W, H);

      // ── 3) Characters layer: dark glyphs inked by darkness (white mask first) ──
      const rampMax = RAMP.length - 1;
      actx.clearRect(0, 0, W, H);
      actx.fillStyle = "#ffffff";
      for (let gy = 0; gy < rows; gy++) {
        const ny = (gy + 0.5) / rows;
        const ff = focus(ny);
        const cy = gy * cell + cell / 2;
        for (let gx = 0; gx < cols; gx++) {
          const dk = 1 - lumBuf[gy * cols + gx]; // darkness
          if (dk < 0.16) continue;               // bright cells (sky) stay clean
          const ch = RAMP[Math.min(rampMax, Math.round(dk * rampMax))];
          if (ch === " ") continue;
          actx.globalAlpha = clamp01((0.4 + 0.6 * dk) * ff);
          actx.fillText(ch, gx * cell + cell / 2, cy);
        }
      }
      actx.globalAlpha = 1;

      // Dark ink mesh from the mask.
      maskFill("rgba(5,7,11,0.95)");
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tmp, 0, 0);

      // ── 4) Chromatic aberration — faint R/B fringes on the mesh edges ──
      const off = Math.max(1, 1.4 * dpr);
      ctx.globalCompositeOperation = "multiply";
      maskFill("rgba(255,90,90,0.5)");
      ctx.globalAlpha = 0.5;
      ctx.drawImage(tmp, -off, 0);
      maskFill("rgba(90,120,255,0.5)");
      ctx.drawImage(tmp, off, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // ── 5) Halftone screen ──
      if (dots) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = dots;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // ── 6) Film dust — a few transient specks / a rare scratch ──
      if (!reduceMotion) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 6; i++) {
          ctx.globalAlpha = 0.05 + Math.random() * 0.08;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.1 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
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
