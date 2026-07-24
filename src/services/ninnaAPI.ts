// services/ninnaAPI.ts
//
// Nina — the AI GTM Strategist for Weez.
//
// Nina is NOT another worker agent. She is the orchestrator and the single
// interface between the founder and the AI GTM workforce (EVA + MAX). This
// module is the "command center" layer: it continuously gathers the state of
// every specialist agent, then synthesizes a single, action-oriented Daily
// Brief in Nina's voice — what happened, why it matters, what needs the
// founder's attention, and what should happen next.
//
// Architecture:
//
//        Founder
//           │
//           ▼
//          Nina            ← this module aggregates + summarizes
//        ┌───┴───┐
//        ▼       ▼
//       EVA     MAX        ← existing specialist APIs (eva/max)
//
// EVA (revenue intelligence) and MAX (sales execution) never talk to the
// founder directly. Nina pulls their state (via the same typed APIs their own
// pages use — so real spaces get real data and demo spaces get the rich local
// samples) and reports only what matters. Every number Nina states is grounded
// in an agent's actual state; she never fabricates.

import CONFIG from "./config";
import evaAPI, { type EvaWorkspace, type QualifiedLead, type ACVTier } from "./evaAPI";
import maxAPI, {
  computeMetrics as computeMaxMetrics,
  type MaxWorkspace,
  type OutboundOpportunity,
  type AccountRecord,
} from "./maxAPI";

// ─── Identity ────────────────────────────────────────────────────────────────

export const NINNA = {
  name: "Nina",
  role: "GTM Strategist",
  short: "AI GTM Strategist",
  avatar: "/assets/nina.png", // reuse the shipped avatar; graceful "N" fallback in UI
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export type AgentKey = "eva" | "max";
export type Priority = "critical" | "important" | "informational";
export type HealthLabel = "excellent" | "healthy" | "at_risk" | "warming_up";
export type AgentStatus = "ok" | "attention" | "quiet" | "working" | "error";

export type DecisionKind =
  | "outbound_approval"
  | "campaign_approval"
  | "meeting"
  | "opportunity"
  | "alert";

// ─── Data objects ──────────────────────────────────────────────────────────────

export interface AgentSummary {
  agent: AgentKey;
  name: string; // EVA / MAX
  role: string; // Revenue Intelligence / Sales Execution
  status: AgentStatus;
  headline: string; // one-line status, in Ninna's reporting voice
  bullets: string[]; // key facts Ninna surfaces
  metrics: { label: string; value: string }[];
  pendingCount: number; // items needing founder attention
  link: string; // route to open the specialist workspace
  error?: string;
}

export interface DecisionItem {
  id: string;
  agent: AgentKey;
  kind: DecisionKind;
  priority: Priority;
  title: string;
  detail: string;
  impact: string; // why it matters (business language)
  actionLabel: string;
  link: string;
  score: number; // internal ranking (business impact, not arrival time)
}

export interface TimelineEntry {
  id: string;
  at: string; // ISO
  agent: AgentKey | "ninna";
  label: string;
  detail: string;
}

export interface HealthDriver {
  label: string;
  value: string;
  positive: boolean;
}

export interface CampaignHealth {
  label: HealthLabel;
  score: number; // 0–100
  summary: string;
  drivers: HealthDriver[];
}

export interface MeetingCardData {
  id: string;
  company: string;
  contact: string;
  role: string;
  when: string;
  source: string; // e.g. "Max · outbound reply"
  link: string;
}

export interface LeadCardData {
  id: string;
  company: string;
  tier: string; // "Medium ACV"
  fit: number; // 0–100
  reason: string;
  event?: string;
  link: string;
}

export interface RecommendationData {
  id: string;
  title: string;
  body: string;
  agents: AgentKey[]; // the strongest recommendations combine multiple agents
  actionLabel?: string;
  link?: string;
  priority: Priority;
}

// Discriminated union of everything Ninna can embed inside a chat message.
// The chat is not free-form text — every response can carry live UI.
export type NinnaCard =
  | { type: "agent_summary"; summary: AgentSummary }
  | { type: "decisions"; items: DecisionItem[] }
  | { type: "campaign_health"; health: CampaignHealth }
  | { type: "meetings"; meetings: MeetingCardData[] }
  | { type: "leads"; leads: LeadCardData[] }
  | { type: "recommendation"; rec: RecommendationData }
  | { type: "timeline"; entries: TimelineEntry[] };

export interface RevenueMetric {
  key: string;
  label: string;
  value: string;
}

export interface DailyBrief {
  greeting: string; // "Good morning."
  headline: string; // Nina's opening line
  narrative: string; // the synthesized "what happened / what matters / what's next"
  sinceLabel: string; // "since your last visit · 2 days ago"
  agentSummaries: AgentSummary[];
  decisions: DecisionItem[];
  health: CampaignHealth;
  timeline: TimelineEntry[];
  recommendations: RecommendationData[];
  meetings: MeetingCardData[];
  topLeads: LeadCardData[];
  revenueMetrics: RevenueMetric[]; // the GTM revenue dashboard tiles
  gtmSummary: string[]; // Nina's continuously-updated GTM summary bullets
  generatedAt: string;
  isDemo: boolean;
}

export interface NinnaChatMessage {
  role: "user" | "ninna";
  content: string;
  cards?: NinnaCard[];
  time: string;
}

export interface NinnaChatResult {
  text: string;
  cards: NinnaCard[];
}

// ─── Config / links ─────────────────────────────────────────────────────────────

export const NINNA_BASE_URL = `${CONFIG.WEEZ_BASE_URL}/nina`; // existing CMO backend

const isRealBrandId = (id?: string): id is string =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Deep-links into each specialist workspace (matches App.tsx routing).
export const agentLink = (agent: AgentKey, spaceId: string): string => {
  switch (agent) {
    case "eva":
      return `/eva/${spaceId}`;
    case "max":
      return `/sales/${spaceId}`;
  }
};
export const plannerLink = (spaceId: string): string => `/autonomous-marketing/${spaceId}`;

const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 100,
  important: 55,
  informational: 15,
};

