// services/maxAPI.ts
//
// Max — the AI Outbound, Relationship-Intelligence & Meeting-Generation
// specialist for Weez.
//
// This module owns the typed data model + transport for Max's page. Max's
// backend monitors many event sources and tracks accounts across them; the
// routes live under `${WEEZ_BASE_URL}/max`. Every public function is async and
// shaped like the real backend contract. For demo / non-UUID spaces it falls
// back to a rich local mock so the page is always explorable.

import CONFIG from "./config";

export const MAX_BASE_URL = `${CONFIG.WEEZ_BASE_URL}/max`;

// ─── Core enums ────────────────────────────────────────────────────────────────

export type ACVTier = "low" | "medium" | "high";
export type ACVMode = "monitoring" | "queue" | "account-intelligence";
export type ConfidenceLabel = "established" | "emerging" | "hypothesis";
export type RecommendedAction = "auto_send" | "queued_review" | "brief_only" | "ae_alert";
export type ApprovalState = "pending" | "approved" | "sent" | "skipped" | "snoozed";
export type AccountStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "qualified"
  | "meeting"
  | "archived";
export type SignalType =
  | "job_posting"
  | "leadership_hire"
  | "funding"
  | "product_launch"
  | "tech_stack"
  | "engagement"
  | "partnership"
  | "compliance";

// ─── Data objects (mirror core/max/models.py) ───────────────────────────────────

export interface SignalEvent {
  id: string;
  signalType: SignalType;
  source: string;
  detail: string;
  company: string;
  timestamp: string;
  confidence: number; // 0–1
  relevantPersonas: string[];
  implication: string;
  actionabilityByTier: Record<ACVTier, string>;
}

export interface SignalBundleItem {
  type: SignalType;
  label: string;
  detail: string;
  recency: string;
  confidence: number;
  source: string;
}

