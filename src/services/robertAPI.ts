// services/robertAPI.ts
//
// Robert — the AI Content Head specialist for Weez.
//
// This module owns the data model + planning logic for Robert's page:
//   • a typed weekly content plan (founder vs org, growth/leads/trust, safe/critical)
//   • an ACV-tier aware plan generator that follows Robert's strategic rules
//   • a local, guardrail-respecting strategic chat responder
//
// The generator currently produces a rich, deterministic mock plan so the page is
// fully usable in development. Every public function is intentionally async and
// shaped like a real backend contract — swap the bodies to call the Weez backend
// (e.g. `${WEEZ_BASE_URL}/robert/...`) once those endpoints exist, and the page
// keeps working without changes.

import CONFIG from "./config";

// Robert's routes are mounted under the /robert prefix on the main Weez backend.
// robertFetch appends paths like "/plan", "/plan/status", "/card", "/chat".
export const ROBERT_BASE_URL = `${CONFIG.WEEZ_BASE_URL}/robert`;

// ─── Core enums ────────────────────────────────────────────────────────────────

export type ACVTier = "low" | "medium" | "high";
export type Author = "founder" | "org";
export type Funnel = "growth" | "leads" | "trust";
export type RiskTag = "safe" | "critical";
export type ApprovalState =
  | "pending"
  | "approved"
  | "needs_explicit_approval"
  | "scheduled"
  | "skipped";

export type PostType =
  | "Founder POV"
  | "Founder Playbook"
  | "Founder Mini Case Study"
  | "Build-in-Public"
  | "Org Case Study"
  | "Product Deep Dive"
  | "Research / Data"
  | "Comparison"
  | "Category POV"
  | "Webinar / AMA";

// How much each context layer feeds a given content piece (should sum to 100).
export interface ContextWeighting {
  founder: number;
  product: number;
  customer: number;
  industry: number;
}

export interface ImageRecommendation {
  recommended: boolean;
  // framework | workflow | case-study | data-viz | comparison | screenshot
  type?: string;
  reason?: string;
  // Populated once an image has been generated for a recommended card.
  status?: "idle" | "generating" | "ready" | "error";
  url?: string;
  prompt?: string;
  error?: string;
}

export interface ContentCard {
  id: string;
  // Core identity
  title: string;
  author: Author;
  postType: PostType;
  funnel: Funnel;
  targetPersona: string;
  scheduledDay: string; // e.g. "Mon"
  scheduledSlot: string; // e.g. "Tue · 9:30 AM"
  acvRelevance: ACVTier;

  // Strategy context
  objective: string;
  whyThisWeek: string;
  contextSources: string[];
  contextWeighting: ContextWeighting;
  contentTypeRationale: string;

  // Risk & approval
  risk: RiskTag;
  riskReason: string;
  requiresExplicitApproval: boolean;
  approvalState: ApprovalState;
  softenTip?: string; // what can be edited to make a critical post safer

  // Content preview
  draft: string;
  hookAlternatives: string[];
  cta?: string;
  proofBlocks?: string[]; // structured proof for case-study / demo cards

  // Asset section
  image: ImageRecommendation;

  // Provenance flag — founder cards written to the founder's stated voice
  followsFounderVoice?: boolean;
}

export interface WeeklyMix {
  growth: number;
  leads: number;
  trust: number;
}

export interface WeeklyPlan {
  weekRange: string;
  acvTier: ACVTier;
  acvRange: string;
  objective: string;
  strategyNote: string;
  founderVoice: string; // summary of founder's stated writing style (from Nina onboarding)
  targetMix: WeeklyMix; // Robert's recommended growth/leads/trust split for this tier
  cards: ContentCard[];
  isDemo?: boolean; // true when this is local sample data (non-UUID / demo space), not real GPT-5.2 output
}

export interface RobertChatMessage {
  role: "user" | "robert";
  content: string;
}

// ─── Static tier configuration (mirrors Robert's strategy rules) ─────────────────

export const TIER_CONFIG: Record<
  ACVTier,
  {
    label: string;
    range: string;
    buyer: string;
    salesCycle: string;
    goal: string;
    mix: WeeklyMix;
    founderPerWeek: string;
    orgPerWeek: string;
    totalPerWeek: string;
    shape: string;
  }
> = {
  low: {
    label: "Low ACV",
    range: "$1K–$10K",
    buyer: "Individual / small team, self-serve mindset",
    salesCycle: "Days to 2 weeks",
    goal: "Generate volume, reach, signups and demos directly",
    mix: { growth: 40, leads: 40, trust: 20 },
    founderPerWeek: "5–7",
    orgPerWeek: "3–5",
    totalPerWeek: "8–12",
    shape: "High founder frequency, high volume, founder is the main distribution engine.",
  },
  medium: {
    label: "Medium ACV",
    range: "$10K–$50K",
    buyer: "Manager / director + 1–2 influencers",
    salesCycle: "3–8 weeks",
    goal: "Build trust and credibility to earn qualified calls and pipeline",
    mix: { growth: 25, leads: 35, trust: 40 },
    founderPerWeek: "3–4",
    orgPerWeek: "2–3",
    totalPerWeek: "5–7",
    shape: "Balanced founder + org. Founder carries credibility and proof, org carries case studies and demos.",
  },
  high: {
    label: "High ACV",
    range: "$50K+",
    buyer: "VP / C-level + buying committee",
    salesCycle: "2–6 months",
    goal: "Build authority, executive credibility and pipeline influence",
    mix: { growth: 10, leads: 20, trust: 70 },
    founderPerWeek: "2–3",
    orgPerWeek: "1–2",
    totalPerWeek: "3–5",
    shape: "Fewer, higher-weight posts. Org page carries enterprise trust signals; founder posts are high-signal and senior-audience oriented.",
  },
};

// ─── Shared founder-voice profile (from Nina's memory onboarding interview) ──────
// Robert must honor what the founder said about how they like to write.
const FOUNDER_VOICE =
  "Plain-spoken and direct. Short sentences, concrete examples over adjectives, " +
  "a light contrarian edge, no hype and no emojis. Prefers opening with a real " +
  "observation rather than a hook cliché. (Captured in Nina's founder memory onboarding.)";