// Decisions are ordered by business impact, not arrival time.
const KIND_BONUS: Record<DecisionKind, number> = {
  meeting: 40,
  campaign_approval: 30,
  outbound_approval: 20,
  opportunity: 12,
  alert: 25,
};

// ─── Last-visit tracking (frames "what happened while you were away") ─────────────

const visitKey = (spaceId: string) => `ninna_last_visit_${spaceId}`;

export function getLastVisit(spaceId: string): Date | null {
  try {
    const raw = localStorage.getItem(visitKey(spaceId));
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

export function recordVisit(spaceId: string): void {
  try {
    localStorage.setItem(visitKey(spaceId), new Date().toISOString());
  } catch {
    /* storage unavailable — non-blocking */
  }
}

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

function humanizeSince(last: Date | null): string {
  if (!last) return "Here's your first GTM briefing.";
  const ms = Date.now() - last.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return "since your last visit · earlier today";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `since your last visit · ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "since your last visit · yesterday";
  if (days < 7) return `since your last visit · ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `since your last visit · ${weeks} week${weeks > 1 ? "s" : ""} ago`;
}

// ─── Timeout guard ────────────────────────────────────────────────────────────
// EVA + MAX loads can kick off long background jobs (market scans, enrichment).
// The command center must stay responsive, so each agent load races a timeout.
// On timeout we report the agent as "working" rather than blocking the whole
// brief — Nina simply says that specialist is still busy.

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const AGENT_TIMEOUT_MS = 14000;

// ─── Per-agent loaders (never throw — always return a summary + slices) ──────────

interface EvaSlice {
  summary: AgentSummary;
  decisions: DecisionItem[];
  topLeads: LeadCardData[];
  recommendation?: RecommendationData;
  timeline: TimelineEntry[];
  ws?: EvaWorkspace;
}

async function loadEva(spaceId: string): Promise<EvaSlice> {
  const base: AgentSummary = {
    agent: "eva",
    name: "EVA",
    role: "Revenue Intelligence",
    status: "quiet",
    headline: "EVA is monitoring the market.",
    bullets: [],
    metrics: [],
    pendingCount: 0,
    link: agentLink("eva", spaceId),
  };
  try {
    const ws = await withTimeout(evaAPI.getWorkspace(spaceId), AGENT_TIMEOUT_MS);
    const m = ws.metrics;
    const active = ws.leads.filter((l) => l.status !== "rejected");
    const alerts = active.filter((l) => l.recommendedAction === "ae_alert");
    const readyForMax = active.filter((l) =>
      ["enriched", "handed_to_max"].includes(l.handoffState)
    );

    const summary: AgentSummary = {
      ...base,
      status: alerts.length > 0 ? "attention" : m.qualifiedLeads > 0 ? "ok" : "quiet",
      headline:
        m.qualifiedLeads > 0
          ? `Eva qualified ${m.qualifiedLeads} companies from ${m.signalsThisWeek} fresh signals this week.`
          : `Eva is monitoring ${m.channelsMonitored} channels for in-market companies.`,
      bullets: [
        `${m.orgsTracked} orgs tracked · ${m.emailsFound} contact emails found`,
        `${readyForMax.length} leads enriched and ready for Max`,
        alerts.length > 0
          ? `${alerts.length} high-priority AE alert${alerts.length > 1 ? "s" : ""} need attention`
          : `High-ACV signals logged to the account brief`,
      ],
      metrics: [
        { label: "Qualified", value: String(m.qualifiedLeads) },
        { label: "Emails", value: String(m.emailsFound) },
        { label: "To Max", value: String(m.handedToMax) },
      ],
      pendingCount: alerts.length,
      link: agentLink("eva", spaceId),
    };

    const decisions: DecisionItem[] = alerts.slice(0, 4).map((l) => ({
      id: `eva_${l.id}`,
      agent: "eva" as const,
      kind: "alert" as const,
      priority: "critical" as Priority,
      title: `${l.company} — high-intent alert`,
      detail: l.primaryEvent || l.qualificationReason,
      impact: `${l.acvTier.toUpperCase()} ACV · ICP fit ${l.icpFit}. ${l.qualificationReason}`,
      actionLabel: "Review in Eva",
      link: agentLink("eva", spaceId),
      score: PRIORITY_WEIGHT.critical + KIND_BONUS.alert,
    }));

    const topLeads: LeadCardData[] = [...active]
      .sort((a, b) => b.icpFit - a.icpFit)
      .slice(0, 5)
      .map((l) => ({
        id: `lead_${l.id}`,
        company: l.company,
        tier: `${l.acvTier.charAt(0).toUpperCase()}${l.acvTier.slice(1)} ACV`,
        fit: l.icpFit,
        reason: l.qualificationReason,
        event: l.primaryEvent || undefined,
        link: agentLink("eva", spaceId),
      }));

    const highIntentCount = active.filter((l) => l.icpFit >= 70).length;
    const recommendation: RecommendationData | undefined =
      highIntentCount > 0
        ? {
            id: "rec_eva",
            title: `${highIntentCount} high-intent companies worth prioritizing`,
            body: `Eva flagged ${highIntentCount} companies with strong ICP fit and a live buying signal. These are the accounts I'd move on first this week.`,
            agents: ["eva"],
            actionLabel: "See the shortlist",
            link: agentLink("eva", spaceId),
            priority: "important",
          }
        : undefined;

    const timeline: TimelineEntry[] = active.slice(0, 4).flatMap((l) =>
      l.signals.slice(0, 1).map((s) => ({
        id: `tl_eva_${s.id}`,
        at: s.timestamp,
        agent: "eva" as const,
        label: `${l.company} — ${l.eventType?.replace("_", " ") || "signal"}`,
        detail: l.primaryEvent || l.qualificationReason,
      }))
    );

    return { summary, decisions, topLeads, recommendation, timeline, ws };
  } catch (e) {
    const working = e instanceof TimeoutError;
    return {
      summary: {
        ...base,
        status: working ? "working" : "error",
        headline: working
          ? "Eva is mid-scan across her channels — I'll bring her findings in shortly."
          : "I couldn't reach Eva just now.",
        error: working ? undefined : (e as Error)?.message,
      },
      decisions: [],
      topLeads: [],
      timeline: [],
    };
  }
}

interface MaxSlice {
  summary: AgentSummary;
  decisions: DecisionItem[];
  meetings: MeetingCardData[];
  recommendation?: RecommendationData;
  timeline: TimelineEntry[];
  ws?: MaxWorkspace;
}

async function loadMax(spaceId: string, tier: ACVTier): Promise<MaxSlice> {
  const base: AgentSummary = {
    agent: "max",
    name: "MAX",
    role: "Sales Execution",
    status: "quiet",
    headline: "MAX is watching your target accounts.",
    bullets: [],
    metrics: [],
    pendingCount: 0,
    link: agentLink("max", spaceId),
  };
  try {
    const ws = await withTimeout(maxAPI.getWorkspace(spaceId, tier), AGENT_TIMEOUT_MS);
    const m = computeMaxMetrics(ws, tier);
    const pendingOpps = ws.opportunities.filter(
      (o) => o.approvalState === "pending" && o.acvTier === tier
    );

    const summary: AgentSummary = {
      ...base,
      status:
        m.meetingsBooked > 0
          ? "ok"
          : pendingOpps.length > 0 || m.repliesAwaiting > 0
            ? "attention"
            : "ok",
      headline:
        m.meetingsBooked > 0
          ? `Max booked ${m.meetingsBooked} meeting${m.meetingsBooked > 1 ? "s" : ""} and is working ${m.accountsMonitored} accounts.`
          : pendingOpps.length > 0
            ? `Max drafted ${pendingOpps.length} outbound email${pendingOpps.length > 1 ? "s" : ""} waiting for your approval.`
            : `Max is monitoring ${m.accountsMonitored} accounts with ${m.activeSignalsThisWeek} fresh signals.`,
      bullets: [
        `${m.accountsMonitored} accounts monitored · ${m.accountsQueued} in the outbound queue`,
        m.replyRate > 0
          ? `Reply rate ${(m.replyRate * 100).toFixed(0)}% · ${m.repliesAwaiting} replies awaiting you`
          : `${m.repliesAwaiting} replies awaiting your response`,
        m.recommendedFocus || "Reviewing the strongest-fit accounts first.",
      ],
      metrics: [
        { label: "Accounts", value: String(m.accountsMonitored) },
        { label: "Queued", value: String(m.accountsQueued) },
        { label: "Meetings", value: String(m.meetingsBooked) },
      ],
      pendingCount: pendingOpps.length,
      link: agentLink("max", spaceId),
    };

    const decisions: DecisionItem[] = pendingOpps.slice(0, 5).map((o) => {
      const acc = ws.accounts.find((a) => a.id === o.accountId);
      return {
        id: `max_${o.id}`,
        agent: "max" as const,
        kind: "outbound_approval" as const,
        priority: o.recommendedAction === "ae_alert" ? "critical" : "important",
        title: `Outbound to ${acc?.company || o.recipientName || "a target account"}`,
        detail: o.subject,
        impact: o.whyNow,
        actionLabel: "Review & approve",
        link: agentLink("max", spaceId),
        score:
          (o.recommendedAction === "ae_alert"
            ? PRIORITY_WEIGHT.critical
            : PRIORITY_WEIGHT.important) + KIND_BONUS.outbound_approval,
      };
    });

    // Meetings are grounded: booked accounts, or opportunities whose tracking
    // reports a meeting. Demo data has none — Ninna simply reports that honestly.
    const meetings: MeetingCardData[] = [];
    ws.accounts
      .filter((a) => a.status === "meeting")
      .forEach((a) => {
        const contact = ws.contacts.find((c) => c.accountId === a.id);
        meetings.push({
          id: `mtg_${a.id}`,
          company: a.company,
          contact: contact?.name || "Contact",
          role: contact?.role || "",
          when: "Scheduled",
          source: "Max · outbound",
          link: agentLink("max", spaceId),
        });
      });
    ws.opportunities
      .filter((o) => o.tracking?.meetingBooked)
      .forEach((o) => {
        const acc = ws.accounts.find((a) => a.id === o.accountId);
        meetings.push({
          id: `mtg_opp_${o.id}`,
          company: acc?.company || o.recipientName || "Account",
          contact: o.recipientName || "Contact",
          role: "",
          when: o.tracking?.sentAt ? "Booked" : "Booked",
          source: "Max · outbound reply",
          link: agentLink("max", spaceId),
        });
      });

    const recommendation: RecommendationData | undefined = m.recommendedFocus
      ? {
          id: "rec_max",
          title: "Where Max recommends focusing outbound",
          body: m.recommendedFocus,
          agents: ["max"],
          actionLabel: "Open Max",
          link: agentLink("max", spaceId),
          priority: pendingOpps.length > 0 ? "important" : "informational",
        }
      : undefined;

    const timeline: TimelineEntry[] = ws.signals.slice(0, 4).map((s) => ({
      id: `tl_max_${s.id}`,
      at: s.timestamp,
      agent: "max" as const,
      label: `${s.company} — ${s.signalType.replace("_", " ")}`,
      detail: s.detail,
    }));

    return { summary, decisions, meetings, recommendation, timeline, ws };
  } catch (e) {
    const working = e instanceof TimeoutError;
    return {
      summary: {
        ...base,
        status: working ? "working" : "error",
        headline: working
          ? "Max is mid-cycle across his signal sources — his outbound update is on the way."
          : "I couldn't reach Max just now.",
        error: working ? undefined : (e as Error)?.message,
      },
      decisions: [],
      meetings: [],
      timeline: [],
    };
  }
}

// ─── GTM health scoring ──────────────────────────────────────────────────────────
// A simple, explainable composite so the founder gets an immediate read on where
// attention is needed. Weighted across signal & lead flow, outbound activity and
// meeting generation. Grounded entirely in the agents' state.

function computeHealth(
  eva: EvaSlice,
  max: MaxSlice
): CampaignHealth {
  const drivers: HealthDriver[] = [];
  let score = 0;
  let weightSeen = 0;

  // Signal & lead flow (30)
  if (eva.ws) {
    const q = eva.ws.metrics.qualifiedLeads;
    const pts = Math.min(30, q * 5); // 6+ qualified leads maxes this out
    score += pts;
    weightSeen += 30;
    drivers.push({
      label: "Signals & leads",
      value: `${q} qualified`,
      positive: q >= 3,
    });
  }

  // Outbound activity (25)
  if (max.ws) {
    const mm = computeMaxMetrics(max.ws, max.ws.acvTier);
    const active = mm.accountsQueued + mm.accountsActive;
    const pts = Math.min(25, active * 4);
    score += pts;
    weightSeen += 25;
    drivers.push({
      label: "Outbound activity",
      value: `${mm.accountsQueued} queued`,
      positive: active >= 3,
    });

    // Meeting generation (15)
    const meetingPts = Math.min(15, mm.meetingsBooked * 8);
    score += meetingPts;
    weightSeen += 15;
    drivers.push({
      label: "Meetings",
      value: String(mm.meetingsBooked),
      positive: mm.meetingsBooked > 0,
    });
  }

  const normalized = weightSeen > 0 ? Math.round((score / weightSeen) * 100) : 0;

  let label: HealthLabel;
  if (weightSeen < 30) label = "warming_up";
  else if (normalized >= 75) label = "excellent";
  else if (normalized >= 55) label = "healthy";
  else if (normalized >= 35) label = "at_risk";
  else label = "warming_up";

  const summary =
    label === "excellent"
      ? "Your GTM engine is firing on all fronts — signals, pipeline and outbound are all moving."
      : label === "healthy"
        ? "Your GTM motion is in good shape. A couple of areas could use a nudge, but nothing's stuck."
        : label === "at_risk"
          ? "A few parts of the engine need attention before momentum slips. See the drivers below."
          : "Your engine is warming up. As EVA and MAX gather more signal, this score will sharpen.";

  return { label, score: normalized, summary, drivers };
}

// ─── Narrative synthesis (Nina's voice, fully grounded) ──────────────────────────

function buildNarrative(
  eva: EvaSlice,
  max: MaxSlice,
  decisions: DecisionItem[],
  meetings: MeetingCardData[]
): string {
  const lines: string[] = [];

  // EVA
  if (eva.ws) {
    const q = eva.ws.metrics.qualifiedLeads;
    if (q > 0) {
      const high = eva.ws.leads.filter((l) => l.status !== "rejected" && l.icpFit >= 70).length;
      lines.push(
        `EVA identified ${q} qualified compan${q === 1 ? "y" : "ies"}${
          high > 0 ? `, ${high} of them high-intent with a live buying signal` : ""
        }.`
      );
    } else if (eva.summary.status === "working") {
      lines.push("EVA is still scanning the market for in-market companies.");
    }
  }

  // MAX
  if (max.ws) {
    const mm = computeMaxMetrics(max.ws, max.ws.acvTier);
    const pending = max.ws.opportunities.filter(
      (o) => o.approvalState === "pending" && o.acvTier === max.ws!.acvTier
    ).length;
    if (mm.meetingsBooked > 0) {
      lines.push(
        `MAX booked ${mm.meetingsBooked} meeting${mm.meetingsBooked > 1 ? "s" : ""} and has ${pending} outbound email${
          pending === 1 ? "" : "s"
        } ready for your review.`
      );
    } else if (pending > 0) {
      lines.push(`MAX drafted ${pending} outbound email${pending === 1 ? "" : "s"} for qualified accounts, waiting on your approval.`);
    } else if (mm.accountsMonitored > 0) {
      lines.push(`MAX is working ${mm.accountsMonitored} target accounts and watching for the right moment to reach out.`);
    }
  }

  // What I'd do today
  const top = decisions[0];
  if (meetings.length > 0) {
    lines.push(
      `You've got ${meetings.length} meeting${meetings.length > 1 ? "s" : ""} on the board${
        top ? `, and I'd start today by clearing the ${top.priority} item in your decision queue.` : "."
      }`
    );
  } else if (top) {
    lines.push(
      `Today I'd start with your decision queue — the highest-impact item is ${
        top.kind === "outbound_approval"
          ? `approving the outbound to ${top.title.replace("Outbound to ", "")}`
          : top.title
      }.`
    );
  } else {
    lines.push("Nothing needs your approval right now — the workforce is executing. I'll flag the moment something does.");
  }

  return lines.join(" ");
}

// ─── Public: the Daily Brief ─────────────────────────────────────────────────────

export const ninnaAPI = {
  /**
   * Aggregate the entire AI workforce into a single Daily Brief. Each specialist
   * is loaded in parallel and tolerates individual failure/slowness — the brief
   * always returns, degrading gracefully to "that agent is still working".
   */
  getDailyBrief: async (
    spaceId: string,
    opts: { tier?: ACVTier; onProgress?: (brief: DailyBrief) => void } = {}
  ): Promise<DailyBrief> => {
    const tier: ACVTier = opts.tier || "medium";
    const onProgress = opts.onProgress;

    // Kick off both specialists in parallel; each resolves independently so the
    // command center paints progressively instead of blocking on the slowest.
    const eP = loadEva(spaceId);
    const mP = loadMax(spaceId, tier);

    let e: EvaSlice | undefined;
    let m: MaxSlice | undefined;

    if (onProgress) {
      const emit = () => onProgress(assembleBrief(spaceId, e, m, true));
      eP.then((s) => { e = s; emit(); }).catch(() => {});
      mP.then((s) => { m = s; emit(); }).catch(() => {});
    }

    const [eva, max] = await Promise.all([eP, mP]);
    const brief = assembleBrief(spaceId, eva, max, false);
    cacheBrief(spaceId, brief);
    return brief;
  },


  /**
   * Nina's chat. Never a free-form-only chatbot: every reply pairs conversation
   * with the relevant live UI (approvals, leads, meetings, health, timeline).
   * For real spaces we opportunistically enrich the prose via the Nina backend
   * (/nina/ask); the deterministic responder is always the safety net and owns
   * the embedded cards.
   */
  chat: async (
    question: string,
    brief: DailyBrief,
    spaceId: string
  ): Promise<NinnaChatResult> => {
    const local = ninnaReply(question, brief, spaceId);

    if (isRealBrandId(spaceId)) {
      try {
        const token = sessionStorage.getItem("token");
        const res = await withTimeout(
          fetch(`${NINNA_BASE_URL}/ask`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "69420",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              brand_id: spaceId,
              question,
              planner_context: {
                narrative: brief.narrative,
                pending_decisions: brief.decisions.length,
                health: brief.health.label,
              },
            }),
          }),
          AGENT_TIMEOUT_MS
        );
        if (res.ok) {
          const data = (await res.json()) as { status?: string; answer?: string };
          if (data?.answer && data.status !== "unavailable") {
            // Keep Ninna's live cards from the local intent match; use the richer
            // model prose as the spoken answer.
            return { text: data.answer, cards: local.cards };
          }
        }
      } catch {
        /* fall back to the local responder */
      }
    }

    return local;
  },

  getLastVisit,
  recordVisit,
  agentLink,
  plannerLink,
};

export default ninnaAPI;

// ─── Cross-agent recommendations ──────────────────────────────────────────────────
// The most valuable recommendations combine both agents. Nina looks for overlaps
// between what EVA is discovering and what MAX is executing, then proposes a
// single coordinated action.

// ─── Revenue metrics + GTM summary ────────────────────────────────────────────
// The dashboard's headline numbers and Nina's continuously-updated GTM summary.
// Counts come straight from EVA + MAX; pipeline/revenue are transparent estimates
// (qualified accounts / meetings × a representative ACV for the space's tier).

const ACV_BY_TIER: Record<ACVTier, number> = { low: 6000, medium: 25000, high: 80000 };

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function computeRevenueMetrics(eva: EvaSlice, max: MaxSlice): RevenueMetric[] {
  const em = eva.ws?.metrics;
  const mm = max.ws ? computeMaxMetrics(max.ws, max.ws.acvTier) : undefined;
  const acv = max.ws ? ACV_BY_TIER[max.ws.acvTier] : ACV_BY_TIER.medium;

  const companiesMonitored = em?.orgsTracked ?? mm?.accountsMonitored ?? 0;
  const buyingSignals = em?.signalsThisWeek ?? 0;
  const qualifiedAccounts = em?.qualifiedLeads ?? 0;
  const activeOutreach = mm ? mm.accountsQueued + mm.accountsActive : 0;
  const positiveReplies = mm?.repliesAwaiting ?? 0;
  const meetingsBooked = mm?.meetingsBooked ?? 0;
  const pipeline = qualifiedAccounts * acv;
  const revenueInfluenced = meetingsBooked * acv;

  return [
    { key: "companies", label: "Companies Monitored", value: companiesMonitored.toLocaleString("en-US") },
    { key: "signals", label: "Buying Signals", value: buyingSignals.toLocaleString("en-US") },
    { key: "qualified", label: "Qualified Accounts", value: qualifiedAccounts.toLocaleString("en-US") },
    { key: "outreach", label: "Active Outreach", value: activeOutreach.toLocaleString("en-US") },
    { key: "replies", label: "Positive Replies", value: positiveReplies.toLocaleString("en-US") },
    { key: "meetings", label: "Meetings Booked", value: meetingsBooked.toLocaleString("en-US") },
    { key: "pipeline", label: "Pipeline Generated", value: fmtMoney(pipeline) },
    { key: "revenue", label: "Revenue Influenced", value: fmtMoney(revenueInfluenced) },
  ];
}

function buildGtmSummary(
  eva: EvaSlice,
  max: MaxSlice,
  decisions: DecisionItem[],
  recommendations: RecommendationData[]
): string[] {
  const bullets: string[] = [];
  const em = eva.ws?.metrics;
  const mm = max.ws ? computeMaxMetrics(max.ws, max.ws.acvTier) : undefined;

  if (em) {
    bullets.push(`EVA monitored ${em.orgsTracked.toLocaleString("en-US")} companies`);
    bullets.push(`${em.signalsThisWeek} buying signal${em.signalsThisWeek === 1 ? "" : "s"} detected`);
    bullets.push(`${em.qualifiedLeads} account${em.qualifiedLeads === 1 ? "" : "s"} qualified`);
  } else if (eva.summary.status === "working") {
    bullets.push("EVA is scanning the market for buying signals…");
  }

  if (mm) {
    const inOutreach = mm.accountsQueued + mm.accountsActive;
    bullets.push(`MAX is working ${mm.accountsMonitored} account${mm.accountsMonitored === 1 ? "" : "s"}${inOutreach ? ` · ${inOutreach} in active outreach` : ""}`);
    if (mm.repliesAwaiting > 0) bullets.push(`${mm.repliesAwaiting} repl${mm.repliesAwaiting === 1 ? "y" : "ies"} awaiting a response`);
    bullets.push(`${mm.meetingsBooked} meeting${mm.meetingsBooked === 1 ? "" : "s"} booked`);
  } else if (max.summary.status === "working") {
    bullets.push("MAX is preparing outreach for qualified accounts…");
  }

  const rec = recommendations[0];
  if (rec) {
    bullets.push(`Recommendation: ${rec.title}`);
  } else if (decisions[0]) {
    bullets.push(`Recommendation: Clear the ${decisions[0].priority} item in your decision queue — ${decisions[0].title}.`);
  }

  return bullets;
}

function buildRecommendations(
  spaceId: string,
  eva: EvaSlice,
  max: MaxSlice
): RecommendationData[] {
  const recs: RecommendationData[] = [];

  // EVA + MAX: qualified, enriched leads that MAX hasn't turned into outbound yet.
  if (eva.ws && max.ws) {
    const readyLeads = eva.ws.leads.filter(
      (l) => l.status !== "rejected" && ["enriched", "handed_to_max"].includes(l.handoffState)
    );
    const pendingMax = max.ws.opportunities.filter((o) => o.approvalState === "pending");
    if (readyLeads.length > 0 && pendingMax.length > 0) {
      const names = readyLeads.slice(0, 3).map((l) => l.company).join(", ");
      recs.push({
        id: "rec_eva_max",
        title: "Turn EVA's fresh accounts into outbound today",
        body: `EVA enriched ${readyLeads.length} qualified compan${
          readyLeads.length === 1 ? "y" : "ies"
        } (${names}) and MAX already has ${pendingMax.length} researched email${
          pendingMax.length === 1 ? "" : "s"
        } drafted. Approving these keeps the pipeline moving while the timing is still warm.`,
        agents: ["eva", "max"],
        actionLabel: "Review outbound",
        link: agentLink("max", spaceId),
        priority: "important",
      });
    }
  }

  // MAX: high-ACV accounts that aren't ready for a direct ask yet.
  if (max.ws) {
    const notReady = max.ws.accounts.filter(
      (a: AccountRecord) => a.momentum !== "accelerating" && a.acvTier === "high"
    );
    if (notReady.length > 0) {
      recs.push({
        id: "rec_max_warm",
        title: "Hold outbound on high-ACV accounts that aren't ready",
        body: `${notReady.length} of your high-ACV accounts aren't showing accelerating momentum yet. I'd let EVA keep monitoring their buying signals and have MAX reach out the moment intent picks up — pushing a CTA too early on these burns the account.`,
        agents: ["eva", "max"],
        actionLabel: "Open Revenue Intelligence",
        link: agentLink("eva", spaceId),
        priority: "informational",
      });
    }
  }

  // Fold in each agent's own single best recommendation (deduped by priority).
  [eva.recommendation, max.recommendation].forEach((r) => {
    if (r) recs.push(r);
  });

  // Order by priority, keep it tight.
  return recs
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, 4);
}

// ─── Local GTM responder (grounded, card-embedding, never fabricates) ─────────────

export const NINNA_QUICK_PROMPTS = [
  "What needs my attention today?",
  "How's my pipeline doing?",
  "Show me the pending approvals",
  "What did EVA find?",
  "What's MAX working on?",
  "What happened this week?",
];

export function ninnaReply(
  question: string,
  brief: DailyBrief,
  spaceId: string
): NinnaChatResult {
  const q = question.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  // Decision queue / approvals / attention
  if (has("attention", "approv", "decision", "pending", "queue", "today", "priorit")) {
    if (brief.decisions.length === 0) {
      return {
        text: "Nothing needs your sign-off right now — the workforce is executing and I'll surface anything the moment it needs you. Want a read on how the campaign is doing instead?",
        cards: [{ type: "campaign_health", health: brief.health }],
      };
    }
    const top = brief.decisions[0];
    return {
      text: `You've got ${brief.decisions.length} thing${
        brief.decisions.length > 1 ? "s" : ""
      } waiting on you, ordered by business impact. I'd start with "${top.title}" — ${top.impact}`,
      cards: [{ type: "decisions", items: brief.decisions.slice(0, 6) }],
    };
  }

  // Campaign health
  if (has("health", "doing", "how are we", "how is the campaign", "on track", "status", "going")) {
    return {
      text: `Campaign health is ${labelText(brief.health.label)} (${brief.health.score}/100). ${brief.health.summary}`,
      cards: [{ type: "campaign_health", health: brief.health }],
    };
  }

  // EVA / revenue intelligence / accounts / signals
  if (has("eva", "lead", "discover", "compan", "account", "prospect", "intent", "signal", "market")) {
    const summary = brief.agentSummaries.find((s) => s.agent === "eva")!;
    const cards: NinnaCard[] = [{ type: "agent_summary", summary }];
    if (brief.topLeads.length > 0) cards.push({ type: "leads", leads: brief.topLeads });
    return {
      text: `${summary.headline} Here's what EVA has surfaced — the shortlist below is ordered by ICP fit.`,
      cards,
    };
  }

  // MAX / outbound / meetings
  if (has("max", "outbound", "email", "meeting", "reply", "sales", "sequence")) {
    const summary = brief.agentSummaries.find((s) => s.agent === "max")!;
    const cards: NinnaCard[] = [{ type: "agent_summary", summary }];
    if (brief.meetings.length > 0) cards.push({ type: "meetings", meetings: brief.meetings });
    const maxDecisions = brief.decisions.filter((d) => d.agent === "max");
    if (maxDecisions.length > 0) cards.push({ type: "decisions", items: maxDecisions });
    return {
      text:
        brief.meetings.length > 0
          ? `${summary.headline} Your booked meetings are below.`
          : `${summary.headline} No meetings on the board yet — I'll tell you the second one lands.`,
      cards,
    };
  }

  // Recommendations / what next / advice
  if (has("recommend", "what next", "what should", "advice", "suggest", "next step")) {
    if (brief.recommendations.length === 0) {
      return { text: "No standout moves to recommend this moment — I'll surface one as soon as the agents give me something worth acting on.", cards: [] };
    }
    return {
      text: "Here's what I'd prioritize — I weight the recommendations that combine more than one agent, because those are usually the highest-leverage.",
      cards: brief.recommendations.map((rec) => ({ type: "recommendation" as const, rec })),
    };
  }

  // Timeline / what happened / recap
  if (has("happen", "timeline", "recap", "week", "history", "since", "away", "update")) {
    return {
      text: brief.narrative,
      cards: brief.timeline.length > 0 ? [{ type: "timeline", entries: brief.timeline }] : [],
    };
  }

  // Default — the brief itself
  return {
    text: `${brief.narrative}\n\nAsk me anything — "what needs my attention?", "how's my pipeline doing?", "what did EVA find?", or "what's MAX working on?"`,
    cards:
      brief.decisions.length > 0
        ? [{ type: "decisions", items: brief.decisions.slice(0, 4) }, { type: "campaign_health", health: brief.health }]
        : [{ type: "campaign_health", health: brief.health }],
  };
}

