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
/**
 * The ACV tier is derived from EVIDENCE about the company (a known employee band,
 * the classified size estimate, else the funding stage). When there is none, the
 * backend says so with "unknown" rather than labelling the row MEDIUM by default,
 * and the UI renders that as "—".
 */
export type ACVTierOrUnknown = ACVTier | "unknown";
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
  /** Where the industry came from: the company's own evidence, or nothing. */
  industrySource?: "company_evidence" | "unknown";
  employeeRange: string;
  companyStage?: string;
  employeeEstimate?: { band?: string; confidence?: number } | null;
  hqLocation: string;
  signalIds: string[];
  firstSeen: string;
  lastSeen: string;
  acvTier: ACVTierOrUnknown | null;
  /** Which evidence set the tier: employee_band | employee_estimate | stage | unknown. */
  tierBasis?: string;
  icpFit: number | null;
  qualified: boolean;
  leadId: string | null;
  /** A confirmed company: own domain, and a name that isn't an article headline. */
  identityVerified?: boolean;
  /** False = contact enrichment is refused server-side, so it isn't offered. */
  enrichable?: boolean;
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
  industrySource?: "company_evidence" | "unknown";
  employeeRange: string;
  companyStage?: string;
  employeeEstimate?: { band?: string; confidence?: number } | null;
  hqLocation: string;
  acvTier: ACVTier;
  tierBasis?: string;
  /** A confirmed company: own domain, and a name that isn't an article headline. */
  identityVerified?: boolean;
  /**
   * False = this record has no confirmed company identity, so enrichment is
   * refused server-side ("unresolved_company") and the control is not offered.
   */
  enrichable?: boolean;
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

  /**
   * The `sales_leads.id` this lead was promoted to, or absent when it never was.
   *
   * **The one reliable marker that Enrich Now was clicked.** `lead_promotion.promote()`
   * runs in exactly one place — the `/eva/lead/enrich` route — and it is the only thing
   * that creates the SQL row; the id is written back onto this document by
   * `service.record_gtm_lead_id()`.
   *
   * It is also what makes a lead *workable* on the GTM surfaces. Eva's ids are
   * `lead_<hex>` strings and every GTM route keys on `sales_leads.id`, so a lead without
   * this has no GTM identity at all: it cannot be tracked, cannot be activated, and
   * cannot be ranked. See `isEnrichedProspect`.
   */
  gtmLeadId?: string | null;
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
  /** Tracked companies that haven't qualified yet (leads-in-progress). */
  potentialLeads: number;
  qualifiedLeads: number;
  enrichedLeads: number;
  emailsFound: number;
  handedToMax: number;
  byTier: Record<ACVTier, number>;
  bySignalType: Record<string, number>;
}

/**
 * A company Eva has discovered and is tracking, but that hasn't qualified yet.
 *
 * Every qualified lead starts here. Qualification needs a strong enough signal for
 * the account's ACV tier (an early-stage funding round at a mid-ACV account, for
 * example, is tracked rather than actioned), so this list is where a founder sees
 * discovery working immediately after a campaign goes live.
 */
export interface PotentialLead {
  id: string;
  company: string;
  domain: string;
  website: string;
  logoUrl?: string;
  industry: string;
  employeeRange: string;
  hqLocation: string;
  icpFit: number | null;
  acvTier: ACVTierOrUnknown | null;
  icpSimilarity?: number | null;
  /**
   * "tracked" = cleared ICP selection; "potential" = still gathering evidence;
   * "below_icp_floor" / "unevaluated" = tracked but gated out of qualification.
   */
  trackingState: "tracked" | "potential" | "below_icp_floor" | "unevaluated" | string;
  /** Why it hasn't qualified yet. */
  reason: string;
  signalCount: number;
  topSignalType: SignalType | null;
  topSignal: string;
  channel: string;
  url: string;
  /** Owned pages (careers / changelog / newsroom) Eva is monitoring. */
  sourceCount: number;
  firstSeen: string;
  lastSeen: string;
}

