import {
  LinkedInLogo,
  GmailLogo,
  OutlookLogo,
  GoogleCalendarLogo,
} from "@/components/brand-logos";

/**
 * Integrations strip — a static, centered row of the tools Weez connects to
 * (no marquee/scrolling animation).
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
  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-sm">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90">
      <Logo className="h-5 w-5" />
    </span>
    <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-slate-200">
      {name}
    </span>
  </div>
);

const LogoMarquee = () => (
  <div className="flex flex-wrap items-center justify-center gap-4">
    {INTEGRATIONS.map((item) => (
      <Chip key={item.name} {...item} />
    ))}
  </div>
);

export default LogoMarquee;