// ─── Plan generators per tier ────────────────────────────────────────────────────

function weekRangeLabel(): string {
  const start = new Date();
  const day = start.getDay();
  const diffToMon = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function mediumCards(): ContentCard[] {
  return [
    {
      id: "m1",
      title: "Why 'more content' stopped moving your pipeline",
      author: "founder",
      postType: "Category POV",
      funnel: "trust",
      targetPersona: "RevOps & demand-gen leaders at 50–500 person SaaS",
      scheduledDay: "Mon",
      scheduledSlot: "Mon · 9:30 AM",
      acvRelevance: "medium",
      objective:
        "Reframe the buyer's world so mid-market leaders see the founder as someone who understands their actual problem.",
      whyThisWeek:
        "Medium-ACV buyers respond to credibility before volume. Opening the week with a category POV sets the trust tone the rest of the plan builds on.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Industry context: content-saturation debate in B2B",
        "Customer context: recurring 'too much noise' objection",
      ],
      contextWeighting: { founder: 40, industry: 30, customer: 20, product: 10 },
      contentTypeRationale:
        "Founder POV / thought leadership — interprets a category shift in the founder's own voice.",
      risk: "critical",
      riskReason:
        "Contains a category-level POV that reads as a positioning statement. Should be confirmed as a founder-approved stance before it ships.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip:
        "Soften by framing the claim as a question ('Has more content stopped working for you?') or attributing it to what you're hearing from buyers, not as a declared truth.",
      draft:
        "Everyone doubled their content output this year. Almost no one doubled their pipeline.\n\nThe problem was never volume. It's that most B2B content answers questions buyers stopped asking.\n\nWhat's actually working right now: fewer posts, each one tied to a decision your buyer is genuinely stuck on. Proof over takes. Specifics over frameworks.\n\nDraft POV for your review — this is a stance, not a settled company line.",
      hookAlternatives: [
        "We tripled our posting cadence last quarter. Pipeline didn't move an inch.",
        "The content treadmill has a dirty secret: most of it answers questions nobody's asking.",
      ],
      image: {
        recommended: false,
        reason: "Text-first founder POV. A visual would dilute a voice-led argument.",
      },
      followsFounderVoice: true,
    },
    {
      id: "m2",
      title: "The 3-step qualification framework we use before any demo",
      author: "founder",
      postType: "Founder Playbook",
      funnel: "leads",
      targetPersona: "Founders & sales-led operators evaluating tooling",
      scheduledDay: "Tue",
      scheduledSlot: "Tue · 8:45 AM",
      acvRelevance: "medium",
      objective:
        "Give a repeatable, useful method that demonstrates operational depth and pulls qualified readers toward a call.",
      whyThisWeek:
        "A playbook mid-week balances the opening POV with something immediately usable — it earns saves and replies from the right buyers.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Customer context: qualification pains before evaluation",
        "Product/brand context: how the workflow maps to the framework",
      ],
      contextWeighting: { founder: 30, customer: 25, product: 25, industry: 20 },
      contentTypeRationale:
        "Founder playbook / framework — repeatable method grounded in real customer work.",
      risk: "safe",
      riskReason:
        "Low-risk educational playbook grounded in previously approved founder themes. No sharp claims or customer names.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "Before any demo, we run three questions:\n\n1. What breaks today if nothing changes in 90 days?\n2. Who else has to say yes — and what do they care about?\n3. What's the smallest win that would make this obviously worth it?\n\nIf we can't answer all three, it's not a qualified demo yet. It's a research call. Naming that early saved us weeks.",
      hookAlternatives: [
        "Most 'demos' are actually research calls in disguise. Here's how we tell the difference.",
      ],
      cta: "Steal the three questions — reply if you want the call script we pair with them.",
      image: {
        recommended: true,
        type: "framework",
        reason:
          "A clean 3-step framework diagram materially improves clarity and is highly saveable.",
      },
      followsFounderVoice: true,
    },
    {
      id: "m3",
      title: "How a 40-person RevOps team cut reporting time by ~60%",
      author: "org",
      postType: "Org Case Study",
      funnel: "trust",
      targetPersona: "RevOps managers evaluating analytics tooling",
      scheduledDay: "Wed",
      scheduledSlot: "Wed · 11:00 AM",
      acvRelevance: "medium",
      objective:
        "Provide structured, evidence-backed proof that de-risks the buying decision for mid-market evaluators.",
      whyThisWeek:
        "Trust-weighted week needs at least one hard proof point. A case study mid-week anchors the credibility the founder POV opened with.",
      contextSources: [
        "Customer context: documented outcome (pending final sign-off)",
        "Product/brand context: reporting workflow capabilities",
      ],
      contextWeighting: { customer: 45, product: 35, industry: 10, founder: 10 },
      contentTypeRationale:
        "Org case study — evidence-led proof content for the org page.",
      risk: "critical",
      riskReason:
        "References a specific customer outcome and a quantified metric. The number and permission to reference the customer must be confirmed before publishing.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip:
        "If the exact figure isn't confirmed, anonymize the customer and use a directional range ('cut reporting time by more than half') until numbers are verified.",
      draft:
        "A 40-person RevOps team was spending a full day a week stitching reports together by hand.\n\nAfter moving that workflow into one place, they got the same reporting done in roughly a third of the time — and stopped arguing about whose numbers were right.\n\n[Metric and customer reference pending confirmation before publish.]",
      hookAlternatives: [
        "One day a week, gone — here's what a RevOps team did with it.",
      ],
      cta: "Read the full breakdown →",
      proofBlocks: [
        "Before: ~8 hrs/week manual reporting",
        "After: ~3 hrs/week (needs final confirmation)",
        "Outcome: single source of truth across GTM",
      ],
      image: {
        recommended: true,
        type: "case-study",
        reason:
          "A before/after proof visual makes the outcome scannable and lifts credibility on the org page.",
      },
    },
    {
      id: "m4",
      title: "A quieter workflow: turning 5 dashboards into one decision view",
      author: "org",
      postType: "Product Deep Dive",
      funnel: "leads",
      targetPersona: "Ops & analytics buyers comparing tools",
      scheduledDay: "Thu",
      scheduledSlot: "Thu · 10:15 AM",
      acvRelevance: "medium",
      objective:
        "Explain a concrete product workflow so evaluators can picture themselves using it.",
      whyThisWeek:
        "Follows the case study with the 'how' — turning proven outcome into a product mechanism the buyer can evaluate.",
      contextSources: [
        "Product/brand context: decision-view workflow",
        "Customer context: dashboard-sprawl pain",
      ],
      contextWeighting: { product: 50, customer: 25, industry: 15, founder: 10 },
      contentTypeRationale:
        "Org product deep dive — explains a real workflow the product supports.",
      risk: "safe",
      riskReason:
        "Explains an existing, supported workflow with no unverified claims or competitive framing.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "Dashboard sprawl isn't a reporting problem, it's a decision problem. When the answer lives across five tabs, nobody trusts any of them.\n\nHere's the workflow: pull the five signals that actually drive the weekly call into one decision view, so the meeting starts from agreement instead of reconciliation.",
      hookAlternatives: [
        "Five dashboards, zero decisions. Sound familiar?",
      ],
      cta: "See the decision view in a 2-minute walkthrough →",
      image: {
        recommended: true,
        type: "workflow",
        reason: "A workflow diagram clarifies the 'five-to-one' consolidation better than prose.",
      },
    },
    {
      id: "m5",
      title: "What I got wrong about hiring our first RevOps person",
      author: "founder",
      postType: "Founder Mini Case Study",
      funnel: "trust",
      targetPersona: "Early-stage founders and GTM leaders",
      scheduledDay: "Fri",
      scheduledSlot: "Fri · 9:00 AM",
      acvRelevance: "medium",
      objective:
        "Build relatability and trust through a grounded lesson, keeping the founder human and credible.",
      whyThisWeek:
        "Closes the week on a trust note. A reflective, specific lesson resonates with peers and account-level buyers without selling.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Founder context: hiring lesson explicitly shared",
      ],
      contextWeighting: { founder: 45, product: 15, customer: 25, industry: 15 },
      contentTypeRationale:
        "Founder mini case study — story-led lesson from the founder's own experience.",
      risk: "safe",
      riskReason:
        "Grounded in a lesson the founder actually shared. No customer claims, metrics or positioning risk.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "I hired our first RevOps person to 'own the numbers.' Wrong framing.\n\nWhat we actually needed was someone to decide which numbers we'd stop arguing about. The tooling mattered less than the agreement.\n\nOnce we reframed the role around decisions instead of dashboards, everything downstream got easier.",
      hookAlternatives: [
        "Our first RevOps hire fixed the wrong problem — my fault, not theirs.",
      ],
      image: {
        recommended: false,
        reason: "Personal reflection reads best as text; a visual would feel decorative.",
      },
      followsFounderVoice: true,
    },
  ];
}