/** Health of the web-search layer behind the news-driven channels. */
export interface SearchHealth {
  degraded: boolean;
  providers: string[];
  queries: number;
  served: number;
  failures: number;
  consecutiveFailures: number;
  lastProvider?: string | null;
}

export interface EnrichmentUsage {
  used: number;
  limit: number;
  remaining: number;
  month: string;
}

/** One provider attempt in the enrichment waterfall. */
export interface WaterfallStep {
  stage: "resolve" | "identify" | "find_email" | "fallback" | "verify" | string;
  provider: string;
  outcome: "hit" | "miss" | "rejected" | "error" | "skipped" | "verified" | "unverified" | "unavailable" | string;
  detail: string;
}

/**
 * What Max did with a lead the moment its email was revealed.
 *   curating – ingested; Max is writing the personalized email now
 *   queued   – ingested, but there's no opportunity to curate yet
 *   skipped  – no email, so there's nothing to send
 */
export interface MaxHandoff {
  status: "curating" | "already_curated" | "queued" | "skipped" | "error" | "scheduled";
  company?: string;
  accountId?: string | null;
  opportunityId?: string | null;
  reason?: string;
}

/**
 * What Enrich Now cost, and what the workspace has left.
 *
 * Enrich Now is priced at 1 credit and the charge happens on this route, before the
 * provider waterfall runs — so a workspace that cannot afford it gets a `402` and no
 * provider is called.
 *
 * **Beside `EnrichmentUsage`, never inside it.** Those are two different limits with two
 * different remedies: `usage` is the per-brand monthly cap on enrichment *attempts* and
 * you wait for the month to roll over, while this is a purchased balance and you top up.
 * Collapsing them would tell the operator to do the wrong thing.
 *
 * `charged` is false on a repeat click for the same lead — already billed, nothing moved.
 *
 * Note the casing: `balanceAfter` is camelCase here because Eva's router speaks camelCase
 * throughout (`gtmLeadId`, `maxHandoff`), where the GTM router speaks snake_case. Each
 * response follows its own router rather than introducing a third convention.
 */
export interface EnrichCredit {
  reason: "ENRICH";
  credits: number;
  balanceAfter: number;
  charged: boolean;
}

export interface EnrichLeadResult {
  /**
   * ``unresolved_company`` = the record has no confirmed company identity, so the
   * request was refused before any provider was touched and no credit was spent.
   */
  status: "enriched" | "no_email" | "unresolved_company" | "limit_reached" | "not_found";
  /** Set on a refusal: what the record is missing. */
  reason?: string;
  found?: boolean;
  email?: string;
  /** True only when a verifier confirmed the address is deliverable. */
  verified?: boolean;
  /**
   * Whether an enrichment attempt was actually consumed on this call.
   *
   * False on every early return — the lead already had an email on file, the company is
   * unresolved, the monthly cap is reached — and those are the cases that spend nothing.
   * It is the same flag the monthly cap counts on and the same flag the credit charge keys
   * on, so a paid action and a capped action cannot disagree about what an attempt is.
   */
  attempted?: boolean;
  /** Per-provider trace, so a miss can be explained rather than guessed at. */
  waterfall?: WaterfallStep[];
  providersTried?: string[];
  /** Set when the reveal handed the lead straight to Max. */
  maxHandoff?: MaxHandoff | null;
  lead?: QualifiedLead;
  usage?: EnrichmentUsage;
  /**
   * What this enrichment cost. `null` when nothing was charged — a refusal, or an email
   * that was already on file — which is a different statement from a charge of zero and is
   * why it is not one.
   */
  credit?: EnrichCredit | null;
  /** The `sales_leads.id` the promotion landed on: the id every GTM route keys on. */
  gtmLeadId?: string | null;
}

export interface EvaWorkspace {
  signals: ChannelSignal[];
  entities: TrackedEntity[];
  leads: QualifiedLead[];
  potentialLeads: PotentialLead[];
  channels: ChannelInfo[];
  searchHealth?: SearchHealth;
  icp?: {
    brand_name: string;
    industry: string;
    segments: string[];
    personas: string[];
    value_prop: string;
  };
  last_scan_at?: string;
  metrics: EvaMetrics;
  enrichmentUsage?: EnrichmentUsage;
  /** "running" = Eva is still sweeping and this workspace is still filling in. */
  sweepState?: SweepState;
  isDemo?: boolean;
}

