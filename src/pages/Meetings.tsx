//
// Meetings — the booked-pipeline workspace.
//
// The end of the GTM chain: Eva finds a good-fit account, Max writes and sends the
// personalized email, the prospect replies, and the meeting that comes out of it
// lands here. There is no separate meetings service — a booked meeting IS an
// outbound outcome, so this page derives everything from Max's workspace
// (`account.status === "meeting"` and `opportunity.tracking.meetingBooked`), which
// is exactly where `POST /max/opportunity/outcome` records it.
//
// Visually this is the same system as Eva and Max: identical page shell, h-16
// header, TONE/Chip/StatTile/PanelTitle primitives and table styling — in the
// amber key the sidebar already uses for Meetings.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  Clock,
  Handshake,
  Loader2,
  Mail,
  MailCheck,
  MessageSquare,
  Radar,
  RefreshCw,
  Reply,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import ConversationSidebar from "@/components/ConversationSidebar";
import {
  maxAPI,
  TIER_CONFIG,
  type ACVTier,
  type AccountRecord,
  type ContactRecord,
  type MaxWorkspace,
  type MonitorStage,
  type OutboundOpportunity,
} from "@/services/maxAPI";

// ─── Tone → tailwind chip classes (shared with Eva/Max) ──────────────────────

const TONE: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

function Chip({
  tone = "zinc",
  icon: Icon,
  children,
  className,
}: {
  tone?: string;
  icon?: typeof Target;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE[tone] || TONE.zinc,
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

// The page's identity mark. Meetings aren't an agent, so instead of an avatar this
// mirrors the sidebar's amber Meetings tile.
function MeetingsMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full text-white shadow-sm", className)}
      style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)" }}
    >
      <CalendarCheck className="h-1/2 w-1/2" />
    </div>
  );
}

function LogoMark({ seed, className = "h-9 w-9" }: { seed: string; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white", className)}
      style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)" }}
    >
      {seed}
    </div>
  );
}

// Brand logo with graceful fallback: favicon → initials (same pattern as Eva).
function CompanyLogo({
  domain,
  company,
  className = "h-9 w-9",
}: {
  domain?: string;
  company: string;
  className?: string;
}) {
  const seed = (company || "AC").slice(0, 2).toUpperCase();
  const favicon = domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
    : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [domain]);

  if (!favicon || failed) return <LogoMark seed={seed} className={className} />;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-white", className)}>
      <img
        src={favicon}
        alt={`${company} logo`}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}

// ─── Meeting derivation ──────────────────────────────────────────────────────
// There is no meetings endpoint. A meeting is an OUTCOME recorded against an
// outbound opportunity (`tracking.meetingBooked`, or the parent account flipped to
// status "meeting" by POST /max/opportunity/outcome). "Interested" is the
// pre-booking state — the prospect said yes in principle but nothing is on the
// calendar yet — and it's worth showing separately so the founder can chase it.

type MeetingStage = "booked" | "interested";

interface MeetingRecord {
  id: string;
  stage: MeetingStage;
  company: string;
  domain: string;
  contact: string;
  role: string;
  email: string;
  emailVerified: boolean;
  acvTier: ACVTier | null;
  at: string | null; // when it was booked / when interest was recorded
  source: string;
  subject: string;
  whyNow: string;
  opportunityId: string | null;
  accountId: string | null;
}

function contactFor(
  ws: MaxWorkspace,
  accountId: string | null,
  contactId?: string | null
): ContactRecord | undefined {
  const contacts = ws.contacts || [];
  if (contactId) {
    const direct = contacts.find((c) => String(c.id) === String(contactId));
    if (direct) return direct;
  }
  if (!accountId) return undefined;
  // Prefer a decision maker with a verified email — the person a meeting is with.
  return [...contacts]
    .filter((c) => String(c.accountId) === String(accountId))
    .sort((a, b) => {
      const rank = (c: ContactRecord) =>
        (c.email && c.emailVerified ? 0 : c.email ? 1 : 2) +
        (c.entryPointType === "decision_maker" ? 0 : 1);
      return rank(a) - rank(b);
    })[0];
}

