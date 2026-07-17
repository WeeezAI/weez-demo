// services/evaAPI.ts
//
// Eva — the AI Lead Analyst for Weez.
//
// Eva runs event-driven, ICP-first discovery: she tracks channels (job postings,
// funding, product launches, tech changes) + the research engine + the LinkedIn
// VM, captures who posted + the event, qualifies orgs/people against the per-ACV
// matrix, enriches them (email/website/event), and hands qualified leads to Max.
//
// Routes live under `${WEEZ_BASE_URL}/eva`. Demo/non-UUID spaces fall back to a
// local sample so the page is always explorable.

import CONFIG from "./config";

export const EVA_BASE_URL = `${CONFIG.WEEZ_BASE_URL}/eva`;

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ACVTier = "low" | "medium" | "high";
export type SignalType =
  | "job_posting"
  | "product_launch"
  | "tech_change"
  | "funding"
  | "leadership_hire"
  | "engagement";
export type EvaAction = "auto_sequence" | "queued_review" | "brief_only" | "ae_alert" | "monitor";
export type HandoffState = "pending_enrichment" | "enriched" | "handed_to_max" | "held";
export type LeadStatus = "new" | "qualified" | "handed" | "rejected";
export type EnrichmentStatus = "pending" | "enriched" | "partial" | "no_contact";
export type ScanStage = "starting" | "context" | "tracking" | "qualifying" | "enriching" | string;

// ─── Data objects (mirror core/eva/models.py) ─────────────────────────────────

export interface ChannelSignal {
  id: string;
  signalType: SignalType;
  company: string;
  detail: string;
  channel: string;
  person?: string;
  personRole?: string;
  url?: string;
  website?: string;
  fundingStage?: string;
  confidence: number;
  timestamp: string;
}

export interface TrackedEntity {
  id: string;
  company: string;
  entityType: "organization" | "person";
  domain: string;
  website: string;
  industry: string;
  employeeRange: string;
  hqLocation: string;
  signalIds: string[];
  firstSeen: string;
  lastSeen: string;
  acvTier: ACVTier | null;
  icpFit: number | null;
  qualified: boolean;
  leadId: string | null;
}

export interface LeadContact {
  name: string;
  role: string;
  email: string;
  emailSource?: string;
  emailConfidence?: number | null;
  emailVerified: boolean;
  linkedinUrl: string;
}