export type SweepState = "running" | "complete";

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

/** What an unknown tier looks like: a stated gap, never a default band. */
export const UNKNOWN_TIER_META = { label: "—", range: "ACV unknown", tone: "zinc" };

/**
 * Tier metadata that never returns undefined. A tier can be "unknown" (no size and
 * no stage evidence yet) or missing entirely on an older stored row, and indexing
 * TIER_META directly with either one crashes the row it renders.
 */
export function tierMeta(tier?: ACVTierOrUnknown | null): { label: string; range: string; tone: string } {
  return (tier && TIER_META[tier as ACVTier]) || UNKNOWN_TIER_META;
}

/**
 * Whether this lead has been through Enrich Now, and therefore belongs on the GTM
 * surfaces.
 *
 * **Why `gtmLeadId` and not `enrichment.status`.** The status field looks like the obvious
 * answer and is not: `service.py`'s workspace sweep sets it to `"enriched"` for any lead
 * that *arrives* carrying a contact email — from the LinkedIn VM or the research engine —
 * with no Enrich Now click and no promotion. Filtering on it would put leads on Prospect
 * Intelligence that have no `sales_leads` row, where every control would 404.
 *
 * `handoffState` fails for the same reason: the same sweep moves it to `"handed_to_max"`.
 *
 * `gtmLeadId` is written by exactly one code path, and it is the id every GTM route needs.
 * So this predicate answers both questions at once — "did the operator enrich this" and
 * "can this prospect actually be worked on here" — and they have the same answer by
 * construction.
 *
 * One known gap, worth knowing rather than working around: `record_gtm_lead_id()` is
 * best-effort, so a Cosmos hiccup can leave a promoted lead without its back-reference and
 * it would not appear. Re-clicking Enrich Now repairs it and costs nothing — the credit
 * charge is keyed on the lead, so a second click is not billed.
 */