function lowCards(): ContentCard[] {
  return [
    {
      id: "l1",
      title: "The 30-second fix that cleaned up our messiest report",
      author: "founder",
      postType: "Build-in-Public",
      funnel: "growth",
      targetPersona: "Self-serve ops users and small teams",
      scheduledDay: "Mon",
      scheduledSlot: "Mon · 8:30 AM",
      acvRelevance: "low",
      objective: "Drive reach and relatability with a fast, tactical daily-pain win.",
      whyThisWeek:
        "Low-ACV weeks lead with volume and tactical hits. A quick win opens the week and invites shares.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Product/brand context: micro before/after",
      ],
      contextWeighting: { founder: 45, product: 30, customer: 15, industry: 10 },
      contentTypeRationale: "Build-in-public micro-proof tied to a daily pain.",
      risk: "safe",
      riskReason: "Low-risk tactical tip with no claims or customer references.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "Our messiest report had one problem: three people owned it and none of them agreed on the columns.\n\nWe deleted every column nobody could defend in one sentence. Report got half as long and twice as useful. Try it on your worst dashboard today.",
      hookAlternatives: ["Delete every column you can't defend in one sentence."],
      cta: "Try it and tell me what you cut.",
      image: { recommended: false, reason: "Text-first tactical post." },
      followsFounderVoice: true,
    },
    {
      id: "l2",
      title: "5 report templates you can copy this week",
      author: "org",
      postType: "Research / Data",
      funnel: "leads",
      targetPersona: "Individual ops users evaluating self-serve tools",
      scheduledDay: "Tue",
      scheduledSlot: "Tue · 12:30 PM",
      acvRelevance: "low",
      objective: "Capture leads with a free, immediately useful template pack.",
      whyThisWeek:
        "Lead-magnet content fits the 40:40:20 low-ACV mix and converts reach into signups.",
      contextSources: [
        "Product/brand context: template library",
        "Customer context: most-requested report types",
      ],
      contextWeighting: { product: 40, customer: 25, industry: 20, founder: 15 },
      contentTypeRationale: "Org lead-magnet / template post.",
      risk: "safe",
      riskReason: "Free resource, no claims. Standard lead capture.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "We packaged the 5 reports people ask us for most into copy-paste templates: pipeline health, win/loss, forecast, activity, and revenue by segment.\n\nGrab them, plug in your data, done.",
      hookAlternatives: ["The 5 reports people ask us for most — now copy-paste ready."],
      cta: "Grab the free template pack →",
      image: { recommended: true, type: "comparison", reason: "A tidy template preview grid boosts click intent." },
    },
    {
      id: "l3",
      title: "Hot take: your 'single source of truth' is three spreadsheets",
      author: "founder",
      postType: "Founder POV",
      funnel: "growth",
      targetPersona: "Ops practitioners on social",
      scheduledDay: "Wed",
      scheduledSlot: "Wed · 9:15 AM",
      acvRelevance: "low",
      objective: "Spark engagement with a contrarian, relatable category take.",
      whyThisWeek: "Contrarian takes drive reach and comments in high-volume weeks.",
      contextSources: ["Founder voice profile (Nina onboarding)", "Industry context: SSOT cliché"],
      contextWeighting: { founder: 40, industry: 30, customer: 20, product: 10 },
      contentTypeRationale: "Founder contrarian POV for reach.",
      risk: "critical",
      riskReason:
        "Contrarian positioning take. Even light, it's a public stance — worth a quick founder nod before it ships.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip: "Frame as a question or an observation about the category rather than a jab.",
      draft:
        "Everybody says they have a single source of truth. Then they open three spreadsheets to check it.\n\nSSOT isn't a tool you buy. It's an agreement you enforce. The tool just makes the agreement cheap to keep.\n\nDraft take for your review.",
      hookAlternatives: ["'Single source of truth' — opens three spreadsheets to confirm."],
      image: { recommended: false, reason: "Punchy text take, no visual needed." },
      followsFounderVoice: true,
    },
    {
      id: "l4",
      title: "Before / after: a customer's dashboard, decluttered",
      author: "org",
      postType: "Comparison",
      funnel: "growth",
      targetPersona: "Prospects browsing social proof",
      scheduledDay: "Thu",
      scheduledSlot: "Thu · 1:00 PM",
      acvRelevance: "low",
      objective: "Show a fast visual win that makes the value obvious in one scroll.",
      whyThisWeek: "Visual before/after content is high-share and reinforces the week's tactical theme.",
      contextSources: ["Customer context: anonymized example", "Product/brand context: UI"],
      contextWeighting: { customer: 35, product: 35, industry: 20, founder: 10 },
      contentTypeRationale: "Org before/after comparison visual.",
      risk: "safe",
      riskReason: "Anonymized, illustrative before/after. No named customer or metric claim.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "Same data. Same team. One view they actually trust.\n\nLeft: what most weekly reports look like. Right: what's left after you remove everything nobody reads.",
      hookAlternatives: ["Same data, half the noise."],
      image: { recommended: true, type: "comparison", reason: "Before/after visual is the whole point of this post." },
    },
    {
      id: "l5",
      title: "The one metric we stopped reporting (and why)",
      author: "founder",
      postType: "Founder Playbook",
      funnel: "leads",
      targetPersona: "Ops leaders and founders",
      scheduledDay: "Fri",
      scheduledSlot: "Fri · 8:45 AM",
      acvRelevance: "low",
      objective: "Give a sharp, opinionated tip that earns saves and profile visits.",
      whyThisWeek: "Closes the volume week with a save-worthy tactical insight.",
      contextSources: ["Founder voice profile (Nina onboarding)", "Customer context: vanity-metric fatigue"],
      contextWeighting: { founder: 35, customer: 30, product: 20, industry: 15 },
      contentTypeRationale: "Founder tactical playbook.",
      risk: "safe",
      riskReason: "Educational tip grounded in known founder themes.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "We killed 'total logins' from every report. It went up when things were bad (people hunting for answers) and up when things were good. Useless signal.\n\nReport the metric that changes your next decision. Delete the rest.",
      hookAlternatives: ["The metric that goes up when you're winning AND when you're losing."],
      cta: "What's the one you should delete?",
      image: { recommended: false, reason: "Text-first tactical playbook." },
      followsFounderVoice: true,
    },
    {
      id: "l6",
      title: "Customer shoutout: what they built in their first week",
      author: "org",
      postType: "Org Case Study",
      funnel: "trust",
      targetPersona: "New and prospective self-serve users",
      scheduledDay: "Sat",
      scheduledSlot: "Sat · 10:30 AM",
      acvRelevance: "low",
      objective: "Light social proof to reinforce trust for self-serve buyers.",
      whyThisWeek: "A casual customer win rounds out the trust slice of the low-ACV mix.",
      contextSources: ["Customer context: user-shared win (needs permission)"],
      contextWeighting: { customer: 45, product: 35, industry: 10, founder: 10 },
      contentTypeRationale: "Org customer shoutout / UGC.",
      risk: "critical",
      riskReason: "References a customer and their result. Needs permission to feature and confirmation of the detail.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip: "Anonymize the user and generalize the result until you have explicit permission to name them.",
      draft:
        "A new user rebuilt their entire weekly report in their first week — and shared it with us.\n\n[Customer name + screenshot pending permission.]",
      hookAlternatives: ["Week one, and they'd already replaced their old reporting stack."],
      image: { recommended: true, type: "screenshot", reason: "A (permitted) screenshot makes UGC proof tangible." },
    },
  ];
}