/** The timestamp a lifecycle event was recorded, from the tracking history. */
function trackedAt(opp: OutboundOpportunity, events: string[]): string | null {
  const history = opp.tracking?.history || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (events.includes(history[i]?.event)) return history[i].at;
  }
  return opp.tracking?.repliedAt || opp.tracking?.sentAt || null;
}

function deriveMeetings(ws: MaxWorkspace | null): MeetingRecord[] {
  if (!ws) return [];
  const accounts = ws.accounts || [];
  const byId = new Map(accounts.map((a) => [String(a.id), a]));
  const out: MeetingRecord[] = [];
  const seenAccounts = new Set<string>();

  // 1) Opportunities carry the richest record — the email that earned the meeting.
  for (const opp of ws.opportunities || []) {
    const status = opp.tracking?.status || "";
    const isBooked = Boolean(opp.tracking?.meetingBooked) || status === "meeting_booked";
    const isInterested = status === "meeting_interested";
    if (!isBooked && !isInterested) continue;

    const account: AccountRecord | undefined = byId.get(String(opp.accountId));
    const contact = contactFor(ws, opp.accountId ?? null, opp.contactId);
    if (isBooked && account) seenAccounts.add(String(account.id));

    out.push({
      id: `mtg_opp_${opp.id}`,
      stage: isBooked ? "booked" : "interested",
      company: account?.company || opp.recipientName || "Account",
      domain: account?.domain || "",
      contact: contact?.name || opp.recipientName || "Contact",
      role: contact?.role || contact?.headline || "",
      email: opp.recipientEmail || contact?.email || "",
      emailVerified: Boolean(opp.recipientEmailVerified ?? contact?.emailVerified),
      acvTier: opp.acvTier || account?.acvTier || null,
      at: trackedAt(opp, isBooked ? ["meeting_booked"] : ["meeting_interested"]),
      source: isBooked ? "Reply to Max's outreach" : "Interest in Max's outreach",
      subject: opp.subject || "",
      whyNow: opp.whyNow || "",
      opportunityId: String(opp.id),
      accountId: account ? String(account.id) : null,
    });
  }

  // 2) An account can be flipped to "meeting" directly (manual log, or an outcome
  //    recorded before the opportunity existed). Only add it if no opportunity
  //    already produced this account's meeting, so nothing is double-counted.
  for (const account of accounts) {
    if (account.status !== "meeting" || seenAccounts.has(String(account.id))) continue;
    const contact = contactFor(ws, String(account.id));
    out.push({
      id: `mtg_acc_${account.id}`,
      stage: "booked",
      company: account.company,
      domain: account.domain || "",
      contact: contact?.name || "Contact",
      role: contact?.role || contact?.headline || "",
      email: contact?.email || "",
      emailVerified: Boolean(contact?.emailVerified),
      acvTier: account.acvTier || null,
      at: null,
      source: "Logged on the account",
      subject: "",
      whyNow: account.whyNow || "",
      opportunityId: null,
      accountId: String(account.id),
    });
  }

  // Most recent first; undated records sort last.
  return out.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0;
    const tb = b.at ? Date.parse(b.at) : 0;
    return tb - ta;
  });
}

/** Outbound funnel counts — the path a meeting travels to get here. */
interface FunnelCounts {
  accounts: number;
  queued: number;
  sent: number;
  replied: number;
  interested: number;
  booked: number;
  bookedThisWeek: number;
  companies: number;
}

const SENT_STATES = new Set([
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "meeting_interested",
  "meeting_booked",
]);

function computeFunnel(ws: MaxWorkspace | null, meetings: MeetingRecord[]): FunnelCounts {
  const opps = ws?.opportunities || [];
  const sent = opps.filter(
    (o) => o.approvalState === "sent" || SENT_STATES.has(o.tracking?.status || "")
  ).length;
  const replied = opps.filter(
    (o) =>
      Boolean(o.tracking?.repliedAt) ||
      ["replied", "meeting_interested", "meeting_booked"].includes(o.tracking?.status || "")
  ).length;
  const booked = meetings.filter((m) => m.stage === "booked");
  const weekAgo = Date.now() - 7 * 864e5;
  return {
    accounts: (ws?.accounts || []).length,
    queued: opps.filter((o) => ["pending", "approved"].includes(o.approvalState)).length,
    sent,
    replied,
    interested: meetings.filter((m) => m.stage === "interested").length,
    booked: booked.length,
    bookedThisWeek: booked.filter((m) => m.at && Date.parse(m.at) >= weekAgo).length,
    companies: new Set(booked.map((m) => m.company.toLowerCase())).size,
  };
}

