import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FOCUS } from "@/components/landing/primitives";
import { CONTACT_EMAIL } from "@/components/stealth/contact";

/* Chrome for the public blog pages. Same tokens and tone as the landing page, lighter weight. */

export const ONE_LINER = "Dexraflow catches workflows that silently break and tells you which leads you lost, the same day, not three weeks later.";

const Wordmark = () => <img src="/brand/dexraflow-lockup.svg" alt="Dexraflow" width={137} height={28} className="h-6 w-auto" />;

const BlogNav = () => (
  <header className="fixed inset-x-0 top-0 z-50 border-b border-dx-line bg-dx-surface/90 backdrop-blur-xl">
    <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
      <div className="flex items-center gap-8">
        <Link to="/" aria-label="Dexraflow home" className={`rounded ${FOCUS}`}>
          <Wordmark />
        </Link>
        <div className="hidden items-center gap-7 text-[14px] font-medium text-dx-ink-muted sm:flex">
          <Link to="/blog" className={`rounded transition hover:text-dx-ink ${FOCUS}`}>
            Blog
          </Link>
          <Link to="/#how" className={`rounded transition hover:text-dx-ink ${FOCUS}`}>
            How it works
          </Link>
        </div>
      </div>
      <Link to="/#offer" className={`group inline-flex h-9 items-center gap-2 rounded-[8px] bg-dx-brand px-4 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover ${FOCUS}`}>
        Book a Missed Pipeline Audit
      </Link>
    </nav>
  </header>
);

const BlogFooter = () => (
  <footer className="border-t border-dx-line bg-dx-raised px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-dx-ink-muted">{ONE_LINER}</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-dx-ink-muted">
        <Link to="/blog" className="transition hover:text-dx-ink">
          Blog
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-dx-ink">
          {CONTACT_EMAIL}
        </a>
        <Link to="/privacy-policy" className="transition hover:text-dx-ink">
          Privacy
        </Link>
        <Link to="/terms-conditions" className="transition hover:text-dx-ink">
          Terms
        </Link>
      </nav>
    </div>
    <div className="mx-auto mt-10 max-w-6xl text-[12px] text-dx-ink-muted">© {new Date().getFullYear()} Dexraflow Inc.</div>
  </footer>
);

/** The closing card every article ends on. */
export const AuditCta = () => (
  <aside className="mt-14 rounded-[8px] border border-dx-night-line bg-dx-night p-7 text-dx-night-ink sm:p-9">
    <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-night-ink-muted">Missed Pipeline Audit</p>
    <h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em]">Find out what your stack dropped last quarter.</h2>
    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dx-night-ink-muted">14 days, read-only, across your last 90 days. You get the exact leads, what they were worth and why.</p>
    <Link to="/#offer" className={`group mt-6 inline-flex h-11 items-center gap-2 rounded-[8px] bg-white px-5 text-[14px] font-medium text-dx-ink transition hover:bg-dx-surface ${FOCUS}`}>
      Book a Missed Pipeline Audit <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
    </Link>
  </aside>
);

export const BlogLayout = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen bg-dx-surface font-dx-sans text-dx-ink antialiased selection:bg-dx-brand-soft">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
      Skip to content
    </a>
    <BlogNav />
    <main id="main" className="px-5 pb-20 pt-28 sm:px-8 md:pb-28 md:pt-36">
      {children}
    </main>
    <BlogFooter />
  </div>
);

export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