export function isEnrichedProspect(lead: QualifiedLead): boolean {
  return typeof lead.gtmLeadId === "string" && lead.gtmLeadId.trim().length > 0;
}

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
      // A promoted id for the seeds that carry an email, so the demo workspace shows the
      // same split a live one does: Prospect Intelligence lists the enriched prospects and
      // Revenue Intelligence lists everything discovered. Without this the demo would show
      // an empty Prospect Intelligence, which is *truthful* about the fixture and useless
      // as a demo — the seeds that have an email are standing in for leads somebody
      // enriched, so they carry the id an enrichment would have written.
      gtmLeadId: s.contact.email ? `demo-gtm-${i}` : null,
      notes: "", createdAt: isoDaysAgo(i % 5), updatedAt: isoDaysAgo(0),
    });
  });

  // Tracked-but-not-yet-qualified companies, so the demo shows the same
  // discovery-in-progress pipeline a live workspace does. These are real entities
  // in the backend too — they just haven't cleared the qualification bar.
  const DEMO_POTENTIAL: {
    company: string; industry: string; emp: string; hq: string; fit: number;
    tier: ACVTier; event: SignalType; detail: string; channel: string; reason: string;
    state: "tracked" | "potential"; sources: number;
  }[] = [
    {
      company: "Northbeam Labs", industry: "B2B SaaS", emp: "51–200", hq: "Austin, TX", fit: 68,
      tier: "medium", event: "funding", detail: "Northbeam Labs raises $4M seed round",
      channel: "Funding news", state: "tracked", sources: 3,
      reason: "Early-stage funding at a mid-ACV account — monitoring for a stronger trigger.",
    },
    {
      company: "Cadence Data", industry: "Data / Analytics", emp: "11–50", hq: "Remote", fit: 61,
      tier: "low", event: "product_launch", detail: "Product update: usage-based billing now GA",
      channel: "Company changelogs (product updates)", state: "tracked", sources: 2,
      reason: "Launch noted from their changelog — waiting on a persona-relevant hire or tech change.",
    },
    {
      company: "Vessel HQ", industry: "Martech", emp: "", hq: "London, UK", fit: 52,
      tier: "low", event: "job_posting", detail: "Hiring: Growth Marketing Manager",
      channel: "Company careers pages (first-party jobs)", state: "potential", sources: 1,
      reason: "Firmographics still thin — Eva is gathering more evidence before qualifying.",
    },
  ];

  const potentialLeads: PotentialLead[] = DEMO_POTENTIAL.map((p, i) => {
    const domain = `${p.company.toLowerCase().split(" ")[0]}.com`;
    const sig: ChannelSignal = {
      id: `evs_p_${i}`, signalType: p.event, company: p.company, detail: p.detail,
      channel: p.channel, confidence: 0.6, timestamp: isoDaysAgo(i % 3),
      website: `https://${domain}`,
    };
    signals.push(sig);
    entities.push({
      id: `ent_p_${i}`, company: p.company, entityType: "organization", domain,
      website: sig.website!, industry: p.industry, employeeRange: p.emp, hqLocation: p.hq,
      signalIds: [sig.id], firstSeen: isoDaysAgo(4), lastSeen: isoDaysAgo(0),
      acvTier: p.tier, icpFit: p.fit, qualified: false, leadId: null,
    });
    return {
      id: `ent_p_${i}`, company: p.company, domain, website: sig.website!,
      logoUrl: `https://logo.clearbit.com/${domain}`,
      industry: p.industry, employeeRange: p.emp, hqLocation: p.hq,
      icpFit: p.fit, acvTier: p.tier, icpSimilarity: p.fit - 4,
      trackingState: p.state, reason: p.reason, signalCount: 1,
      topSignalType: p.event, topSignal: `[${p.event}] ${p.detail}`,
      channel: p.channel, url: "", sourceCount: p.sources,
      firstSeen: isoDaysAgo(4), lastSeen: isoDaysAgo(0),
    };
  });

  const byTier = { low: 0, medium: 0, high: 0 } as Record<ACVTier, number>;
  leads.forEach((l) => (byTier[l.acvTier] += 1));
  const bySignalType: Record<string, number> = {};
  signals.forEach((s) => (bySignalType[s.signalType] = (bySignalType[s.signalType] || 0) + 1));

  return {
    signals,
    entities,
    leads,
    potentialLeads,
    channels: [
      { key: "linkedin_jobs", signalType: "job_posting", displayName: "LinkedIn Jobs (hiring signals)", live: true },
      { key: "job_boards", signalType: "job_posting", displayName: "Job boards (Lever / Greenhouse / Ashby)", live: true },
      { key: "funding_news", signalType: "funding", displayName: "Funding news", live: true },
      { key: "product_launches", signalType: "product_launch", displayName: "Product launches / announcements", live: true },
      { key: "tech_change", signalType: "tech_change", displayName: "Tech-stack changes", live: true },
      { key: "owned_careers", signalType: "job_posting", displayName: "Company careers pages (first-party jobs)", live: true },
      { key: "owned_changelog", signalType: "product_launch", displayName: "Company changelogs (product updates)", live: true },
      { key: "owned_newsroom", signalType: "funding", displayName: "Company newsroom / blog (funding + announcements)", live: true },
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
      channelsMonitored: 10, signalsCaptured: signals.length, signalsThisWeek: signals.length,
      orgsTracked: entities.length, potentialLeads: potentialLeads.length,
      qualifiedLeads: leads.length,
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

/**
 * A failed Eva request, with the status it failed on.
 *
 * The counterpart of `gtmAPI`'s `GtmApiError`, and here for the same reason: Enrich Now is
 * a priced action, so this router can answer `402 Payment Required`, and a paywall must not
 * render as "something went wrong". The operator's next step is to top up, not to retry.
 *
 * Still an `Error` with the same `message`, so every existing `catch` that reads
 * `err.message` is unaffected.
 */
export class EvaApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EvaApiError";
    this.status = status;
    // Needed for `instanceof` to survive the ES5 target's class downleveling.
    Object.setPrototypeOf(this, EvaApiError.prototype);
  }
}