export interface QualifiedLead {
  id: string;
  entityId: string;
  company: string;
  domain: string;
  website: string;
  logoUrl?: string;
  industry: string;
  employeeRange: string;
  hqLocation: string;
  acvTier: ACVTier;
  icpFit: number;
  recommendedAction: EvaAction;
  escalation: string;
  qualificationReason: string;
  primaryEvent: string | null;
  eventType: SignalType | null;
  signals: ChannelSignal[];
  contact: LeadContact;
  enrichment: { website: string; status: EnrichmentStatus; notes?: string; enrichedAt?: string };
  handoffState: HandoffState;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelInfo {
  key: string;
  signalType: SignalType;
  displayName: string;
  live: boolean;
}

export interface EvaMetrics {
  channelsMonitored: number;
  signalsCaptured: number;
  signalsThisWeek: number;
  orgsTracked: number;
  qualifiedLeads: number;
  enrichedLeads: number;
  emailsFound: number;
  handedToMax: number;
  byTier: Record<ACVTier, number>;
  bySignalType: Record<string, number>;
}

export interface EvaWorkspace {
  signals: ChannelSignal[];
  entities: TrackedEntity[];
  leads: QualifiedLead[];
  channels: ChannelInfo[];
  icp?: {
    brand_name: string;
    industry: string;
    segments: string[];
    personas: string[];
    value_prop: string;
  };
  last_scan_at?: string;
  metrics: EvaMetrics;
  isDemo?: boolean;
}

export interface EvaChatMessage {
  role: "user" | "eva";
  content: string;
}

// ─── Display metadata ─────────────────────────────────────────────────────────

export const SIGNAL_META: Record<SignalType, { label: string; tone: string }> = {
  job_posting: { label: "Job posting", tone: "sky" },
  product_launch: { label: "Product launch", tone: "cyan" },
  tech_change: { label: "Tech-stack change", tone: "amber" },
  funding: { label: "Funding", tone: "emerald" },
  leadership_hire: { label: "Leadership hire", tone: "violet" },
  engagement: { label: "Engagement", tone: "rose" },
};

export const ACTION_META: Record<EvaAction, { label: string; tone: string; desc: string }> = {
  auto_sequence: { label: "Auto-sequence", tone: "emerald", desc: "Auto-enrolled — Eva runs it, humans handle exceptions." },
  queued_review: { label: "Queued for SDR", tone: "amber", desc: "Drafted and queued for a human to review before send." },
  brief_only: { label: "Brief only", tone: "indigo", desc: "Logged to the account brief as context — not automated." },
  ae_alert: { label: "AE alert", tone: "rose", desc: "Active alert raised for AE/founder attention." },
  monitor: { label: "Monitoring", tone: "zinc", desc: "Tracked but not yet actioned." },
};

export const TIER_META: Record<ACVTier, { label: string; range: string; tone: string }> = {
  low: { label: "Low ACV", range: "$1K–$10K", tone: "cyan" },
  medium: { label: "Medium ACV", range: "$10K–$50K", tone: "violet" },
  high: { label: "High ACV", range: "$50K+", tone: "orange" },
};

export const ENRICHMENT_META: Record<EnrichmentStatus, { label: string; tone: string }> = {
  enriched: { label: "Email found", tone: "emerald" },
  partial: { label: "Contact, no email", tone: "amber" },
  no_contact: { label: "No contact yet", tone: "zinc" },
  pending: { label: "Enriching…", tone: "sky" },
};

// ─── Local demo workspace (non-UUID / demo spaces) ────────────────────────────

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface DemoLeadSeed {
  company: string;
  tier: ACVTier;
  industry: string;
  emp: string;
  hq: string;
  fit: number;
  action: EvaAction;
  event: SignalType;
  eventDetail: string;
  channel: string;
  reason: string;
  contact: { name: string; role: string; email: string; verified: boolean };
  enrich: EnrichmentStatus;
  handoff: HandoffState;
}

const DEMO_SEEDS: DemoLeadSeed[] = [
  {
    company: "Brightloop Labs", tier: "medium", industry: "B2B SaaS", emp: "201–500", hq: "Austin, TX",
    fit: 84, action: "queued_review", event: "funding", eventDetail: "Raised $18M Series B led by Accel",
    channel: "Funding news", reason: "Series B/C funding + ICP fit — researched message queued for SDR.",
    contact: { name: "Priya Patel", role: "Head of RevOps", email: "priya@brightloop.com", verified: true },
    enrich: "enriched", handoff: "handed_to_max",
  },
  {
    company: "Signalyn", tier: "low", industry: "B2B SaaS", emp: "11–50", hq: "Remote-first",
    fit: 66, action: "auto_sequence", event: "job_posting", eventDetail: "Open role: Growth Marketing Manager (Ashby)",
    channel: "Job boards", reason: "Job posting matched ICP keywords — auto-enroll in the templated 3-touch sequence.",
    contact: { name: "Dana Kim", role: "Growth Marketing Manager", email: "dana@signalyn.io", verified: true },
    enrich: "enriched", handoff: "enriched",
  },
  {
    company: "Corvex Systems", tier: "high", industry: "B2B SaaS", emp: "1001–5000", hq: "New York, NY",
    fit: 79, action: "ae_alert", event: "leadership_hire", eventDetail: "Announced a new Chief Revenue Officer",
    channel: "Exec-move tracker", reason: "Leadership hire at a target account — 60–90 day evaluation window. AE alert.",
    contact: { name: "Marcus Reyes", role: "Chief Revenue Officer", email: "", verified: false },
    enrich: "partial", handoff: "enriched",
  },
  {
    company: "Datamere", tier: "medium", industry: "B2B SaaS", emp: "501–1000", hq: "Denver, CO",
    fit: 76, action: "queued_review", event: "tech_change", eventDetail: "Migrated to Snowflake, dropping legacy BI",
    channel: "Tech-stack changes", reason: "Qualify first, then a comparison-angle message to the SDR queue.",
    contact: { name: "Omar Haddad", role: "Head of Data", email: "omar@datamere.com", verified: true },
    enrich: "enriched", handoff: "enriched",
  },
  {
    company: "Tidemark", tier: "low", industry: "B2B SaaS", emp: "51–200", hq: "Seattle, WA",
    fit: 61, action: "auto_sequence", event: "product_launch", eventDetail: "Launched a self-serve onboarding flow",
    channel: "Product launches", reason: "Product launch signals growth/greenfield — auto 'congrats + scale' sequence.",
    contact: { name: "Maya Silva", role: "Growth Lead", email: "maya@tidemark.app", verified: true },
    enrich: "enriched", handoff: "enriched",
  },
  {
    company: "Vantagely", tier: "high", industry: "B2B SaaS", emp: "5000+", hq: "London, UK",
    fit: 72, action: "brief_only", event: "product_launch", eventDetail: "Announced a new analytics platform",
    channel: "Product launches", reason: "Logged as account-narrative context to shape a POV — not a standalone message.",
    contact: { name: "Elena Rossi", role: "VP Product", email: "", verified: false },
    enrich: "no_contact", handoff: "enriched",
  },
];

function buildDemoWorkspace(): EvaWorkspace {
  const signals: ChannelSignal[] = [];
  const entities: TrackedEntity[] = [];
  const leads: QualifiedLead[] = [];

  DEMO_SEEDS.forEach((s, i) => {
    const sig: ChannelSignal = {
      id: `evs_${i}`, signalType: s.event, company: s.company, detail: s.eventDetail,
      channel: s.channel, confidence: 0.6, timestamp: isoDaysAgo(i % 5),
      website: `https://${s.company.toLowerCase().split(" ")[0]}.com`,
    };
    signals.push(sig);
    entities.push({
      id: `ent_${i}`, company: s.company, entityType: "organization",
      domain: `${s.company.toLowerCase().split(" ")[0]}.com`,
      website: sig.website!, industry: s.industry, employeeRange: s.emp, hqLocation: s.hq,
      signalIds: [sig.id], firstSeen: isoDaysAgo(9), lastSeen: isoDaysAgo(0),
      acvTier: s.tier, icpFit: s.fit, qualified: true, leadId: `lead_${i}`,
    });
    leads.push({
      id: `lead_${i}`, entityId: `ent_${i}`, company: s.company,
      domain: `${s.company.toLowerCase().split(" ")[0]}.com`, website: sig.website!,
      logoUrl: `https://logo.clearbit.com/${s.company.toLowerCase().split(" ")[0]}.com`,
      industry: s.industry, employeeRange: s.emp, hqLocation: s.hq,
      acvTier: s.tier, icpFit: s.fit, recommendedAction: s.action, escalation: "",
      qualificationReason: s.reason, primaryEvent: `[${s.event}] ${s.eventDetail}`, eventType: s.event,
      signals: [sig],
      contact: {
        name: s.contact.name, role: s.contact.role, email: s.contact.email,
        emailSource: s.contact.email ? "apollo" : "", emailConfidence: s.contact.email ? 0.9 : null,
        emailVerified: s.contact.verified, linkedinUrl: "",
      },
      enrichment: { website: sig.website!, status: s.enrich },
      handoffState: s.handoff, status: s.handoff === "handed_to_max" ? "handed" : "qualified",
      notes: "", createdAt: isoDaysAgo(i % 5), updatedAt: isoDaysAgo(0),
    });
  });

  const byTier = { low: 0, medium: 0, high: 0 } as Record<ACVTier, number>;
  leads.forEach((l) => (byTier[l.acvTier] += 1));
  const bySignalType: Record<string, number> = {};
  signals.forEach((s) => (bySignalType[s.signalType] = (bySignalType[s.signalType] || 0) + 1));

  return {
    signals,
    entities,
    leads,
    channels: [
      { key: "job_boards", signalType: "job_posting", displayName: "Job boards (Lever / Greenhouse / Ashby)", live: true },
      { key: "funding_news", signalType: "funding", displayName: "Funding news", live: true },
      { key: "product_launches", signalType: "product_launch", displayName: "Product launches / announcements", live: true },
      { key: "tech_change", signalType: "tech_change", displayName: "Tech-stack changes", live: true },
      { key: "research_engine", signalType: "engagement", displayName: "Research engine (web/events)", live: false },
      { key: "linkedin_vm", signalType: "engagement", displayName: "LinkedIn VM (engagement)", live: true },
    ],
    icp: {
      brand_name: "your workspace", industry: "B2B SaaS",
      segments: ["Mid-market SaaS", "Growth-stage SaaS"], personas: ["RevOps", "Growth", "Data"],
      value_prop: "unify GTM reporting into one decision view",
    },
    last_scan_at: isoDaysAgo(0),
    metrics: {
      channelsMonitored: 6, signalsCaptured: signals.length, signalsThisWeek: signals.length,
      orgsTracked: entities.length, qualifiedLeads: leads.length,
      enrichedLeads: leads.filter((l) => l.enrichment.status === "enriched").length,
      emailsFound: leads.filter((l) => l.contact.email).length,
      handedToMax: leads.filter((l) => l.handoffState === "handed_to_max").length,
      byTier, bySignalType,
    },
    isDemo: true,
  };
}

// ─── Backend transport ─────────────────────────────────────────────────────────

const isRealBrandId = (id?: string): id is string =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function evaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${EVA_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Eva backend error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* non-JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

interface WorkspaceResponse {
  status: "ready" | "scanning" | "error" | "unknown";
  workspace?: EvaWorkspace;
  error?: string;
  stage?: ScanStage;
}

async function pollForWorkspace(
  spaceId: string,
  onProgress?: (stage: ScanStage) => void,
  intervalMs = 3000,
  maxMs = 300000
): Promise<EvaWorkspace> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let s: WorkspaceResponse;
    try {
      s = await evaFetch<WorkspaceResponse>(`/workspace/status?brand_id=${encodeURIComponent(spaceId)}`);
    } catch {
      continue;
    }
    if (s.status === "ready" && s.workspace) return s.workspace;
    if (s.status === "error") throw new Error(s.error || "Eva couldn't complete the scan.");
    if (s.stage) onProgress?.(s.stage);
  }
  throw new Error("Eva is taking longer than usual to scan channels. Please try again.");
}