function highCards(): ContentCard[] {
  return [
    {
      id: "h1",
      title: "The next decade of RevOps is an accountability problem, not a tooling one",
      author: "founder",
      postType: "Category POV",
      funnel: "trust",
      targetPersona: "VPs and C-level GTM leaders at enterprise SaaS",
      scheduledDay: "Mon",
      scheduledSlot: "Mon · 7:45 AM",
      acvRelevance: "high",
      objective: "Establish macro authority with executives through an original industry thesis.",
      whyThisWeek:
        "High-ACV weeks are trust-dominant. A macro POV early positions the founder as a peer to senior buyers.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Industry context: enterprise RevOps maturity",
        "Founder context: strategic observations",
      ],
      contextWeighting: { founder: 40, industry: 30, customer: 20, product: 10 },
      contentTypeRationale: "Founder macro POV / mental model for a senior audience.",
      risk: "critical",
      riskReason:
        "A category-defining thesis aimed at executives. High brand weight — must be confirmed as a founder-owned position.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip: "Anchor the thesis to evidence you can cite, or frame it explicitly as a forward-looking hypothesis.",
      draft:
        "Every enterprise I talk to has more RevOps tooling than it can use. What they don't have is agreement on who owns the number.\n\nThe next decade won't be won by better dashboards. It'll be won by clearer accountability — tools that make ownership obvious instead of optional.\n\nDraft thesis for your review.",
      hookAlternatives: ["More tools than they can use. Still no agreement on who owns the number."],
      image: { recommended: false, reason: "Executive-facing thesis lands best as considered text." },
      followsFounderVoice: true,
    },
    {
      id: "h2",
      title: "Enterprise case study: board-level reporting standardized across 6 BUs",
      author: "org",
      postType: "Org Case Study",
      funnel: "trust",
      targetPersona: "Enterprise buying committees and executives",
      scheduledDay: "Wed",
      scheduledSlot: "Wed · 10:00 AM",
      acvRelevance: "high",
      objective: "Deliver enterprise-grade proof with board-level ROI framing.",
      whyThisWeek:
        "Enterprise trust plays need a flagship proof point. A committee-ready case study is the week's anchor.",
      contextSources: [
        "Customer context: enterprise reference (approval pending)",
        "Product/brand context: multi-BU governance",
      ],
      contextWeighting: { customer: 45, product: 35, industry: 10, founder: 10 },
      contentTypeRationale: "Enterprise org case study with executive ROI.",
      risk: "critical",
      riskReason:
        "Enterprise customer reference with board-level claims. Requires customer approval and verified figures before publishing.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip: "Publish as an anonymized 'global enterprise' story with directional outcomes until the reference and numbers clear legal/customer sign-off.",
      draft:
        "Six business units, six definitions of 'revenue,' one very unhappy board.\n\nStandardizing reporting into one governed model gave the board a single number to trust — and gave each BU room to keep operating.\n\n[Customer reference and ROI figures pending approval.]",
      hookAlternatives: ["Six BUs, six definitions of revenue, one unhappy board."],
      proofBlocks: [
        "Scope: 6 business units, 1 governed model",
        "Outcome: board-level single source of truth",
        "ROI: figure pending verification",
      ],
      image: { recommended: true, type: "case-study", reason: "A governance/ROI summary graphic supports an executive read." },
    },
    {
      id: "h3",
      title: "A mental model for deciding what belongs on the board deck",
      author: "founder",
      postType: "Founder Playbook",
      funnel: "leads",
      targetPersona: "Senior GTM and finance leaders",
      scheduledDay: "Thu",
      scheduledSlot: "Thu · 8:15 AM",
      acvRelevance: "high",
      objective: "Offer an original framework that senior buyers keep and reference.",
      whyThisWeek:
        "A high-signal framework mid-week gives executives something durable, reinforcing authority without volume.",
      contextSources: [
        "Founder voice profile (Nina onboarding)",
        "Customer context: board-reporting friction",
        "Product/brand context: governance model",
      ],
      contextWeighting: { founder: 30, customer: 25, product: 25, industry: 20 },
      contentTypeRationale: "Founder original framework / mental model.",
      risk: "safe",
      riskReason: "Framework grounded in real customer work; no sharp positioning or unverified claims.",
      requiresExplicitApproval: false,
      approvalState: "pending",
      draft:
        "A metric earns a board slide only if it passes three tests: it changes a decision, someone owns it, and it can't be gamed without getting caught.\n\nEverything else is an appendix. Most board decks are 80% appendix.",
      hookAlternatives: ["Most board decks are 80% appendix. Here's the 20% test."],
      cta: "The full test is three questions — reply for the one-pager.",
      image: { recommended: true, type: "framework", reason: "A three-test framework diagram is highly referenceable for execs." },
      followsFounderVoice: true,
    },
    {
      id: "h4",
      title: "Analyst-referenced trend: governance is the new analytics buying criterion",
      author: "org",
      postType: "Research / Data",
      funnel: "leads",
      targetPersona: "Enterprise evaluators and analysts",
      scheduledDay: "Fri",
      scheduledSlot: "Fri · 9:30 AM",
      acvRelevance: "high",
      objective: "Reinforce category authority with a directional, evidence-based trend read.",
      whyThisWeek: "A research-flavored post closes the week with credibility that appeals to committees.",
      contextSources: ["Industry context: analyst commentary", "Customer context: enterprise RFP patterns"],
      contextWeighting: { industry: 40, customer: 25, product: 20, founder: 15 },
      contentTypeRationale: "Org research / trend post for category education.",
      risk: "critical",
      riskReason: "Cites analyst/industry claims. Must reference a real source or be framed as a directional observation, not fabricated research.",
      requiresExplicitApproval: true,
      approvalState: "needs_explicit_approval",
      softenTip: "Attach the actual source, or reframe as 'what we're seeing in enterprise RFPs' rather than implying formal research.",
      draft:
        "Two years ago, enterprise analytics RFPs led with features. Now they lead with governance and auditability.\n\nThe buyer changed. The question moved from 'what can it show me' to 'can I defend this number to the board.'\n\n[Source to be attached before publish.]",
      hookAlternatives: ["Enterprise RFPs stopped leading with features. Here's what replaced them."],
      image: { recommended: true, type: "data-viz", reason: "A simple trend chart supports a credible, data-flavored read." },
    },
  ];
}