/** Whether this failure was the workspace being unable to afford the action (402). */
export function isInsufficientCredits(error: unknown): boolean {
  return error instanceof EvaApiError && error.status === 402;
}

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
    throw new EvaApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

interface WorkspaceResponse {
  status: "ready" | "scanning" | "error" | "unknown";
  /**
   * Whether Eva's channel sweep is still in flight. Eva publishes a fast-ready
   * workspace (status "ready" carrying the PREVIOUS results) before the sweep runs
   * so the page paints instantly — so "ready" alone doesn't mean a scan finished.
   */
  sweepState?: SweepState;
  workspace?: EvaWorkspace;
  error?: string;
  stage?: ScanStage;
}

// A minimal, valid empty workspace for a REAL brand. Returned (instead of
// throwing) whenever Eva is still warming up / a scan is slow, so the page shows
// the friendly "Eva is discovering your accounts" state and keeps refreshing —
// never a hard error screen.
function emptyWorkspace(): EvaWorkspace {
  return {
    signals: [],
    entities: [],
    leads: [],
    potentialLeads: [],
    channels: [],
    metrics: {
      channelsMonitored: 0,
      signalsCaptured: 0,
      signalsThisWeek: 0,
      orgsTracked: 0,
      potentialLeads: 0,
      qualifiedLeads: 0,
      enrichedLeads: 0,
      emailsFound: 0,
      handedToMax: 0,
      byTier: { low: 0, medium: 0, high: 0 },
      bySignalType: {},
    },
    isDemo: false,
  };
}

interface PollOptions {
  onProgress?: (stage: ScanStage) => void;
  /** Called every time the poll sees a newer workspace, so results stream in. */
  onWorkspace?: (ws: EvaWorkspace) => void;
  /**
   * Wait for the channel sweep to actually FINISH rather than accepting the
   * fast-ready snapshot. Used by "Scan channels": without this the poll returned
   * the pre-sweep workspace within ~3s, so the button looked like it did nothing.
   */
  requireComplete?: boolean;
  intervalMs?: number;
  maxMs?: number;
}

async function pollForWorkspace(spaceId: string, opts: PollOptions = {}): Promise<EvaWorkspace> {
  const { onProgress, onWorkspace, requireComplete = false, intervalMs = 3000, maxMs = 90000 } = opts;
  const deadline = Date.now() + maxMs;
  // Remember the freshest workspace we've seen. On a timeout or a mid-scan error we
  // return THIS rather than an empty one — replacing a populated board with zeros
  // made a slow-but-healthy scan look like a wipe.
  let latest: EvaWorkspace | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let s: WorkspaceResponse;
    try {
      s = await evaFetch<WorkspaceResponse>(`/workspace/status?brand_id=${encodeURIComponent(spaceId)}`);
    } catch {
      continue;
    }

    if (s.workspace) {
      latest = s.workspace;
      onWorkspace?.(s.workspace); // stream partial results into the page
    }

    const sweeping = (s.sweepState ?? s.workspace?.sweepState) === "running";
    if (s.status === "ready" && s.workspace && !(requireComplete && sweeping)) {
      return s.workspace;
    }
    // A scan hiccup shouldn't dump the founder on an error screen — Eva keeps
    // scanning in the background. Keep whatever we last saw.
    if (s.status === "error") return latest ?? emptyWorkspace();
    if (s.stage) onProgress?.(s.stage);
  }

  // Slow sweep (throttled channel calls + first-party page fetches). Don't error
  // and don't blank the board — serve the latest snapshot; the page keeps refreshing.
  return latest ?? emptyWorkspace();
}

