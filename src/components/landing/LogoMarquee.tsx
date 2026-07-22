import { motion } from "framer-motion";
import {
  LinkedInLogo,
  GmailLogo,
  OutlookLogo,
  GoogleCalendarLogo,
} from "@/components/brand-logos";

/**
 * LogoMarquee — a seamless, hover-free infinite logo strip.
 *
 * Adapted from the 21st.dev "Logo Cloud" (InfiniteSlider) marquee pattern, but
 * reimplemented with a dependency-safe framer-motion loop (no react-use-measure):
 * the row is duplicated and translated by -50%, so the loop is seamless at any
 * width. Here it shows the tools Weez connects to — matching the connectors page.
 */

interface Integration {
  name: string;
  Logo: (props: { className?: string }) => JSX.Element;
}

const INTEGRATIONS: Integration[] = [
  { name: "LinkedIn", Logo: LinkedInLogo },
  { name: "Gmail", Logo: GmailLogo },
  { name: "Outlook", Logo: OutlookLogo },
  { name: "Google Calendar", Logo: GoogleCalendarLogo },
];

const Chip = ({ name, Logo }: Integration) => (
  <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-sm">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90">
      <Logo className="h-5 w-5" />
    </span>
    <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-slate-200">
      {name}
    </span>
  </div>
);

const LogoMarquee = ({ speed = 26 }: { speed?: number }) => {
  // Two identical sets back-to-back; translating the track by -50% loops seamlessly.
  const track = [...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 96px, black calc(100% - 96px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 96px, black calc(100% - 96px), transparent)",
      }}
    >
      <motion.div
        className="flex w-max gap-4"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {track.map((item, i) => (
          <Chip key={`${item.name}-${i}`} {...item} />
        ))}
      </motion.div>
    </div>
  );
};

export default LogoMarquee;