function labelText(label: HealthLabel): string {
  switch (label) {
    case "excellent":
      return "excellent";
    case "healthy":
      return "healthy";
    case "at_risk":
      return "at risk";
    case "warming_up":
      return "warming up";
  }
}

export function healthMeta(label: HealthLabel): { text: string; tone: string } {
  switch (label) {
    case "excellent":
      return { text: "Excellent", tone: "emerald" };
    case "healthy":
      return { text: "Healthy", tone: "sky" };
    case "at_risk":
      return { text: "At risk", tone: "amber" };
    case "warming_up":
      return { text: "Warming up", tone: "zinc" };
  }
}

// ─── Progressive assembly helpers ──────────────────────────────────────────────
// When an agent hasn't resolved yet it renders as a "working" placeholder, so the
// command center paints instantly and fills in as each specialist reports back.

function loadingSummary(agent: AgentKey, spaceId: string): AgentSummary {
  const meta: Record<AgentKey, { name: string; role: string; line: string }> = {
    eva: { name: "EVA", role: "Revenue Intelligence", line: "EVA is scanning the market for in-market companies…" },
    max: { name: "MAX", role: "Sales Execution", line: "MAX is sweeping his signal sources…" },
  };
  const info = meta[agent];
  return {
    agent,
    name: info.name,
    role: info.role,
    status: "working",
    headline: info.line,
    bullets: [],
    metrics: [],
    pendingCount: 0,
    link: agentLink(agent, spaceId),
  };
}