function workspaceContextString(ws: EvaWorkspace): string {
  const m = ws.metrics;
  const top = ws.leads
    .filter((l) => l.status !== "rejected")
    .slice(0, 6)
    .map((l) => `- ${l.company} (${l.acvTier} ACV, fit ${l.icpFit}, ${l.eventType}, ${l.recommendedAction})`)
    .join("\n");
  const potential = (ws.potentialLeads || [])
    .slice(0, 6)
    .map((p) => `- ${p.company} (fit ${p.icpFit ?? "?"}, ${p.topSignalType || "no signal"}) — ${p.reason}`)
    .join("\n");
  return [
    `Channels monitored: ${m.channelsMonitored}. Signals: ${m.signalsCaptured} (${m.signalsThisWeek} this week).`,
    `Orgs tracked: ${m.orgsTracked}. Qualified leads: ${m.qualifiedLeads} (low ${m.byTier.low} / med ${m.byTier.medium} / high ${m.byTier.high}).`,
    `Potential leads (tracked, not yet qualified): ${m.potentialLeads ?? 0}.`,
    `Emails found: ${m.emailsFound}. Handed to Max: ${m.handedToMax}.`,
    `Top qualified leads:\n${top || "(none yet)"}`,
    `Potential leads and what they're waiting on:\n${potential || "(none yet)"}`,
  ].join("\n");
}

export const evaAPI = {
  getWorkspace: async (
    spaceId: string,
    force = false,
    onProgress?: (stage: ScanStage) => void,
    onWorkspace?: (ws: EvaWorkspace) => void
  ): Promise<EvaWorkspace> => {
    if (isRealBrandId(spaceId)) {
      let start: WorkspaceResponse;
      try {
        start = await evaFetch<WorkspaceResponse>(
          `/workspace?brand_id=${encodeURIComponent(spaceId)}&force=${force}`
        );
      } catch {
        // Transient start hiccup — show the discovering state and let the page
        // auto-refresh rather than hard-failing.
        return emptyWorkspace();
      }
      // Page load stays FAST: the fast-ready snapshot is good enough to paint, and
      // the page keeps auto-refreshing as the sweep fills it in.
      if (start.status === "ready" && start.workspace) return start.workspace;
      // Never hard-error on a warming/erroring scan — degrade to discovering.
      if (start.status === "error") return emptyWorkspace();
      onProgress?.(start.stage || "starting");
      return pollForWorkspace(spaceId, { onProgress, onWorkspace });
    }
    await new Promise((r) => setTimeout(r, 400));
    return buildDemoWorkspace();
  },

  /**
   * "Scan channels" — force a fresh sweep across every channel.
   *
   * Unlike a page load this WAITS for the sweep to complete (requireComplete), so
   * the button reflects real work instead of handing back the pre-sweep snapshot.
   * Results stream in through `onWorkspace` while it runs, and the window is
   * generous because a sweep also fetches first-party careers/changelog/newsroom
   * pages.
   */
  scan: async (
    spaceId: string,
    onProgress?: (stage: ScanStage) => void,
    onWorkspace?: (ws: EvaWorkspace) => void
  ): Promise<EvaWorkspace> => {
    if (isRealBrandId(spaceId)) {
      const start = await evaFetch<WorkspaceResponse>(
        `/scan?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST" }
      );
      onProgress?.(start.stage || "tracking");
      return pollForWorkspace(spaceId, {
        onProgress,
        onWorkspace,
        requireComplete: true,
        maxMs: 240000,
      });
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

  // On-demand enrichment ("Show Email"): resolve the lead's email via the
  // Apollo → Hunter → PDL waterfall. Counts against the monthly cap; only
  // enriched leads are handed to Max. Demo spaces already show emails, so this
  // is a no-op there.
  enrichLead: async (spaceId: string | undefined, leadId: string): Promise<EnrichLeadResult> => {
    // Demo spaces aren't linked to a real brand, so there's no provider to query
    // and nothing to fabricate. Report it as "no email" rather than a contradictory
    // "enriched but not found".
    if (!isRealBrandId(spaceId)) return { status: "no_email", found: false };
    return evaFetch<EnrichLeadResult>(`/lead/enrich?brand_id=${encodeURIComponent(spaceId)}`, {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId }),
    });
  },

  getEnrichmentUsage: async (spaceId: string | undefined): Promise<EnrichmentUsage | null> => {
    if (!isRealBrandId(spaceId)) return null;
    try {
      return await evaFetch<EnrichmentUsage>(`/enrichment/usage?brand_id=${encodeURIComponent(spaceId)}`);
    } catch {
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