export function buildWeeklyPlan(acvTier: ACVTier): WeeklyPlan {
  const cfg = TIER_CONFIG[acvTier];
  const cards =
    acvTier === "low" ? lowCards() : acvTier === "high" ? highCards() : mediumCards();

  const strategyNoteByTier: Record<ACVTier, string> = {
    low: "This week leans into volume and tactical wins. The founder is the distribution engine (build-in-public, contrarian takes, quick fixes) while the org page runs lead magnets and social proof. Recommendation: keep hooks sharp and ship daily.",
    medium: "This week is credibility-first. I opened with a founder category POV, backed it with a playbook and a proof-heavy org case study, then closed on a human founder lesson. Recommendation: prioritize the two critical cards — the POV stance and the case-study metric — since they carry the week's trust.",
    high: "This week is trust-dominant and low-volume. Every post is high-signal and aimed at senior buyers: a macro founder thesis, an enterprise case study, an executive framework, and a governance trend read. Recommendation: get customer/legal sign-off on the enterprise references early so the flagship case study isn't blocked.",
  };

  return {
    weekRange: weekRangeLabel(),
    acvTier,
    acvRange: cfg.range,
    objective: cfg.goal,
    strategyNote: strategyNoteByTier[acvTier],
    founderVoice: FOUNDER_VOICE,
    targetMix: cfg.mix,
    cards,
  };
}