function pendingEva(spaceId: string): EvaSlice {
  return { summary: loadingSummary("eva", spaceId), decisions: [], topLeads: [], timeline: [] };
}
function pendingMax(spaceId: string): MaxSlice {
  return { summary: loadingSummary("max", spaceId), decisions: [], meetings: [], timeline: [] };
}

// Assemble a (possibly partial) brief from whatever agent slices are ready.
function assembleBrief(
  spaceId: string,
  evaS: EvaSlice | undefined,
  maxS: MaxSlice | undefined,
  partial: boolean
): DailyBrief {
  const eva = evaS || pendingEva(spaceId);
  const max = maxS || pendingMax(spaceId);

  const agentSummaries = [eva.summary, max.summary];
  const decisions = [...eva.decisions, ...max.decisions].sort(
    (a, b) => b.score - a.score
  );
  const meetings = max.meetings;
  const topLeads = eva.topLeads;
  const timeline = [...eva.timeline, ...max.timeline]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 10);
  const health = computeHealth(eva, max);
  const recommendations = buildRecommendations(spaceId, eva, max);
  const revenueMetrics = computeRevenueMetrics(eva, max);
  const gtmSummary = buildGtmSummary(eva, max, decisions, recommendations);

  const lastVisit = getLastVisit(spaceId);
  const isDemo =
    !isRealBrandId(spaceId) || Boolean(eva.ws?.isDemo && max.ws?.isDemo);
  const narrative = buildNarrative(eva, max, decisions, meetings);
  const pendingTotal = decisions.length;
  const stillWorking = agentSummaries.some((s) => s.status === "working");
  const headline =
    partial && stillWorking
      ? "Here's your GTM update — I'm still gathering the last details from the workforce."
      : pendingTotal > 0
        ? `Here's your GTM update — ${pendingTotal} thing${pendingTotal > 1 ? "s" : ""} could use your attention.`
        : "Here's your GTM update. The workforce is executing — nothing's blocked on you.";

  return {
    greeting: greetingForNow(),
    headline,
    narrative,
    sinceLabel: humanizeSince(lastVisit),
    agentSummaries,
    decisions,
    health,
    timeline,
    recommendations,
    meetings,
    topLeads,
    revenueMetrics,
    gtmSummary,
    generatedAt: new Date().toISOString(),
    isDemo,
  };
}

// ─── Brief cache (instant revisits) ───────────────────────────────────────────
// The last assembled brief is cached per space so re-opening Nina paints instantly
// while a fresh brief loads (and streams in) in the background.

const briefCacheKey = (spaceId: string) => `ninna_brief_${spaceId}`;
const BRIEF_CACHE_TTL_MS = 10 * 60 * 1000;

export function getCachedBrief(spaceId: string): DailyBrief | null {
  try {
    const raw = sessionStorage.getItem(briefCacheKey(spaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { brief: DailyBrief; at: number };
    if (Date.now() - parsed.at > BRIEF_CACHE_TTL_MS) return null;
    return parsed.brief;
  } catch {
    return null;
  }
}

function cacheBrief(spaceId: string, brief: DailyBrief): void {
  try {
    sessionStorage.setItem(briefCacheKey(spaceId), JSON.stringify({ brief, at: Date.now() }));
  } catch {
    /* storage full/unavailable — non-blocking */
  }
}
