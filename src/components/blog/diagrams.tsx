import { useState, type ReactNode } from "react";
import { FOCUS } from "@/components/landing/primitives";
import type { DiagramName } from "@/content/blog";

/* Diagrams for the blog posts. No chart library: layout is HTML and CSS so labels stay at a readable
   size on a phone and nothing scrolls sideways; arrows and marks are inline SVG. Teal is the main
   colour and each diagram has one amber accent, on the point that fails. Every label is real text,
   so screen readers read the diagram as content; each figure also carries a title and a description. */

const MONO = "font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em]";

const Frame = ({ id, title, desc, caption, children }: { id: string; title: string; desc: string; caption?: ReactNode; children: ReactNode }) => (
  <figure className="mt-8" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
    <div className="rounded-[8px] border border-dx-line bg-dx-raised p-4 sm:p-6">
      <p id={`${id}-title`} className={`${MONO} text-dx-ink-muted`}>
        {title}
      </p>
      <p id={`${id}-desc`} className="sr-only">
        {desc}
      </p>
      <div className="mt-4">{children}</div>
    </div>
    {caption && <figcaption className="mt-2 text-[13px] leading-relaxed text-dx-ink-muted">{caption}</figcaption>}
  </figure>
);

/** A short arrow: points right on wide screens and down when the diagram stacks. */
const Arrow = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 28 12" aria-hidden="true" className={`h-3 w-7 shrink-0 rotate-90 md:rotate-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 6h25M21 1.5 26 6l-5 4.5" />
  </svg>
);

const Node = ({ children, solid = false }: { children: ReactNode; solid?: boolean }) => (
  <div className={`flex min-h-[52px] items-center justify-center rounded-[8px] border px-3 py-2 text-center text-[14px] font-semibold leading-snug md:flex-1 ${solid ? "border-dx-brand bg-dx-brand text-white" : "border-dx-brand/40 bg-dx-brand-soft text-dx-ink"}`}>{children}</div>
);

/* ───────────────────────── 1 · the lead path ───────────────────────── */

const PATH = ["Form", "CRM contact", "Owner assigned", "First touch"];
const GAPS = [
  { short: "Never arrives", between: "Form to CRM contact", fails: "The lead never reaches the CRM, so routing never runs.", check: "Yesterday's form submissions counted against new CRM contacts from that form." },
  { short: "No owner", between: "CRM contact to Owner assigned", fails: "A rule depends on a field that was renamed or left empty. The lead matches no rule and gets no owner.", check: "New leads older than 30 minutes with no owner." },
  { short: "No follow-up", between: "Owner assigned to First touch", fails: "The owner is on leave or deactivated, the queue is unwatched, or the lead bounces between owners.", check: "Leads owned yesterday with zero activity, and leads with more than two owner changes." },
];

