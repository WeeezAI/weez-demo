import { useReducedMotion } from "framer-motion";

/**
 * Real posts from public channels in a RevOps practitioner Slack community.
 * Names, avatars and @mentions are blurred in the images; the text is unedited.
 * 09 is an excerpt (header + one section) of a longer reply.
 */
type Complaint = { src: string; w: number; h: number; tag: string; alt: string };

const COMPLAINTS: Complaint[] = [
  { src: "/complaints/02-tools-dont-agree.webp", w: 686, h: 221, tag: "Data trust", alt: "Slack post: the hardest part is that the tools don't agree on who the customer is — CRM, billing and support each have their own record." },
  { src: "/complaints/04-routing.webp", w: 686, h: 110, tag: "Routing", alt: "Slack post: Routing. It's by far the biggest gap. Rules from 5 years ago built on top of over and over again." },
  { src: "/complaints/09-too-late.webp", w: 686, h: 187, tag: "Found too late", alt: "Slack post excerpt: we've found out about projects after the client had already selected a vendor; the trigger was visible earlier, we just didn't connect the dots." },
  { src: "/complaints/05-apollo-sync.webp", w: 686, h: 135, tag: "Broken sync", alt: "Slack post: our sales team uses Apollo to get contacts into Salesforce, but they've been mentioning a lot of sync issues." },
  { src: "/complaints/01-what-to-do-next.webp", w: 686, h: 317, tag: "No next step", alt: "Slack post: the problem isn't too many tools, it's that none of them tells you what to do next." },
  { src: "/complaints/07-agent-write-access.webp", w: 686, h: 134, tag: "AI agents", alt: "Slack post: I am not comfortable giving my agents access to read, write, and update SFDC." },
  { src: "/complaints/03-three-spellings.webp", w: 686, h: 317, tag: "Data trust", alt: "Slack post: reps stop updating when they stop trusting the CRM — the same account under three spellings, missing fields." },
  { src: "/complaints/06-reconciliation.webp", w: 686, h: 435, tag: "Systems disagree", alt: "Slack post: each system is individually correct and nobody owns which one is true — reconciliation is a person, not a process." },
  { src: "/complaints/08-agent-duplicates.webp", w: 686, h: 237, tag: "AI agents", alt: "Slack post: if the CRM has duplicates or stale fields, the agent writes confident updates on top of them." },
];

const Card = ({ c, hidden }: { c: Complaint; hidden?: boolean }) => (
  <figure
    aria-hidden={hidden || undefined}
    className="overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night-raised"
  >
    <img
      src={c.src}
      width={c.w}
      height={c.h}
      alt={hidden ? "" : c.alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="block h-auto w-full select-none"
    />
    <figcaption className="flex items-center justify-between gap-3 whitespace-nowrap border-t border-dx-night-line px-4 py-2 font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em]">
      <span className="rounded-[4px] border border-dx-night-line px-2 py-0.5 text-dx-brand-night">{c.tag}</span>
      <span className="truncate text-dx-night-ink-muted">RevOps Slack</span>
    </figcaption>
  </figure>
);

const Column = ({ items, duration, reverse, className = "" }: { items: Complaint[]; duration: number; reverse?: boolean; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <div className={`group relative min-w-0 flex-1 ${className}`}>
      <div
        className="flex flex-col gap-4 group-hover:[animation-play-state:paused]"
        style={
          reduce
            ? undefined
            : { animation: `complaint-scroll ${duration}s linear infinite${reverse ? " reverse" : ""}` }
        }
      >
        {items.map((c) => (
          <Card key={c.src} c={c} />
        ))}
        {/* duplicate set for a seamless loop */}
        {!reduce && items.map((c) => <Card key={`${c.src}-dup`} c={c} hidden />)}
      </div>
    </div>
  );
};

const ComplaintWall = ({ className = "" }: { className?: string }) => {
  const pairA = COMPLAINTS.filter((_, i) => i % 2 === 0);
  const pairB = COMPLAINTS.filter((_, i) => i % 2 === 1);
  const thirds = [0, 1, 2].map((k) => COMPLAINTS.filter((_, i) => i % 3 === k));
  return (
    <div className={`relative ${className}`} role="region" aria-label="What RevOps leaders are saying">
      <div className="h-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_90%,transparent)]">
        <div className="flex h-full gap-3 sm:gap-4">
          <Column items={COMPLAINTS} duration={70} className="sm:hidden" />
          <Column items={pairA} duration={56} className="hidden sm:block lg:hidden" />
          <Column items={pairB} duration={64} reverse className="hidden sm:block lg:hidden" />
          <Column items={thirds[0]} duration={48} className="hidden lg:block" />
          <Column items={thirds[1]} duration={58} reverse className="hidden lg:block" />
          <Column items={thirds[2]} duration={52} className="hidden lg:block" />
        </div>
      </div>
    </div>
  );
};

export default ComplaintWall;
