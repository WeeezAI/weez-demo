import { useEffect, useRef, useState } from "react";
import AsciiForest from "./AsciiForest";

/**
 * HeroBackground — plays the hero background video (public/hero-space.mp4),
 * with graceful degradation in three steps:
 *
 *   1. The video, muted + looping, once it can play.
 *   2. A still poster image while the video buffers, or if it fails to load.
 *   3. The animated AsciiForest canvas if no poster image is available either.
 *
 * Both the video and the poster are served from the site root, so dropping a
 * replacement file into frontend/public/ is all that's needed — no import or
 * rebuild required.
 *
 * Accessibility: the video is decorative, so it is aria-hidden and carries no
 * audio track playback. Visitors who ask for reduced motion never get the
 * video — they see the still poster (or the canvas) instead.
 */

const VIDEO_SRC = "/hero-space.mp4";

// Poster / fallback stills, tried in order.
const POSTER_CANDIDATES = [
  "/hero-forest-landscape.png",
  "/hero-forest.jpeg",
  "/hero-forest.jpg",
  "/hero-forest.png",
  "/hero-forest.webp",
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const HeroBackground = ({ className = "" }: { className?: string }) => {
  const [poster, setPoster] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Resolve the first poster image that actually exists.
  useEffect(() => {
    let cancelled = false;
    const tryLoad = (i: number) => {
      if (i >= POSTER_CANDIDATES.length) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setPoster(POSTER_CANDIDATES[i]);
      };
      img.onerror = () => {
        if (!cancelled) tryLoad(i + 1);
      };
      img.src = POSTER_CANDIDATES[i];
    };
    tryLoad(0);
    return () => {
      cancelled = true;
    };
  }, []);

  // Honour changes to the reduced-motion preference while the page is open.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Some browsers reject the autoplay promise even when muted; retry once so a
  // rejection doesn't leave a frozen first frame.
  useEffect(() => {
    if (reduceMotion || videoFailed) return;
    const video = videoRef.current;
    if (!video) return;
    const play = () => void video.play().catch(() => undefined);
    play();
    video.addEventListener("canplay", play);
    return () => video.removeEventListener("canplay", play);
  }, [reduceMotion, videoFailed]);

  const showVideo = !reduceMotion && !videoFailed;

  return (
    <div className={className}>
      {showVideo ? (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : poster ? (
        <img
          src={poster}
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