/** Form → CRM contact → Owner assigned → First touch. Each arrow is a button: pick one to see which check catches that failure. */
export const LeadPathDiagram = () => {
  const [on, setOn] = useState(1);
  return (
    <Frame
      id="lead-path"
      title="The lead path, and what fails at each handoff"
      desc="A lead moves from the form, to a CRM contact, to an assigned owner, to a first touch. Three handoffs can fail without an error: the lead never arrives in the CRM, the lead gets no owner, or the lead gets an owner and no follow-up."
      caption="Select a handoff to see which check catches it. None of the three raises an error."
    >
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {PATH.map((step, i) => (
          <div key={step} className="contents">
            <Node solid={i === PATH.length - 1}>{step}</Node>
            {i < GAPS.length && (
              <button
                type="button"
                onClick={() => setOn(i)}
                aria-pressed={on === i}
                aria-label={`Handoff ${i + 1}, ${GAPS[i].between}: ${GAPS[i].short}`}
                className={`flex items-center justify-center gap-2 rounded-[8px] border px-2 py-2 text-[12px] font-medium leading-tight transition md:w-[104px] md:flex-col md:gap-1.5 ${on === i ? "border-dx-signal bg-dx-signal-soft text-dx-signal-ink" : "border-transparent text-dx-ink-muted hover:border-dx-line-strong hover:text-dx-ink"} ${FOCUS}`}
              >
                <Arrow />
                <span>{GAPS[i].short}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <ol className="mt-5 space-y-2" aria-live="polite">
        {GAPS.map((g, i) => (
          <li key={g.short} className={`rounded-[8px] border-l-[3px] py-2 pl-4 pr-2 text-[14px] leading-relaxed ${on === i ? "border-dx-signal bg-dx-surface" : "border-dx-line"}`}>
            <p className="text-dx-ink">
              <span className="font-semibold">
                {i + 1}. {g.short}.
              </span>{" "}
              <span className="text-dx-ink-muted">{g.fails}</span>
            </p>
            {on === i && (
              <p className="mt-1 text-dx-ink">
                <span className={`${MONO} text-dx-brand`}>Caught by</span> {g.check}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Frame>
  );
};

/* ───────────────────────── 2 · the three-number diagnosis ───────────────────────── */

const COUNTS = [
  { k: "A", label: "Form submissions", sub: "yesterday, from the form tool" },
  { k: "B", label: "New CRM contacts", sub: "created from that form" },
  { k: "C", label: "Contacts with a first touch", sub: "a call, an email or a task done" },
];
const VERDICTS = [
  { when: "A is higher than B", then: "Lost before the CRM", note: "Not a routing problem. The lead never arrived." },
  { when: "A matches B, some have no owner", then: "Routing broke", note: "Look at what the ownerless leads have in common.", amber: true },
  { when: "Owners are set, C is short", then: "Follow-up problem", note: "Check for an absent owner, an unwatched queue or a bouncing lead." },
];

export const ThreeNumbersDiagram = () => (
  <Frame
    id="three-numbers"
    title="Three counts in, three conclusions out"
    desc="Compare three counts for yesterday: form submissions, new CRM contacts from that form, and contacts with a first touch. If submissions are higher than contacts, the lead was lost before the CRM. If they match but some contacts have no owner, routing broke. If owners are set but there is no first touch, it is a follow-up problem."
  >
    <div className="grid gap-2 sm:grid-cols-3">
      {COUNTS.map((c) => (
        <div key={c.k} className="flex items-center gap-3 rounded-[8px] border border-dx-brand/40 bg-dx-brand-soft p-3 sm:flex-col sm:items-start sm:gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dx-brand font-dx-mono text-[13px] font-medium text-white">{c.k}</span>
          <div>
            <p className="text-[14px] font-semibold leading-snug text-dx-ink">{c.label}</p>
            <p className="text-[12px] leading-snug text-dx-ink-muted">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="my-3 flex justify-center text-dx-ink-muted">
      <svg viewBox="0 0 12 24" aria-hidden="true" className="h-6 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1v21M1.5 17.5 6 22l4.5-4.5" />
      </svg>
    </div>
    <ul className="space-y-2">
      {VERDICTS.map((v) => (
        <li key={v.then} className={`grid gap-x-4 gap-y-1 rounded-[8px] border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center ${v.amber ? "border-dx-signal bg-dx-signal-soft" : "border-dx-line bg-dx-surface"}`}>
          <p className="font-dx-mono text-[13px] leading-snug text-dx-ink">{v.when}</p>
          <div>
            <p className={`text-[15px] font-semibold leading-snug ${v.amber ? "text-dx-signal-ink" : "text-dx-ink"}`}>{v.then}</p>
            <p className="text-[13px] leading-snug text-dx-ink-muted">{v.note}</p>
          </div>
        </li>
      ))}
    </ul>
  </Frame>
);

/* ───────────────────────── 3 · the five checks ───────────────────────── */

const CHECKS = [
  { name: "No owner after 30 minutes", looks: "New leads older than 30 minutes with no owner", often: "Hourly" },
  { name: "Owned, no activity", looks: "Leads owned yesterday with zero activity", often: "Daily" },
  { name: "Too many owner changes", looks: "Leads with more than two owner changes", often: "Daily" },
  { name: "Test lead", looks: "A test lead sent through the real path, checked at the end", often: "Daily" },
  { name: "Zero dashboards", looks: "Reports whose correct value is always zero", often: "Daily, posted to Slack" },
];
const CELL = "block px-4 py-1 text-[14px] leading-snug md:table-cell md:border-t md:border-dx-line md:py-3";
const CELL_LABEL = "before:mb-0.5 before:block before:font-dx-mono before:text-[12px] before:uppercase before:tracking-[0.06em] before:text-dx-ink-muted before:content-[attr(data-label)] md:before:hidden";

export const FiveChecksDiagram = () => (
  <figure className="mt-8">
    <div className="overflow-hidden rounded-[8px] border border-dx-line bg-dx-raised">
      <table className="block w-full border-collapse text-left md:table">
        <caption className={`block px-4 pb-3 pt-4 text-left md:table-caption ${MONO} text-dx-ink-muted`}>Five checks: what each looks for and how often to run it</caption>
        <thead className="hidden bg-dx-sunken md:table-header-group">
          <tr>
            {["Check", "What it looks for", "How often"].map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-dx-mono text-[12px] font-medium uppercase tracking-[0.06em] text-dx-ink-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {CHECKS.map((c, i) => (
            <tr key={c.name} className="block border-t border-dx-line py-3 md:table-row md:border-0 md:py-0">
              <th scope="row" className={`${CELL} font-semibold text-dx-ink`}>
                <span className="mr-2 font-dx-mono text-[12px] font-medium text-dx-brand">0{i + 1}</span>
                {c.name}
              </th>
              <td data-label="What it looks for" className={`${CELL} ${CELL_LABEL} text-dx-ink-muted`}>
                {c.looks}
              </td>
              <td data-label="How often" className={`${CELL} ${CELL_LABEL} whitespace-normal font-medium text-dx-ink md:whitespace-nowrap`}>
                {c.often}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <figcaption className="mt-2 text-[13px] leading-relaxed text-dx-ink-muted">Every check looks for a state that should not exist. The right answer is always zero.</figcaption>
  </figure>
);

/* ───────────────────────── 4 · the average hides the tail ───────────────────────── */

const BUCKETS = [
  { label: "Under 1 hour", n: 44 },
  { label: "1 to 4 hours", n: 23 },
  { label: "Same day", n: 14 },
  { label: "Next day", n: 8 },
  { label: "2 days or more", n: 6 },
  { label: "No first touch", n: 5, out: true },
];
const BAR_MAX = Math.max(...BUCKETS.map((b) => b.n));

export const AverageTailDiagram = () => (
  <Frame
    id="average-tail"
    title="How an average hides the tail"
    desc="An illustrative bar chart of 100 leads by time to first touch. Most are answered within a few hours, a few wait a day or more, and five never get a first touch. The average is calculated on the 95 that got a response. The five with no first touch are left out of it."
    caption={
      <>
        <strong className="font-semibold text-dx-ink">Illustration, not real data.</strong> One hundred made-up leads, grouped by time to first touch. The average is worked out on the teal bars only.
      </>
    }
  >
    <ul className="space-y-2">
      {BUCKETS.map((b) => (
        <li key={b.label} className="grid grid-cols-[104px_minmax(0,1fr)_28px] items-center gap-3 sm:grid-cols-[130px_minmax(0,1fr)_32px]">
          <span className={`text-[13px] leading-tight ${b.out ? "font-semibold text-dx-signal-ink" : "text-dx-ink"}`}>{b.label}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" className="h-5 w-full">
            <rect x="0" y="0" width="100" height="10" rx="1" className="fill-dx-sunken" />
            <rect x="0" y="0" width={(b.n / BAR_MAX) * 100} height="10" rx="1" className={b.out ? "fill-dx-signal" : "fill-dx-brand"} />
          </svg>
          <span className="text-right font-dx-mono text-[13px] text-dx-ink">{b.n}</span>
        </li>
      ))}
    </ul>
    <div className="mt-4 grid gap-2 text-[13px] leading-snug sm:grid-cols-2">
      <p className="flex items-center gap-2 text-dx-ink">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[2px] bg-dx-brand" /> Counted in the average
      </p>
      <p className="flex items-center gap-2 text-dx-ink">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[2px] bg-dx-signal" /> Not in the average at all
      </p>
    </div>
  </Frame>
);

/* ───────────────────────── 5 · where the metric is calculated ───────────────────────── */

const STAGES = [
  { label: "Leads submitted", w: "100%", lost: "Never became a CRM contact" },
  { label: "Reached the CRM", w: "88%", lost: "No owner" },
  { label: "Got an owner", w: "76%", lost: "Owner absent, or a sequence that shows active and sent nothing" },
  { label: "Got a first touch", w: "62%" },
];

export const MetricFunnelDiagram = () => (
  <Frame
    id="metric-funnel"
    title="Where speed to lead is calculated"
    desc="Four stages, each smaller than the last: leads submitted, reached the CRM, got an owner, got a first touch. Speed to lead is calculated only on the last group. Leads that never became a contact, never got an owner, or were assigned and never contacted are left out of the number."
    caption="Bar widths are illustrative. The point is the order: every lead that drops out before the last bar is missing from the metric."
  >
    <ol className="space-y-1">
      {STAGES.map((s, i) => {
        const last = i === STAGES.length - 1;
        return (
          <li key={s.label}>
            <div style={{ width: s.w }} className={`flex min-h-[44px] items-center justify-between gap-3 rounded-[8px] border px-3 py-2 ${last ? "min-w-[268px]" : "min-w-[190px]"} ${last ? "border-dx-brand bg-dx-brand text-white" : "border-dx-brand/40 bg-dx-brand-soft text-dx-ink"}`}>
              <span className="text-[14px] font-semibold leading-snug">{s.label}</span>
              {last && <span className="text-right font-dx-mono text-[12px] leading-tight">the metric counts these</span>}
            </div>
            {s.lost && (
              <p className="flex items-start gap-2 py-1.5 pl-3 text-[13px] leading-snug text-dx-ink-muted">
                <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 1v6h8M7 4l3 3-3 3" />
                </svg>
                <span>
                  Drops out: <span className="text-dx-ink">{s.lost}</span>
                </span>
              </p>
            )}
          </li>
        );
      })}
    </ol>
    <p className="mt-3 rounded-[8px] border border-dx-signal bg-dx-signal-soft px-3 py-2 text-[13px] font-medium leading-snug text-dx-signal-ink">Everything that drops out has no response time, so it is never in the number.</p>
  </Frame>
);

/* ───────────────────────── 6 · the 90-day clock ───────────────────────── */

const DAYS = [
  { day: "Day 0", title: "Filed as spam", body: "The visitor sees success. No contact is created." },
  { day: "Day 1", title: "Daily spam digest", body: "It exists, but it is off by default. Nobody receives it." },
  { day: "Day 90", title: "Deleted", body: "The submission is removed from the spam queue.", amber: true },
];

export const SpamTimelineDiagram = () => (
  <Frame
    id="spam-timeline"
    title="The 90-day clock on a submission filed as spam"
    desc="A timeline with three points. Day 0: the submission is filed as spam, the visitor sees success and no contact is created. Day 1: the daily spam digest exists but is off by default. Day 90: the submission is deleted."
    caption="Reproduced in our own HubSpot account on 15 November 2026."
  >
    <ol className="relative grid gap-5 md:grid-cols-3 md:gap-4">
      <span aria-hidden="true" className="absolute bottom-3 left-[7px] top-3 w-px bg-dx-line-strong md:bottom-auto md:left-2 md:right-2 md:top-[7px] md:h-px md:w-auto" />
      {DAYS.map((d) => (
        <li key={d.day} className="relative pl-7 md:pl-0 md:pt-7">
          <span aria-hidden="true" className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-dx-raised md:top-0 ${d.amber ? "bg-dx-signal" : "bg-dx-brand"}`} />
          <p className={`${MONO} ${d.amber ? "text-dx-signal-ink" : "text-dx-brand"}`}>{d.day}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-dx-ink">{d.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-dx-ink-muted">{d.body}</p>
        </li>
      ))}
    </ol>
  </Frame>
);

export const DIAGRAMS: Record<DiagramName, () => JSX.Element> = {
  "lead-path": LeadPathDiagram,
  "three-numbers": ThreeNumbersDiagram,
  "five-checks": FiveChecksDiagram,
  "average-tail": AverageTailDiagram,
  "metric-funnel": MetricFunnelDiagram,
  "spam-timeline": SpamTimelineDiagram,
};
