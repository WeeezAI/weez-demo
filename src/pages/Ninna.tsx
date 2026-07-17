// pages/Ninna.tsx
//
// Ninna — the AI CMO Marketing Command Center.
//
// This is the default homepage of every workspace and the single interface
// between the founder and the AI marketing workforce (Robert, Eva, Max). It is
// NOT a chatbot: it opens by proactively answering "what happened while you were
// away?", surfaces a prioritized decision queue, a live campaign-health read and
// a timeline, and pairs every chat reply with embedded, actionable UI cards.
//
// Left: the Daily Brief dashboard. Right: Ninna's living conversation, where
// every message can carry the same interactive cards.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  Activity,
  BrainCircuit,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gauge,
  Lightbulb,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ConversationSidebar from "@/components/ConversationSidebar";
import SageAssistant from "@/components/SageAssistant";
import {
  ninnaAPI,
  getCachedBrief,
  NINNA,
  NINNA_QUICK_PROMPTS,
  healthMeta,
  type AgentKey,
  type AgentSummary,
  type CampaignHealth,
  type DailyBrief,
  type DecisionItem,
  type LeadCardData,
  type MeetingCardData,
  type NinnaCard,
  type NinnaChatMessage,
  type Priority,
  type RecommendationData,
  type TimelineEntry,
} from "@/services/ninnaAPI";

// ─── Tone palette (literal classes so Tailwind keeps them) ────────────────────

const TONE: Record<
  string,
  { bg: string; softBg: string; text: string; border: string; dot: string; solid: string }