function whenLabel(at: string | null): { label: string; sub: string } {
  if (!at) return { label: "Scheduled", sub: "date not recorded" };
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return { label: "Scheduled", sub: "" };
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 864e5);
  const rel =
    days <= 0
      ? "today"
      : days === 1
        ? "yesterday"
        : days < 7
          ? `${days} days ago`
          : days < 30
            ? `${Math.floor(days / 7)}w ago`
            : `${Math.floor(days / 30)}mo ago`;
  return {
    label: d.toLocaleDateString([], { month: "short", day: "numeric" }),
    sub: rel,
  };
}

// ─── Loading state (mirrors Eva's ScanProgress / Max's MonitorProgress) ──────

const LOAD_STEPS: { label: string; hint: string; Icon: typeof Users }[] = [
  { label: "Reading your outbound workspace", hint: "Accounts, contacts and every sent opportunity.", Icon: Users },
  { label: "Matching replies to outcomes", hint: "Finding the conversations that turned into interest.", Icon: Reply },
  { label: "Assembling the booked pipeline", hint: "Ordering meetings by when they were booked.", Icon: CalendarCheck },
];

function MeetingsLoading({ stage }: { stage: MonitorStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = stage === "starting" || !stage ? 0 : stage === "scanning" ? 1 : 2;
  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-amber-400/20" />
        <MeetingsMark className="relative h-16 w-16 ring-2 ring-amber-100" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Building your booked pipeline</p>
        <p className="mt-0.5 text-xs text-zinc-400">Reading outbound outcomes · {elapsed}s elapsed</p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left">
        {LOAD_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const Icon = step.Icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                state === "active" ? "border-amber-200 bg-amber-50/50" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  state === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : state === "active"
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-100 text-zinc-400"
                )}
              >
                {state === "done" ? (
                  <CheckCheck className="h-4 w-4" />
                ) : state === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-snug",
                    state === "pending" ? "text-zinc-400" : "text-zinc-800"
                  )}
                >
                  {step.label}
                </p>
                {state === "active" && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{step.hint}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state — "no meetings booked yet" ─────────────────────────────────
// Deliberately animated and INFORMATIVE rather than a dead end: it shows the real
// pipeline the founder already has in motion (accounts → queued → sent → replied)
// so an empty calendar reads as "still early" instead of "nothing is working".

const PIPELINE_STATUS: string[] = [
  "Watching for replies to Max's outreach…",
  "A positive reply becomes a meeting the moment it lands…",
  "Eva keeps qualifying new accounts for Max to work…",
  "Max is personalizing outreach for the strongest-fit accounts…",
  "Every booked meeting appears here automatically…",
];

function FlowStep({
  Icon,
  label,
  value,
  active,
  index,
}: {
  Icon: typeof Users;
  label: string;
  value: number;
  active: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5",
        active ? "border-amber-200 bg-amber-50/60" : "border-zinc-200/70 bg-white"
      )}
    >
      {active && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}
      <Icon className={cn("h-4 w-4", active ? "text-amber-600" : "text-zinc-400")} />
      <span className="text-lg font-semibold leading-none text-zinc-900 tabular-nums">{value}</span>
      <span className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </span>
    </motion.div>
  );
}

