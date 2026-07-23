import { useEffect, useState } from "react";
import AsciiForest from "./AsciiForest";

/**
 * HeroBackground — shows the exact provided hero image when present, and falls
 * back to the animated AsciiForest canvas until it is.
 *
 * ▶ To use your exact image: save it under frontend/public/ as hero-forest.jpeg
 *   (.jpg / .png / .webp with the same name also work). It is served from the
 *   site root, so no rebuild/import is needed — just drop it in.
 *
 * Until the file exists the load fails silently and the canvas effect renders,
 * so the hero never looks empty or shows a broken-image icon.
 */

const CANDIDATES = [
  "/hero-forest-landscape.png",
  "/hero-forest.jpeg",
  "/hero-forest.jpg",
  "/hero-forest.png",
  "/hero-forest.webp",
];

const HeroBackground = ({ className = "" }: { className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tryLoad = (i: number) => {
      if (i >= CANDIDATES.length) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setSrc(CANDIDATES[i]);
      };
      img.onerror = () => {
        if (!cancelled) tryLoad(i + 1);
      };
      img.src = CANDIDATES[i];
    };
    tryLoad(0);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={className}>
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <AsciiForest className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
};

export default HeroBackground;
