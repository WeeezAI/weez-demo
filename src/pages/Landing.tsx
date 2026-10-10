import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import StackNetwork from "@/components/stealth/StackNetwork";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import ComplaintWall from "@/components/landing/ComplaintWall";
import { CONTACT_EMAIL } from "@/components/stealth/contact";
import type { AccessIntent } from "@/services/earlyAccessAPI";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ───────────────────────── primitives ───────────────────────── */

const Reveal = ({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

const DexraMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <g fill="currentColor">
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="19" cy="5" r="2.2" />
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
    </g>
  </svg>
);

const Wordmark = () => (
  <span className="flex items-center gap-2.5">
    <DexraMark className="h-[14px] w-[14px] text-indigo-200/90" />
    <span className="text-[13px] font-medium tracking-[0.3em] text-white/90">DEXRAFLOW</span>
  </span>
);

const SectionLabel = ({ index, children }: { index: string; children: ReactNode }) => (
  <div className="flex items-center gap-3 font-geist-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
    <span className="text-white/55">{index}</span>
    <span className="h-px w-8 bg-white/15" />
    <span>{children}</span>
  </div>
);

const StealthDot = () => (
  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
    <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-200/70 motion-safe:animate-[stealth-pulse_3.2s_ease-in-out_infinite]" />
    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-100" />
  </span>
);

const PrimaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-[#08090c] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_40px_-12px_rgba(165,180,252,0.45)] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090c] ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  </button>
);

const SecondaryCTA = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.12] px-5 text-[14px] text-white/80 transition hover:border-white/25 hover:bg-white/[0.03] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090c]"
  >
    {children}
  </button>
);

/* ───────────────────────── nav ───────────────────────── */

const Nav = ({ onAccess }: { onAccess: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 ${
        scrolled ? "border-b border-white/[0.06] bg-[#08090c]/75 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
        <Link to="/" aria-label="Dexraflow home" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/60">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            type="button"
            onClick={onAccess}
            className="h-9 rounded-full border border-white/15 px-4 text-[13px] text-white/90 transition hover:border-white/30 hover:bg-white/[0.04]"
          >
            <span className="sm:hidden">Early Access</span>
            <span className="hidden sm:inline">Request Early Access</span>
          </button>
        </div>
      </nav>
    </header>
  );
};

/* ───────────────────────── hero ───────────────────────── */

const Hero = ({ onAccess, onFounder }: { onAccess: () => void; onFounder: () => void }) => {
  const reduce = useReducedMotion();
  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.1, delay: 0.15 + i * 0.12, ease: EASE },
        };

  return (
    <section className="relative isolate overflow-hidden lg:min-h-[100svh]" aria-labelledby="hero-title">
      {/* ambient illumination — kept very low so the network carries the depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_40%,rgba(99,102,241,0.10),transparent_70%),radial-gradient(40%_40%_at_10%_0%,rgba(148,163,184,0.06),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(70%_60%_at_60%_40%,black,transparent)]"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col px-5 pt-32 sm:px-8 md:pt-40 lg:min-h-[100svh] lg:justify-center lg:pb-28 lg:pt-24">
        <div className="relative z-10 max-w-[640px]">
          <motion.p {...enter(0)} className="font-geist-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            For B2B SaaS revenue teams
          </motion.p>

          <motion.h1
            id="hero-title"
            {...enter(1)}
            className="mt-6 text-[42px] font-light leading-[1.02] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[76px]"
          >
            We heard you. <span className="text-white/35">Loud and clear.</span>
          </motion.h1>

          <motion.p {...enter(2)} className="mt-7 max-w-[500px] text-[17px] leading-relaxed text-white/55 md:text-lg">
            Tools that disagree on who the customer is. Deals spotted after a competitor already won them. Routing rules nobody trusts. We're building the next generation of GTM systems to fix it.
          </motion.p>

          <motion.div {...enter(3)} className="mt-8 flex items-center gap-3 text-[13px] text-white/50">
            <StealthDot />
            Currently building in stealth.
          </motion.div>

          <motion.div {...enter(4)} className="mt-10 flex flex-wrap items-center gap-3">
            <PrimaryCTA onClick={onAccess}>Request Early Access</PrimaryCTA>
            <SecondaryCTA onClick={onFounder}>Talk to the Founder</SecondaryCTA>
          </motion.div>
        </div>

        {/* Wall of real RevOps complaints: in-flow band on mobile, right-hand field on desktop */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.5, ease: EASE }}
          className="relative mb-16 mt-14 h-[440px] sm:h-[520px] xl:absolute xl:bottom-0 xl:left-[52%] xl:right-[min(0px,calc(640px-50vw))] xl:top-20 xl:mt-0 xl:mb-0 xl:h-auto"
        >
          <ComplaintWall className="h-full" />
        </motion.div>
      </div>
    </section>
  );
};

/* ───────────────────────── sections ───────────────────────── */

const Corner = ({ className }: { className: string }) => (
  <span aria-hidden="true" className={`absolute h-3 w-3 border-white/25 ${className}`} />
);

