import { useEffect, useRef } from "react";

/**
 * AsciiForest — the "Forest" halftone effect from 21st.dev/community/ascii,
 * reimplemented with Canvas2D.
 *
 * Matches the reference: a smooth, softly-blurred COLOUR mountain/forest photo
 * with a regular HALFTONE dot screen over it — each grid cell gets a dark dot
 * whose size/opacity grows with the cell's darkness, so the pale sky shows a
 * fine faint grid of small dots while the dark forest reads as a dense near-solid
 * mesh. Faint chromatic fringing on the dots + a subtle animated shimmer.
 *
 * The photo + dot plate are STATIC, so they're rendered once (on mount/resize);
 * only the shimmer + film-dust animate → smooth and cheap. Procedural scene, so
 * there are no CORS/asset dependencies.
 */

interface AsciiForestProps {
  className?: string;
  /** CSS px spacing of the halftone grid. */
  cellSize?: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const tri = (nx: number, c: number, w: number) => {
  const d = Math.abs(nx - c) / w;
  return d < 1 ? 1 - d : 0;
};

// Tall pine silhouettes rising above the treeline (near-black), incl. the
// central spire + right-edge pines from the reference photo.
const TREES = [
  { cx: 0.6, top: 0.3, w: 0.012, taper: 0.05 },
  { cx: 0.93, top: 0.22, w: 0.011, taper: 0.05 },
  { cx: 0.88, top: 0.36, w: 0.014, taper: 0.055 },
  { cx: 0.05, top: 0.46, w: 0.022, taper: 0.06 },
  { cx: 0.46, top: 0.48, w: 0.013, taper: 0.05 },
];

const AsciiForest = ({ className = "", cellSize = 8 }: AsciiForestProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen buffers.
    const small = document.createElement("canvas");  // low-res colour scene
    const sctx = small.getContext("2d")!;
    const mask = document.createElement("canvas");    // white dot mask (full res)
    const mctx = mask.getContext("2d")!;
    const tmp = document.createElement("canvas");       // reusable tint buffer
    const tctx = tmp.getContext("2d")!;
    const plate = document.createElement("canvas");     // final static composite
    const plctx = plate.getContext("2d")!;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    let W = 0, H = 0, cell = 0, cols = 0, rows = 0;
    let mtnTop = new Float32Array(0);
    let forestTop = new Float32Array(0);

    let running = true;
    let raf = 0;
    let last = 0;
    const startedAt = performance.now();

    // The procedural "photo": a mountain/forest scene. Returns 0-255 RGB.
    const scene = (nx: number, ny: number, mt: number, ft: number): [number, number, number] => {
      if (ny < mt) {
        // Sky — pale blue, cooler up top, lighter toward the ridge.
        const f = clamp01(ny / (mt <= 0 ? 1e-3 : mt));
        return [156 + 40 * f, 182 + 24 * f, 203 + 13 * f];
      }
      if (ny < ft) {
        // Mountain — grey-blue with warm side-light on the left/upper faces.
        const span = ft - mt || 1e-3;
        const h = (ny - mt) / span;
        let r = 98, g = 112, b = 130;
        const warm = clamp01((0.5 - nx) * 1.6) * clamp01(1 - h * 1.2) * 0.85;
        r += (188 - r) * warm; g += (158 - g) * warm; b += (118 - b) * warm;
        const dk = clamp01(h * 0.9) * 0.55;
        r += (58 - r) * dk; g += (68 - g) * dk; b += (84 - b) * dk;
        const s = 0.93 + 0.07 * Math.sin(nx * 150 + ny * 40);
        return [r * s, g * s, b * s];
      }
      // Forest — dark, autumn foliage, a couple of blue accents.
      const d = clamp01((ny - ft) / (1 - ft || 1e-3));
      let r = 46 + (5 - 46) * d, g = 54 + (7 - 54) * d, b = 42 + (6 - 42) * d;
      const n = 0.5 + 0.5 * Math.sin(nx * 33 + Math.sin(ny * 17) * 2) * Math.cos(ny * 29 + nx * 11);
      const warmMask = clamp01(n - 0.4) * clamp01(1 - Math.abs(d - 0.3) / 0.32) * 0.85;
      r += (152 - r) * warmMask; g += (120 - g) * warmMask; b += (48 - b) * warmMask;
      const bl = clamp01(1 - Math.hypot((nx - 0.32) / 0.055, (d - 0.72) / 0.07)) * 0.6
        + clamp01(1 - Math.hypot((nx - 0.42) / 0.04, (d - 0.78) / 0.05)) * 0.5;
      r += (70 - r) * bl; g += (120 - g) * bl; b += (160 - b) * bl;
      return [r, g, b];
    };

    const isTree = (nx: number, ny: number) => {
      for (let i = 0; i < TREES.length; i++) {
        const T = TREES[i];
        if (ny > T.top && Math.abs(nx - T.cx) < T.w + T.taper * (ny - T.top)) return true;
      }
      return false;
    };

    // A full-canvas fill of `color` shaped by the white dot mask.
    const maskFill = (color: string) => {
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = 1;
      tctx.clearRect(0, 0, W, H);
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = "source-over";
    };

    const buildPlate = () => {
      // 1) Paint the colour scene at ~half res, then blur-upscale into the photo.
      const sw = Math.max(2, Math.ceil(W / 2));
      const sh = Math.max(2, Math.ceil(H / 2));
      small.width = sw;
      small.height = sh;
      const imgData = sctx.createImageData(sw, sh);
      const data = imgData.data;
      for (let y = 0; y < sh; y++) {
        const ny = (y + 0.5) / sh;
        for (let x = 0; x < sw; x++) {
          const nx = (x + 0.5) / sw;
          const mt = mtnTopAt(nx);
          const ft = forestTopAt(nx);
          let r: number, g: number, b: number;
          if (isTree(nx, ny)) {
            r = 10; g = 14; b = 12;
          } else {
            [r, g, b] = scene(nx, ny, mt, ft);
          }
          const i = (y * sw + x) * 4;
          data[i] = clamp255(r); data[i + 1] = clamp255(g); data[i + 2] = clamp255(b); data[i + 3] = 255;
        }
      }
      sctx.putImageData(imgData, 0, 0);

      // 2) Blurred colour photo → plate background (bgMode "blur").
      plctx.globalCompositeOperation = "source-over";
      plctx.clearRect(0, 0, W, H);
      plctx.imageSmoothingEnabled = true;
      plctx.filter = `blur(${Math.max(1, 1.6 * dpr)}px)`;
      plctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H);
      plctx.filter = "none";
      plctx.fillStyle = "rgba(6,9,14,0.10)"; // ~10% not shown
      plctx.fillRect(0, 0, W, H);

      // 3) Halftone dot mask — white dot per cell, size/alpha ∝ darkness.
      mctx.clearRect(0, 0, W, H);
      mctx.fillStyle = "#ffffff";
      for (let gy = 0; gy < rows; gy++) {
        const ny = (gy + 0.5) / rows;
        const cy = gy * cell + cell / 2;
        for (let gx = 0; gx < cols; gx++) {
          const nx = (gx + 0.5) / cols;
          const mt = mtnTop[gx];
          const ft = forestTop[gx];
          let lum: number;
          if (isTree(nx, ny)) {
            lum = 0.05;
          } else {
            const [r, g, b] = scene(nx, ny, mt, ft);
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          }
          lum = clamp01((lum - 0.5) * 1.35 + 0.5); // contrast
          const d = 1 - lum;                        // darkness
          const radius = cell * (0.13 + 0.42 * d);
          mctx.globalAlpha = clamp01(0.45 + 0.45 * d);
          mctx.beginPath();
          mctx.arc(gx * cell + cell / 2, cy, radius, 0, Math.PI * 2);
          mctx.fill();
        }
      }
      mctx.globalAlpha = 1;

      // 4) Dark dots onto the photo + faint chromatic fringing.
      maskFill("rgba(7,10,15,0.96)");
      plctx.globalCompositeOperation = "source-over";
      plctx.drawImage(tmp, 0, 0);

      const off = Math.max(1, 1.2 * dpr);
      plctx.globalCompositeOperation = "multiply";
      plctx.globalAlpha = 0.45;
      maskFill("rgb(255,120,120)");
      plctx.drawImage(tmp, -off, 0);
      maskFill("rgb(120,150,255)");
      plctx.drawImage(tmp, off, 0);
      plctx.globalAlpha = 1;
      plctx.globalCompositeOperation = "source-over";
    };