export interface AccountRecord {
  id: string;
  company: string;
  domain: string;
  industry: string;
  segment: string;
  employeeRange: string;
  hqLocation: string;
  acvTier: ACVTier;
  icpFit: number; // 0–100
  priority: number; // 0–100
  momentum: "accelerating" | "steady" | "quiet";
  activeSignalIds: string[];
  signalBundle: SignalBundleItem[];
  whyNow: string;
  contactIds: string[];
  engagementHistory: unknown[];
  outboundHistory: unknown[];
  maxRecommendation: string;
  confidenceLabel: ConfidenceLabel;
  routedTo: "automation" | "sdr" | "ae";
  status: AccountStatus;
  logoSeed: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRecord {
  id: string;
  accountId: string;
  name: string;
  role: string;
  department: string;
  seniority: "executive" | "director" | "manager" | "ic";
  relevanceToUseCase: string;
  contactConfidence: number; // 0–1
  entryPointType: "entry" | "decision_maker" | "influencer";
  preferredAngle: string;
  touchHistory: unknown[];
  linkedinHint: string;
  relationshipStatus: string;
  email?: string;             // enriched contact email (Eva)
  emailVerified?: boolean;
  headline?: string;
}

export interface OutboundOpportunity {
  id: string;
  accountId: string;
  contactId: string | null;
  acvTier: ACVTier;
  whyNow: string;
  signalBundle: SignalBundleItem[];
  fitScore: number;
  confidenceLabel: ConfidenceLabel;
  recommendedAction: RecommendedAction;
  subject: string;
  draft: string;
  ctaDraft: string;
  ctaReady: boolean;
  approvalState: ApprovalState;
  touchNumber: number;
  channel: string;
  createdAt: string;
  snoozedUntil: string | null;
  notes: string;
  angle?: string;
  recommendedContactId?: string | null;
  draftSource?: string; // "template" | "llm" | "pipeline"
  // ── Who + where to send (resolved from the enriched contact) ──
  recipientName?: string;
  recipientEmail?: string;
  recipientEmailVerified?: boolean;
  // ── Multi-stage reasoning + lifecycle (surfaced whole from the backend) ──
  subjectAlternatives?: string[];
  reasoning?: ReasoningArtifact | null;
  qualityReview?: QualityReview | null;
  disposition?: ApprovalDisposition | null;
  tracking?: OutboundTracking | null;
}

// ─── Multi-stage reasoning artifacts (mirror core/max/pipeline.py) ───────────────
// Max is an outbound strategist, not an email generator: every email is the
// output of an explicit reasoning chain, each stage emitting structured JSON.

export interface ReasoningStageSummary {
  id:
    | "research"
    | "problem"
    | "solution"
    | "strategy"
    | "generation"
    | "review"
    | "approval"
    | string;
  label: string;
  status: "complete" | "skipped" | string;
  headline: string;
}

export interface WebsiteIntelligence {
  businessSummary?: string;
  icp?: string;
  positioning?: string;
  currentMessaging?: string;
  productCategory?: string;
  productMaturity?: string;
  likelyGtmMotion?: string;
  growthSignals?: string[];
  uniqueSellingPoints?: string[];
  currentMarketingAngle?: string;
  observed?: string[];
  inferred?: string[];
  confidence?: ConfidenceLabel | string;
  gaps?: string;
}

export interface ProblemInference {
  observedEvidence?: string[];
  possibleProblems?: { problem: string; confidence: string; rationale: string }[];
  primaryProblem?: string;
  businessImpact?: string;
  confidence?: ConfidenceLabel | string;
}

export interface SolutionMapping {
  mappings?: { problem: string; capability: string; expectedOutcome: string; strength: number }[];
  strongestAngle?: string;
  rationale?: string;
  relevanceConfidence?: ConfidenceLabel | string;
}

export interface EmailStrategyPlan {
  conversationGoal?: string;
  focus?: string[];
  openingAngle?: string;
  primaryPain?: string;
  secondaryPain?: string;
  productMapping?: string;
  personalization?: string;
  trustBuilder?: string;
  socialProofDirection?: string;
  ctaType?: string;
  meetingGoal?: string;
  avoid?: string[];
  riskLevel?: string;
  confidence?: ConfidenceLabel | string;
}

export interface GeneratedEmail {
  subject?: string;
  subjectAlternatives?: string[];
  body?: string;
  cta?: string;
  ctaReady?: boolean;
  angle?: string;
  whyNow?: string;
  confidenceLabel?: ConfidenceLabel;
}

export interface QualityReview {
  scores?: {
    personalization: number;
    clarity: number;
    relevance: number;
    trust: number;
    humanTone: number;
    meetingProbability: number;
  };
  overall?: number;
  hasRealObservation?: boolean;
  personalizationAuthentic?: boolean;
  soundsAiGenerated?: boolean;
  connectsProblemToSolution?: boolean;
  leadsToConversation?: boolean;
  wouldSend?: boolean;
  issues?: string[];
  improvementHints?: string[];
}

export type DispositionDecision = "auto_send" | "queue_for_approval" | string;

export interface ApprovalDisposition {
  decision?: DispositionDecision;
  mode?: "autopilot" | "approval" | string;
  reason?: string;
  qualityOk?: boolean;
  confidenceOk?: boolean;
  mailboxOk?: boolean;
  overall?: number;
}

export interface ReasoningArtifact {
  research?: WebsiteIntelligence;
  problem?: ProblemInference;
  solution?: SolutionMapping;
  strategy?: EmailStrategyPlan;
  email?: GeneratedEmail;
  review?: QualityReview;
  disposition?: ApprovalDisposition;
  stages?: ReasoningStageSummary[];
  regenerated?: boolean;
  generatedAt?: string;
}

export interface OutboundTracking {
  status: string; // not_sent | queued | sent | delivered | opened | clicked | replied | meeting_booked | bounced | no_reply
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  repliedAt?: string | null;
  meetingBooked?: boolean;
  bounced?: boolean;
  outcome?: string;
  history?: { event: string; at: string; note?: string }[];
}

export interface CommitteeMember {
  name: string;
  role: string;
  department: string;
  influence: "high" | "medium" | "low";
  relationshipState: string;
  touchStatus: string;
  entryPointType: string;
}

export interface TimelineEvent {
  date: string;
  type: SignalType;
  detail: string;
  interpretation: string;
}

export interface JournalNote {
  note: string;
  at: string;
  author: string;
}

export interface AccountBrief {
  accountId: string;
  company: string;
  narrative: string;
  buyingCommittee: CommitteeMember[];
  signalTimeline: TimelineEvent[];
  recommendedAngle: string;
  angleConfidence: ConfidenceLabel;
  angleRationale: string;
  recommendedNextAction: string;
  signalInterpretation: string[];
  whyNotNow: string;
  journal: JournalNote[];
  generatedAt: string;
}

export interface LearningInsight {
  id: string;
  pattern: string;
  segment: string;
  tier: string;
  evidence: string;
  confidenceLabel: ConfidenceLabel;
  recommendedChange: string;
  createdAt: string;
}

export interface MaxMetrics {
  accountsMonitored: number;
  accountsQueued: number;
  accountsActive: number;
  meetingsBooked: number;
  repliesAwaiting: number;
  activeSignalsThisWeek: number;
  autoSent: number;
  replyRate: number;
  bounceRate: number;
  optOutRate: number;
  recommendedFocus: string;
  learnedThisWeek: string;
}

export interface SourceInfo {
  key: string;
  signalType: SignalType;
  displayName: string;
  live: boolean;
}

export interface EffortAllocation {
  low: number;
  medium: number;
  high: number;
  note: string;
}

export interface MaxWorkspace {
  acvTier: ACVTier;
  signals: SignalEvent[];
  accounts: AccountRecord[];
  contacts: ContactRecord[];
  opportunities: OutboundOpportunity[];
  briefs: Record<string, AccountBrief>;
  insights: LearningInsight[];
  effort?: EffortAllocation;
  sources?: SourceInfo[];
  icp?: {
    brand_name: string;
    industry: string;
    segments: string[];
    personas: string[];
    value_prop: string;
    has_evidence: boolean;
  };
  recommendedFocusByTier?: Record<ACVTier, string>;
  last_monitor_at?: string;
  metrics: MaxMetrics;
  outboundMode?: "autopilot" | "approval"; // autonomy lane: autopilot auto-sends, approval queues
  isDemo?: boolean;
  isSample?: boolean;            // backend synthetic sample feed (no real leads yet)
  reasoningInProgress?: boolean; // Max is personalizing the top opportunities in the background
}

export type MonitorStage =
  | "starting"
  | "context"
  | "scanning"
  | "qualifying"
  | "reasoning"
  | "drafting"
  | string;

export interface MaxChatMessage {
  role: "user" | "max";
  content: string;
}

// ─── Static tier configuration (mirrors core/max/prompts.py TIER_CONFIG) ─────────

export const TIER_CONFIG: Record<
  ACVTier,
  {
    label: string;
    range: string;
    mode: ACVMode;
    buyer: string;
    salesCycle: string;
    goal: string;
    mentalModel: string;
    contactsPerAccount: number;
    personalization: string;
    ctaDelay: string;
    autoSend: boolean;
    effortPrior: number;
    signalPrinciple: string;
  }
> = {
  low: {
    label: "Low ACV",
    range: "$1K–$10K",
    mode: "monitoring",
    buyer: "Individual / small team, self-serve mindset",
    salesCycle: "Days to 2 weeks",
    goal: "Turn many acceptable-fit signals into scaled outreach efficiently",
    mentalModel: "Trust the machine, only inspect exceptions.",
    contactsPerAccount: 1,
    personalization: "merge-field",
    ctaDelay: "1–2 days (often fixed)",
    autoSend: true,
    effortPrior: 17,
    signalPrinciple:
      "Signals can directly trigger action (auto-enroll). Humans only touch exceptions.",
  },
  medium: {
    label: "Medium ACV",
    range: "$10K–$50K",
    mode: "queue",
    buyer: "Manager / director + 1–2 influencers",
    salesCycle: "3–8 weeks",
    goal: "Produce qualified pipeline through researched, reviewable outreach",
    mentalModel: "Max researches and drafts. A human reviews and approves.",
    contactsPerAccount: 2,
    personalization: "semi-custom",
    ctaDelay: "3–5 days, engagement-influenced",
    autoSend: false,
    effortPrior: 38,
    signalPrinciple:
      "Signals create a reviewable opportunity, not an auto-send.",
  },
  high: {
    label: "High ACV",
    range: "$50K+",
    mode: "account-intelligence",
    buyer: "VP / C-level + buying committee",
    salesCycle: "2–6 months",
    goal: "Build account intelligence and trust for AE/founder-led execution",
    mentalModel: "Max is my research analyst; I decide the move.",
    contactsPerAccount: 4,
    personalization: "bespoke",
    ctaDelay: "1–3 weeks or only after meaningful engagement",
    autoSend: false,
    effortPrior: 50,
    signalPrinciple: "Signals become evidence inside the account brief; the CTA is earned.",
  },
};

export const SIGNAL_META: Record<SignalType, { label: string; tone: string }> = {
  job_posting: { label: "Job posting", tone: "sky" },
  leadership_hire: { label: "Leadership hire", tone: "violet" },
  funding: { label: "Funding", tone: "emerald" },
  product_launch: { label: "Product launch", tone: "cyan" },
  tech_stack: { label: "Tech-stack change", tone: "amber" },
  engagement: { label: "Engagement", tone: "rose" },
  partnership: { label: "Partnership", tone: "indigo" },
  compliance: { label: "Compliance", tone: "teal" },
};

export const CONFIDENCE_META: Record<ConfidenceLabel, { label: string; tone: string }> = {
  established: { label: "Established", tone: "emerald" },
  emerging: { label: "Emerging pattern", tone: "amber" },
  hypothesis: { label: "Hypothesis", tone: "zinc" },
};

export const ACTION_META: Record<RecommendedAction, { label: string; tone: string }> = {
  auto_send: { label: "Auto-send", tone: "emerald" },
  queued_review: { label: "Queued for review", tone: "amber" },
  brief_only: { label: "Brief only", tone: "indigo" },
  ae_alert: { label: "AE alert", tone: "rose" },
};

// ─── Local demo workspace (only for non-UUID / demo spaces) ──────────────────────
// A deterministic sample so the page is fully explorable without a real brand.
// Real spaces always hit the live monitoring backend.

interface DemoSeed {
  company: string;
  tier: ACVTier;
  segment: string;
  emp: string;
  hq: string;
  fit: number;
  priority: number;
  momentum: AccountRecord["momentum"];
  conf: ConfidenceLabel;
  signals: Array<{ type: SignalType; detail: string; source: string; days: number; conf: number }>;
  contact: { name: string; role: string; dept: string; seniority: ContactRecord["seniority"]; entry: ContactRecord["entryPointType"] };
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    company: "Brightloop Labs", tier: "medium", segment: "Mid-market SaaS", emp: "201–500", hq: "Austin, TX",
    fit: 84, priority: 82, momentum: "accelerating", conf: "emerging",
    signals: [
      { type: "leadership_hire", detail: "Announced a new VP of Revenue Operations", source: "Executive-move tracker", days: 2, conf: 0.62 },
      { type: "job_posting", detail: "Opened 2 RevOps roles: Sr. RevOps Analyst, Head of RevOps", source: "Job boards / ATS", days: 5, conf: 0.58 },
      { type: "engagement", detail: "3 people engaged with the founder's post", source: "Content engagement", days: 1, conf: 0.7 },
    ],
    contact: { name: "Priya Patel", role: "Head of RevOps", dept: "RevOps", seniority: "director", entry: "decision_maker" },
  },
  {
    company: "Corvex Systems", tier: "high", segment: "Enterprise SaaS", emp: "1001–5000", hq: "New York, NY",
    fit: 76, priority: 71, momentum: "steady", conf: "hypothesis",
    signals: [
      { type: "funding", detail: "Raised $60M Series C led by Insight Partners", source: "Funding news", days: 7, conf: 0.55 },
      { type: "compliance", detail: "Publicly achieved SOC 2 Type II", source: "Compliance / security watch", days: 21, conf: 0.42 },
    ],
    contact: { name: "Marcus Reyes", role: "Chief Revenue Officer", dept: "Sales", seniority: "executive", entry: "decision_maker" },
  },
  {
    company: "Signalyn", tier: "low", segment: "Growth-stage SaaS", emp: "11–50", hq: "Remote-first",
    fit: 68, priority: 74, momentum: "accelerating", conf: "emerging",
    signals: [
      { type: "product_launch", detail: "Launched a self-serve onboarding flow", source: "Product / changelog watch", days: 0, conf: 0.5 },
      { type: "engagement", detail: "Repeat engagement from an ICP contact (3 interactions)", source: "Content engagement", days: 0, conf: 0.72 },
    ],
    contact: { name: "Dana Kim", role: "Growth Marketing Manager", dept: "Marketing", seniority: "manager", entry: "entry" },
  },
  {
    company: "Datamere", tier: "medium", segment: "Mid-market SaaS", emp: "501–1000", hq: "Denver, CO",
    fit: 79, priority: 66, momentum: "steady", conf: "emerging",
    signals: [
      { type: "tech_stack", detail: "Adopted Snowflake; signals suggest they're moving off a legacy BI tool", source: "Tech-stack detector", days: 4, conf: 0.56 },
      { type: "job_posting", detail: "Opened 1 Data role: Analytics Engineer", source: "Job boards / ATS", days: 6, conf: 0.5 },
    ],
    contact: { name: "Omar Haddad", role: "Head of Data", dept: "Data", seniority: "executive", entry: "decision_maker" },
  },
  {
    company: "Vantagely", tier: "high", segment: "Enterprise SaaS", emp: "5000+", hq: "London, UK",
    fit: 72, priority: 63, momentum: "quiet", conf: "hypothesis",
    signals: [
      { type: "leadership_hire", detail: "Announced a new Chief Data Officer", source: "Executive-move tracker", days: 14, conf: 0.6 },
    ],
    contact: { name: "Elena Rossi", role: "VP Engineering", dept: "Eng", seniority: "executive", entry: "influencer" },
  },
  {
    company: "Upswell", tier: "low", segment: "Growth-stage SaaS", emp: "51–200", hq: "Toronto, CA",
    fit: 62, priority: 57, momentum: "steady", conf: "hypothesis",
    signals: [
      { type: "job_posting", detail: "Opened 1 Ops role: Business Operations Lead", source: "Job boards / ATS", days: 3, conf: 0.52 },
    ],
    contact: { name: "Noah Brooks", role: "Business Operations Lead", dept: "Ops", seniority: "manager", entry: "entry" },
  },
  {
    company: "Tidemark", tier: "medium", segment: "Mid-market SaaS", emp: "201–500", hq: "Seattle, WA",
    fit: 71, priority: 60, momentum: "accelerating", conf: "emerging",
    signals: [
      { type: "funding", detail: "Raised $18M Series B led by Accel", source: "Funding news", days: 8, conf: 0.5 },
      { type: "engagement", detail: "Visited the pricing page after a founder post", source: "Content engagement", days: 2, conf: 0.66 },
    ],
    contact: { name: "Maya Silva", role: "Sales Operations Manager", dept: "Sales", seniority: "manager", entry: "entry" },
  },
  {
    company: "Northwind AI", tier: "low", segment: "Growth-stage SaaS", emp: "11–50", hq: "Berlin, DE",
    fit: 59, priority: 52, momentum: "steady", conf: "hypothesis",
    signals: [
      { type: "product_launch", detail: "Launched an AI copilot for their product", source: "Product / changelog watch", days: 1, conf: 0.48 },
    ],
    contact: { name: "Liam Weber", role: "Growth Marketing Manager", dept: "Marketing", seniority: "manager", entry: "entry" },
  },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function recencyLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function demoTemplateDraft(tier: ACVTier, company: string, signalLine: string): { subject: string; body: string; cta: string; ready: boolean } {
  if (tier === "low") {
    return {
      subject: `Quick idea after seeing ${company}'s update`,
      body: `Hi {{first_name}},\n\nSaw that ${company} ${signalLine.toLowerCase()} — nice. Teams doing that usually hit the same snag next, and we help them move faster on it. Worth a quick look?\n\n— grab 15 min here: {{meeting_link}}`,
      cta: "Grab 15 min: {{meeting_link}}",
      ready: true,
    };
  }
  if (tier === "medium") {
    return {
      subject: `${company} + a faster path on what changed recently`,
      body: `Hi {{first_name}},\n\nNoticed ${company} ${signalLine.toLowerCase()}. When that happens, one person usually ends up owning a messier version of the same problem.\n\nIf it's useful, I'll bring a specific idea for ${company}, not a generic demo. Open to a 20-min working session next week?`,
      cta: "20-min working session with an agenda tailored to your setup",
      ready: true,
    };
  }
  return {
    subject: `A thought on ${company}'s next 90 days`,
    body: `Hi {{first_name}},\n\nFollowing ${company} — ${signalLine.toLowerCase()} caught my eye. In similar shifts, the hard part isn't the tooling, it's who ends up owning the number across the org.\n\nNo ask here. I put together a short read on how a few teams navigated exactly this — happy to send it over if that's a live question for you.`,
    cta: "Offer a relevant POV/resource; earn the meeting later",
    ready: false,
  };
}

function buildDemoReasoning(
  seed: DemoSeed,
  draft: { subject: string; body: string; cta: string; ready: boolean },
  top: SignalBundleItem
): ReasoningArtifact {
  const overall = seed.tier === "high" ? 68 : 82;
  const decision: DispositionDecision = seed.tier === "low" ? "auto_send" : "queue_for_approval";
  const sig = SIGNAL_META[top.type].label.toLowerCase();
  return {
    research: {
      businessSummary: `${seed.company} is a ${seed.segment.toLowerCase()} company (${seed.emp} employees, ${seed.hq}).`,
      productCategory: "B2B SaaS",
      productMaturity: seed.tier === "high" ? "mature" : "growth",
      likelyGtmMotion: seed.tier === "low" ? "plg" : "sales-led",
      growthSignals: seed.signals.map((s) => s.detail),
      observed: [top.detail],
      inferred: [`Given the ${sig}, they are likely scaling the ${seed.contact.dept} function.`],
      confidence: seed.conf,
      gaps: "Public signals only — no confirmed buying intent.",
    },
    problem: {
      observedEvidence: [top.detail],
      primaryProblem:
        seed.tier === "high"
          ? "Scaling GTM without losing account control"
          : "Needs more predictable pipeline as the team scales",
      possibleProblems: [
        { problem: "Pipeline / acquisition pressure", confidence: seed.conf, rationale: `Follows from the ${sig}.` },
      ],
      businessImpact: "Slower revenue ramp if the motion isn't scaled deliberately.",
      confidence: seed.conf,
    },
    solution: {
      mappings: [
        {
          problem: "Pipeline pressure",
          capability: "Event-driven outbound workforce",
          expectedOutcome: "More qualified, better-timed conversations",
          strength: overall,
        },
      ],
      strongestAngle: "Connect the recent signal to a faster, better-timed path to pipeline.",
      relevanceConfidence: seed.conf,
    },
    strategy: {
      conversationGoal: seed.tier === "high" ? "Earn a first conversation with a relevant POV" : "Book a short working session",
      focus: [sig],
      openingAngle: `Reference ${seed.company}'s ${sig}.`,
      primaryPain: "Scaling the motion without adding headcount noise",
      productMapping: "Event-driven outbound → better-timed, qualified pipeline",
      ctaType: seed.tier === "high" ? "no-cta-yet" : seed.tier === "low" ? "meeting-link" : "agenda-based",
      meetingGoal: "A specific idea tailored to their setup",
      avoid: ["fake urgency", "unverifiable claims"],
      riskLevel: seed.tier === "high" ? "medium" : "low",
      confidence: seed.conf,
    },
    email: {
      subject: draft.subject,
      subjectAlternatives: [draft.subject, `A quick idea for ${seed.company}`],
      body: draft.body,
      cta: draft.cta,
      ctaReady: draft.ready,
      angle: "signal tied to a persona-relevant outcome",
      whyNow: `${top.detail} (${top.recency}).`,
      confidenceLabel: seed.conf,
    },
    review: {
      scores: {
        personalization: overall - 4,
        clarity: overall + 3,
        relevance: overall,
        trust: overall - 2,
        humanTone: overall + 1,
        meetingProbability: seed.tier === "high" ? 55 : 72,
      },
      overall,
      hasRealObservation: true,
      personalizationAuthentic: true,
      soundsAiGenerated: false,
      connectsProblemToSolution: true,
      leadsToConversation: true,
      wouldSend: overall >= 70,
      issues: overall >= 70 ? [] : ["First touch leans slightly generic — tie the observation tighter to their world."],
      improvementHints: overall >= 70 ? [] : ["Open with the specific signal, then the inferred problem in one line."],
    },
    disposition: {
      decision,
      mode: "approval",
      reason:
        decision === "auto_send"
          ? "Auto-send eligible (approval-mode low-ACV lane): quality passes and mailbox is healthy."
          : seed.tier === "high"
          ? "High-ACV first touch — Max never blind-sends; a human decides the move."
          : "Queued for approval — workspace is in approval mode.",
      qualityOk: overall >= 70,
      confidenceOk: seed.conf !== "hypothesis",
      mailboxOk: true,
      overall,
    },
    stages: [
      { id: "research", label: "Research", status: "complete", headline: `${seed.company} — ${seed.segment}` },
      { id: "problem", label: "Problem Inference", status: "complete", headline: "Pipeline pressure as the team scales" },
      { id: "solution", label: "Solution Mapping", status: "complete", headline: "Event-driven outbound → better-timed pipeline" },
      { id: "strategy", label: "Email Strategy", status: "complete", headline: "Reference the signal, offer a specific idea" },
      { id: "generation", label: "Email Generation", status: "complete", headline: draft.subject },
      { id: "review", label: "Quality Review", status: "complete", headline: `Overall ${overall}/100` },
      {
        id: "approval",
        label: "Approval Decision",
        status: "complete",
        headline: decision === "auto_send" ? "Auto-send" : "Queued for approval",
      },
    ],
    regenerated: false,
    generatedAt: isoDaysAgo(0),
  };
}

function buildDemoWorkspace(acvTier: ACVTier): MaxWorkspace {
  const signals: SignalEvent[] = [];
  const accounts: AccountRecord[] = [];
  const contacts: ContactRecord[] = [];
  const opportunities: OutboundOpportunity[] = [];
  const briefs: Record<string, AccountBrief> = {};

  DEMO_SEEDS.forEach((seed, i) => {
    const accId = `demo_acc_${i}`;
    const conId = `demo_con_${i}`;
    const bundle: SignalBundleItem[] = seed.signals
      .slice()
      .sort((a, b) => a.days - b.days)
      .map((s) => ({
        type: s.type,
        label: SIGNAL_META[s.type].label,
        detail: s.detail,
        recency: recencyLabel(s.days),
        confidence: s.conf,
        source: s.source,
      }));

    seed.signals.forEach((s, j) => {
      signals.push({
        id: `demo_sig_${i}_${j}`,
        signalType: s.type,
        source: s.source,
        detail: s.detail,
        company: seed.company,
        timestamp: isoDaysAgo(s.days),
        confidence: s.conf,
        relevantPersonas: [seed.contact.dept],
        implication: "",
        actionabilityByTier: { low: "auto", medium: "queue", high: "brief" },
      });
    });

    const top = bundle[0];
    const whyNow = `${top.detail} (${top.recency}). ${
      seed.tier === "high"
        ? "Evidence for the account brief — timing is a hypothesis until confirmed."
        : "A relevant, timely opening."
    }`;

    accounts.push({
      id: accId,
      company: seed.company,
      domain: `${seed.company.toLowerCase().split(" ")[0]}.com`,
      industry: "B2B SaaS",
      segment: seed.segment,
      employeeRange: seed.emp,
      hqLocation: seed.hq,
      acvTier: seed.tier,
      icpFit: seed.fit,
      priority: seed.priority,
      momentum: seed.momentum,
      activeSignalIds: seed.signals.map((_, j) => `demo_sig_${i}_${j}`),
      signalBundle: bundle,
      whyNow,
      contactIds: [conId],
      engagementHistory: [],
      outboundHistory: [],
      maxRecommendation:
        seed.tier === "low"
          ? "Auto-enroll in the templated warm sequence; inspect only on exception."
          : seed.tier === "medium"
          ? "Queue a researched warm email for your review before sending."
          : "Fold into the account brief as evidence; the CTA is not earned yet.",
      confidenceLabel: seed.conf,
      routedTo: seed.tier === "low" ? "automation" : seed.tier === "medium" ? "sdr" : "ae",
      status: "new",
      logoSeed: seed.company.slice(0, 2).toUpperCase(),
      createdAt: isoDaysAgo(9),
      updatedAt: isoDaysAgo(0),
    });

    contacts.push({
      id: conId,
      accountId: accId,
      name: seed.contact.name,
      role: seed.contact.role,
      department: seed.contact.dept,
      seniority: seed.contact.seniority,
      relevanceToUseCase: `Owns/influences the ${seed.contact.dept} workflow the signals point to`,
      contactConfidence: 0.62,
      entryPointType: seed.contact.entry,
      preferredAngle: "",
      touchHistory: [],
      linkedinHint: `linkedin.com/in/${seed.company.toLowerCase().split(" ")[0]}-${seed.contact.dept.toLowerCase()}`,
      relationshipStatus: "none",
    });

    const draft = demoTemplateDraft(seed.tier, seed.company, top.detail);
    const action: RecommendedAction =
      seed.tier === "low"
        ? "auto_send"
        : seed.tier === "medium"
        ? "queued_review"
        : ["leadership_hire", "funding", "engagement"].includes(top.type)
        ? "ae_alert"
        : "brief_only";
    const reasoning = buildDemoReasoning(seed, draft, top);
    opportunities.push({
      id: `demo_opp_${i}`,
      accountId: accId,
      contactId: conId,
      acvTier: seed.tier,
      whyNow,
      signalBundle: bundle,
      fitScore: seed.fit,
      confidenceLabel: seed.conf,
      recommendedAction: action,
      subject: draft.subject,
      draft: draft.body,
      ctaDraft: draft.cta,
      ctaReady: draft.ready,
      approvalState: action === "auto_send" ? "approved" : "pending",
      touchNumber: 1,
      channel: "email",
      createdAt: isoDaysAgo(0),
      snoozedUntil: null,
      notes: "",
      angle: seed.tier === "high" ? "account-level POV, product-agnostic" : "signal tied to a persona-relevant outcome",
      draftSource: "pipeline",
      recipientName: seed.contact.name,
      recipientEmail: `${seed.contact.name.toLowerCase().split(" ")[0]}@${seed.company.toLowerCase().split(" ")[0]}.com`,
      recipientEmailVerified: true,
      subjectAlternatives: reasoning.email?.subjectAlternatives || [draft.subject],
      reasoning,
      qualityReview: reasoning.review,
      disposition: reasoning.disposition,
      tracking: { status: "not_sent", history: [] },
    });
  });

  const insights: LearningInsight[] = [
    {
      id: "demo_ins_1",
      pattern: "New leadership hires may open a 60–90 day evaluation window worth AE-led testing.",
      segment: "cross-tier",
      tier: "",
      evidence: "2 leadership-hire signals detected this period.",
      confidenceLabel: "hypothesis",
      recommendedChange: "Route leadership-hire accounts to AE/founder review, not auto-send.",
      createdAt: isoDaysAgo(0),
    },
    {
      id: "demo_ins_2",
      pattern: "Repeat engagement is the highest-confidence outbound trigger in the current feed.",
      segment: "all",
      tier: "",
      evidence: "Engagement signals carry the strongest base confidence.",
      confidenceLabel: "emerging",
      recommendedChange: "Raise queue priority for engagement-driven accounts across tiers.",
      createdAt: isoDaysAgo(0),
    },
  ];

  const focusByTier: Record<ACVTier, string> = {
    low: "Auto-enrolling accounts this cycle. Watch the exception queue for bounces and replies.",
    medium: "Start with Brightloop Labs — emerging confidence, 82 priority. Review the drafts before sending.",
    high: "Corvex Systems is the account to study first. Open its brief before any outreach.",
  };

  const ws: MaxWorkspace = {
    acvTier,
    signals: signals.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    accounts,
    contacts,
    opportunities,
    briefs,
    insights,
    effort: { low: 17, medium: 38, high: 50, note: "Starting priors; Max updates these from outcome data." },
    sources: [
      { key: "job_boards", signalType: "job_posting", displayName: "Job boards / ATS", live: false },
      { key: "exec_moves", signalType: "leadership_hire", displayName: "Executive-move tracker", live: false },
      { key: "funding_news", signalType: "funding", displayName: "Funding news", live: false },
      { key: "product_launches", signalType: "product_launch", displayName: "Product / changelog watch", live: false },
      { key: "tech_stack", signalType: "tech_stack", displayName: "Tech-stack detector", live: false },
      { key: "engagement", signalType: "engagement", displayName: "Content engagement", live: false },
      { key: "partnerships", signalType: "partnership", displayName: "Partnership / integration watch", live: false },
      { key: "compliance", signalType: "compliance", displayName: "Compliance / security watch", live: false },
    ],
    icp: {
      brand_name: "your workspace",
      industry: "B2B SaaS",
      segments: ["Growth-stage SaaS", "Mid-market SaaS", "Enterprise SaaS"],
      personas: ["RevOps", "Data", "Marketing", "Sales"],
      value_prop: "unify GTM reporting into one decision view",
      has_evidence: false,
    },
    recommendedFocusByTier: focusByTier,
    last_monitor_at: isoDaysAgo(0),
    metrics: computeDemoMetrics(accounts, opportunities, signals, acvTier, focusByTier[acvTier]),
    isDemo: true,
  };
  return ws;
}

function computeDemoMetrics(
  accounts: AccountRecord[],
  opportunities: OutboundOpportunity[],
  signals: SignalEvent[],
  tier: ACVTier,
  focus: string
): MaxMetrics {
  const acc = accounts.filter((a) => a.acvTier === tier);
  const opps = opportunities.filter((o) => o.acvTier === tier);
  const companies = new Set(acc.map((a) => a.company));
  const weekSignals = signals.filter(
    (s) => companies.has(s.company) && Date.now() - new Date(s.timestamp).getTime() < 7 * 864e5
  );
  return {
    accountsMonitored: acc.length,
    accountsQueued: opps.filter((o) => ["pending", "approved"].includes(o.approvalState)).length,
    accountsActive: acc.filter((a) => ["contacted", "qualified", "meeting"].includes(a.status)).length,
    meetingsBooked: 0,
    repliesAwaiting: 0,
    activeSignalsThisWeek: weekSignals.length,
    autoSent: opps.filter((o) => o.approvalState === "sent").length,
    replyRate: 0,
    bounceRate: 0,
    optOutRate: 0,
    recommendedFocus: focus,
    learnedThisWeek: "Engagement-driven accounts are the strongest trigger so far (emerging).",
  };
}

// ─── Public metrics recompute (used after optimistic local mutations) ────────────

export function computeMetrics(ws: MaxWorkspace, tier: ACVTier): MaxMetrics {
  const focus = ws.recommendedFocusByTier?.[tier] || ws.metrics?.recommendedFocus || "";
  return computeDemoMetrics(ws.accounts, ws.opportunities, ws.signals, tier, focus);
}

// ─── Backend transport ───────────────────────────────────────────────────────────

const isRealBrandId = (id?: string): id is string =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function maxFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${MAX_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Max backend error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

interface WorkspaceResponse {
  status: "ready" | "monitoring" | "error" | "unknown";
  workspace?: MaxWorkspace;
  error?: string;
  stage?: MonitorStage;
}

// The monitoring cycle runs as a background job (sources -> tracker). We poll
// the status endpoint until the workspace is ready, forwarding each live stage.
async function pollForWorkspace(
  spaceId: string,
  acvTier: ACVTier,
  onProgress?: (stage: MonitorStage) => void,
  intervalMs = 2500,
  maxMs = 240000
): Promise<MaxWorkspace> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let s: WorkspaceResponse;
    try {
      s = await maxFetch<WorkspaceResponse>(
        `/workspace/status?brand_id=${encodeURIComponent(spaceId)}&acv_tier=${acvTier}`
      );
    } catch {
      continue; // transient hiccup — keep polling
    }
    if (s.status === "ready" && s.workspace) return s.workspace;
    if (s.status === "error") throw new Error(s.error || "Max couldn't complete monitoring.");
    if (s.stage) onProgress?.(s.stage);
  }
  throw new Error("Max is taking longer than usual to scan sources. Please try again.");
}