const Stack = () => (
  <section className="relative px-5 py-28 sm:px-8 md:py-36" aria-labelledby="stack-title">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <Reveal>
            <SectionLabel index="01">The GTM stack</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="stack-title" className="mt-8 text-[34px] font-light leading-[1.08] tracking-[-0.035em] sm:text-5xl">
              Individually useful.
              <br />
              <span className="text-white/40">Collectively complex.</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <p className="max-w-md text-[17px] leading-relaxed text-white/50 md:justify-self-end">
            Each system holds part of the picture. Signals move between them constantly — some converge, some split, some never
            arrive where they're needed.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="relative mt-14 md:mt-20">
        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.012] px-3 py-8 sm:px-8 md:py-12">
          <Corner className="-left-px -top-px rounded-tl-2xl border-l border-t" />
          <Corner className="-right-px -top-px rounded-tr-2xl border-r border-t" />
          <Corner className="-bottom-px -left-px rounded-bl-2xl border-b border-l" />
          <Corner className="-bottom-px -right-px rounded-br-2xl border-b border-r" />
          <StackNetwork className="mx-auto block h-auto w-full max-w-[380px] sm:max-w-none" />
        </div>
        <div className="mt-4 flex items-center justify-between font-geist-mono text-[10.5px] uppercase tracking-[0.16em] text-white/25">
          <span>Fig. 02 — Signal flow across a typical stack</span>
          <span className="hidden sm:inline">Illustrative</span>
        </div>
      </Reveal>
    </div>
  </section>
);

const Stealth = ({ onFounder }: { onFounder: () => void }) => (
  <section className="relative isolate overflow-hidden px-5 py-32 sm:px-8 md:py-48" aria-labelledby="stealth-title">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_50%_45%,rgba(129,140,248,0.09),transparent_70%)]"
    />
    <div aria-hidden="true" className="absolute inset-x-0 top-0 mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <div className="mx-auto max-w-4xl text-center">
      <Reveal>
        <div className="flex justify-center">
          <SectionLabel index="02">Status</SectionLabel>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 id="stealth-title" className="mt-10 text-[52px] font-light leading-[0.98] tracking-[-0.05em] sm:text-7xl md:text-[112px]">
          Building in stealth.
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mx-auto mt-10 max-w-xl text-[17px] leading-relaxed text-white/55 md:text-lg">
          We're researching how modern revenue teams operate, coordinate, and scale across increasingly complex GTM environments.
        </p>
      </Reveal>
      <Reveal delay={0.15} className="mt-12 flex justify-center">
        <SecondaryCTA onClick={onFounder}>
          Talk to the Founder <ArrowUpRight className="h-4 w-4 opacity-60" />
        </SecondaryCTA>
      </Reveal>
    </div>
  </section>
);

const EarlyAccess = ({ onAccess }: { onAccess: () => void }) => (
  <section className="relative px-5 py-20 sm:px-8 md:py-28" aria-labelledby="access-title">
    <Reveal className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.008))] p-8 sm:p-12 md:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl"
        />
        <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="font-geist-mono text-[11px] uppercase tracking-[0.18em] text-white/35">Access by request</p>
            <h2 id="access-title" className="mt-6 text-[32px] font-light leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
              Want to see what we're building?
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/50">
              We're keeping the product private while we work with a small group of revenue teams.
            </p>
          </div>
          <div className="md:justify-self-end">
            <PrimaryCTA onClick={onAccess} className="w-full justify-center sm:w-auto">
              Request Early Access
            </PrimaryCTA>
          </div>
        </div>
      </div>
    </Reveal>
  </section>
);

const Founder = ({ onFounder }: { onFounder: () => void }) => (
  <section className="relative px-5 py-28 sm:px-8 md:py-40" aria-labelledby="founder-title">
    <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.3fr]">
      <Reveal>
        <SectionLabel index="03">Approach</SectionLabel>
      </Reveal>
      <div>
        <Reveal delay={0.05}>
          <h2 id="founder-title" className="text-[30px] font-light leading-[1.12] tracking-[-0.03em] sm:text-[40px]">
            Building from conversations, <span className="text-white/40">not assumptions.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/50">
            We're speaking directly with revenue leaders to understand where modern GTM systems break down as companies scale.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <button
            type="button"
            onClick={onFounder}
            className="group mt-9 inline-flex items-center gap-2 border-b border-white/20 pb-1 text-[15px] text-white/85 transition hover:border-white/60 hover:text-white"
          >
            Talk to the Founder
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </Reveal>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/[0.06] px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-4 flex items-center gap-2.5 text-[13px] text-white/40">
          <StealthDot />
          Building in stealth.
        </p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-white/40">
        <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-white">
          {CONTACT_EMAIL}
        </a>
        <Link to="/privacy-policy" className="transition hover:text-white">
          Privacy
        </Link>
        <Link to="/terms-conditions" className="transition hover:text-white">
          Terms
        </Link>
        <Link to="/data-deletion" className="transition hover:text-white">
          Data deletion
        </Link>
      </nav>
    </div>
    <div className="mx-auto mt-14 max-w-6xl font-geist-mono text-[11px] tracking-[0.08em] text-white/25">
      © {new Date().getFullYear()} Dexraflow Inc.
    </div>
  </footer>
);

/* ───────────────────────── page ───────────────────────── */

const Landing = () => {
  const [intent, setIntent] = useState<AccessIntent | null>(null);
  const openAccess = () => setIntent("early-access");
  const openFounder = () => setIntent("founder-conversation");

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow — Building in Stealth";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#08090c] font-geist text-white antialiased [overflow-x:clip] selection:bg-indigo-300/25">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>
      <Nav onAccess={openAccess} />
      <main id="main">
        <Hero onAccess={openAccess} onFounder={openFounder} />
        <Stack />
        <Stealth onFounder={openFounder} />
        <EarlyAccess onAccess={openAccess} />
        <Founder onFounder={openFounder} />
      </main>
      <Footer />
      <AccessRequestModal intent={intent} onOpenChange={(open) => !open && setIntent(null)} />
    </div>
  );
};

export default Landing;