function NoMeetingsYet({ funnel, onOpenMax }: { funnel: FunnelCounts; onOpenMax: () => void }) {
  const [statusIdx, setStatusIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % PIPELINE_STATUS.length), 2400);
    return () => clearInterval(t);
  }, []);

  // Highlight the furthest stage that actually has volume, so the animation points
  // at where this founder's pipeline really is.
  const activeStage =
    funnel.replied > 0 ? 3 : funnel.sent > 0 ? 2 : funnel.queued > 0 ? 1 : 0;

  return (
    <div className="flex min-h-[64vh] flex-col items-center justify-center gap-7 py-12 text-center">
      {/* Animated calendar pulse */}
      <div className="relative flex h-32 w-32 items-center justify-center">
        {[0, 0.8, 1.6].map((delay, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-400/15"
            style={{
              inset: 0,
              animation: "ping 2.4s cubic-bezier(0,0,0.2,1) infinite",
              animationDelay: `${delay}s`,
            }}
          />
        ))}
        <span className="absolute inset-6 rounded-full border border-amber-200" />
        <span className="absolute inset-10 rounded-full border border-amber-100" />
        <MeetingsMark className="relative h-16 w-16 ring-2 ring-amber-100" />
      </div>

      <div className="max-w-xl space-y-2.5">
        <div className="flex justify-center">
          <Chip tone="amber" icon={CalendarClock}>
            Live · booked pipeline
          </Chip>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">No meetings booked yet</h2>
        <p className="text-[13px] leading-relaxed text-zinc-500">
          Meetings arrive at the end of the chain: Eva qualifies a good-fit account, Max writes and
          sends the personalized email, and the moment a prospect replies to book time it appears
          here — with the conversation that earned it.
        </p>
      </div>

      {/* Cycling status line */}
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/70 px-4 py-2 text-[12px] font-medium text-amber-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <motion.span
          key={statusIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {PIPELINE_STATUS[statusIdx]}
        </motion.span>
      </div>

      {/* The real pipeline in motion — grounded counts, not decoration */}
      <div className="w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          <Activity className="h-3.5 w-3.5" /> Your pipeline right now
        </div>
        <div className="flex items-stretch gap-2">
          <FlowStep Icon={Users} label="Accounts" value={funnel.accounts} active={activeStage === 0} index={0} />
          <FlowStep Icon={Mail} label="Queued" value={funnel.queued} active={activeStage === 1} index={1} />
          <FlowStep Icon={Send} label="Sent" value={funnel.sent} active={activeStage === 2} index={2} />
          <FlowStep Icon={Reply} label="Replied" value={funnel.replied} active={activeStage === 3} index={3} />
          <FlowStep Icon={CalendarCheck} label="Meetings" value={funnel.booked} active={false} index={4} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={onOpenMax}
          className="h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
        >
          <Send className="h-3.5 w-3.5" />
          {funnel.queued > 0 ? `Review ${funnel.queued} queued email${funnel.queued === 1 ? "" : "s"}` : "Open Max's outreach"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <p className="text-[11px] text-zinc-400">
          {funnel.queued > 0
            ? "Approving queued outreach is the fastest way to a first meeting."
            : "Meetings appear here automatically — nothing to set up."}
        </p>
      </div>
    </div>
  );
}

// ─── Summary header ─────────────────────────────────────────────────────────

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold leading-none text-zinc-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function SummaryHeader({ funnel, lastCheckedAt }: { funnel: FunnelCounts; lastCheckedAt?: string }) {
  const replyToMeeting = funnel.replied > 0 ? Math.round((funnel.booked / funnel.replied) * 100) : 0;
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone="amber" icon={CalendarCheck}>
              Booked pipeline
            </Chip>
            <span className="text-[10px] font-medium text-zinc-400">
              Eva qualifies → Max sends → prospect replies → meeting booked
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">
            Every meeting here came from a real outbound conversation, so you can trace it back to the
            email and the signal that earned it.
          </p>
        </div>
        {lastCheckedAt && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
            <Clock className="h-3 w-3" /> Updated {whenLabel(lastCheckedAt).sub || "just now"}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Booked" value={funnel.booked} sub="meetings" tone="text-emerald-600" />
        <StatTile label="This week" value={funnel.bookedThisWeek} sub="newly booked" />
        <StatTile label="Companies" value={funnel.companies} sub="with a meeting" />
        <StatTile
          label="Interested"
          value={funnel.interested}
          sub="not yet booked"
          tone={funnel.interested > 0 ? "text-amber-600" : undefined}
        />
        <StatTile label="Replies" value={funnel.replied} sub={`of ${funnel.sent} sent`} />
        <StatTile label="Reply → meeting" value={`${replyToMeeting}%`} sub="conversion" />
      </div>
    </div>
  );
}

function PanelTitle({ icon: Icon, children, right }: { icon: typeof Radar; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        <Icon className="h-3.5 w-3.5" /> {children}
      </p>
      {right}
    </div>
  );
}

// ─── Meetings table ─────────────────────────────────────────────────────────

function MeetingRow({ meeting, onOpen }: { meeting: MeetingRecord; onOpen: () => void }) {
  const when = whenLabel(meeting.at);
  const booked = meeting.stage === "booked";
  const tier = meeting.acvTier ? TIER_CONFIG[meeting.acvTier] : null;
  return (
    <tr className="border-t border-zinc-100 transition-colors hover:bg-zinc-50/70">
      {/* Company */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CompanyLogo domain={meeting.domain} company={meeting.company} className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-zinc-900">{meeting.company}</p>
            <p className="truncate text-[10.5px] text-zinc-400">{meeting.domain || "—"}</p>
          </div>
        </div>
      </td>

      {/* Who */}
      <td className="px-4 py-3">
        <p className="truncate text-[12.5px] font-medium text-zinc-700">{meeting.contact}</p>
        <p className="truncate text-[10.5px] text-zinc-400">{meeting.role || "—"}</p>
      </td>

      {/* Stage */}
      <td className="px-4 py-3">
        <Chip tone={booked ? "emerald" : "amber"} icon={booked ? CalendarCheck : Handshake}>
          {booked ? "Booked" : "Interested"}
        </Chip>
        {tier && <p className="mt-1 text-[10px] text-zinc-400">{tier.label}</p>}
      </td>

      {/* Contact channel */}
      <td className="px-4 py-3">
        {meeting.email ? (
          <a
            href={`mailto:${meeting.email}`}
            className="flex items-center gap-1 text-[12px] font-medium text-emerald-600 hover:underline"
          >
            {meeting.emailVerified ? (
              <MailCheck className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Mail className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{meeting.email}</span>
          </a>
        ) : (
          <span className="text-[11px] text-zinc-400">—</span>
        )}
      </td>

      {/* When */}
      <td className="px-4 py-3">
        <p className="text-[12.5px] font-medium text-zinc-700">{when.label}</p>
        <p className="text-[10.5px] text-zinc-400">{when.sub}</p>
      </td>

      {/* Why / source */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-medium text-zinc-500">{meeting.source}</span>
          {(meeting.subject || meeting.whyNow) && (
            <HoverCard openDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label="What earned this meeting"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                >
                  <Sparkles className="h-3 w-3" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-80 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                  What earned this meeting
                </p>
                {meeting.subject && (
                  <p className="text-[12px] font-medium text-zinc-800">“{meeting.subject}”</p>
                )}
                {meeting.whyNow && (
                  <p className="text-[12px] leading-relaxed text-zinc-600">{meeting.whyNow}</p>
                )}
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 whitespace-nowrap rounded-full border-zinc-200 px-2.5 text-[11px] font-semibold"
            onClick={onOpen}
          >
            Open in Max <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MeetingsTable({ meetings, onOpen }: { meetings: MeetingRecord[]; onOpen: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="overflow-x-auto">
        {/* table-fixed + colgroup = identical column widths on every row */}
        <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              <th className="px-4 py-2.5 font-bold">Company</th>
              <th className="px-4 py-2.5 font-bold">Who you're meeting</th>
              <th className="px-4 py-2.5 font-bold">Stage</th>
              <th className="px-4 py-2.5 font-bold">Contact</th>
              <th className="px-4 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 font-bold">Booked via</th>
              <th className="px-4 py-2.5 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <MeetingRow key={m.id} meeting={m} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

type StageFilter = "all" | MeetingStage;

export default function Meetings() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [ws, setWs] = useState<MaxWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<MonitorStage | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  const load = useCallback(
    async (force: boolean) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        // Meetings live across every ACV tier. The workspace payload is not
        // tier-scoped (only its metrics are), so one call covers all of them.
        const data = await maxAPI.getWorkspace(spaceId || "demo", "medium", force, (s) => setStage(s));
        setWs(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your booked pipeline");
      } finally {
        setStage(null);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [spaceId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const meetings = useMemo(() => deriveMeetings(ws), [ws]);
  const funnel = useMemo(() => computeFunnel(ws, meetings), [ws, meetings]);

  const booked = useMemo(() => meetings.filter((m) => m.stage === "booked"), [meetings]);
  const interested = useMemo(() => meetings.filter((m) => m.stage === "interested"), [meetings]);
  const visible = useMemo(
    () => (stageFilter === "all" ? meetings : meetings.filter((m) => m.stage === stageFilter)),
    [meetings, stageFilter]
  );

  const openMax = () => navigate(`/sales/${spaceId}`);

  const FILTERS: { key: StageFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: meetings.length },
    { key: "booked", label: "Booked", count: booked.length },
    { key: "interested", label: "Interested", count: interested.length },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <MeetingsMark className="h-9 w-9 ring-2 ring-amber-100" />
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Booked Pipeline
              </span>
              <span className="text-sm font-semibold text-zinc-900">Meetings · Won from outbound</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 text-[9px] font-bold uppercase tracking-wider text-amber-700"
            >
              <CalendarCheck className="h-3 w-3" /> {funnel.booked} booked
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              title="Re-read outbound outcomes"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={openMax}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Outreach</span>
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <MeetingsLoading stage={stage} />
            ) : error && !ws ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">Couldn't load your booked pipeline</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button
                  onClick={() => load(true)}
                  className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : meetings.length === 0 ? (
              <NoMeetingsYet funnel={funnel} onOpenMax={openMax} />
            ) : (
              <>
                <SummaryHeader funnel={funnel} lastCheckedAt={ws?.last_monitor_at} />

                {/* Stage filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex w-fit items-center gap-1 rounded-full bg-zinc-100/80 p-1">
                    {FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setStageFilter(f.key)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                          stageFilter === f.key
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        {f.label} {f.count}
                      </button>
                    ))}
                  </div>
                  <span className="ml-auto text-[11px] font-medium text-zinc-400">
                    {visible.length} shown
                  </span>
                </div>

                {visible.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 py-16 text-zinc-400">
                    <Target className="h-5 w-5" />
                    <p className="text-sm font-medium">No meetings match this filter.</p>
                  </div>
                ) : (
                  <MeetingsTable meetings={visible} onOpen={openMax} />
                )}

                {/* Prospects who said yes in principle but aren't on the calendar yet
                    — the highest-leverage follow-up list on this page. */}
                {stageFilter === "all" && interested.length > 0 && (
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4">
                    <PanelTitle
                      icon={Handshake}
                      right={
                        <span className="text-[10px] font-medium text-zinc-400">
                          {interested.length} to chase
                        </span>
                      }
                    >
                      Interested — no date yet
                    </PanelTitle>
                    <p className="mb-3 text-[12px] leading-relaxed text-zinc-500">
                      These prospects replied with interest but nothing is on the calendar. Following up
                      here converts faster than any new outreach.
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {interested.map((m, i) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5"
                        >
                          <CompanyLogo domain={m.domain} company={m.company} className="h-8 w-8" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-semibold text-zinc-900">{m.company}</p>
                            <p className="truncate text-[10.5px] text-zinc-400">
                              {m.contact}
                              {m.role ? ` · ${m.role}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={openMax}
                            className="shrink-0 text-amber-600 transition-colors hover:text-amber-800"
                            aria-label={`Open ${m.company} in Max`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Where meetings come from — keeps the funnel visible once the
                    table takes over the page. */}
                <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-4">
                  <PanelTitle icon={TrendingUp}>Pipeline that produced these meetings</PanelTitle>
                  <div className="flex items-stretch gap-2">
                    <FlowStep Icon={Users} label="Accounts" value={funnel.accounts} active={false} index={0} />
                    <FlowStep Icon={Mail} label="Queued" value={funnel.queued} active={false} index={1} />
                    <FlowStep Icon={Send} label="Sent" value={funnel.sent} active={false} index={2} />
                    <FlowStep Icon={Reply} label="Replied" value={funnel.replied} active={false} index={3} />
                    <FlowStep
                      Icon={CalendarCheck}
                      label="Meetings"
                      value={funnel.booked}
                      active={funnel.booked > 0}
                      index={4}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