    // Ridge + treeline helpers (also used at pixel res for the photo).
    const mtnTopAt = (nx: number) => {
      let m = 0.44;
      m -= 0.27 * tri(nx, 0.22, 0.11);
      m -= 0.21 * tri(nx, 0.58, 0.13);
      m -= 0.12 * tri(nx, 0.78, 0.09);
      m -= 0.07 * tri(nx, 0.4, 0.07);
      m -= 0.05 * tri(nx, 0.9, 0.06);
      m += 0.015 * Math.sin(nx * 47) + 0.01 * Math.sin(nx * 23 + 1);
      return m;
    };
    const forestTopAt = (nx: number) => {
      const f = 0.52 + 0.03 * Math.sin(nx * 18 + 0.7) + 0.02 * Math.sin(nx * 41);
      return Math.max(f, mtnTopAt(nx) + 0.05);
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      const cs = cssW < 640 ? Math.max(6, cellSize - 1) : cellSize;

      W = Math.floor(cssW * dpr);
      H = Math.floor(cssH * dpr);
      cell = Math.max(4, Math.floor(cs * dpr));
      cols = Math.ceil(W / cell);
      rows = Math.ceil(H / cell);

      for (const c of [canvas, mask, tmp, plate]) {
        c.width = W;
        c.height = H;
      }
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

      mtnTop = new Float32Array(cols);
      forestTop = new Float32Array(cols);
      for (let gx = 0; gx < cols; gx++) {
        const nx = (gx + 0.5) / cols;
        mtnTop[gx] = mtnTopAt(nx);
        forestTop[gx] = forestTopAt(nx);
      }

      buildPlate();
    };

    const draw = (now: number) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(plate, 0, 0);

      if (!reduceMotion) {
        const t = (now - startedAt) / 1000;
        // Subtle drifting shimmer highlight.
        const cx = (0.5 + 0.42 * Math.sin(t * 0.16)) * W;
        const cy = (0.42 + 0.22 * Math.cos(t * 0.13)) * H;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
        g.addColorStop(0, "rgba(255,255,255,0.06)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Film dust — a few transient specks.
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.05 + Math.random() * 0.07;
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
      if (now - last >= 40) {
        last = now;
        draw(now);
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