export const maxAPI = {
  /**
   * The outbound workspace for a space at a given ACV tier. Launches (or reads)
   * a background monitoring cycle and polls until ready.
   */
  getWorkspace: async (
    spaceId: string,
    acvTier: ACVTier,
    force = false,
    onProgress?: (stage: MonitorStage) => void
  ): Promise<MaxWorkspace> => {
    if (isRealBrandId(spaceId)) {
      const start = await maxFetch<WorkspaceResponse>(
        `/workspace?brand_id=${encodeURIComponent(spaceId)}&acv_tier=${acvTier}&force=${force}`
      );
      if (start.status === "ready" && start.workspace) return start.workspace;
      if (start.status === "error") throw new Error(start.error || "Max couldn't monitor sources.");
      onProgress?.(start.stage || "starting");
      return pollForWorkspace(spaceId, acvTier, onProgress);
    }
    await new Promise((r) => setTimeout(r, 400));
    return buildDemoWorkspace(acvTier);
  },

  /** Force a fresh monitoring cycle across all sources. */
  scan: async (spaceId: string, acvTier: ACVTier, onProgress?: (stage: MonitorStage) => void): Promise<MaxWorkspace> => {
    if (isRealBrandId(spaceId)) {
      const start = await maxFetch<WorkspaceResponse>(
        `/scan?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ acv_tier: acvTier }) }
      );
      onProgress?.(start.stage || "scanning");
      return pollForWorkspace(spaceId, acvTier, onProgress);
    }
    await new Promise((r) => setTimeout(r, 700));
    return buildDemoWorkspace(acvTier);
  },

  /** Approve / send / skip / snooze / change-contact / edit a queue item. */
  opportunityAction: async (
    spaceId: string | undefined,
    opportunityId: string,
    action: string,
    payload?: Record<string, unknown>
  ): Promise<OutboundOpportunity | null> => {
    if (!isRealBrandId(spaceId)) return null; // demo: page mutates locally
    try {
      const res = await maxFetch<{ updated: boolean; opportunity?: OutboundOpportunity }>(
        `/opportunity/action?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ opportunity_id: opportunityId, action, payload }) }
      );
      return res.opportunity || null;
    } catch (e) {
      console.warn("[max] opportunity action failed (non-blocking):", e);
      return null;
    }
  },

  /** LLM redraft of one opportunity's warm email. */
  regenerateMessage: async (
    spaceId: string | undefined,
    opportunityId: string,
    angleHint = ""
  ): Promise<OutboundOpportunity | null> => {
    if (!isRealBrandId(spaceId)) {
      await new Promise((r) => setTimeout(r, 500));
      return null; // demo: keep the template draft
    }
    const res = await maxFetch<{ opportunity: OutboundOpportunity }>(
      `/message/regenerate?brand_id=${encodeURIComponent(spaceId)}`,
      { method: "POST", body: JSON.stringify({ opportunity_id: opportunityId, angle_hint: angleHint }) }
    );
    return res.opportunity;
  },

  /** Record a lifecycle outcome on a sent opportunity (Tracking & Learning layer). */
  recordOutcome: async (
    spaceId: string | undefined,
    opportunityId: string,
    event: string,
    note = ""
  ): Promise<OutboundOpportunity | null> => {
    if (!isRealBrandId(spaceId)) return null; // demo: no live tracking backend
    try {
      const res = await maxFetch<{ updated: boolean; opportunity?: OutboundOpportunity }>(
        `/opportunity/outcome?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ opportunity_id: opportunityId, event, note }) }
      );
      return res.opportunity || null;
    } catch (e) {
      console.warn("[max] outcome record failed (non-blocking):", e);
      return null;
    }
  },

  /** Update a tracked account (status / priority / routing / notes). */
  accountAction: async (
    spaceId: string | undefined,
    accountId: string,
    patch: Record<string, unknown>
  ): Promise<AccountRecord | null> => {
    if (!isRealBrandId(spaceId)) return null;
    try {
      const res = await maxFetch<{ updated: boolean; account?: AccountRecord }>(
        `/account/action?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ account_id: accountId, patch }) }
      );
      return res.account || null;
    } catch (e) {
      console.warn("[max] account action failed (non-blocking):", e);
      return null;
    }
  },

  /** Generate (or return a cached) high-ACV account brief. */
  getBrief: async (
    spaceId: string | undefined,
    account: AccountRecord,
    contacts: ContactRecord[],
    signals: SignalEvent[],
    force = false
  ): Promise<AccountBrief> => {
    if (isRealBrandId(spaceId)) {
      const res = await maxFetch<{ brief: AccountBrief }>(
        `/account/brief?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ account_id: account.id, force }) }
      );
      return res.brief;
    }
    await new Promise((r) => setTimeout(r, 500));
    return buildDemoBrief(account, contacts, signals);
  },

  /** Append a note to a high-ACV account journal. */
  addJournalNote: async (
    spaceId: string | undefined,
    accountId: string,
    note: string
  ): Promise<AccountBrief | null> => {
    if (!isRealBrandId(spaceId)) return null;
    const res = await maxFetch<{ brief: AccountBrief }>(
      `/account/journal?brand_id=${encodeURIComponent(spaceId)}`,
      { method: "POST", body: JSON.stringify({ account_id: accountId, note }) }
    );
    return res.brief;
  },

  /** Max's strategic chat, grounded in the ICP and the visible workspace. */
  chat: async (
    question: string,
    ws: MaxWorkspace,
    spaceId?: string
  ): Promise<string> => {
    if (isRealBrandId(spaceId)) {
      try {
        const data = await maxFetch<{ response: string }>(
          `/chat?brand_id=${encodeURIComponent(spaceId)}`,
          {
            method: "POST",
            body: JSON.stringify({
              acv_tier: ws.acvTier,
              message: question,
              workspace_context: workspaceContextString(ws),
            }),
          }
        );
        return data.response;
      } catch (e) {
        console.warn("[max] chat failed, using local fallback:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    return maxReply(question, ws);
  },

  /**
   * Set Max's outbound autonomy mode.
   *  • "autopilot" — Max sends quality-checked drafts directly to leads. Every
   *    email still passes the same pre-send double-check as a manual send: the
   *    staged quality review + the recipient deliverability (email-check) gate.
   *    Switching on also mails the already-approved / auto-send leads right away.
   *  • "approval" — every draft waits in the queue for a human.
   * Returns the stored mode + a send summary when autopilot kicks off a send.
   */
  setOutboundMode: async (
    spaceId: string | undefined,
    mode: "autopilot" | "approval",
    autosend = true
  ): Promise<{ ok?: boolean; mode: "autopilot" | "approval"; sent?: number; attempted?: number; blocked?: number }> => {
    if (!isRealBrandId(spaceId)) {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, mode, sent: 0, attempted: 0, blocked: 0 };
    }
    return maxFetch(`/settings/outbound-mode?brand_id=${encodeURIComponent(spaceId)}`, {
      method: "POST",
      body: JSON.stringify({ mode, autosend }),
    });
  },

  /** Autopilot only: send every approved / auto_send, unsent opportunity now. */
  autosend: async (
    spaceId: string | undefined,
    acvTier: ACVTier = "medium"
  ): Promise<{ mode?: string; attempted: number; sent: number; blocked: number }> => {
    if (!isRealBrandId(spaceId)) {
      await new Promise((r) => setTimeout(r, 300));
      return { attempted: 0, sent: 0, blocked: 0 };
    }
    return maxFetch(`/autosend?brand_id=${encodeURIComponent(spaceId)}`, {
      method: "POST",
      body: JSON.stringify({ acv_tier: acvTier }),
    });
  },
};

export default maxAPI;

// ─── Demo brief + local chat responder ──────────────────────────────────────────

function buildDemoBrief(
  account: AccountRecord,
  contacts: ContactRecord[],
  signals: SignalEvent[]
): AccountBrief {
  const accContacts = contacts.filter((c) => c.accountId === account.id);
  const accSignals = signals
    .filter((s) => s.company === account.company)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return {
    accountId: account.id,
    company: account.company,
    narrative: `${account.company} is a ${account.segment} account in ${account.industry} (${account.employeeRange} employees). ${
      account.signalBundle[0] ? `Most recent signal: ${account.signalBundle[0].detail}. ` : ""
    }Momentum is ${account.momentum}; treat timing as a hypothesis until confirmed.`,
    buyingCommittee: accContacts.map((c) => ({
      name: c.name,
      role: c.role,
      department: c.department,
      influence: c.seniority === "executive" || c.seniority === "director" ? "high" : "medium",
      relationshipState: c.relationshipStatus,
      touchStatus: "not_contacted",
      entryPointType: c.entryPointType,
    })),
    signalTimeline: accSignals.map((s) => ({
      date: s.timestamp,
      type: s.signalType,
      detail: s.detail,
      interpretation: s.implication || SIGNAL_META[s.signalType].label,
    })),
    recommendedAngle: account.maxRecommendation || "Anchor on the operational shift the signals imply.",
    angleConfidence: account.confidenceLabel,
    angleRationale: "Grounded in the detected signals; no fabricated buyer intent.",
    recommendedNextAction:
      "Study the brief, pick one entry-point contact, and prepare a POV — do not send a calendar link yet.",
    signalInterpretation: accSignals.slice(0, 3).map((s) => s.implication || SIGNAL_META[s.signalType].label),
    whyNotNow: account.momentum === "accelerating" ? "" : "Momentum is not yet strong enough to justify a direct CTA.",
    journal: [],
    generatedAt: new Date().toISOString(),
  };
}

function workspaceContextString(ws: MaxWorkspace): string {
  const m = ws.metrics;
  const top = ws.accounts
    .filter((a) => a.acvTier === ws.acvTier)
    .slice(0, 5)
    .map((a) => `- ${a.company} (fit ${a.icpFit}, priority ${a.priority}, ${a.confidenceLabel}, ${a.momentum})`)
    .join("\n");
  return [
    `ACV mode: ${ws.acvTier} (${TIER_CONFIG[ws.acvTier].label}).`,
    `Monitored: ${m.accountsMonitored}, queued: ${m.accountsQueued}, active: ${m.accountsActive}, meetings: ${m.meetingsBooked}.`,
    `Active signals this week: ${m.activeSignalsThisWeek}.`,
    `Top accounts in this tier:\n${top || "(none)"}`,
  ].join("\n");
}

const QUICK_PROMPTS = [
  "Why is this account ahead of the others?",
  "Is this signal meaningful or just noise?",
  "Should I ask for a meeting now or wait?",
  "Who should we contact first?",
  "What's working in our outbound right now?",
];

export { QUICK_PROMPTS };

/** Local guardrail-respecting responder for demo spaces (never fabricates). */
export function maxReply(question: string, ws: MaxWorkspace): string {
  const q = question.toLowerCase();
  const cfg = TIER_CONFIG[ws.acvTier];
  const tierAccounts = ws.accounts.filter((a) => a.acvTier === ws.acvTier);
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  const top = [...tierAccounts].sort((a, b) => b.priority - a.priority)[0];

  if (has("ahead", "prioritit", "priority", "why is this account", "top account")) {
    if (!top) return "No qualified accounts in this tier yet — I'm still scanning sources.";
    return `**${top.company}** leads this tier because its ICP fit is ${top.icpFit} and priority ${top.priority}, driven by ${top.signalBundle.length} signal(s) across sources: ${top.signalBundle.map((b) => b.label).join(", ")}. I've graded the account **${CONFIDENCE_META[top.confidenceLabel].label.toLowerCase()}** — ${top.confidenceLabel === "hypothesis" ? "worth testing, not proven" : "directionally supported by the signal mix"}. ${top.whyNow}`;
  }

  if (has("noise", "meaningful", "signal", "matter")) {
    return `A signal matters for outbound only if it maps to a persona-relevant change AND clears the ICP floor for this tier. In **${cfg.label}**, ${cfg.signalPrinciple.toLowerCase()} I weight leadership hires, funding and repeat engagement highest — but I treat any single weak signal as a **hypothesis**, not proof of buying intent.`;
  }

  if (has("meeting now", "ask for", "cta", "wait", "meeting")) {
    return `For **${cfg.label}**, the CTA norm is ${cfg.ctaDelay}. ${
      ws.acvTier === "high"
        ? "On high-ACV first touches I usually recommend NOT sending a calendar link — the meeting is earned after a POV or a warm reply. Push a CTA too early here and you burn the account."
        : ws.acvTier === "medium"
        ? "Frame the ask around an agenda/outcome, not 'let's chat', and let engagement influence timing."
        : "A direct meeting-link ask is fine here — keep it fast and low-friction."
    }`;
  }

  if (has("who", "contact first")) {
    const c = ws.contacts.find((x) => x.accountId === top?.id);
    if (!c) return "Pick an entry-point contact whose function matches the signal — for low ACV, one is enough.";
    return `Start with **${c.name} — ${c.role}** (${c.entryPointType.replace("_", " ")}). They own the ${c.department} workflow the signals point to. ${
      ws.acvTier === "high" ? "For this tier, plan to multi-thread the committee over time rather than blasting everyone at once." : ""
    }`;
  }

  if (has("working", "performing", "learn", "results")) {
    const ins = ws.insights[0];
    return ins
      ? `Right now: **${ins.pattern}** (${CONFIDENCE_META[ins.confidenceLabel].label}). Evidence: ${ins.evidence} My recommendation: ${ins.recommendedChange}. I keep these confidence-graded — I won't call something established until the sample supports it.`
      : "I don't have enough outcome data yet to call anything established. I'm building the baseline and grading everything as a hypothesis until the sample supports more.";
  }

  if (has("nina", "warm", "nurture", "not ready", "timing", "hold")) {
    return `Recommendation: some of these accounts aren't ready for a direct CTA. If a segment keeps showing interest but not converting, I'd hold outreach and let **EVA** keep monitoring their buying signals — then I'll re-engage the moment intent picks up. If it implies a positioning shift, that's a **Nina** call. I'd flag ${top ? top.company : "the top engaged accounts"} to nurture before we push a meeting ask.`;
  }

  return `I'm Max, your outbound head. In **${cfg.label}** mode (${cfg.mode.replace("-", " ")}), I'm monitoring ${ws.metrics.accountsMonitored} accounts with ${ws.metrics.activeSignalsThisWeek} fresh signals this week. Ask me things like: "why is this account ahead?", "is this signal noise?", "should I ask for the meeting now?", "who do I contact first?", or "what's working in our outbound?".`;
}