// ─── Derived metrics used by the header + approval footer ────────────────────────

export interface PlanMetrics {
  total: number;
  founderCount: number;
  orgCount: number;
  safeCount: number;
  criticalCount: number;
  scheduledCount: number;
  pendingCount: number;
  needsApprovalCount: number;
  eligibleToSchedule: number; // safe + already-approved that aren't scheduled/skipped
  blockedCritical: number; // critical cards still awaiting explicit approval
  actualMix: WeeklyMix; // computed growth/leads/trust split (percent)
}

export function computeMetrics(cards: ContentCard[]): PlanMetrics {
  const active = cards.filter((c) => c.approvalState !== "skipped");
  const total = active.length;
  const founderCount = active.filter((c) => c.author === "founder").length;
  const orgCount = active.filter((c) => c.author === "org").length;
  const safeCount = active.filter((c) => c.risk === "safe").length;
  const criticalCount = active.filter((c) => c.risk === "critical").length;
  const scheduledCount = active.filter((c) => c.approvalState === "scheduled").length;
  const pendingCount = active.filter((c) => c.approvalState === "pending").length;
  const needsApprovalCount = active.filter(
    (c) => c.approvalState === "needs_explicit_approval"
  ).length;

  const eligibleToSchedule = active.filter(
    (c) =>
      c.approvalState === "approved" ||
      (c.approvalState === "pending" && c.risk === "safe")
  ).length;

  const blockedCritical = active.filter(
    (c) => c.risk === "critical" && c.approvalState === "needs_explicit_approval"
  ).length;

  const counts = { growth: 0, leads: 0, trust: 0 };
  active.forEach((c) => {
    counts[c.funnel] += 1;
  });
  const denom = total || 1;
  const actualMix: WeeklyMix = {
    growth: Math.round((counts.growth / denom) * 100),
    leads: Math.round((counts.leads / denom) * 100),
    trust: Math.round((counts.trust / denom) * 100),
  };

  return {
    total,
    founderCount,
    orgCount,
    safeCount,
    criticalCount,
    scheduledCount,
    pendingCount,
    needsApprovalCount,
    eligibleToSchedule,
    blockedCritical,
    actualMix,
  };
}

// ─── Backend transport ───────────────────────────────────────────────────────────
// Robert's routes live on the main Weez backend under /robert. We authenticate
// with the JWT in sessionStorage (same pattern as weezAPI.fetchWithBypass) and
// fall back to the local mock generator whenever the backend is unreachable,
// unauthorized (dev/demo spaces), or errors — so the page never breaks.

const isRealBrandId = (id?: string): id is string =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function robertFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${ROBERT_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Robert backend error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

// Post copy must be final/publishable. Strip any bracketed placeholders
// ("[... pending ...]") or meta "for review" / "pending" lines that slipped
// through — this also cleans plans generated & cached before the prompt fix.
const _PLACEHOLDER = /\[[^\]\n]*\]/;
const _PLACEHOLDER_G = /\[[^\]\n]*\]/g;
const _META_LINE =
  /^\s*(proposed\b.*\bfor review\b.*|draft\b.*\bfor (your )?review\b.*|.*\bpending (confirmation|permission|approval|final|review)\b.*)\s*[:.]?\s*$/i;

function cleanText(text?: string | null): string {
  if (!text) return "";
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (_PLACEHOLDER.test(line)) {
      const cleaned = line.replace(_PLACEHOLDER_G, "").trim();
      if (cleaned.length < 3 || cleaned.endsWith(":")) {
        while (out.length && !out[out.length - 1].trim()) out.pop();
        if (out.length && out[out.length - 1].trim().endsWith(":")) out.pop();
        continue;
      }
      out.push(cleaned);
      continue;
    }
    if (_META_LINE.test(line)) {
      while (out.length && !out[out.length - 1].trim()) out.pop();
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeCard(card: ContentCard): ContentCard {
  return {
    ...card,
    draft: cleanText(card.draft),
    cta: card.cta ? cleanText(card.cta) || undefined : card.cta,
    hookAlternatives: (card.hookAlternatives || []).map((h) => cleanText(h)).filter((h) => h.length > 0),
    proofBlocks: card.proofBlocks
      ? card.proofBlocks.map((p) => cleanText(p)).filter((p) => p.length > 0)
      : card.proofBlocks,
  };
}

function sanitizePlan(plan: WeeklyPlan): WeeklyPlan {
  return { ...plan, cards: (plan.cards || []).map(sanitizeCard) };
}

function planContextString(plan: WeeklyPlan, metrics: PlanMetrics): string {
  const critical = plan.cards
    .filter((c) => c.risk === "critical")
    .map((c) => `- ${c.title} (${c.author})`)
    .join("\n");
  return [
    `Week: ${plan.weekRange} · ACV: ${plan.acvTier} (${plan.acvRange})`,
    `Posts: ${metrics.total} (${metrics.founderCount} founder, ${metrics.orgCount} org)`,
    `Safe/Critical: ${metrics.safeCount}/${metrics.criticalCount} · ${metrics.needsApprovalCount} need approval`,
    `Target mix G:L:T = ${plan.targetMix.growth}:${plan.targetMix.leads}:${plan.targetMix.trust}; actual = ${metrics.actualMix.growth}:${metrics.actualMix.leads}:${metrics.actualMix.trust}`,
    critical ? `Critical posts:\n${critical}` : "No critical posts.",
  ].join("\n");
}

// Backend generation stage — powers the frontend's real-time progress UI.
export type GenStage = "starting" | "context" | "writing" | "reviewing" | string;

interface PlanResponse {
  status: "ready" | "generating" | "error" | "unknown";
  plan?: WeeklyPlan;
  error?: string;
  stage?: GenStage;
}

// Generation runs as a background job on the server (it takes ~45-60s, too long
// for one HTTP request). We poll the status endpoint until the plan is ready,
// forwarding each live stage to `onProgress` so the UI can animate real work.
async function pollForPlan(
  spaceId: string,
  acvTier: ACVTier,
  onProgress?: (stage: GenStage) => void,
  intervalMs = 2500,
  maxMs = 300000
): Promise<WeeklyPlan> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let s: PlanResponse;
    try {
      s = await robertFetch<PlanResponse>(
        `/plan/status?brand_id=${encodeURIComponent(spaceId)}&acv_tier=${acvTier}`
      );
    } catch {
      continue; // transient network hiccup — keep polling until the deadline
    }
    if (s.status === "ready" && s.plan) return s.plan;
    if (s.status === "error") {
      throw new Error(s.error || "Robert couldn't generate this week's content.");
    }
    if (s.stage) onProgress?.(s.stage); // "generating" → report the live stage
  }
  throw new Error("Robert is taking longer than usual to write this week. Please try again.");
}