> = {
  emerald: { bg: "bg-emerald-500", softBg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", solid: "bg-emerald-600" },
  sky: { bg: "bg-sky-500", softBg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500", solid: "bg-sky-600" },
  violet: { bg: "bg-violet-500", softBg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500", solid: "bg-violet-600" },
  amber: { bg: "bg-amber-500", softBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", solid: "bg-amber-600" },
  rose: { bg: "bg-rose-500", softBg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", solid: "bg-rose-600" },
  zinc: { bg: "bg-zinc-500", softBg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200", dot: "bg-zinc-400", solid: "bg-zinc-600" },
  indigo: { bg: "bg-indigo-500", softBg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500", solid: "bg-indigo-600" },
};

const AGENT_TONE: Record<AgentKey, string> = { robert: "violet", eva: "sky", max: "emerald" };
const AGENT_ICON: Record<AgentKey, typeof FileText> = { robert: FileText, eva: Target, max: Mail };
const PRIORITY_TONE: Record<Priority, string> = { critical: "rose", important: "amber", informational: "zinc" };
const PRIORITY_LABEL: Record<Priority, string> = { critical: "Critical", important: "Important", informational: "FYI" };

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Ninna avatar ─────────────────────────────────────────────────────────────

function NinnaAvatar({ className = "w-10 h-10" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("rounded-full overflow-hidden ring-2 ring-indigo-100 shrink-0 shadow-sm", className)}>
      {ok ? (
        <img src={NINNA.avatar} alt={NINNA.name} onError={() => setOk(false)} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black">
          N
        </div>
      )}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-indigo-600">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Embedded cards (shared by the dashboard and the chat) ────────────────────

function AgentSummaryCard({ summary, onOpen }: { summary: AgentSummary; onOpen: (link: string) => void }) {
  const tone = TONE[AGENT_TONE[summary.agent]];
  const Icon = AGENT_ICON[summary.agent];
  const statusText =
    summary.status === "attention"
      ? "Needs you"
      : summary.status === "working"
        ? "Working…"
        : summary.status === "error"
          ? "Unreachable"
          : summary.status === "quiet"
            ? "Standing by"
            : "On track";
  const statusTone =
    summary.status === "attention" ? "amber" : summary.status === "error" ? "rose" : summary.status === "working" ? "indigo" : "emerald";
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", tone.softBg)}>
            <Icon className={cn("w-5 h-5", tone.text)} />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900 leading-none">{summary.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">{summary.role}</p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
            TONE[statusTone].softBg,
            TONE[statusTone].text
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", TONE[statusTone].dot, summary.status === "working" && "animate-pulse")} />
          {statusText}
        </span>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{summary.headline}</p>

      {summary.metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {summary.metrics.map((mt) => (
            <div key={mt.label} className="rounded-2xl bg-gray-50 px-3 py-2.5 text-center">
              <p className="text-lg font-black text-gray-900 leading-none tabular-nums">{mt.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">{mt.label}</p>
            </div>
          ))}
        </div>
      )}

      {summary.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {summary.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
              <span className={cn("mt-1.5 h-1 w-1 rounded-full shrink-0", tone.dot)} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => onOpen(summary.link)}
        className={cn(
          "mt-auto flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-bold text-white transition-transform active:scale-95",
          tone.solid
        )}
      >
        Open {summary.name}
        {summary.pendingCount > 0 && (
          <span className="ml-2 flex items-center gap-1">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black">{summary.pendingCount} pending</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        )}
        {summary.pendingCount === 0 && <ArrowUpRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function CampaignHealthCard({ health }: { health: CampaignHealth }) {
  const meta = healthMeta(health.label);
  const tone = TONE[meta.tone];
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Campaign Health</span>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", tone.softBg, tone.text)}>
          {meta.text}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-2">
        <span className="text-5xl font-black tracking-tighter text-gray-900 tabular-nums">{health.score}</span>
        <span className="text-sm font-bold text-gray-400 mb-1.5">/ 100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className={cn("h-full rounded-full transition-all duration-700", tone.bg)} style={{ width: `${Math.max(4, health.score)}%` }} />
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-4">{health.summary}</p>

      <div className="space-y-2">
        {health.drivers.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-500">
              <span className={cn("h-1.5 w-1.5 rounded-full", d.positive ? "bg-emerald-500" : "bg-amber-500")} />
              {d.label}
            </span>
            <span className="font-bold text-gray-800 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionRow({ item, onOpen }: { item: DecisionItem; onOpen: (link: string) => void }) {
  const pTone = TONE[PRIORITY_TONE[item.priority]];
  const aTone = TONE[AGENT_TONE[item.agent]];
  const Icon = AGENT_ICON[item.agent];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", aTone.softBg)}>
          <Icon className={cn("w-4 h-4", aTone.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", pTone.softBg, pTone.text)}>
              {PRIORITY_LABEL[item.priority]}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 capitalize">{item.agent}</span>
          </div>
          <p className="text-sm font-bold text-gray-900 leading-snug truncate">{item.title}</p>
          <p className="text-xs text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{item.impact}</p>
        </div>
        <button
          onClick={() => onOpen(item.link)}
          className="shrink-0 flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-black transition-colors active:scale-95"
        >
          {item.actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function LeadRow({ lead, onOpen }: { lead: LeadCardData; onOpen: (link: string) => void }) {
  return (
    <button
      onClick={() => onOpen(lead.link)}
      className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-sky-200 transition-colors group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-gray-900 truncate">{lead.company}</p>
            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-sky-50 text-sky-700">{lead.tier}</span>
          </div>
          {lead.event && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{lead.event}</p>}
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{lead.reason}</p>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <div className="text-lg font-black text-sky-600 tabular-nums leading-none">{lead.fit}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Fit</div>
        </div>
      </div>
    </button>
  );
}

function MeetingRow({ meeting, onOpen }: { meeting: MeetingCardData; onOpen: (link: string) => void }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gray-900 truncate">{meeting.company}</p>
          <p className="text-xs text-gray-600 truncate">
            {meeting.contact}
            {meeting.role ? ` · ${meeting.role}` : ""}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">
            {meeting.when} · {meeting.source}
          </p>
        </div>
        <button onClick={() => onOpen(meeting.link)} className="shrink-0 text-emerald-700 hover:text-emerald-900">
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, onOpen }: { rec: RecommendationData; onOpen: (link: string) => void }) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-5">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-black text-gray-900">{rec.title}</p>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{rec.body}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          {rec.agents.map((a) => (
            <span
              key={a}
              className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest capitalize", TONE[AGENT_TONE[a]].softBg, TONE[AGENT_TONE[a]].text)}
            >
              {a}
            </span>
          ))}
        </div>
        {rec.actionLabel && rec.link && (
          <button
            onClick={() => onOpen(rec.link!)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
          >
            {rec.actionLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative pl-4">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
      <div className="space-y-4">
        {entries.map((e) => {
          const tone = e.agent === "ninna" ? TONE.indigo : TONE[AGENT_TONE[e.agent as AgentKey]] || TONE.zinc;
          return (
            <div key={e.id} className="relative">
              <span className={cn("absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-white", tone.bg)} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-800 leading-snug">{e.label}</p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 shrink-0">
                  {timeAgo(e.at)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{e.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// Renders any embedded card inside a chat message.
function ChatCard({ card, onOpen }: { card: NinnaCard; onOpen: (link: string) => void }) {
  switch (card.type) {
    case "agent_summary":
      return <AgentSummaryCard summary={card.summary} onOpen={onOpen} />;
    case "decisions":
      return (
        <div className="space-y-2">
          {card.items.map((it) => (
            <DecisionRow key={it.id} item={it} onOpen={onOpen} />
          ))}
        </div>
      );
    case "campaign_health":
      return <CampaignHealthCard health={card.health} />;
    case "leads":
      return (
        <div className="space-y-2">
          {card.leads.map((l) => (
            <LeadRow key={l.id} lead={l} onOpen={onOpen} />
          ))}
        </div>
      );
    case "meetings":
      return (
        <div className="space-y-2">
          {card.meetings.map((m) => (
            <MeetingRow key={m.id} meeting={m} onOpen={onOpen} />
          ))}
        </div>
      );
    case "recommendation":
      return <RecommendationCard rec={card.rec} onOpen={onOpen} />;
    case "timeline":
      return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <TimelineList entries={card.entries} />
        </div>
      );
    default:
      return null;
  }
}

// ─── Section shell ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Activity;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-500">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function BriefLoading({ spaceName }: { spaceName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-[#FDFBFF]">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
        <NinnaAvatar className="w-20 h-20 relative" />
      </div>
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Gathering your workforce</span>
        </div>
        <p className="text-sm font-medium text-gray-500 max-w-xs leading-relaxed">
          Nina is checking in with Robert, Eva and Max to build your brief for <span className="font-bold text-gray-800">{spaceName}</span>.
        </p>
      </div>
      <div className="flex items-center gap-6">
        {(["Robert", "Eva", "Max"] as const).map((n, i) => (
          <div key={n} className="flex flex-col items-center gap-2 opacity-60" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Ninna() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { currentSpace, user, selectSpace, spaces } = useAuth();

  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<NinnaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const userInteractedRef = useRef(false);
  const loadTokenRef = useRef(0);
  const spaceName = currentSpace?.name || spaces.find((s) => s.id === spaceId)?.name || "your workspace";
  const firstName = (user?.name || "").trim().split(" ")[0] || "";

  // Keep the space context in sync if a user deep-links straight into Ninna.
  useEffect(() => {
    if (spaceId && currentSpace?.id !== spaceId) {
      const match = spaces.find((s) => s.id === spaceId);
      if (match) selectSpace(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, spaces]);

  const openLink = (link: string) => navigate(link);

  // Seed / refresh the chat's opening message from the brief. We keep refreshing
  // it as the brief streams in, but stop the moment the founder starts chatting.
  const maybeSeed = (b: DailyBrief) => {
    if (userInteractedRef.current) return;
    const openingCards: NinnaCard[] = [];
    if (b.decisions.length > 0) openingCards.push({ type: "decisions", items: b.decisions.slice(0, 4) });
    openingCards.push({ type: "campaign_health", health: b.health });
    setMessages([
      {
        role: "ninna",
        content: `${b.greeting} Here's everything that happened ${b.sinceLabel}.\n\n${b.narrative}`,
        cards: openingCards,
        time: nowTime(),
      },
    ]);
    seededRef.current = true;
  };

  const loadBrief = async (isRefresh = false) => {
    if (!spaceId) return;
    const token = ++loadTokenRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      // Paint instantly from cache (if any); otherwise show the loader until the
      // first specialist reports in.
      const cached = getCachedBrief(spaceId);
      if (cached) {
        setBrief(cached);
        setLoading(false);
        maybeSeed(cached);
      } else {
        setLoading(true);
      }
    }

    try {
      const b = await ninnaAPI.getDailyBrief(spaceId, {
        onProgress: (partial) => {
          if (loadTokenRef.current !== token) return; // a newer load superseded this one
          setBrief(partial);
          setLoading(false);
          maybeSeed(partial);
        },
      });
      if (loadTokenRef.current !== token) return;
      setBrief(b);
      maybeSeed(b);
    } catch (e) {
      // getDailyBrief is designed never to throw, but guard anyway.
      console.error("[ninna] brief load failed", e);
    } finally {
      if (loadTokenRef.current === token) {
        setLoading(false);
        setRefreshing(false);
      }
      // Record the visit AFTER we've computed "since your last visit".
      ninnaAPI.recordVisit(spaceId);
    }
  };

  useEffect(() => {
    loadBrief(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || thinking || !brief || !spaceId) return;
    userInteractedRef.current = true; // stop the brief from re-seeding the thread
    setMessages((prev) => [...prev, { role: "user", content: prompt, time: nowTime() }]);
    setInput("");
    setThinking(true);
    try {
      const res = await ninnaAPI.chat(prompt, brief, spaceId);
      setMessages((prev) => [...prev, { role: "ninna", content: res.text, cards: res.cards, time: nowTime() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ninna", content: "I hit a snag reaching my reasoning model — mind trying that again in a moment?", time: nowTime() },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const criticalCount = useMemo(
    () => (brief?.decisions || []).filter((d) => d.priority === "critical").length,
    [brief]
  );

  return (
    <div className="flex h-screen bg-[#FDFBFF] overflow-hidden">
      {/* Shared workspace shell — Ninna is a first-class workspace page and the
          home the sidebar's top item now points to (replacing the old dashboard). */}
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {loading || !brief ? (
          <BriefLoading spaceName={spaceName} />
        ) : (
          <>
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <NinnaAvatar className="w-9 h-9" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 leading-none">{NINNA.name}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{NINNA.short}</span>
              {brief.isDemo && (
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Demo</span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate block">{spaceName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadBrief(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            title="Refresh brief"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Body: dashboard + chat */}
      <div className="flex-1 flex min-h-0">
        {/* Daily Brief dashboard */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Hero */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px w-8 bg-indigo-500/30" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600/70">Daily Brief · {brief.sinceLabel}</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 leading-tight">
                {brief.greeting}
                {firstName ? ` ${firstName}.` : ""}
              </h1>
              <p className="text-base text-gray-600 leading-relaxed">{brief.headline}</p>
              <div className="rounded-3xl border border-indigo-100 bg-white p-5 flex items-start gap-3 shadow-sm">
                <NinnaAvatar className="w-9 h-9" />
                <p className="text-sm text-gray-700 leading-relaxed pt-1">{renderInline(brief.narrative)}</p>
              </div>
            </div>

            {/* Decision queue */}
            {brief.decisions.length > 0 && (
              <Section
                icon={CheckCircle2}
                title="Decision Queue"
                action={
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {brief.decisions.length} waiting{criticalCount > 0 ? ` · ${criticalCount} critical` : ""}
                  </span>
                }
              >
                <div className="space-y-2">
                  {brief.decisions.map((d) => (
                    <DecisionRow key={d.id} item={d} onOpen={openLink} />
                  ))}
                </div>
              </Section>
            )}

            {/* Agent summaries */}
            <Section icon={Users} title="The Workforce">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {brief.agentSummaries.map((s) => (
                  <AgentSummaryCard key={s.agent} summary={s} onOpen={openLink} />
                ))}
              </div>
            </Section>

            {/* Health + meetings/leads */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section icon={Gauge} title="Health">
                <CampaignHealthCard health={brief.health} />
              </Section>

              <Section icon={brief.meetings.length > 0 ? CalendarClock : Target} title={brief.meetings.length > 0 ? "Meetings" : "Top Leads"}>
                {brief.meetings.length > 0 ? (
                  <div className="space-y-2">
                    {brief.meetings.map((m) => (
                      <MeetingRow key={m.id} meeting={m} onOpen={openLink} />
                    ))}
                  </div>
                ) : brief.topLeads.length > 0 ? (
                  <div className="space-y-2">
                    {brief.topLeads.slice(0, 4).map((l) => (
                      <LeadRow key={l.id} lead={l} onOpen={openLink} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-400">
                    No qualified leads yet — Eva is still scanning your channels.
                  </div>
                )}
              </Section>
            </div>

            {/* Recommendations */}
            {brief.recommendations.length > 0 && (
              <Section icon={Lightbulb} title="What I'd Do Next">
                <div className="grid grid-cols-1 gap-3">
                  {brief.recommendations.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onOpen={openLink} />
                  ))}
                </div>
              </Section>
            )}

            {/* Timeline */}
            {brief.timeline.length > 0 && (
              <Section icon={Clock} title="Workspace Timeline">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                  <TimelineList entries={brief.timeline} />
                </div>
              </Section>
            )}

            <div className="h-4" />
          </div>
        </main>

        {/* Ninna chat dock */}
        <aside className="hidden lg:flex w-[400px] xl:w-[440px] shrink-0 border-l border-gray-200/70 bg-white flex-col min-h-0">
          <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">Ask Nina</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-gray-900 text-white text-sm leading-relaxed">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <NinnaAvatar className="w-8 h-8" />
                    <div className="min-w-0 flex-1">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {renderInline(m.content)}
                      </div>
                    </div>
                  </div>
                  {m.cards && m.cards.length > 0 && (
                    <div className="pl-10 space-y-3">
                      {m.cards.map((c, ci) => (
                        <ChatCard key={ci} card={c} onOpen={openLink} />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            {thinking && (
              <div className="flex items-start gap-2.5">
                <NinnaAvatar className="w-8 h-8" />
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 inline-flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Nina is thinking…
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="shrink-0 px-4 pt-3 flex flex-wrap gap-1.5">
            {NINNA_QUICK_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={thinking}
                className="px-2.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="shrink-0 p-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-1.5 pl-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Nina about your marketing…"
                disabled={thinking}
                className="flex-1 bg-transparent px-1 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none border-0 focus:ring-0 disabled:opacity-60"
              />
              <Button
                onClick={() => send()}
                disabled={thinking || !input.trim()}
                className="h-9 w-9 p-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
              >
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </aside>
      </div>
          </>
        )}
      </div>

      {/* Nina's weekly founder check-in (voice). Sits left of the chat dock on
          large screens so it never covers the composer; bottom-right otherwise. */}
      {spaceId && (
        <SageAssistant spaceId={spaceId} fabClassName="bottom-6 right-6 lg:right-[420px] xl:right-[468px]" />
      )}
    </div>
  );
}
