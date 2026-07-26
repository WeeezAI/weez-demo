/**
 * CosmicIcons — illustrative, space-themed duotone icons for the landing page.
 *
 * These are deliberately NOT single-stroke glyphs. Each icon is a small
 * illustration: a gradient "body" layer, a lighter aurora layer, and gold
 * star/accent details, so feature cards read as artwork rather than UI chrome.
 *
 * Palette (light-space): indigo → violet body, cyan → teal aurora, amber stars.
 * Every icon is decorative, so it renders aria-hidden and takes its size from
 * the className the caller passes (default h-8 w-8).
 */

import type { ReactNode } from "react";

export interface CosmicIconProps {
  className?: string;
}

/** Shared frame: 48×48 viewBox plus the three gradients each icon draws with. */
function Frame({
  id,
  className = "h-8 w-8",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* body: deep indigo → violet */}
        <linearGradient id={`cb-${id}`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        {/* aurora: cyan → teal */}
        <linearGradient id={`ca-${id}`} x1="8" y1="10" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        {/* star: amber → gold */}
        <linearGradient id={`cs-${id}`} x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

/** A four-point sparkle star, used as the shared accent detail. */
const Star = ({ id, x, y, r = 3, o = 1 }: { id: string; x: number; y: number; r?: number; o?: number }) => (
  <path
    d={`M${x} ${y - r} L${x + r * 0.32} ${y - r * 0.32} L${x + r} ${y} L${x + r * 0.32} ${y + r * 0.32} L${x} ${y + r} L${x - r * 0.32} ${y + r * 0.32} L${x - r} ${y} L${x - r * 0.32} ${y - r * 0.32} Z`}
    fill={`url(#cs-${id})`}
    opacity={o}
  />
);

/* ─────────────────────────  Journey / how it works  ───────────────────────── */

/** Planet with an orbit ring + latitude lines — "start with your website". */
export const IconWorldOrbit = ({ className }: CosmicIconProps) => (
  <Frame id="world" className={className}>
    <ellipse cx="24" cy="26" rx="20" ry="7.5" stroke={`url(#ca-world)`} strokeWidth="1.8" opacity=".55" />
    <circle cx="24" cy="22" r="12" fill={`url(#cb-world)`} />
    <path d="M12.6 18h22.8M12.6 26h22.8" stroke="#fff" strokeWidth="1.4" opacity=".55" strokeLinecap="round" />
    <path d="M24 10c4 4 4 20 0 24M24 10c-4 4-4 20 0 24" stroke="#fff" strokeWidth="1.4" opacity=".45" />
    <circle cx="41" cy="30" r="2.4" fill={`url(#ca-world)`} />
    <Star id="world" x={39} y={12} r={3.2} />
  </Frame>
);

/** Nebula brain — "build your business context". */
export const IconNebulaBrain = ({ className }: CosmicIconProps) => (
  <Frame id="brain" className={className}>
    <path
      d="M18 8c-5 0-9 3.6-9 8.2 0 1.3-.6 2-1.5 3C6.3 20.5 6 22 6 23.6 6 27 8.4 30 12 30.8V34c0 3.3 2.9 6 6.5 6 2.4 0 4.5-1.2 5.5-3V10.5C22.8 9 20.5 8 18 8Z"
      fill={`url(#cb-brain)`}
    />
    <path
      d="M30 8c5 0 9 3.6 9 8.2 0 1.3.6 2 1.5 3 1.2 1.3 1.5 2.8 1.5 4.4 0 3.4-2.4 6.4-6 7.2V34c0 3.3-2.9 6-6.5 6-2.4 0-4.5-1.2-5.5-3V10.5C25.2 9 27.5 8 30 8Z"
      fill={`url(#ca-brain)`}
      opacity=".85"
    />
    <path d="M24 14v22" stroke="#fff" strokeWidth="1.6" opacity=".7" strokeLinecap="round" />
    <path d="M17 18h4M17 25h5M31 18h-4M31 25h-5" stroke="#fff" strokeWidth="1.4" opacity=".65" strokeLinecap="round" />
    <Star id="brain" x={40} y={38} r={3} />
  </Frame>
);

/** Satellite dish with signal arcs — "detect live buying signals". */
export const IconSignalDish = ({ className }: CosmicIconProps) => (
  <Frame id="dish" className={className}>
    <path d="M8 40h20l-6-12-14 12Z" fill={`url(#cb-dish)`} />
    <ellipse cx="21" cy="21" rx="12" ry="9" transform="rotate(-32 21 21)" fill={`url(#ca-dish)`} />
    <ellipse cx="21" cy="21" rx="6" ry="4.4" transform="rotate(-32 21 21)" fill="#fff" opacity=".55" />
    <path d="M30 18a10 10 0 0 1 3.6 7.4" stroke={`url(#cs-dish)`} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M33 12a16 16 0 0 1 6 12.6" stroke={`url(#cs-dish)`} strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
    <Star id="dish" x={10} y={10} r={3.2} />
  </Frame>
);

/** Comet with a trail — "run autonomous outreach". */
export const IconCometSend = ({ className }: CosmicIconProps) => (
  <Frame id="comet" className={className}>
    <path d="M6 42c4-14 12-24 26-30-6 14-12 22-26 30Z" fill={`url(#ca-comet)`} opacity=".55" />
    <path d="M42 6 26 40l-4.4-11.6L10 24 42 6Z" fill={`url(#cb-comet)`} />
    <path d="M42 6 21.6 28.4" stroke="#fff" strokeWidth="1.6" opacity=".7" strokeLinecap="round" />
    <Star id="comet" x={11} y={12} r={3} />
    <Star id="comet" x={38} y={38} r={2.4} o={0.8} />
  </Frame>
);

/** Calendar orbited by a moon — "book qualified meetings". */
export const IconOrbitCalendar = ({ className }: CosmicIconProps) => (
  <Frame id="cal" className={className}>
    <ellipse cx="24" cy="24" rx="21" ry="10" transform="rotate(-24 24 24)" stroke={`url(#ca-cal)`} strokeWidth="1.8" opacity=".5" />
    <rect x="10" y="12" width="28" height="26" rx="6" fill={`url(#cb-cal)`} />
    <path d="M10 20h28" stroke="#fff" strokeWidth="1.8" opacity=".65" />
    <path d="M17 9v6M31 9v6" stroke={`url(#cb-cal)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M18 28.5l3.4 3.4 7-7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="41.5" cy="15" r="3" fill={`url(#cs-cal)`} />
  </Frame>
);

/* ─────────────────────────  Capabilities  ───────────────────────── */

/** Mission-control chart on a planet — revenue intelligence. */
export const IconMissionChart = ({ className }: CosmicIconProps) => (
  <Frame id="chart" className={className}>
    <ellipse cx="24" cy="41" rx="18" ry="4.5" fill={`url(#ca-chart)`} opacity=".4" />
    <rect x="7" y="9" width="34" height="26" rx="6" fill={`url(#cb-chart)`} />
    <path d="M14 28v-6M21 28V17M28 28v-9M35 28V14" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity=".9" />
    <path d="M13 21l7-6 7 4 8-7" stroke={`url(#ca-chart)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Star id="chart" x={39} y={40} r={2.8} />
  </Frame>
);

/** Radar sweep — market intelligence. */
export const IconRadarSweep = ({ className }: CosmicIconProps) => (
  <Frame id="radar" className={className}>
    <circle cx="24" cy="24" r="18" fill={`url(#cb-radar)`} opacity=".16" />
    <circle cx="24" cy="24" r="18" stroke={`url(#cb-radar)`} strokeWidth="2" />
    <circle cx="24" cy="24" r="11" stroke={`url(#cb-radar)`} strokeWidth="1.6" opacity=".6" />
    <circle cx="24" cy="24" r="4.5" fill={`url(#cb-radar)`} />
    <path d="M24 24 41 16a18 18 0 0 1 1 8L24 24Z" fill={`url(#ca-radar)`} opacity=".8" />
    <path d="M24 24 38 12" stroke={`url(#ca-radar)`} strokeWidth="2.2" strokeLinecap="round" />
    <Star id="radar" x={33} y={35} r={3} />
  </Frame>
);

/** Docked probe sending mail — sales execution. */
export const IconProbeMail = ({ className }: CosmicIconProps) => (
  <Frame id="mail" className={className}>
    <rect x="6" y="14" width="30" height="21" rx="5" fill={`url(#cb-mail)`} />
    <path d="M8 18l13 9.4L34 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    <path d="M36 20h5M36 26h7" stroke={`url(#ca-mail)`} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="41" cy="12" r="4" fill={`url(#ca-mail)`} />
    <Star id="mail" x={12} y={41} r={2.8} />
  </Frame>
);

/** Constellation of linked stars — buying-signal monitoring. */
export const IconConstellation = ({ className }: CosmicIconProps) => (
  <Frame id="const" className={className}>
    <path d="M11 34 19 16l11 9 8-13" stroke={`url(#cb-const)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 16 14 40M30 25l9 13" stroke={`url(#ca-const)`} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
    <circle cx="11" cy="34" r="3.4" fill={`url(#cb-const)`} />
    <circle cx="30" cy="25" r="3" fill={`url(#ca-const)`} />
    <circle cx="14" cy="40" r="2.2" fill={`url(#ca-const)`} opacity=".8" />
    <circle cx="39" cy="38" r="2.4" fill={`url(#cb-const)`} opacity=".8" />
    <Star id="const" x={19} y={16} r={4} />
    <Star id="const" x={38} y={12} r={3.2} />
  </Frame>
);

/** Rocket lifting off — launches / autonomous meetings. */
export const IconRocket = ({ className }: CosmicIconProps) => (
  <Frame id="rocket" className={className}>
    <path d="M24 4c6.5 5.4 10 13 10 21.5L24 32l-10-6.5C14 17 17.5 9.4 24 4Z" fill={`url(#cb-rocket)`} />
    <circle cx="24" cy="18" r="4.4" fill="#fff" opacity=".85" />
    <path d="M14 24 8 33l8-1.5M34 24l6 9-8-1.5" fill={`url(#ca-rocket)`} />
    <path d="M20 33c1.4 5 2.7 8 4 11 1.3-3 2.6-6 4-11-2.6 1.2-5.4 1.2-8 0Z" fill={`url(#cs-rocket)`} />
    <Star id="rocket" x={39} y={10} r={3} />
  </Frame>
);

/* ─────────────────────────  Signals  ───────────────────────── */

/** Crew of astronauts — hiring signals / decision makers. */
export const IconCrew = ({ className }: CosmicIconProps) => (
  <Frame id="crew" className={className}>
    <circle cx="18" cy="17" r="8" fill={`url(#cb-crew)`} />
    <path d="M18 26c-6.6 0-12 4.3-12 9.6 0 1.3 1 2.4 2.3 2.4h19.4c1.3 0 2.3-1.1 2.3-2.4C30 30.3 24.6 26 18 26Z" fill={`url(#cb-crew)`} />
    <path d="M14 15.5a5 5 0 0 1 8 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
    <circle cx="34" cy="19" r="6" fill={`url(#ca-crew)`} opacity=".9" />
    <path d="M34 26c-2.4 0-4.6.6-6.3 1.7 2.6 1.8 4.3 4.5 4.3 7.5h9.7c1.3 0 2.3-1.1 2.3-2.4 0-3.8-4.5-6.8-10-6.8Z" fill={`url(#ca-crew)`} opacity=".9" />
    <Star id="crew" x={9} y={9} r={2.8} />
  </Frame>
);

/** Rising trajectory arc — funding & growth. */
export const IconTrajectory = ({ className }: CosmicIconProps) => (
  <Frame id="traj" className={className}>
    <path d="M6 38C10 22 22 10 42 8" stroke={`url(#cb-traj)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M6 38C10 22 22 10 42 8v6C26 16 15 26 11 38H6Z" fill={`url(#ca-traj)`} opacity=".35" />
    <circle cx="6" cy="38" r="3.4" fill={`url(#cb-traj)`} />
    <circle cx="20" cy="21" r="3" fill={`url(#ca-traj)`} />
    <circle cx="42" cy="8" r="4.4" fill={`url(#cs-traj)`} />
    <Star id="traj" x={33} y={33} r={3} o={0.85} />
  </Frame>
);

/** Energy crystal — tech & intent. */
export const IconEnergyCell = ({ className }: CosmicIconProps) => (
  <Frame id="cell" className={className}>
    <path d="M24 3 41 15v18L24 45 7 33V15L24 3Z" fill={`url(#cb-cell)`} opacity=".22" />
    <path d="M24 3 41 15v18L24 45 7 33V15L24 3Z" stroke={`url(#cb-cell)`} strokeWidth="2" />
    <path d="M26 12 16 27h6l-2 10 11-16h-6l1-9Z" fill={`url(#cs-cell)`} />
    <path d="M24 3v42M7 15l17 9 17-9" stroke={`url(#ca-cell)`} strokeWidth="1.4" opacity=".5" />
  </Frame>
);

/** Orbital station — leadership changes / company. */
export const IconStation = ({ className }: CosmicIconProps) => (
  <Frame id="station" className={className}>
    <rect x="18" y="10" width="12" height="28" rx="4" fill={`url(#cb-station)`} />
    <rect x="4" y="16" width="11" height="8" rx="2.5" fill={`url(#ca-station)`} />
    <rect x="4" y="27" width="11" height="8" rx="2.5" fill={`url(#ca-station)`} opacity=".75" />
    <rect x="33" y="16" width="11" height="8" rx="2.5" fill={`url(#ca-station)`} />
    <rect x="33" y="27" width="11" height="8" rx="2.5" fill={`url(#ca-station)`} opacity=".75" />
    <path d="M15 20h3M15 31h3M30 20h3M30 31h3" stroke={`url(#cb-station)`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="17" r="2.6" fill="#fff" opacity=".85" />
    <Star id="station" x={24} y={43} r={2.8} />
  </Frame>
);

/** Pulsing beacon — engagement signals. */
export const IconBeacon = ({ className }: CosmicIconProps) => (
  <Frame id="beacon" className={className}>
    <circle cx="24" cy="24" r="19" stroke={`url(#ca-beacon)`} strokeWidth="1.6" opacity=".35" />
    <circle cx="24" cy="24" r="13" stroke={`url(#ca-beacon)`} strokeWidth="1.8" opacity=".6" />
    <circle cx="24" cy="24" r="7" fill={`url(#cb-beacon)`} />
    <circle cx="24" cy="24" r="2.6" fill="#fff" opacity=".9" />
    <Star id="beacon" x={40} y={9} r={3.2} />
    <Star id="beacon" x={8} y={38} r={2.6} o={0.8} />
  </Frame>
);

/* ─────────────────────────  Explainability / edge  ───────────────────────── */

/** Telescope — explainable AI, "why this company". */
export const IconTelescope = ({ className }: CosmicIconProps) => (
  <Frame id="scope" className={className}>
    <path d="M9 27 33 12l5 8L14 35l-5-8Z" fill={`url(#cb-scope)`} />
    <path d="M33 12l5 8 5-3-4-8-6 3Z" fill={`url(#ca-scope)`} />
    <path d="M17 33v9M17 42h-6M17 42h6" stroke={`url(#cb-scope)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M12 24l22-13" stroke="#fff" strokeWidth="1.4" opacity=".55" strokeLinecap="round" />
    <Star id="scope" x={40} y={34} r={3.4} />
  </Frame>
);

/** Clock inside an orbit — "why now". */
export const IconTimeOrbit = ({ className }: CosmicIconProps) => (
  <Frame id="time" className={className}>
    <ellipse cx="24" cy="24" rx="21" ry="9" transform="rotate(-28 24 24)" stroke={`url(#ca-time)`} strokeWidth="1.8" opacity=".5" />
    <circle cx="24" cy="24" r="13" fill={`url(#cb-time)`} />
    <path d="M24 17v7.6l5 3" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="42" cy="15" r="2.8" fill={`url(#cs-time)`} />
  </Frame>
);

/** Star map with a pinned target — "why this contact" / star map. */
export const IconStarMap = ({ className }: CosmicIconProps) => (
  <Frame id="map" className={className}>
    <path d="M7 12l11-4 12 4 11-4v28l-11 4-12-4-11 4V12Z" fill={`url(#cb-map)`} opacity=".18" />
    <path d="M7 12l11-4 12 4 11-4v28l-11 4-12-4-11 4V12Z" stroke={`url(#cb-map)`} strokeWidth="2" strokeLinejoin="round" />
    <path d="M18 8v28M30 12v28" stroke={`url(#cb-map)`} strokeWidth="1.4" opacity=".45" />
    <circle cx="24" cy="22" r="5.5" fill={`url(#ca-map)`} />
    <circle cx="24" cy="22" r="2" fill="#fff" />
    <Star id="map" x={36} y={16} r={3} />
    <Star id="map" x={12} y={30} r={2.4} o={0.8} />
  </Frame>
);

/** Autonomous probe / bot — autonomous execution. */
export const IconProbeBot = ({ className }: CosmicIconProps) => (
  <Frame id="bot" className={className}>
    <rect x="10" y="16" width="28" height="22" rx="7" fill={`url(#cb-bot)`} />
    <circle cx="18.5" cy="26" r="3.4" fill="#fff" />
    <circle cx="29.5" cy="26" r="3.4" fill="#fff" />
    <path d="M19 33h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    <path d="M24 16V9" stroke={`url(#ca-bot)`} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="24" cy="6.5" r="3.4" fill={`url(#cs-bot)`} />
    <path d="M10 24H5M38 24h5" stroke={`url(#ca-bot)`} strokeWidth="2.4" strokeLinecap="round" />
  </Frame>
);

/** Docking port — plug-and-play setup. */
export const IconDockingPort = ({ className }: CosmicIconProps) => (
  <Frame id="dock" className={className}>
    <circle cx="24" cy="24" r="17" stroke={`url(#cb-dock)`} strokeWidth="2.2" />
    <circle cx="24" cy="24" r="17" fill={`url(#cb-dock)`} opacity=".14" />
    <circle cx="24" cy="24" r="8.5" fill={`url(#ca-dock)`} opacity=".85" />
    <path d="M24 15.5v17M15.5 24h17" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 7v4M24 37v4M7 24h4M37 24h4" stroke={`url(#cb-dock)`} strokeWidth="2.6" strokeLinecap="round" />
    <Star id="dock" x={38} y={11} r={2.8} />
  </Frame>
);

/* ─────────────────────────  Small metric icons  ───────────────────────── */

export const IconReplyComet = ({ className }: CosmicIconProps) => (
  <Frame id="reply" className={className}>
    <path d="M20 10 6 24l14 14v-8c11 0 17 3 22 10 1-14-8-22-22-22v-8Z" fill={`url(#cb-reply)`} />
    <path d="M20 10 6 24l14 14" stroke="#fff" strokeWidth="1.6" opacity=".55" strokeLinejoin="round" fill="none" />
    <Star id="reply" x={40} y={12} r={3} />
  </Frame>
);

export const IconPipelineValue = ({ className }: CosmicIconProps) => (
  <Frame id="value" className={className}>
    <circle cx="24" cy="24" r="17" fill={`url(#cb-value)`} />
    <ellipse cx="24" cy="24" rx="21" ry="6.5" transform="rotate(-20 24 24)" stroke={`url(#cs-value)`} strokeWidth="2.2" />
    <path d="M24 14v20M29 18.5c-1.2-1.6-3-2.5-5-2.5-2.8 0-5 1.7-5 4s2.2 3.4 5 4 5 1.7 5 4-2.2 4-5 4c-2 0-3.8-.9-5-2.5"
      stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </Frame>
);

export const IconSignalCount = ({ className }: CosmicIconProps) => (
  <Frame id="sigc" className={className}>
    <circle cx="24" cy="30" r="5.5" fill={`url(#cb-sigc)`} />
    <path d="M32 22a11 11 0 0 1 0 15M16 22a11 11 0 0 0 0 15" stroke={`url(#cb-sigc)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M38 15a19 19 0 0 1 0 29M10 15a19 19 0 0 0 0 29" stroke={`url(#ca-sigc)`} strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
    <Star id="sigc" x={24} y={9} r={3.4} />
  </Frame>
);

export const IconAccounts = ({ className }: CosmicIconProps) => (
  <Frame id="acct" className={className}>
    <rect x="8" y="14" width="15" height="26" rx="4" fill={`url(#cb-acct)`} />
    <rect x="25" y="21" width="15" height="19" rx="4" fill={`url(#ca-acct)`} />
    <path d="M12.5 20h6M12.5 26h6M12.5 32h6M29.5 27h6M29.5 33h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
    <Star id="acct" x={33} y={12} r={3.2} />
  </Frame>
);

export const IconMeetingsBooked = ({ className }: CosmicIconProps) => (
  <Frame id="mtg" className={className}>
    <rect x="8" y="12" width="32" height="28" rx="6" fill={`url(#cb-mtg)`} />
    <path d="M8 21h32" stroke="#fff" strokeWidth="1.8" opacity=".6" />
    <path d="M16 9v6M32 9v6" stroke={`url(#cb-mtg)`} strokeWidth="3" strokeLinecap="round" />
    <path d="M17 30.5l3.6 3.6L31 24" stroke={`url(#cs-mtg)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);
