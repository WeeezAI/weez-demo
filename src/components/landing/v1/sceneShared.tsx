/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import { Edges, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { BRAND_ICONS, BRAND_LOGOS } from "../brandIcons";
import { TILE_H, TILE_SIZE } from "./sceneData";

/* Pieces shared by the WebGL scenes: brand marks rasterised to textures, a tool tile,
   soft alpha maps, and screen-space chips whose visibility is driven from useFrame via refs. */

export const BRAND = "#0b6e69";
export const BRAND_NIGHT = "#3bbfaf";
export const SIGNAL = "#e8962e";
export const SUCCESS = "#1e7a4a";
export const LINE = "#cfd9d6";

/* ───────────── icon textures: brand marks rasterised onto a tile ───────────── */

export function useIconTexture(k: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    let made: THREE.Texture | null = null;
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const finish = () => {
      if (cancelled) return;
      made = new THREE.CanvasTexture(c);
      made.colorSpace = THREE.SRGBColorSpace;
      made.anisotropy = 4;
      made.needsUpdate = true;
      setTex(made);
    };
    const logo = BRAND_LOGOS[k];
    const icon = BRAND_ICONS[k];
    if (k === "bot") {
      ctx.strokeStyle = "#3bbfaf";
      ctx.fillStyle = "#3bbfaf";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.roundRect(52, 84, 152, 112, 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(100, 140, 13, 0, Math.PI * 2);
      ctx.arc(156, 140, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(128, 84);
      ctx.lineTo(128, 56);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(128, 46, 10, 0, Math.PI * 2);
      ctx.fill();
      finish();
    } else if (k === "form") {
      ctx.strokeStyle = "#0f1a1f";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.roundRect(40, 40, 176, 176, 22);
      ctx.stroke();
      [[78, 100, 178], [78, 132, 150]].forEach(([x1, y, x2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      });
      ctx.fillStyle = BRAND;
      ctx.beginPath();
      ctx.roundRect(78, 160, 64, 26, 8);
      ctx.fill();
      finish();
    } else if (logo) {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(192 / img.width, 192 / img.height);
        const w = img.width * r;
        const h = img.height * r;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        finish();
      };
      img.onerror = finish;
      img.src = logo.src;
    } else if (icon) {
      ctx.fillStyle = icon.hex;
      ctx.translate(32, 32);
      ctx.scale(8, 8);
      ctx.fill(new Path2D(icon.path));
      finish();
    }
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [k]);
  return tex;
}

/* ───────────── pieces ───────────── */

export function Tile({ k, x, y = 0, z, rimRef, rimColor = SIGNAL, size = TILE_SIZE, height = TILE_H, color = "#ffffff", edge = "#dbe3e0", mark = 0.5 }: { k: string; x: number; y?: number; z: number; rimRef?: React.MutableRefObject<THREE.MeshBasicMaterial | null>; rimColor?: string; size?: number; height?: number; color?: string; edge?: string; mark?: number }) {
  const tex = useIconTexture(k);
  const glow = useGlowAlpha();
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[size, height, size]} radius={Math.min(0.05, size * 0.08)} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0} />
        <Edges color={edge} threshold={30} />
      </RoundedBox>
      {tex && (
        <mesh position={[0, height / 2 + 0.004, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[mark, mark]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {rimRef && (
        <mesh position={[0, -height / 2 + 0.006, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[size * 1.7, size * 1.7]} />
          <meshBasicMaterial ref={rimRef} color={rimColor} transparent opacity={0} alphaMap={glow} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** A soft radial alpha map for the amber underglow beneath the broken tile. */
export function useGlowAlpha() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }, []);
}

/** Builds a gradient alpha map so the scan curtain fades toward the floor. */
export function useCurtainAlpha() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 128);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }, []);
}

export function Chip({ el, tone, children, anchor = "center", visible = false, position }: { el: React.MutableRefObject<HTMLDivElement | null>; tone: "ink" | "amber" | "green" | "teal"; children: React.ReactNode; position: [number, number, number]; anchor?: "center" | "right" | "left"; visible?: boolean }) {
  const tones = {
    ink: "bg-dx-ink text-white",
    amber: "border border-dx-signal/50 bg-dx-signal-soft text-dx-signal-ink",
    green: "border border-dx-success/30 bg-dx-success-soft text-dx-success",
    teal: "border border-dx-brand/30 bg-dx-brand-soft text-dx-brand",
  };
  const dot = { ink: "bg-dx-brand-night", amber: "bg-dx-signal", green: "bg-dx-success", teal: "bg-dx-brand" };
  const shift = { center: "translate(-50%, -50%)", right: "translate(-100%, -50%)", left: "translate(0, -50%)" }[anchor];
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ transform: shift }}>
        <div
          ref={el}
          className={`flex items-center gap-2 whitespace-nowrap rounded-[6px] px-2.5 py-1 font-dx-mono text-[11px] font-medium tracking-[0.02em] shadow-[0_6px_20px_-10px_rgba(15,26,31,0.35)] ${tones[tone]}`}
          style={{ opacity: visible ? 1 : 0, transition: "opacity 240ms ease, transform 240ms ease", transform: visible ? "translateY(0px)" : "translateY(4px)" }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
          {children}
        </div>
      </div>
    </Html>
  );
}

export const show = (el: HTMLDivElement | null, on: boolean) => {
  if (!el) return;
  el.style.opacity = on ? "1" : "0";
  el.style.transform = on ? "translateY(0px)" : "translateY(4px)";
};