function workspaceContextString(ws: EvaWorkspace): string {
  const m = ws.metrics;
  const top = ws.leads
    .filter((l) => l.status !== "rejected")
    .slice(0, 6)
    .map((l) => `- ${l.company} (${l.acvTier} ACV, fit ${l.icpFit}, ${l.eventType}, ${l.recommendedAction})`)
    .join("\n");
  return [
    `Channels monitored: ${m.channelsMonitored}. Signals: ${m.signalsCaptured} (${m.signalsThisWeek} this week).`,
    `Orgs tracked: ${m.orgsTracked}. Qualified leads: ${m.qualifiedLeads} (low ${m.byTier.low} / med ${m.byTier.medium} / high ${m.byTier.high}).`,
    `Emails found: ${m.emailsFound}. Handed to Max: ${m.handedToMax}.`,
    `Top qualified leads:\n${top || "(none yet)"}`,
  ].join("\n");
}

export const evaAPI = {
  getWorkspace: async (
    spaceId: string,
    force = false,
    onProgress?: (stage: ScanStage) => void
  ): Promise<EvaWorkspace> => {
    if (isRealBrandId(spaceId)) {
      const start = await evaFetch<WorkspaceResponse>(
        `/workspace?brand_id=${encodeURIComponent(spaceId)}&force=${force}`
      );
      if (start.status === "ready" && start.workspace) return start.workspace;
      if (start.status === "error") throw new Error(start.error || "Eva couldn't scan channels.");
      onProgress?.(start.stage || "starting");
      return pollForWorkspace(spaceId, onProgress);
    }
    await new Promise((r) => setTimeout(r, 400));
    return buildDemoWorkspace();
  },

  scan: async (spaceId: string, onProgress?: (stage: ScanStage) => void): Promise<EvaWorkspace> => {
    if (isRealBrandId(spaceId)) {
      const start = await evaFetch<WorkspaceResponse>(
        `/scan?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST" }
      );
      onProgress?.(start.stage || "tracking");
      return pollForWorkspace(spaceId, onProgress);
    }
    await new Promise((r) => setTimeout(r, 700));
    return buildDemoWorkspace();
  },

  leadAction: async (
    spaceId: string | undefined,
    leadId: string,
    action: "hand_to_max" | "reject" | "reset"
  ): Promise<QualifiedLead | null> => {
    if (!isRealBrandId(spaceId)) return null; // demo: page mutates locally
    try {
      const res = await evaFetch<{ updated: boolean; lead?: QualifiedLead }>(
        `/lead/action?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ lead_id: leadId, action }) }
      );
      return res.lead || null;
    } catch (e) {
      console.warn("[eva] lead action failed (non-blocking):", e);
      return null;
    }
  },

  chat: async (question: string, ws: EvaWorkspace, spaceId?: string): Promise<string> => {
    if (isRealBrandId(spaceId)) {
      try {
        const data = await evaFetch<{ response: string }>(
          `/chat?brand_id=${encodeURIComponent(spaceId)}`,
          { method: "POST", body: JSON.stringify({ message: question, workspace_context: workspaceContextString(ws) }) }
        );
        return data.response;
      } catch (e) {
        console.warn("[eva] chat failed, using local fallback:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    return evaReply(question, ws);
  },
};

export default evaAPI;

export const QUICK_PROMPTS = [
  "Why did this lead qualify?",
  "Which channel is producing the best leads?",
  "Show me the high-ACV alerts",
  "Which leads are ready for Max?",
  "Is this signal real intent or noise?",
];

/** Local guardrail-respecting responder for demo spaces (never fabricates). */
export function evaReply(question: string, ws: EvaWorkspace): string {
  const q = question.toLowerCase();
  const has = (...k: string[]) => k.some((x) => q.includes(x));
  const leads = ws.leads.filter((l) => l.status !== "rejected");
  const top = [...leads].sort((a, b) => b.icpFit - a.icpFit)[0];

  if (has("qualify", "why did", "qualified")) {
    if (!top) return "No qualified leads yet — I'm still scanning channels for your ICP.";
    return `**${top.company}** qualified as **${TIER_META[top.acvTier].label}** (ICP fit ${top.icpFit}). Trigger: a **${top.eventType}** event — "${top.primaryEvent}". ${top.qualificationReason} Routing: **${ACTION_META[top.recommendedAction].label}**.`;
  }
  if (has("channel", "best", "producing", "source")) {
    const counts = ws.metrics.bySignalType;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return "No channel data yet.";
    return `Signal volume by channel right now: ${ranked.map(([t, n]) => `${SIGNAL_META[t as SignalType]?.label || t} (${n})`).join(", ")}. I weight funding, leadership hires and repeat engagement highest for intent.`;
  }
  if (has("high", "alert", "ae")) {
    const alerts = leads.filter((l) => l.recommendedAction === "ae_alert");
    if (!alerts.length) return "No active AE alerts right now — high-ACV signals are logged to the brief until a leadership hire, major funding or M&A fires.";
    return `**${alerts.length} AE alert(s)**:\n${alerts.map((l) => `- ${l.company} — ${l.primaryEvent}`).join("\n")}`;
  }
  if (has("ready for max", "hand", "max")) {
    const ready = leads.filter((l) => ["enriched", "handed_to_max"].includes(l.handoffState));
    return `${ready.length} lead(s) are enriched and ready for Max${ready.length ? ": " + ready.slice(0, 5).map((l) => l.company).join(", ") : ""}. Max crawls their site and writes the personalized email.`;
  }
  if (has("noise", "real intent", "signal")) {
    return "A signal is real intent only if it maps to a persona-relevant change AND clears the ACV fit bar. A single weak signal is a hypothesis — I grade it as such and route it conservatively (monitor/brief) rather than blasting outreach.";
  }
  return `I'm Eva, your lead analyst. I'm monitoring ${ws.metrics.channelsMonitored} channels, tracking ${ws.metrics.orgsTracked} orgs, with ${ws.metrics.qualifiedLeads} qualified leads and ${ws.metrics.emailsFound} emails found. Ask me "why did this lead qualify?", "which channel is best?", "show the high-ACV alerts", or "which leads are ready for Max?".`;
}