export const robertAPI = {
  /**
   * Weekly content plan for a space at a given ACV tier.
   * Launches (or reads) a background GPT-5.2 generation job and polls until ready.
   */
  getWeeklyPlan: async (
    spaceId: string,
    acvTier: ACVTier,
    force = false,
    onProgress?: (stage: GenStage) => void
  ): Promise<WeeklyPlan> => {
    if (isRealBrandId(spaceId)) {
      // Real space → real GPT-5.2 content. Errors PROPAGATE so the UI shows a
      // retry instead of silently masking the failure with sample content.
      const start = await robertFetch<PlanResponse>(
        `/plan?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "POST", body: JSON.stringify({ acv_tier: acvTier, force }) }
      );
      if (start.status === "ready" && start.plan) return sanitizePlan(start.plan);
      if (start.status === "error") {
        throw new Error(start.error || "Robert couldn't generate this week's content.");
      }
      // generating → poll the status endpoint until the job finishes
      onProgress?.(start.stage || "starting");
      return sanitizePlan(await pollForPlan(spaceId, acvTier, onProgress));
    }
    // Demo / non-UUID space only: local sample so the page is still explorable.
    await new Promise((r) => setTimeout(r, 300));
    return sanitizePlan({ ...buildWeeklyPlan(acvTier), isDemo: true });
  },

  /**
   * Regenerate a single content card. Calls POST /robert/card/regenerate;
   * falls back to a local hook-swap rewrite.
   */
  regenerateCard: async (
    card: ContentCard,
    spaceId?: string,
    acvTier: ACVTier = "medium"
  ): Promise<ContentCard> => {
    if (isRealBrandId(spaceId)) {
      try {
        const next = await robertFetch<ContentCard>(
          `/card/regenerate?brand_id=${encodeURIComponent(spaceId)}`,
          { method: "POST", body: JSON.stringify({ acv_tier: acvTier, card }) }
        );
        return sanitizeCard(next);
      } catch (e) {
        console.warn("[robert] card regenerate failed, using local fallback:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    const alt = card.hookAlternatives[0];
    if (!alt) return { ...card };
    const [firstLine, ...rest] = card.draft.split("\n");
    return sanitizeCard({
      ...card,
      draft: [alt, ...rest].join("\n"),
      hookAlternatives: [firstLine, ...card.hookAlternatives.slice(1)],
    });
  },

  /**
   * Persist an approval/edit change to a card. Best-effort — never throws.
   * Calls PATCH /robert/card.
   */
  updateCard: async (
    spaceId: string | undefined,
    acvTier: ACVTier,
    cardId: string,
    patch: Partial<ContentCard>
  ): Promise<void> => {
    if (!isRealBrandId(spaceId)) return;
    try {
      await robertFetch(`/card?brand_id=${encodeURIComponent(spaceId)}`, {
        method: "PATCH",
        body: JSON.stringify({ acv_tier: acvTier, card_id: cardId, patch }),
      });
    } catch (e) {
      console.warn("[robert] card persist failed (non-blocking):", e);
    }
  },

  /**
   * Robert's strategic chat. Calls POST /robert/chat; falls back to the local
   * guardrail-respecting responder.
   */
  chat: async (
    question: string,
    plan: WeeklyPlan,
    metrics: PlanMetrics,
    spaceId?: string
  ): Promise<string> => {
    if (isRealBrandId(spaceId)) {
      try {
        const data = await robertFetch<{ response: string }>(
          `/chat?brand_id=${encodeURIComponent(spaceId)}`,
          {
            method: "POST",
            body: JSON.stringify({
              acv_tier: plan.acvTier,
              message: question,
              plan_context: planContextString(plan, metrics),
            }),
          }
        );
        return data.response;
      } catch (e) {
        console.warn("[robert] chat failed, using local fallback:", e);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    return robertReply(question, plan, metrics);
  },

  /**
   * Generate a focused, type-accurate image for a card that recommends one.
   * Runs as a backend job (gpt-image-2 is slow); starts it then polls until ready.
   * Returns the updated image object (with `url`). Throws on failure.
   */
  generateCardImage: async (
    spaceId: string | undefined,
    acvTier: ACVTier,
    card: ContentCard
  ): Promise<ImageRecommendation> => {
    if (!isRealBrandId(spaceId)) {
      throw new Error("Image generation needs a real workspace (not the demo space).");
    }
    if (!card.image?.recommended) {
      throw new Error("This post is text-first — no image is recommended.");
    }
    const start = await robertFetch<CardImageResponse>(
      `/card/image?brand_id=${encodeURIComponent(spaceId)}`,
      { method: "POST", body: JSON.stringify({ acv_tier: acvTier, card_id: card.id }) }
    );
    if (start.status === "ready" && start.image?.url) return start.image;
    if (start.status === "not_recommended") throw new Error("This post is text-first — no image recommended.");
    if (start.status === "not_found") throw new Error("Post not found on the server. Regenerate the week first.");
    if (start.status === "error") throw new Error(start.error || "Image generation failed.");
    return await pollCardImage(spaceId, acvTier, card.id);
  },
};

interface CardImageResponse {
  status: "idle" | "generating" | "ready" | "error" | "not_recommended" | "not_found";
  image?: ImageRecommendation;
  error?: string;
}

async function pollCardImage(
  spaceId: string,
  acvTier: ACVTier,
  cardId: string,
  intervalMs = 3000,
  maxMs = 240000
): Promise<ImageRecommendation> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let s: CardImageResponse;
    try {
      s = await robertFetch<CardImageResponse>(
        `/card/image/status?brand_id=${encodeURIComponent(spaceId)}&acv_tier=${acvTier}&card_id=${encodeURIComponent(cardId)}`
      );
    } catch {
      continue;
    }
    if (s.status === "ready" && s.image?.url) return s.image;
    if (s.status === "error") throw new Error(s.image?.error || s.error || "Image generation failed.");
  }
  throw new Error("The image is taking longer than usual. Please try again.");
}

// ─── Local strategic responder ───────────────────────────────────────────────────
// Robert may hold opinions on inbound strategy, but must frame them as recommendations
// and never present them as the founder's own stated view.

export function robertReply(
  question: string,
  plan: WeeklyPlan,
  metrics: PlanMetrics
): string {
  const q = question.toLowerCase();
  const cfg = TIER_CONFIG[plan.acvTier];

  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  if (has("critical", "why is", "flagged", "risk")) {
    const crit = plan.cards.filter((c) => c.risk === "critical");
    const lines = crit
      .map((c) => `- **${c.title}** — ${c.riskReason}`)
      .join("\n");
    return `**${metrics.criticalCount} posts are tagged critical** this week. Critical means the post needs an explicit founder yes before it can be scheduled — usually because of a positioning stance, a customer reference, a metric, or competitive framing.\n\n${lines}\n\nMy recommendation: clear these first. Each one has a softening option if you'd rather de-risk than approve outright.`;
  }

  if (has("ratio", "mix", "split", "balance")) {
    return `For ${cfg.label} (${cfg.range}), my recommended split is Growth ${plan.targetMix.growth} : Leads ${plan.targetMix.leads} : Trust ${plan.targetMix.trust}. This week's actual plan sits at Growth ${metrics.actualMix.growth} : Leads ${metrics.actualMix.leads} : Trust ${metrics.actualMix.trust}, with ${metrics.founderCount} founder and ${metrics.orgCount} org posts.\n\nStrategy recommendation: ${cfg.shape} If you want to shift the balance, tell me the goal (more pipeline, more reach, more authority) and I'll rebuild the week.`;
  }

  if (has("founder", "voice", "more like me", "sound like")) {
    return `Founder posts this week are written to your stated voice from Nina's onboarding: ${plan.founderVoice}\n\nIf a draft feels off, point me at the specific card and tell me what's not you — too polished, too soft, wrong opener — and I'll rewrite it in your voice. I keep founder content text-first by default, so I won't add a visual unless it genuinely helps (a framework or proof).`;
  }

  if (has("working", "performing", "learn", "engagement", "results")) {
    return `Recommendation based on what tends to work for ${cfg.label} B2B SaaS: the content that pulls the right buyers is proof-led and specific — playbooks, real case studies, and grounded founder lessons — not vanity reach.\n\nOnce we have your own performance data, I'll weight next week toward the themes that drove qualified replies and demos, and quietly retire formats that only earn empty likes. Right now I'm optimizing for qualified conversations, not raw engagement.`;
  }

  if (has("low", "medium", "high", "acv", "tier")) {
    return `Quick tier map:\n\n- **Low ACV** (${TIER_CONFIG.low.range}) → volume + reach, founder-heavy, mix ${TIER_CONFIG.low.mix.growth}:${TIER_CONFIG.low.mix.leads}:${TIER_CONFIG.low.mix.trust}.\n- **Medium ACV** (${TIER_CONFIG.medium.range}) → credibility + qualified pipeline, balanced, mix ${TIER_CONFIG.medium.mix.growth}:${TIER_CONFIG.medium.mix.leads}:${TIER_CONFIG.medium.mix.trust}.\n- **High ACV** (${TIER_CONFIG.high.range}) → authority + enterprise trust, low volume, mix ${TIER_CONFIG.high.mix.growth}:${TIER_CONFIG.high.mix.leads}:${TIER_CONFIG.high.mix.trust}.\n\nYou're viewing **${cfg.label}**. Switch the tier selector and I'll re-plan the whole week around it.`;
  }

  if (has("image", "visual", "diagram", "picture")) {
    const withImg = plan.cards.filter((c) => c.image.recommended).length;
    return `I recommend a visual on ${withImg} of ${plan.cards.length} posts this week. Founder posts default to text-only — I only add a visual when it materially helps (a framework diagram, a workflow, or case-study proof). Org posts use visuals more freely for demos, comparisons and ROI summaries. I never add decorative AI art.`;
  }

  if (has("skip", "delete", "block", "eligible", "schedule")) {
    return `Right now ${metrics.eligibleToSchedule} posts are eligible to schedule (safe or already approved). ${metrics.blockedCritical} critical posts are still blocked pending your explicit approval. One blocked critical post never holds up the rest of the week — you can schedule everything eligible now and clear the critical ones separately.`;
  }

  if (has("why", "this week", "plan", "reason")) {
    return `${plan.strategyNote}\n\nThe week is built for ${cfg.label} (${cfg.range}), where the goal is: ${cfg.goal.toLowerCase()}. That's why the mix is weighted Growth ${plan.targetMix.growth} : Leads ${plan.targetMix.leads} : Trust ${plan.targetMix.trust}.`;
  }

  // Default
  return `I'm Robert, your content head. This week I've planned ${metrics.total} posts for ${cfg.label} — ${metrics.founderCount} founder, ${metrics.orgCount} org, with ${metrics.criticalCount} needing your explicit approval.\n\nAsk me things like: “why is this week planned like this?”, “why is a post critical?”, “change the mix for our ACV”, “make the founder posts sound more like me”, or “what's working in our category?”`;
}

export default robertAPI;
