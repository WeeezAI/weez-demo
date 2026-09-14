// pages/ProspectIntelligence.tsx
//
// Prospect Intelligence — the decision-maker view over the prospects that have been
// **enriched**. It reads the *same* Cosmos-backed workspace Eva does (GET /eva/workspace →
// eva_leads container) and reshapes it: prospects grouped by company, the resolved
// decision-maker per lead, and a dossier that answers who / why them / why now / what to
// open with.
//
// ─── What is on this page, and what is not ────────────────────────────────────
//
// **Only the leads Enrich Now promoted.** Discovery's full output — every qualified
// account Eva found — lives on Revenue Intelligence, which is where Enrich Now is pressed.
// This page is what comes back from it.
//
// That split is not presentational. Every control here beyond the dossier belongs to the
// GTM lifecycle — Activate Intelligence, the ranked next move, Contact Directly — and every
// one of those routes keys on `sales_leads.id`. Enrich Now is the only thing that creates
// that row (`lead_promotion.promote()`, from the `/eva/lead/enrich` route and nowhere else),
// so a lead that has not been enriched has no GTM identity at all. Listing it here would
// mean rendering a dossier with nothing in it above controls certain to 404.
//
// The filter is `evaAPI.isEnrichedProspect`, which reads `gtmLeadId` — the promoted id,
// written back onto the document. It deliberately does *not* read `enrichment.status` or
// `handoffState`: the workspace sweep in `core/eva/service.py` sets both of those for any
// lead that *arrives* carrying a contact email, with no enrichment and no promotion, so
// either one would put unworkable prospects on this page.
//
// `qualifiedLeads` is kept beside `activeLeads` for the empty states, because "discovery
// has found nothing yet" and "discovery found forty accounts and none is enriched" need
// different sentences and different next steps.
//
// Grounding rule: every number and sentence on this page comes from a field on
// the workspace payload. Nothing is scored, invented or rotated client-side.
// When a field is missing we say so instead of filling the gap.
//
// ─── The GTM state overlay (R28.2, R28.7) ─────────────────────────────────────
//
// Each decision-maker row and each dossier also carries where the prospect stands
// in the GTM journey, how urgent the live recommendation is, and what intent has
// been observed. None of that is on the Eva workspace payload — it belongs to the
// prospect state engine — so it is read through `services/gtmAPI.ts` and joined
// onto Eva's leads by `leadId`, which is `sales_leads.id` and the only id every GTM
// route answers to (see `gtmLeadIdOf`).
//
// **Two reads, both cheap, and neither one per row.**
//
//   `gtmAPI.getActionQueue()`  one read for the whole page. The queue is one row
//                              per prospect with a live recommendation and carries
//                              `journeyState`, `priorityTier`, `actionType` and
//                              `channel` on each, so a single call fills the
//                              journey badge and the tier for every row on screen.
//                              `getProspectState()` also carries `journeyState`,
//                              but only for one lead — firing it per row would be
//                              one request per decision-maker on mount, which is
//                              exactly what a company with twelve contacts must
//                              not cost.
//   `gtmAPI.getProspectState()` one read for the *selected* lead only, because the
//                              eleven Intent records live on `ProspectStateFull`
//                              and on no list payload. So the intent summary is a
//                              dossier field rather than a row field: the dossier
//                              shows one prospect at a time, and that is the whole
//                              reason it is affordable here.
//
// **Absence is absence.** A prospect with no live recommendation has no tier and
// no queue-side journey value, and both render as *absent* — never as `LATER`,
// which is a real tier, and never as `UNKNOWN`, which would be a claim we looked.
// Where the single queue read did not reach the end of the queue we say only that
// the row was not on the page we read, because "not found in a truncated list" and
// "has no live recommendation" are different facts. An intent summary with nothing
// behind it says so rather than showing a zero.
//
// **Neither read can take the dossier down.** Both are secondary: their failures
// are held in their own state, surfaced as a line of text next to the fields they
// would have filled, and never touch `ws`, `loading` or `error`. Eva's rows render
// exactly as they did before whether or not the GTM layer answers.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Brain,
  Building2,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Flag,
  Globe,
  Info,
  Layers,
  Linkedin,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  Radar,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
  Signal as SignalIcon,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConversationSidebar from "@/components/ConversationSidebar";
import { JourneyStateBadge } from "@/components/gtm/JourneyStateBadge";
import {
  ACTION_CARD_LABELS,
  NextActionPanel,
  PRIORITY_TIER_LABELS,
  actionIdempotencyKey,
} from "@/components/gtm/NextActionPanel";
import { INTENT_PANEL_LABELS, IntentPanel } from "@/components/gtm/IntentPanel";
// The one spelling of absence, for the measure lines this page composes itself. The
// primitive that carries it is no longer imported here: every observed fact on the surface
// now reaches the screen through a folded-in panel that owns its own `ObservedValue`.
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
// The band words and the plain-English meaning behind each measure. The dossier renders a
// measure the way the queue page does — the reading first, the number after — rather than
// putting a bare 0-100 integer in front of a rep. See `measure.ts` for why the banding is
// the UI's own and why the number is never replaced by it.
import { MEASURE_MEANINGS, measureParts } from "@/components/gtm/measure";
import {
  CreditBalanceBadge,
  CreditPriceTag,
} from "@/components/gtm/CreditBalance";
import { InsufficientCreditsAlert } from "@/components/gtm/InsufficientCreditsAlert";
import { useCredits } from "@/hooks/useCredits";
import { WorkspaceSetupChecklist } from "@/components/setup/WorkspaceSetupChecklist";
import { useWorkspaceSetup } from "@/hooks/useWorkspaceSetup";
import {
  CHANNEL_LABEL,
  GTM_ABSENCE_LABELS,
  GTM_CONNECTION_LABELS,
  GTM_IDENTITY_CONFIRM_LABELS,
  GTM_INTENT_LABELS,
  GTM_JOURNEY_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  GTM_IDENTITY_LABELS,
  PROSPECT_STAGE_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  // The two remaining Contact gates, read by `contactGateOf()` below. It is the only
  // thing on this page that needs this table now that the activation gate is gone.
  CONTACT_DIRECTLY_LABELS,
  TONE as GTM_TONE,
} from "@/components/gtm/labels";
// `trackRefusal` lives with the identity block that owns the gate, not in the label table.
import { trackRefusal } from "@/components/gtm/IdentityPanel";
// `isInsufficientCredits` arrives under its own name because `evaAPI` exports a predicate
// called the same thing, and this page's paid controls are served by both transports. See
// `isCreditRefusal`.
import gtmAPI, {
  isInsufficientCredits as isGtmInsufficientCredits,
  type ActionQueueItem,
  type CandidateAction,
  type IdentityResolution,
  type Intent,
  type LearningScopeDecision,
  type LearningUpdate,
  type NextBestAction,
  type ProspectDetail,
  type ProspectStateFull,
  type ProspectTracking,
  type RelationshipState,
  type TimingState,
} from "@/services/gtmAPI";
import { ProspectDecision } from "@/components/gtm/ProspectDecision";
import { NextBestActionCard } from "@/components/gtm/NextBestActionCard";
// The panels folded in from `GTMProspect`, reused exactly as they are. This restructure is
// composition and hierarchy: not one of them is reimplemented, subclassed or wrapped, and
// no panel is introduced for a job a panel already does (R20.1).
//
// Where each lands is §2.2's table: `ProspectHeader` in band 2, `ActionExplanation` in
// band 4, `ActivityPanel` in band 5, `NextActionPanel` in band 7 beside the recommendation
// card, `IdentityConfirmPanel` beside the decision when the server has a candidate to
// settle, and the remaining eight inside the disclosure inventory below.
import { ActionExplanation } from "@/components/gtm/ActionExplanation";
import { ActivityPanel } from "@/components/gtm/ActivityPanel";
import { BuyingStagePanel } from "@/components/gtm/BuyingStagePanel";
import { CTAReadinessPanel } from "@/components/gtm/CTAReadinessPanel";
import { ChannelIntelligencePanel } from "@/components/gtm/ChannelIntelligencePanel";
import { ChannelRecommendationPanel } from "@/components/gtm/ChannelRecommendationPanel";
import { ConnectionPanel } from "@/components/gtm/ConnectionPanel";
// The Contextual_Outreach_Surface's fifth slot, whole (§7). It owns the channel section
// label, the first generation and the open-channel control, and it mounts `MessageComposer`
// itself — which is why nothing here rebuilds any of that (R20.1).
import { ContactDirectlyPanel } from "@/components/gtm/ContactDirectlyPanel";
import {
  IdentityConfirmPanel,
  hasCandidateToSettle,
} from "@/components/gtm/IdentityConfirmPanel";
import { LearningInsightsPanel } from "@/components/gtm/LearningInsightsPanel";
import { ProspectHeader } from "@/components/gtm/ProspectHeader";
import { StateDimensionGrid } from "@/components/gtm/StateDimensionGrid";
import { StateHistoryPanel } from "@/components/gtm/StateHistoryPanel";
import { SignalList } from "@/components/gtm/SignalList";
import { ProspectTimeline } from "@/components/gtm/ProspectTimeline";
import {
  isIntelligenceActive,
  prospectStageOf,
  showsDecision,
  type ProspectStage,
} from "@/components/gtm/prospectStage";
import {
  evaAPI,
  isEnrichedProspect,
  isInsufficientCredits,
  ACTION_META,
  ENRICHMENT_META,
  SIGNAL_META,
  TIER_META,
  tierMeta,
  type ACVTier,
  type ChannelSignal,
  type EvaAction,
  type EvaWorkspace,
  type QualifiedLead,
  type ScanStage,
} from "@/services/evaAPI";

/**
 * Whether a priced write was refused because the workspace could not afford it (`402`).
 *
 * **Both transports, because this page uses both.** Enrich Now is `evaAPI.enrichLead` and
 * raises `EvaApiError`; Activate Intelligence (`gtmAPI.trackProspect`) and Send Connection
 * Request (`gtmAPI.requestAction`) raise `GtmApiError`. Each service's predicate is an
 * `instanceof` check against its own error type, so either one alone answers `false` for the
 * other's refusal — and a `402` that answers `false` here falls into the error branch beside
 * the control, which is the one wrong answer for a paywall: it reports a fault and invites a
 * retry that will be refused identically, and it never says the words that make a refusal
 * survivable — the action was not performed and nothing was charged (R17.6).
 *
 * Neither exported predicate is widened to cover the other's error: each is correct about
 * its own transport, and the union belongs to the caller that spans both.
 */
function isCreditRefusal(error: unknown): boolean {
  return isInsufficientCredits(error) || isGtmInsufficientCredits(error);
}

// ─── Tone → tailwind chip classes (same palette as Eva / Max) ──────────────────

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

function PanelTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: typeof Target;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        <Icon className="h-3.5 w-3.5" /> {children}
      </p>
      {right}
    </div>
  );
}

/**
 * The one retry control, beside every failure statement on this page (R18.5).
 *
 * Every read here owns a `failed` boolean and a `refresh()`, and this is the third part of
 * that pair: the press. One component rather than the same six lines of button markup at
 * each failure site, because a failure statement with no way to try again is a dead end and
 * the way to make sure none of them is missing one is to make adding it a single element.
 *
 * `GTM_PAGE_LABELS.retry` and never an inline string, so the whole product asks to try
 * again in the same words.
 */
function RetryButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-7 shrink-0 gap-1.5 rounded-full border-zinc-200 bg-white text-[11px]",
        className
      )}
      onClick={onClick}
    >
      <RotateCcw className="h-3 w-3" aria-hidden="true" /> {GTM_PAGE_LABELS.retry}
    </Button>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold leading-none text-zinc-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function LogoMark({ seed, className = "h-9 w-9" }: { seed: string; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white", className)}
      style={{ background: "linear-gradient(135deg,#8b5cf6,#0ea5e9)" }}
    >
      {seed}
    </div>
  );
}

// Brand logo with graceful fallback: backend logoUrl → favicon → initials.
function CompanyLogo({
  logoUrl,
  domain,
  company,
  className = "h-9 w-9",
}: {
  logoUrl?: string;
  domain?: string;
  company: string;
  className?: string;
}) {
  const seed = (company || "AC").slice(0, 2).toUpperCase();
  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : "";
  const sources = useMemo(() => [logoUrl, favicon].filter(Boolean) as string[], [logoUrl, favicon]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [logoUrl, domain]);

  if (idx >= sources.length) return <LogoMark seed={seed} className={className} />;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-white", className)}>
      <img
        src={sources[idx]}
        alt={`${company} logo`}
        onError={() => setIdx((i) => i + 1)}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}

// ─── Small grounded formatters ────────────────────────────────────────────────

// `toPercent` used to live here, normalising a 0–1 or 0–100 confidence for display. It went
// with the two things that read it: the email-confidence line in the identity band and the
// per-signal confidence in the Eva signal timeline. A confidence value is evidence about a
// statement rather than a statement, so R8.8 puts it inside an evidence disclosure and R9.9
// keeps it out of a primary band — a rep decides the same way at 71% as at 68%.

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** Backend prefixes primaryEvent with "[event_type] " — strip it for display. */
function stripEventPrefix(text?: string | null): string {
  return (text || "").replace(/^\[[^\]]+\]\s*/, "").trim();
}

function hostOf(lead: QualifiedLead): string {
  return (lead.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || lead.domain || "";
}

// ─── The GTM state overlay ────────────────────────────────────────────────────

/**
 * The strings this overlay needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` and
 * `GTMActionQueue.tsx`'s `ACTION_QUEUE_LABELS` established, because `labels.ts` was
 * closed for this feature. They belong there beside `GTM_PAGE_LABELS`, and moving
 * them is a one-line change at each use site.
 *
 * Everything already in `labels.ts` is taken from there rather than restated:
 * `GTM_JOURNEY_LABELS`, `GTM_PRIORITY_TIER_LABELS` (through `PRIORITY_TIER_LABELS`),
 * `GTM_INTENT_LABELS`, `GTM_UI_LABELS.computed`, `ACTION_CARD_LABELS.priority` and
 * `.expectedOutcome`, `MEASURE_MEANINGS` and the band words from `measure.ts`, every
 * sentence in `GTM_ABSENCE_LABELS`, every stage label in `PROSPECT_STAGE_LABELS`,
 * `INTENT_PANEL_LABELS.neverEvaluated`, every summary and note in
 * `PROSPECT_INTELLIGENCE_SECTIONS`, and the connection and identity-confirm notices in
 * `GTM_CONNECTION_LABELS` and `GTM_IDENTITY_CONFIRM_LABELS`.
 *
 * No entry states or implies that Weez sends anything. Nothing here names a channel: the
 * action titles and the channel names it used to carry belong to `NextBestActionCard`, which
 * is the one place a recommendation is stated.
 *
 * The three absence strings are three different facts and are deliberately not one
 * string. `noRecommendation` is a statement about the prospect — the queue was read
 * to its end and this lead is not on it. `notOnQueuePage` is a statement about the
 * read — the queue was longer than the one page we took, so we do not know. And
 * `overlayFailed` is a statement about us. None of them is a tier, because `LATER`
 * is a real tier and would be a plausible-looking lie.
 *
 * They are also *not* the sentences band 4 uses for a missing recommendation: those are
 * `GTM_ABSENCE_LABELS`', keyed on the stage table, and `nbaAbsenceStatement()` picks between
 * them. Two vocabularies, two subjects — the queue read, and the ranking — and no third.
 */
export const PROSPECT_GTM_LABELS = {
  /**
   * Band 6's heading, and it names one thing.
   *
   * It read "Journey, priority & intent" while this panel carried all three. The journey
   * projection is band 3's now — it is where the prospect *stands*, which is what "current
   * status" means — and the priority tier rides on the Next Best Action card, which is the
   * only place a ranking band means anything. What is left is the band the hierarchy asks
   * for: what this prospect is currently interested in.
   */
  sectionTitle: "Current buying intent",
  journeyLabel: "Journey",
  intentHeading: "Intent observed",

  /**
   * Band 4's own heading, used where there is no server recommendation to head it.
   *
   * The string the band carried inline before the bands were named. Kept verbatim: it is
   * Eva's persisted qualification reason underneath, and "why this prospect" is exactly
   * what that answers.
   */
  whyThisProspect: "Why this prospect",

  /** Band 5's heading. The band is the prospect's activity, whoever observed it. */
  activityHeading: "Activity",

  /** Band 4's EPS_Summary: the heading over the four dimensions the ranking recorded. */
  epsHeading: "How this was prioritised",

  /**
   * The four scoring dimensions, as meanings rather than as field names (R8.4).
   *
   * Four and not six: the other two banding inputs — the Action_Confidence and the
   * relationship reading — are not measures on this row, and `NextBestActionCard` already
   * carries the tier they produced. `ACTION_CARD_LABELS.expectedOutcome` supplies the
   * fourth name, so the same dimension is not called two things on two surfaces.
   */
  epsUrgency: "Urgency",
  epsBusinessValue: "Business value",
  epsSignalFreshness: "Signal freshness",

  /**
   * What the tier is banded from, so the badge reads as re-derivable and not as a verdict.
   *
   * No longer sends the reader anywhere: the full ranking used to live on the prospect's own
   * page, and that page folded into this one.
   */
  tierNote:
    "Banded from urgency, expected outcome, business value, signal freshness, action confidence and relationship state. The four that are measures are above; the tier is on the recommendation itself.",

  /** The three absences, kept apart. */
  noRecommendation: "No live recommendation — nothing is ranked for this prospect",
  notOnQueuePage: "Not on the page of the queue we read — priority unknown here",
  overlayFailed: "Couldn't read the journey and priority for this prospect",

  /** Absence in a row chip, where there is no room for the sentence above it. */
  noRecommendationShort: "No live recommendation",
  notOnQueuePageShort: "Priority unknown",
  overlayFailedShort: "Journey unavailable",

  /**
   * The intent summary's own absences. `noIntentObserved` is the plural of
   * `INTENT_PANEL_LABELS.noSupport`: every one of the eleven types was evaluated and
   * none is supported, which is a real answer and not an empty state.
   */
  noIntentObserved: "Nothing observed for any intent type",
  intentUnavailable: "Couldn't read the intent records for this prospect",
  intentLoading: "Reading intent records",
  intentNote: "Eleven types are held separately. The strongest observed are shown here.",

  /**
   * ── The Contextual_Outreach_Surface (§7) ──
   *
   * A region inside the dossier, not a page (R12.3), opened by two presses and by nothing
   * else. Its copy says what arrived with the operator rather than asking for anything: the
   * prospect and the recommendation are the current selection's, so there is no picker here
   * and no sentence implying one (R12.2).
   *
   * `outreachRecommendation` heads a *statement* of the recommended action, read through
   * `GTM_NBA_ACTION_LABELS` — the same table `NextBestActionCard` reads, so the action is
   * named one way on the surface rather than two. No second vocabulary is introduced.
   */
  outreachHeading: "Reach out",
  outreachNote:
    "The prospect, the recommendation and the reason came with you. Weez never sends anything — you review the draft and open the channel yourself.",
  outreachProspect: "Who this is for",
  outreachRecommendation: "What Weez recommends",
  outreachAngleHeading: "Conversation angle",
  outreachAngleCopy: "Copy brief",
  /**
   * Where the angle's four fields come from, and what generates and what does not.
   *
   * The sentence used to end "Max writes the actual copy", which was true while this panel
   * sat at the bottom of the dossier and no composer was anywhere near it. It sits beside
   * `MessageComposer` now, so that clause would point at the wrong writer. What it has to
   * keep saying — and does — is that the angle itself is assembled from persisted fields and
   * is not generated.
   */
  outreachAngleNote:
    "Assembled from Eva's captured event, her qualification reason and your saved ICP positioning — nothing here is generated. The draft below is written from the same grounded facts.",
  outreachAngleEmpty:
    "Not enough grounded context for an angle yet — no event, reason or ICP value prop stored.",
} as const;

/**
 * How often, and how many times, to re-check for a queued identity verdict.
 *
 * Six seconds apart and twenty tries — two minutes of watching. Bounded deliberately: an
 * unbounded poll on a job that never completes is a tab quietly re-reading forever, and the
 * honest fallback is to say the search is still queued rather than to keep asking.
 */
export const IDENTITY_POLL_MS = 6000;
export const IDENTITY_POLL_LIMIT = 20;

/**
 * The verdict as one comparable string, so the poll can tell a *new* answer from the old one.
 *
 * The reason this is needed at all: `POST /resolve-identity` queues a search and does not
 * clear the verdict it is about to replace. So a lead that already reads `NO_MATCH` still
 * reads `NO_MATCH` on the first poll after a re-run, and a poll that treated any non-null
 * verdict as the answer would report the *previous* search's result as this one's — telling
 * the operator "we couldn't verify this person" about a lookup still in the queue.
 *
 * The three fields are the whole verdict half of `sales_leads`, and `getProspect` and
 * `resolve-identity` both answer with all three, so the baseline and the poll are comparing
 * the same columns rather than two views of them.
 */
export function identityVerdict(
  status: string | null,
  verifiedAt: string | null,
  confidence: number | null
): string {
  return `${status ?? ""}|${verifiedAt ?? ""}|${confidence ?? ""}`;
}

/**
 * What activation actually did, read off the acknowledgement (R6.5).
 *
 * Three facts, and not one of them assumed. Whether the profile row was created or already
 * existed, and then — separately — whether the two first reads were queued. The track route
 * enqueues both: the profile page, which says who this person is, and the activity feed,
 * which is what the evolving state is folded from. `TrackProspectOut` reports each as its own
 * job id, so this reads them rather than claiming two because the sequence names two.
 *
 * `observationNotQueued` is the honest half of that: a prospect with no address an activity
 * feed could be built from gets `activityJobId: null`, and the operator has just paid for
 * intelligence and is owed the difference between "we have started looking" and "the next
 * sweep will pick them up".
 */
export function activationNoticeFor(ack: ProspectTracking): string {
  const reads =
    ack.observationJobId !== null && ack.activityJobId !== null
      ? GTM_IDENTITY_LABELS.observationQueued
      : GTM_IDENTITY_LABELS.observationNotQueued;
  return ack.createdProfile
    ? `${GTM_IDENTITY_LABELS.tracked} ${GTM_IDENTITY_LABELS.trackedNext} ${reads}`
    : `${GTM_IDENTITY_LABELS.alreadyTracking} ${reads}`;
}

/**
 * How many of the eleven intent records the dossier summarises in band 6.
 *
 * The other eight are not lost: `IntentPanel`, behind "Where this prospect stands", carries
 * all eleven with their confidences and supporting signals. The band states the three
 * strongest; the disclosure holds the evidence (R8.8).
 */
export const INTENT_SUMMARY_LIMIT = 3;

/**
 * How many rows of each debug collection the learning disclosure asks for.
 *
 * The same 25 the retired page used, restated here rather than imported from it: nothing on
 * the dossier may depend on `pages/GTMProspect.tsx`, which is off the route table (R3.3) and
 * is the source this composition was lifted *out* of.
 */
export const LEARNING_UPDATE_LIMIT = 25;

/**
 * One page of the action queue is all this page reads, and `complete` says whether
 * that page was the whole queue.
 *
 * The distinction is the only thing that keeps the absence honest: a lead missing
 * from a queue we read to the end has no live recommendation, and a lead missing
 * from a truncated page is simply a lead we did not look at.
 */
export interface QueueOverlay {
  byLead: Map<string, ActionQueueItem>;
  complete: boolean;
}

/**
 * How much of the queue one read takes.
 *
 * One page, deliberately: the join has to cost a fixed number of requests no matter
 * how many decision-makers are on screen. A queue longer than this leaves the rows
 * past it reading `notOnQueuePage`, which is the truth, rather than walking the cursor
 * on mount.
 */
export const PROSPECT_QUEUE_PAGE_SIZE = 100;

/** The overlay for one lead: the queue row, or the reason there isn't one. */
export type OverlayState =
  | { kind: "row"; item: ActionQueueItem }
  | { kind: "none" }
  | { kind: "unknown" }
  | { kind: "failed" };

/**
 * Which of the four states a lead is in.
 *
 * `failed` wins over everything: when the read did not land we say so rather than
 * reporting an empty map as an absence of recommendations.
 */
/**
 * One collapsed intelligence section, whose contents are built only once opened.
 *
 * **The gate is about reads, not visibility.** `<details>` already handles showing and
 * hiding; what this adds is that `children` is a *function*, so the panel inside is not
 * constructed until the operator asks for it. `SignalList`, `StateHistoryPanel` and
 * `ProspectTimeline` each fetch a collection on mount, so rendering them closed would put
 * three requests behind every prospect selection for panels nobody opened — which is the
 * cost this page has always refused to pay, and the same reasoning that keeps the queue to
 * one read for the whole page rather than one per row.
 *
 * A native `<summary>` rather than a button: focusable and Enter/Space operable as it
 * stands, with no `aria-expanded` of ours to keep in sync with the element's own `open`.
 */
function IntelligenceSection({
  summary,
  note,
  children,
}: {
  summary: string;
  note: string;
  /** Built on first open. Deliberately a function — see the docblock. */
  children: () => ReactNode;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <details
      className="group rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      // Latched rather than tracking `open`: closing a section must not throw away a
      // collection the operator already paid a request for, so re-opening it is free.
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-zinc-900">{summary}</span>
          <span className="block text-[11px] leading-relaxed text-zinc-400">{note}</span>
        </span>
      </summary>
      <div className="border-t border-zinc-100 p-4">{opened ? children() : null}</div>
    </details>
  );
}

/**
 * The `/debug` read behind "What we've learned", and nothing else.
 *
 * **This is not a panel.** `LearningInsightsPanel` is the panel and it is rendered
 * unmodified; what this holds is the *read*, because that panel takes its collection as a
 * prop while the other three fetching panels own theirs internally. `SignalList`,
 * `StateHistoryPanel` and `ProspectTimeline` each hold a request, a failure and a retry of
 * their own, so the disclosure hands them ids and gets out of the way. This is the same
 * three lines for the one panel that cannot — introducing a second learning panel to carry
 * them would be exactly the duplication R20.1 forbids.
 *
 * It lives inside the disclosure's `children()` and therefore mounts only once the section
 * is opened, which is what keeps a prospect selection at three reads (R3.8). `getDebugView`
 * answers with six ledger collections and the whole belief to feed one panel, so it is
 * asked for rather than fired on selection.
 *
 * `refreshKey` is the page's `intelligenceKey`: a different prospect, or a write that landed,
 * is a different ledger, and an open section must never keep showing the previous one.
 */
function LearningInsights({
  brandId,
  leadId,
  refreshKey,
  scope,
}: {
  brandId: string;
  leadId: string;
  refreshKey: number;
  /** The scope decision the recommendation recorded, when the ranking read carried one. */
  scope: LearningScopeDecision | null;
}) {
  const [updates, setUpdates] = useState<LearningUpdate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The same monotonic-ticket idiom the page's own reads use: a slow answer must not land
  // on top of a newer one.
  const reqRef = useRef(0);

  const read = useCallback(async () => {
    if (!brandId || !leadId) return;
    const my = ++reqRef.current;
    setFailed(null);
    setLoading(true);
    try {
      const debug = await gtmAPI.getDebugView(brandId, leadId, {
        limit: LEARNING_UPDATE_LIMIT,
      });
      if (my !== reqRef.current) return;
      setUpdates(debug.learningUpdates);
    } catch (e) {
      if (my !== reqRef.current) return;
      setFailed(e instanceof Error ? e.message : GTM_PAGE_LABELS.loadFailedTitle);
    } finally {
      if (my === reqRef.current) setLoading(false);
    }
  }, [brandId, leadId]);

  useEffect(() => {
    void read();
    // `refreshKey` is a re-read trigger, not a value this reads.
  }, [read, refreshKey]);

  if (failed) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-amber-800">{failed}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 rounded-full border-amber-200 bg-white text-[11px]"
          onClick={() => void read()}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> {GTM_PAGE_LABELS.retry}
        </Button>
      </div>
    );
  }

  if (!updates) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        {loading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {GTM_PAGE_LABELS.statusLoading}
      </p>
    );
  }

  // `scope` is passed even when null: the panel renders the scope decision's own "nothing
  // recorded" line, which is a real answer about this evaluation rather than a gap.
  return <LearningInsightsPanel updates={updates} scope={scope} />;
}

/**
 * The `sales_leads.id` for a lead on this page — the only id the GTM layer answers to.
 *
 * **Eva's `lead.id` is not it, and using it was a real bug.** Eva mints `lead_<hex>`
 * document ids; `gtmLeadId` is the SQL row `lead_promotion.promote()` created during
 * Enrich Now, and `evaAPI`'s own docblock says every GTM route keys on that one. Three
 * call sites on this page were passing `lead.id`:
 *
 *   - `getProspectState()` for the intent summary, which 404'd every time and rendered
 *     as "Couldn't read the intent records for this prospect" — reported as a failed
 *     read, which it was, for a reason that had nothing to do with the prospect.
 *   - `overlayFor()`, which joins against `ActionQueueItem.leadId`. A `lead_<hex>` never
 *     matches a `sales_leads.id`, so the journey badge and the priority tier were
 *     silently absent for every row on the page, indistinguishable from a prospect with
 *     no live recommendation.
 *   - the entry into the per-prospect execution surface, which handed the Eva id
 *     straight to `GTMProspect` as its `lead_id` — so every read on the destination page
 *     404'd too.
 *
 * Safe to return a bare string because this page's subject is `activeLeads`, which is
 * filtered by `isEnrichedProspect` — a lead without a `gtmLeadId` is not on screen. The
 * empty-string fallback is for the type, not for a case that reaches a request: the two
 * call sites that fetch both guard on a falsy id before they call.
 */
export function gtmLeadIdOf(lead: QualifiedLead): string {
  return (lead.gtmLeadId ?? "").trim();
}

/**
 * Why Contact Directly cannot be offered for this prospect, or `null` when it can.
 *
 * The single condition `ProspectDecision` gates the Contact control on (R5.5), and after
 * the profile-guard relaxation it is no longer about activation at all. `_require_profile`
 * takes `allow_missing`, and both `POST /gtm/message/generate` and
 * `POST /gtm/action/request` now answer for a lead with no `li_gtm_profiles` row — so
 * `CONTACT_DIRECTLY_LABELS.needsActivation` was the sentence the relaxation made false and
 * it is deleted from the table rather than left here to be reused.
 *
 * **Derived from backend-supplied facts only, never from the activation stage.** That is
 * what R5.4 asks for: `gtmLeadId` is written by `lead_promotion.promote()` during Enrich
 * Now, `contact.email` and `contact.linkedinUrl` are the enrichment's own answers, and
 * `profile.profileUrl` is the address on the tracked-profile row. `prospectStage` is not
 * read, so an enriched, unactivated lead evaluates to `null` — the control is live for it,
 * which is the whole point of the requirement. There is no `contact_unavailable_reason`
 * wire field and this function is the authority, not a fallback for one.
 *
 * Two gates, in the order they matter:
 *
 *   `needsEnrichment` — no `gtmLeadId`, so there is no enrichment assertion for the writer
 *   to ground a draft in, and every GTM route keys on that id anyway. Enriching is the next
 *   step and the sentence says so. `activeLeads` is filtered by `isEnrichedProspect`, so
 *   this is unreachable from the current surface; it is stated rather than assumed because
 *   the filter is somebody else's invariant and not this function's.
 *
 *   `noChannel` — no email address, no `contact.linkedinUrl` and no `profile.profileUrl`,
 *   so `_lead_destination()` would find nowhere to open, refund the charge and answer
 *   `422`. Saying so up front is better than charging for the discovery.
 *
 * `detail` is nullable because the prospect read can fail or still be in flight, and a
 * missing read must not manufacture a gate: it only ever *removes* the third channel from
 * consideration, so a lead whose contact carries either address is still offered the
 * control.
 */
export function contactGateOf(
  lead: QualifiedLead,
  detail: ProspectDetail | null
): string | null {
  if (!gtmLeadIdOf(lead)) return CONTACT_DIRECTLY_LABELS.needsEnrichment;
  const hasChannel =
    Boolean(lead.contact?.email) ||
    Boolean(lead.contact?.linkedinUrl) ||
    Boolean(detail?.profile.profileUrl);
  if (!hasChannel) return CONTACT_DIRECTLY_LABELS.noChannel;
  return null;
}

export function overlayFor(
  leadId: string,
  overlay: QueueOverlay | null,
  failed: boolean
): OverlayState {
  if (failed) return { kind: "failed" };
  if (!overlay) return { kind: "unknown" };
  const item = overlay.byLead.get(leadId);
  if (item) return { kind: "row", item };
  return overlay.complete ? { kind: "none" } : { kind: "unknown" };
}

/** The short absence text for a row chip, or null when there is a queue row to render. */
export function absenceShort(state: OverlayState): string | null {
  switch (state.kind) {
    case "row":
      return null;
    case "none":
      return PROSPECT_GTM_LABELS.noRecommendationShort;
    case "unknown":
      return PROSPECT_GTM_LABELS.notOnQueuePageShort;
    case "failed":
      return PROSPECT_GTM_LABELS.overlayFailedShort;
  }
}

/** The full absence sentence for the dossier, or null when there is a queue row. */
export function absenceSentence(state: OverlayState): string | null {
  switch (state.kind) {
    case "row":
      return null;
    case "none":
      return PROSPECT_GTM_LABELS.noRecommendation;
    case "unknown":
      return PROSPECT_GTM_LABELS.notOnQueuePage;
    case "failed":
      return PROSPECT_GTM_LABELS.overlayFailed;
  }
}

/**
 * What band 4/7 says in place of the Next Best Action card, or `null` for no statement.
 *
 * Two pinned sentences and a deliberate silence, keyed on facts rather than on the stage —
 * which is what R9.4 and R9.5 are written as ("IF the backend supplies no recommendation",
 * "IF a tracked prospect has no meaningful signal") and what lets the same statement be
 * right at `WAITING` and at `ACTIVE` for the reason each of them is right:
 *
 *   nothing at all      before activation. There is no ranking to be absent yet, and the
 *                       stage banner in band 3 already says what is happening. A "nothing is
 *                       recommended" line on an un-activated prospect would read as a
 *                       verdict on them rather than as a step not taken.
 *   silence, again      when the ranking read failed. That is not an absence, it is our
 *                       failure, and the amber `rankingReadFailed` line beside this slot
 *                       says so with a different sentence on purpose.
 *   `noMeaningfulSignal` tracked, and the timing read says nothing meaningful has landed
 *                       (R9.5). This is the `WAITING` case: activated, observation queued,
 *                       nothing observed yet.
 *   `noRecommendation`  tracked, something *has* been observed, and the evaluation still has
 *                       no move worth making (R9.4).
 *
 * A `null` `timing` is unread rather than empty, so it falls through to `noRecommendation`:
 * "not enough evidence yet" is the honest reading of a ranking that answered with nothing,
 * and claiming no meaningful signal off a read we do not have would be a fabrication.
 */
export function nbaAbsenceStatement({
  active,
  hasRecommendation,
  rankingFailed,
  timing,
}: {
  active: boolean;
  hasRecommendation: boolean;
  rankingFailed: boolean;
  timing: TimingState | null;
}): string | null {
  if (!active || hasRecommendation || rankingFailed) return null;
  const noMeaningfulSignal = timing !== null && !timing.lastMeaningfulSignalAt;
  return noMeaningfulSignal
    ? GTM_ABSENCE_LABELS.noMeaningfulSignal
    : GTM_ABSENCE_LABELS.noRecommendation;
}

/**
 * The strongest observed intents, and what to say when there are none.
 *
 * A sort over the numbers the server sent, then a filter on `value > 0` — nothing is
 * scored here and no threshold is invented. A row at value zero is not "weak intent",
 * it is *nothing observed for that type* (R5.5), which is why it is summarised as a
 * sentence rather than shown as a zero in a chip.
 *
 * `note` distinguishes the two zeros the engine keeps apart: a type with an
 * `evaluatedAt` was looked at and found unsupported, and a type without one has never
 * been looked at. Where nothing is supported at all, the note says which of those is
 * true rather than picking the friendlier reading.
 */
export function intentSummary(intents: Intent[]): { rows: Intent[]; note: string | null } {
  const ranked = [...(intents || [])].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : b.confidence - a.confidence
  );
  const observed = ranked.filter((i) => i.value > 0);
  if (observed.length > 0) return { rows: observed.slice(0, INTENT_SUMMARY_LIMIT), note: null };
  const everEvaluated = ranked.some((i) => Boolean(i.evaluatedAt));
  return {
    rows: [],
    note: everEvaluated
      ? PROSPECT_GTM_LABELS.noIntentObserved
      : INTENT_PANEL_LABELS.neverEvaluated,
  };
}

// `formatMeasure` — a bare number, to two places when it had a fraction — is gone with the
// last bare number on the dossier. Every measure a band renders now goes through
// `measureParts`, which is the difference between `68` and `High · 68`: a rep cannot act on
// the first, and R8.4 asks for the second.

/**
 * The journey projection and the priority tier as two phrasing-level chips.
 *
 * Phrasing-level on purpose: these render inside `ProspectCard`, which is a
 * `<button>`, and a button may only contain phrasing content. The dossier mounts the
 * real `JourneyStateBadge` — with its display-only note — in band 3, where block content
 * is allowed. Both carry visible text and an `sr-only` name, so neither one leans on its
 * tone to be readable (R18.9).
 */
function JourneyTierChips({ state }: { state: OverlayState }) {
  const absent = absenceShort(state);
  if (absent) {
    return (
      <Chip tone="zinc" icon={Route}>
        <span className="sr-only">{PROSPECT_GTM_LABELS.journeyLabel}: </span>
        {absent}
      </Chip>
    );
  }

  const item = (state as { kind: "row"; item: ActionQueueItem }).item;
  const journey = item.journeyState;
  const journeyUnknown = journey.isUnknown || journey.value == null;

  return (
    <>
      <Chip tone="zinc" icon={Route}>
        <span className="sr-only">
          {GTM_UI_LABELS.computed} {PROSPECT_GTM_LABELS.journeyLabel}:{" "}
        </span>
        {journeyUnknown ? (
          <>
            {UNKNOWN_TEXT}
            <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
          </>
        ) : (
          GTM_JOURNEY_LABELS[journey.value as string] ?? String(journey.value)
        )}
      </Chip>
      <Chip tone="amber" icon={Flag}>
        <span className="sr-only">{ACTION_CARD_LABELS.priority}: </span>
        {PRIORITY_TIER_LABELS[item.priorityTier] ?? item.priorityTier}
      </Chip>
    </>
  );
}

// ─── Company grouping (the only derivation this page performs) ────────────────

const TIER_ORDER: Record<ACVTier, number> = { low: 0, medium: 1, high: 2 };

interface CompanyGroup {
  key: string;
  company: string;
  domain: string;
  website: string;
  logoUrl?: string;
  industry: string;
  employeeRange: string;
  hqLocation: string;
  leads: QualifiedLead[];
  bestFit: number;
  topTier: ACVTier;
  signals: ChannelSignal[];
  contactsWithEmail: number;
  handedCount: number;
  lastActivity: string;
}

function groupByCompany(leads: QualifiedLead[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();

  for (const lead of leads) {
    const key = (lead.domain || lead.company || lead.id).toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        company: lead.company,
        domain: lead.domain,
        website: lead.website,
        logoUrl: lead.logoUrl,
        industry: lead.industry,
        employeeRange: lead.employeeRange,
        hqLocation: lead.hqLocation,
        leads: [],
        bestFit: lead.icpFit,
        topTier: lead.acvTier,
        signals: [],
        contactsWithEmail: 0,
        handedCount: 0,
        lastActivity: "",
      };
      map.set(key, group);
    }
    group.leads.push(lead);
    group.industry = group.industry || lead.industry;
    group.employeeRange = group.employeeRange || lead.employeeRange;
    group.hqLocation = group.hqLocation || lead.hqLocation;
    group.website = group.website || lead.website;
    group.logoUrl = group.logoUrl || lead.logoUrl;
    if (lead.icpFit > group.bestFit) group.bestFit = lead.icpFit;
    if (TIER_ORDER[lead.acvTier] > TIER_ORDER[group.topTier]) group.topTier = lead.acvTier;
    if (lead.contact?.email) group.contactsWithEmail += 1;
    if (lead.handoffState === "handed_to_max") group.handedCount += 1;
    const stamp = lead.updatedAt || lead.createdAt || "";
    if (stamp > group.lastActivity) group.lastActivity = stamp;
  }

  for (const group of map.values()) {
    const seen = new Set<string>();
    for (const lead of group.leads) {
      for (const signal of lead.signals || []) {
        if (signal?.id && seen.has(signal.id)) continue;
        if (signal?.id) seen.add(signal.id);
        group.signals.push(signal);
      }
    }
    group.signals.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    group.leads.sort((a, b) => b.icpFit - a.icpFit);
  }

  return [...map.values()].sort((a, b) => b.bestFit - a.bestFit);
}

function leadHaystack(lead: QualifiedLead): string {
  return [
    lead.company,
    lead.industry,
    lead.hqLocation,
    lead.employeeRange,
    lead.contact?.name,
    lead.contact?.role,
    lead.contact?.email,
    stripEventPrefix(lead.primaryEvent),
    lead.qualificationReason,
    ...(lead.signals || []).map((s) => `${s.channel} ${s.detail} ${s.person || ""} ${s.personRole || ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ─── Conversation angle (composed from grounded fields only) ──────────────────

interface AngleBlock {
  label: string;
  value: string;
  source: string;
}

function angleBlocks(lead: QualifiedLead, icp?: EvaWorkspace["icp"]): AngleBlock[] {
  const blocks: AngleBlock[] = [];
  const event = stripEventPrefix(lead.primaryEvent) || lead.signals?.[0]?.detail || "";

  if (event) {
    blocks.push({
      label: "Open with",
      value: event,
      source: lead.eventType
        ? `Eva · ${SIGNAL_META[lead.eventType]?.label || lead.eventType}`
        : "Eva · captured event",
    });
  }
  if (lead.contact?.name || lead.contact?.role) {
    blocks.push({
      label: "Speak to",
      value: [lead.contact.name, lead.contact.role].filter(Boolean).join(" · "),
      source: "Eva · resolved contact",
    });
  }
  if (lead.qualificationReason) {
    blocks.push({ label: "Why them", value: lead.qualificationReason, source: "Eva · qualification" });
  }
  if (icp?.value_prop) {
    blocks.push({ label: "Tie back to", value: icp.value_prop, source: "Your ICP · value prop" });
  }
  return blocks;
}

// ─── Research progress (mirrors Eva's ScanProgress) ───────────────────────────

const SCAN_STEPS: { keys: ScanStage[]; label: string; hint: string; Icon: typeof Layers }[] = [
  {
    keys: ["starting", "context"],
    label: "Reading your ICP",
    hint: "Industry, segments and personas — the bar every decision-maker is matched against.",
    Icon: Layers,
  },
  {
    keys: ["tracking"],
    label: "Tracking channels",
    hint: "Job postings, funding, product launches, tech changes, research engine and LinkedIn VM.",
    Icon: Radar,
  },
  {
    keys: ["qualifying"],
    label: "Qualifying accounts",
    hint: "Deduping signals into orgs and applying the per-ACV qualification matrix.",
    Icon: Target,
  },
  {
    keys: ["enriching"],
    label: "Resolving decision-makers",
    hint: "Finding the person, their role and a verified email for each qualified account.",
    Icon: Mail,
  },
];

function scanStepIndex(stage: ScanStage | null): number {
  if (!stage) return 0;
  const i = SCAN_STEPS.findIndex((s) => s.keys.includes(stage));
  return i === -1 ? 0 : i;
}

function ResearchProgress({ stage }: { stage: ScanStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = scanStepIndex(stage);
  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-violet-400/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white ring-2 ring-violet-100">
          <Brain className="h-7 w-7" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Building your prospect dossiers</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Reading the qualified accounts Eva has captured · {elapsed}s elapsed
        </p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left">
        {SCAN_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const Icon = step.Icon;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                state === "active" ? "border-violet-200 bg-violet-50/50" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  state === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : state === "active"
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 text-zinc-400"
                )}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4" />
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
                {state === "active" && <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{step.hint}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyPanel({
  icon: Icon = Search,
  title,
  subtitle,
  children,
}: {
  icon?: typeof Search;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-zinc-200 px-5 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-600">{title}</p>
        {subtitle && <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Summary header ──────────────────────────────────────────────────────────

/**
 * The six tiles, and which population each one counts.
 *
 * Three of them are about **this page's** population — the enriched prospects — and three
 * are workspace-wide facts that belong to discovery. Mixing the two without saying so is
 * how a header ends up reading "40 qualified leads" above a list of two, so each tile's
 * `sub` names its own scope.
 *
 * `prospects` is the enriched set the page lists. `qualifiedTotal` is discovery's whole
 * output, carried so the enriched count can be read as a fraction of it — which is the
 * number that actually tells the operator how much of their pipeline they have worked.
 */
function SummaryHeader({
  ws,
  companies,
  prospects,
  qualifiedTotal,
}: {
  ws: EvaWorkspace;
  companies: CompanyGroup[];
  prospects: QualifiedLead[];
  qualifiedTotal: number;
}) {
  const m = ws.metrics;
  // Counted over the enriched prospects, not the workspace: these three describe the rows
  // on screen, and a count that included un-enriched leads would describe a different list.
  const withContact = prospects.filter((l) => l.contact?.name).length;
  const verified = prospects.filter((l) => l.contact?.emailVerified).length;
  const withEmail = prospects.filter((l) => l.contact?.email).length;

  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="violet" icon={Brain}>
              Reasoning layer · Eva → Max
            </Chip>
            <span className="text-[10px] font-medium text-zinc-400">
              Who to contact · why them · why now · what to open with
            </span>
          </div>
          {ws.icp ? (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">
              Matching against <span className="font-semibold text-zinc-700">{ws.icp.industry}</span>
              {ws.icp.segments?.length ? ` · ${ws.icp.segments.join(", ")}` : ""}
              {ws.icp.personas?.length ? ` · personas: ${ws.icp.personas.join(", ")}` : ""}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] text-zinc-400">No ICP saved for this space yet.</p>
          )}
        </div>
        {ws.last_scan_at && (
          <span className="text-[11px] font-medium text-zinc-400">Last scan {relTime(ws.last_scan_at)}</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Companies" value={companies.length} sub="on this page" />
        <StatTile
          label="Enriched prospects"
          value={prospects.length}
          sub={`of ${qualifiedTotal} qualified`}
          tone="text-violet-600"
        />
        <StatTile label="Decision-makers" value={withContact} sub="contact resolved" />
        <StatTile
          label="Emails found"
          value={withEmail}
          sub={`${verified} verified`}
          tone="text-emerald-600"
        />
        {/* The two workspace-wide facts, labelled as such. They belong to discovery rather
            than to this page's population, and the `sub` says so rather than leaving a
            reader to assume they are counting the rows below. */}
        <StatTile label="Signals / wk" value={m.signalsThisWeek} sub={`${m.signalsCaptured} workspace total`} />
        <StatTile label="Handed to Max" value={m.handedToMax} sub="workspace total" tone="text-violet-600" />
      </div>
    </div>
  );
}

// ─── Company + prospect cards ────────────────────────────────────────────────

function CompanyCard({
  group,
  active,
  onSelect,
}: {
  group: CompanyGroup;
  active: boolean;
  onSelect: () => void;
}) {
  const tier = tierMeta(group.topTier);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-violet-300 bg-violet-50/60"
          : "border-zinc-200/70 bg-white hover:border-zinc-300 hover:bg-zinc-50/70"
      )}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo logoUrl={group.logoUrl} domain={group.domain} company={group.company} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-900">{group.company}</p>
          <p className="truncate text-[11px] text-zinc-400">{group.industry || group.domain || "Industry unknown"}</p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {group.bestFit}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <Chip tone={tier.tone}>{tier.label}</Chip>
        {group.handedCount > 0 && (
          <Chip tone="violet" icon={ArrowRight}>
            {group.handedCount} with Max
          </Chip>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" /> {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <SignalIcon className="h-3 w-3" /> {group.signals.length}
        </span>
        {group.lastActivity && <span>{relTime(group.lastActivity)}</span>}
      </div>
    </button>
  );
}

function ProspectCard({
  lead,
  active,
  overlay,
  onSelect,
}: {
  lead: QualifiedLead;
  active: boolean;
  /** Where this prospect stands in the GTM journey, or why we can't say. */
  overlay: OverlayState;
  onSelect: () => void;
}) {
  const action = ACTION_META[lead.recommendedAction];
  const enrichment = ENRICHMENT_META[lead.enrichment?.status];
  const handed = lead.handoffState === "handed_to_max";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-violet-300 bg-violet-50/60"
          : "border-zinc-200/70 bg-white hover:border-zinc-300 hover:bg-zinc-50/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {lead.contact?.name ? (
            <p className="truncate text-[13px] font-semibold text-zinc-900">{lead.contact.name}</p>
          ) : (
            <p className="truncate text-[13px] font-semibold text-zinc-400">Decision-maker not resolved yet</p>
          )}
          <p className="truncate text-[11px] text-zinc-500">{lead.contact?.role || lead.company}</p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {lead.icpFit}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {action && (
          <Chip tone={action.tone} icon={Zap}>
            {action.label}
          </Chip>
        )}
        {enrichment && <Chip tone={enrichment.tone}>{enrichment.label}</Chip>}
        {handed && <Chip tone="violet">With Max</Chip>}
      </div>
      {/* Where this prospect stands in the GTM journey, and how urgent the live
          recommendation is. Both come from one action-queue read joined by lead id;
          a prospect with no live recommendation says so rather than showing a tier. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <JourneyTierChips state={overlay} />
      </div>
      {lead.eventType && (
        <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">
          <span className="font-semibold text-zinc-700">{SIGNAL_META[lead.eventType]?.label || lead.eventType}:</span>{" "}
          {stripEventPrefix(lead.primaryEvent) || lead.signals?.[0]?.detail || "No event detail captured."}
        </p>
      )}
    </button>
  );
}

// ─── Dossier ─────────────────────────────────────────────────────────────────

// The Eva signal timeline that used to live here — one card per stored channel signal,
// carrying the signal type, the channel, its age, who posted it, the funding stage, the
// confidence and a link to the source — was a primary panel made entirely of evidence.
//
// Every one of those seven fields is on R8.8's list, and R9.9 is a deletion criterion
// rather than a preference: a rep who cannot see the confidence on a job posting decides
// and acts exactly as well as one who can. What the rep needs from those signals is *what
// happened*, which band 5 states in one line each, in the order the payload supplied. The
// auditable version of the same claim is the "What Weez has seen" disclosure, which reads
// `/signals` on open and prints strength, source and timestamp per row.
//
// `ChannelSignal` is still imported: `CompanyGroup` collects the signals for the company
// list, and band 5 reads `lead.signals` for its statements.

/**
 * The three per-prospect GTM reads, and which of them failed.
 *
 * A flag per read rather than one shared `failed`, because they are three independent
 * routes and collapsing them would make a page that could not read the ranking claim it
 * could not read the belief either.
 */
export interface SelectedProspectRead {
  loading: boolean;
  detail: ProspectDetail | null;
  detailFailed: boolean;
  state: ProspectStateFull | null;
  stateFailed: boolean;
  ranking: NextBestAction | null;
  rankingFailed: boolean;
}

export const EMPTY_SELECTED_READ: SelectedProspectRead = {
  loading: false,
  detail: null,
  detailFailed: false,
  state: null,
  stateFailed: false,
  ranking: null,
  rankingFailed: false,
};

/** What the dossier knows about the selected lead's intent records, and how it knows. */
export interface IntentReadState {
  loading: boolean;
  failed: boolean;
  state: ProspectStateFull | null;
  /**
   * Re-run the read behind this slice. The third part of R18.5's `failed` / `refresh()` /
   * retry-control triple, and the belief read shares it with the other two per-selection
   * reads because all three land in one `Promise.allSettled`.
   */
  refresh: () => void;
}

/**
 * One measure, in the form R8.4 pins: `<meaning label>: <band> · <number>`.
 *
 * The meaning label, then the band, then the server's own number — and the whole line is
 * one string of text, so the reading a rep gets and the accessible name a screen reader
 * gets are the same sentence rather than three fragments in a grid.
 *
 * **The band comes from `measure.ts` and nowhere else, which is why the requirement's own
 * example does not render verbatim.** R8.4 illustrates the form with `Urgency: High · 68`,
 * and `MEASURE_BAND_FLOORS` puts HIGH at 70 — so a supplied 68 reads
 * `Urgency: Moderate · 68` here, and a supplied 74 reads `High · 74`. The alternative was a
 * second banding table for this one band, which is exactly the drift `measure.ts` exists to
 * prevent: two surfaces would then disagree in words about the same number while agreeing
 * about the number. The form is the requirement; the thresholds are stated once.
 *
 * The number is never touched beyond `measureParts`' rounding of an integer scale, so it
 * cannot gain precision the backend did not supply (R9.8), and an unread measure renders
 * *nothing at all* rather than `Minimal · 0`: R8.5 says at most the dimensions the backend
 * supplied, and a band is a reading of a number that exists.
 */
function MeasureLine({
  label,
  measureKey,
  attribute = "data-measure",
  value,
}: {
  label: string;
  /**
   * The key the measure travels under — the wire field name for an EPS dimension, the
   * intent type for an intent row. Used for the data attribute and for the
   * `MEASURE_MEANINGS` lookup, which has no entry for an intent type and so renders no
   * tooltip rather than a made-up one.
   */
  measureKey: string;
  /** Which data attribute names the row, so a dimension and an intent stay tellable apart. */
  attribute?: string;
  value: number | null | undefined;
}) {
  const measure = measureParts(value);
  if (measure.label === null) return null;
  return (
    <li {...{ [attribute]: measureKey }} className="min-w-0">
      <span
        title={MEASURE_MEANINGS[measureKey]}
        className={cn(
          "text-[11.5px] font-semibold text-zinc-500",
          MEASURE_MEANINGS[measureKey] && "cursor-help"
        )}
      >
        {label}
      </span>
      {": "}
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
          GTM_TONE[measure.tone] ?? GTM_TONE.zinc
        )}
      >
        {measure.label}
      </span>
      {" · "}
      <span className="text-[11.5px] font-semibold tabular-nums text-zinc-700">
        {measure.value}
      </span>
    </li>
  );
}

/**
 * Band 4's EPS_Summary: the four scoring dimensions behind the recommendation (R8.4, R8.5).
 *
 * **It costs nothing.** Every number here is on the `ActionQueueItem` the page-wide
 * `getActionQueue` read already returned, joined by lead id — the same row the priority
 * tier on the card comes from. There is no per-dimension read and no second ranking read,
 * which is why this is affordable inside a band rather than behind a disclosure.
 *
 * Four dimensions, not six: `urgency`, the expected outcome, `businessValue` and
 * `signalFreshness` are the measures the glossary names as the EPS_Summary. The other two
 * banding inputs are the Action_Confidence, which belongs to the recommendation and is
 * rendered by the execution panel, and the relationship reading, which is an observed fact
 * rather than a measure and gets its own disclosure.
 *
 * Whatever the backend did not supply is simply not here — see `MeasureLine`.
 */
function EpsSummary({ item }: { item: ActionQueueItem }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <PanelTitle icon={Flag}>{PROSPECT_GTM_LABELS.epsHeading}</PanelTitle>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <MeasureLine
          label={PROSPECT_GTM_LABELS.epsUrgency}
          measureKey="urgency"
          value={item.urgency}
        />
        <MeasureLine
          label={ACTION_CARD_LABELS.expectedOutcome}
          measureKey="expected_success_probability"
          value={item.expectedSuccessProbability}
        />
        <MeasureLine
          label={PROSPECT_GTM_LABELS.epsBusinessValue}
          measureKey="business_value"
          value={item.businessValue}
        />
        <MeasureLine
          label={PROSPECT_GTM_LABELS.epsSignalFreshness}
          measureKey="signal_freshness"
          value={item.signalFreshness}
        />
      </ul>
      {/* What the tier on the card above was banded from, so the badge reads as
          re-derivable rather than as a verdict. */}
      <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500">
        {PROSPECT_GTM_LABELS.tierNote}
      </p>
    </div>
  );
}

/**
 * Band 6: what this prospect is currently interested in.
 *
 * **Three things left this panel and none of them was deleted from the dossier.** The
 * journey projection moved to band 3, which is where "current status" lives; the priority
 * tier, the action title and the channel moved to — or rather stayed on —
 * `NextBestActionCard` in band 4/7, where a ranking band is next to the thing it ranks.
 * Rendering them twice would have failed R9.9 twice over: remove either copy and the rep
 * decides exactly as well.
 *
 * What is left is the band the Dossier_Hierarchy asks for, and it is one read: the eleven
 * Intent records live on `ProspectStateFull` and on no list payload, which is why this is a
 * dossier field rather than a row field, and why `INTENT_SUMMARY_LIMIT` caps it at the
 * three strongest observed.
 *
 * Each row reads `Hiring: High · 72` — the same form the EPS_Summary uses, because it is
 * the same kind of number and a bare `72` is not a statement a rep can act on. The
 * per-intent confidence is gone from the band: a confidence is evidence about a statement
 * (R8.8) and `IntentPanel`, behind "Where this prospect stands", carries all eleven rows
 * with theirs.
 */
function BuyingIntentPanel({ intent }: { intent: IntentReadState }) {
  const summary = useMemo(
    () => intentSummary(intent.state?.intents ?? []),
    [intent.state]
  );

  return (
    <div
      data-gtm-section="buying-intent"
      className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <PanelTitle icon={Compass}>{PROSPECT_GTM_LABELS.sectionTitle}</PanelTitle>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        {PROSPECT_GTM_LABELS.intentHeading}
      </p>
      {intent.loading ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {PROSPECT_GTM_LABELS.intentLoading}
        </p>
      ) : intent.failed ? (
        /* Our failure, with the way out of it beside the sentence (R18.5). The belief read
           is one of the three in the selection's `Promise.allSettled`, so this press re-runs
           all three — which is the honest scope: they failed together or they did not. */
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[12px] text-zinc-500">
            {PROSPECT_GTM_LABELS.intentUnavailable}
          </p>
          <RetryButton onClick={intent.refresh} />
        </div>
      ) : summary.rows.length > 0 ? (
        <>
          <ul className="mt-1.5 space-y-1.5">
            {summary.rows.map((row) => (
              <MeasureLine
                key={row.intentType}
                label={GTM_INTENT_LABELS[row.intentType] ?? row.intentType}
                measureKey={row.intentType}
                attribute="data-intent-type"
                value={row.value}
              />
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            {PROSPECT_GTM_LABELS.intentNote}
          </p>
        </>
      ) : (
        /* Nothing behind the summary says so — a zero row is "nothing observed for
           that type", never "weak intent", and never a number in a chip. */
        <p className="mt-1.5 text-[12px] text-zinc-500">{summary.note}</p>
      )}
    </div>
  );
}

function Dossier({
  lead,
  group,
  icp,
  overlay,
  refreshOverlay,
  intent,
  onAction,
  onShowEmail,
  enrichPrice = null,
  decision,
  intelligence,
  flows,
}: {
  lead: QualifiedLead;
  group: CompanyGroup;
  icp?: EvaWorkspace["icp"];
  /** Where this prospect stands in the GTM journey, or why we can't say. */
  overlay: OverlayState;
  /**
   * Re-read the one action-queue page the overlay is joined from.
   *
   * Its own callback rather than the selection's, because it is its own read: the queue is
   * read once for the whole page and a failure there is `{ kind: "failed" }` on every row.
   * `absenceSentence()` says so; this is what the operator presses about it (R18.5).
   */
  refreshOverlay: () => void;
  /** The selected lead's intent records, or the reason there are none to show. */
  intent: IntentReadState;
  /**
   * The lifecycle stage and the two-way choice that belongs to it.
   *
   * One object rather than eight loose props, because they are one thing: what stage this
   * prospect is in and what the operator can do about it. The dossier renders it; the page
   * decides it.
   */
  decision: {
    stage: ProspectStage;
    /**
     * `onContactDirectly` is gone from this contract, and so is `onTakeAction` below.
     *
     * Both were `navigate()` calls to `/relationship-intelligence/{space}?lead_id=…`, which
     * is a Retired_Route that now redirects straight back to this page — a press that left
     * and returned. What they open instead is the `Contextual_Outreach_Surface`, a region
     * *inside* this component (R12.3), so the flag that opens it and the ref that scrolls to
     * it are local state here rather than two more props. Nothing on the page has to know
     * that a dossier region is open, and a prop the page would only ever forward back down
     * is a prop that can disagree with what is on screen.
     *
     * The region is also why they are not merely no-ops: with the destination inside the
     * component, the handler that reaches it belongs inside too.
     */
    contactUnavailableReason: string | null;
    contactPrice: number | null;
    onActivate: () => void;
    activating: boolean;
    activateUnavailableReason: string | null;
    activatePrice: number | null;
    /** What the last activation did, or the server's refusal. Never a fabrication. */
    notice: string | null;
    /**
     * Whether the notice above is one another read could answer.
     *
     * True for exactly one of them: `resolveStillRunning`, which R6.9 requires to carry a
     * retry — the verdict is genuinely outstanding and re-reading is what finds it. The page
     * decides this rather than the dossier comparing the notice against a label table,
     * because the page is what set the notice and knows why.
     *
     * False for every other notice. A retry beside "Intelligence activated." would invite a
     * press that changes nothing, and one beside `activationStopped` would suggest the
     * verdict is still open when it has landed.
     */
    noticeRetryable: boolean;
    /**
     * Re-run the three per-selection reads. The retry beside each of their failures (R18.5).
     *
     * One callback for three statements because there is one request: `loadSelected` issues
     * `getProspect`, `getProspectState` and `getNextBestAction` in a single
     * `Promise.allSettled`, so re-reading any of them re-reads all three.
     */
    refreshRead: () => void;
    /**
     * The prospect read failed, so no stage can be claimed.
     *
     * Kept apart from the stage rather than folded into it, because a failed read and a
     * prospect nobody has looked for are different facts that happen to look the same from
     * here: with no payload, `verificationStatus` and `profileId` are both null and the
     * stage machine would land on `RESOLVING` — telling the operator an identity search is
     * under way when actually a request errored. Absence is not a stage.
     */
    readFailed: boolean;
    /**
     * The recommended candidate, or null when no evaluation has produced one.
     *
     * Null is a real answer rather than a gap to fill: the backend refuses to fabricate a
     * `WAIT` for a prospect nothing has scored, so the card is simply absent and the stage
     * banner is what says why.
     */
    recommended: CandidateAction | null;
    /** Ask for an identity search — the way out of every activation refusal. */
    onResolveIdentity: () => void;
    resolvingIdentity: boolean;
    /**
     * The ranking read failed, so the absence of a recommendation is not an answer.
     *
     * The same absent-versus-failed distinction `readFailed` draws, one level down. Without
     * this the card is simply missing, which is indistinguishable from "nothing is
     * recommended for this prospect" — and those call for different things from the
     * operator: one is a retry, the other is patience.
     */
    rankingFailed: boolean;
  };
  /**
   * What the folded-in panels read: the ids they fetch with, and the two payloads the
   * non-fetching ones render from.
   *
   * Separate from `decision` because it is a different concern. `decision` is what the
   * operator can *do*; this is the evidence for why they should. Keeping them apart is what
   * stops the dossier's prop list from becoming a bag of unrelated flags.
   *
   * `detail` replaced a `state: ProspectState` slice when `GTMProspect`'s panels folded in.
   * Nine of them read a different part of the same `getProspect` payload — the profile, the
   * observed activity, the three scored channels, the CTA band, the prepared next action,
   * the message versions and the four dimensions — and passing seven slices of one object
   * would have been seven props that can disagree with each other. It is the read the
   * selection already makes, handed over whole.
   */
  intelligence: {
    /** The brand. Every GTM route is brand-scoped. */
    brandId: string;
    /** `sales_leads.id`. Empty suppresses the whole region rather than fetching with "". */
    gtmLeadId: string;
    /** `getProspect`'s payload. Null when that read failed — never a fabricated shell. */
    detail: ProspectDetail | null;
    /** The engine's full read, which adds the extended dimensions and confidences. */
    stateFull: ProspectStateFull | null;
    /**
     * `getNextBestAction`'s payload, whole, for the execution panel in band 7.
     *
     * `decision.recommended` is the winner alone — what band 4 states — while the panel also
     * reads the ranking's recorded lifecycle position and its alternatives. Handed over
     * rather than reassembled here: a `NextBestAction` built from one field would be this
     * page inventing a ranking envelope.
     */
    ranking: NextBestAction | null;
    /** Bumped to make the four fetching panels re-read their collections. */
    refreshKey: number;
  };
  /**
   * The interactive flows that came with the folded-in panels, and what they are waiting on.
   *
   * Every one of them is a *press*, so none of them costs a prospect selection anything: the
   * channel re-evaluation, the connection question, settling an identity candidate, and
   * asking which candidate band 4 should argue for. The page owns the requests; the dossier
   * owns where the controls sit.
   */
  flows: {
    /**
     * Recompute the channel recommendation — the one request behind "How to reach them",
     * and it fires on this press alone. `ChannelRecommendationPanel` renders the three
     * scored channels off the held payload and asks for nothing on open (R3.8).
     */
    onReevaluateChannels: () => void;
    evaluatingChannels: boolean;
    /** Why the last re-evaluation did not land. Stated where it was asked for. */
    channelError: string | null;
    /** The connection question, whose answer only the operator has. */
    connection: {
      awaitingSendAnswer: boolean;
      onSendRequest: () => void;
      sending: boolean;
      onConfirm: (state: RelationshipState) => void;
      confirming: boolean;
      onDismissPrompt: () => void;
      onStillAwaiting: () => void;
      notice: string | null;
    };
    /** Settling the candidate the resolver could not corroborate. */
    identityConfirm: {
      onConfirm: (confirmed: boolean) => void;
      submitting: boolean;
      notice: string | null;
    };
    /**
     * Which candidate band 4 argues for, and the control that changes it.
     *
     * Null means the ranking's own winner, whose reasoning the card already carries behind
     * "View why". A non-null value is a candidate the operator picked out of the execution
     * panel's alternatives, and band 4 states the argument for that one instead.
     */
    explained: CandidateAction | null;
    onExplainCandidate: (action: CandidateAction) => void;
    /** A write landed whose effect the held payload cannot describe. Re-read it. */
    onRecordChanged: () => void;
  };
  onAction: (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => void;
  onShowEmail: (lead: QualifiedLead) => Promise<void> | void;
  /**
   * What Enrich Now costs, from the server's price list. `null` renders no tag — the page
   * owns the balance read and this dossier is handed the answer rather than making its own.
   */
  enrichPrice?: number | null;
}) {
  const tier = tierMeta(lead.acvTier);
  const action = ACTION_META[lead.recommendedAction];
  const handed = lead.handoffState === "handed_to_max";
  // "Show Email" is only offered on a CONFIRMED company (its own domain, a name
  // that isn't an article headline). The server refuses anything else with
  // "unresolved_company" and spends no credit — this only avoids offering an
  // action that would be refused. Undefined (an older stored row) still gets it.
  const enrichable = lead.enrichable !== false;
  const blocks = angleBlocks(lead, icp);
  const host = hostOf(lead) || group.domain;
  const [enriching, setEnriching] = useState(false);

  // ── The Contextual_Outreach_Surface: open, and where it is ──
  //
  // Two pieces of state, and both are local because the region is local. The page keys this
  // component on the selected lead, so selecting a different prospect remounts it and the
  // region closes on its own — no reset effect, and no way for one person's open composer to
  // be on screen under another person's name.
  //
  // `openTick` exists because "scroll it into view in the same commit" cannot be done from
  // the press: the region is not in the DOM until the commit that opens it, so a
  // `scrollIntoView` in the handler would be addressed at nothing. Bumping a counter beside
  // the flag puts both in one batch, and the layout effect below runs after React has
  // mutated the DOM and before the browser paints — the same commit, and the operator never
  // sees the unscrolled frame.
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [openTick, setOpenTick] = useState(0);
  const outreachRef = useRef<HTMLElement | null>(null);
  const outreachHeadingId = useId();

  /**
   * The one way in, called by exactly two presses (§7).
   *
   * Contact Directly on `ProspectDecision` pre-activation, and Take action on
   * `NextBestActionCard` post-activation. Nothing else calls it, nothing between the press
   * and the surface asks the operator a question, and neither press navigates: R5.7 is a
   * statement about what happens *between* the press and the draft, and what happens is one
   * state update.
   */
  const openOutreach = useCallback(() => {
    setOutreachOpen(true);
    setOpenTick((tick) => tick + 1);
  }, []);

  useLayoutEffect(() => {
    if (openTick === 0) return;
    // Optional call, not optional chain on the ref alone: jsdom implements no layout, so
    // `scrollIntoView` is absent there and a bare call would throw inside a layout effect —
    // taking the whole render down in every test that presses either control.
    outreachRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [openTick]);

  // ── What bands 4 and 5 say when they have nothing to show ──
  //
  // Both answers come out of the vocabulary that already exists: `GTM_ABSENCE_LABELS` for
  // the stage table's statements and `absenceSentence()` for `OverlayState`'s three kinds.
  // Nothing here invents a fourth way of saying "nothing".
  const active = isIntelligenceActive(decision.stage);
  const nbaAbsence = nbaAbsenceStatement({
    active,
    hasRecommendation: decision.recommended !== null,
    rankingFailed: decision.rankingFailed,
    timing: intelligence.stateFull?.timing ?? null,
  });

  // The selection's own payload, named once. Null is a failed read and never a blank
  // prospect: every block below that renders from it is gated on it, and band 3's amber line
  // is what says why the rest is missing.
  const detail = intelligence.detail;

  // Band 5's two grounded sources, and the one case that earns the absence sentence.
  // Eva's events are read in payload order — the order the backend supplied is the order
  // presented (R8.10), so there is no sort here.
  const evaEvents = lead.signals ?? [];
  // `detail.activity.level`, not `detail.state.activityLevel`: the same banding, and this is
  // the one `ActivityPanel` renders, so the gate and the panel now agree about what
  // "observed" means. Both are the same `ObservedFact` from the same read.
  const activityLevel = detail?.activity.level ?? null;
  const activityLevelObserved = Boolean(
    activityLevel && !activityLevel.isUnknown && activityLevel.value != null
  );
  // Only a tracked prospect earns `noActivity`: the sentence promises Weez reads their
  // profile on a schedule, which is true once intelligence is active and a claim before it.
  const activityAbsence =
    active && !activityLevelObserved && evaEvents.length === 0
      ? GTM_ABSENCE_LABELS.noActivity
      : null;
  const showActivityBand =
    activityLevelObserved || evaEvents.length > 0 || activityAbsence !== null;

  // ── What "Where this prospect stands" renders, and why each has two sources ──
  //
  // The three readings arrive on either payload: `getProspect` carries them as additive
  // fields when the server is new enough, and `getProspectState` always does. The detail
  // copy is preferred because it came from the same read as everything else in the band, and
  // `null` — not an empty list, not an `UNKNOWN`-valued stage — is what "nothing has been
  // read" looks like on both. All three panels take non-nullable props by contract, so a
  // section with nothing to report says so instead of being fed an invented payload.
  const buyingStage = detail?.buyingStage ?? intelligence.stateFull?.buyingStage ?? null;
  const intents = detail?.intents ?? intelligence.stateFull?.intents ?? null;
  const channelStates = detail?.channelStates ?? intelligence.stateFull?.channels ?? null;

  /**
   * The candidate band 4 argues for, and the reasoning behind it.
   *
   * Only ever the candidate the operator *asked* about, from the execution panel's "Edit
   * reasoning" control. The ranking's own winner is deliberately absent from this slot:
   * `NextBestActionCard` already renders `ActionExplanation` behind its "View why"
   * disclosure, so mounting a second copy of the same four sections in the band above it
   * would answer one question twice and put the whole evidence apparatus in a primary
   * statement (R8.8, R9.9).
   */
  const explainedCandidate = flows.explained;
  /** The learning scope this evaluation applied — the argued candidate's, or the winner's. */
  const learningScope =
    (explainedCandidate ?? decision.recommended)?.explanation?.scope ?? null;

  const revealEmail = async () => {
    setEnriching(true);
    try {
      await onShowEmail(lead);
    } finally {
      setEnriching(false);
    }
  };

  const copyBrief = async () => {
    const text = [
      `${lead.contact?.name || "Contact TBD"}${lead.contact?.role ? ` — ${lead.contact.role}` : ""} @ ${lead.company}`,
      `ICP fit ${lead.icpFit} · ${tier.label} (${tier.range}) · ${action?.label || lead.recommendedAction}`,
      ...blocks.map((b) => `${b.label}: ${b.value}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prospect brief copied");
    } catch {
      toast.error("Couldn't copy — clipboard access was blocked");
    }
  };

  return (
    <motion.div
      key={lead.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Band 1: the company ──
          First, because that is the order the Dossier_Hierarchy fixes and the order the
          question arrives in: which account is this, and is it the kind of account we sell
          to. Everything here is a field on the Eva workspace lead. */}
      <div
        data-gtm-section="company"
        className="rounded-2xl border border-zinc-200/70 bg-white p-5 pb-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      >
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo
            logoUrl={lead.logoUrl}
            domain={lead.domain}
            company={lead.company}
            className="h-12 w-12"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">{lead.company}</h2>
              <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                fit {lead.icpFit}
              </span>
              <Chip tone={tier.tone}>
                {tier.label} · {tier.range}
              </Chip>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-zinc-500">
              {/* An unknown industry is an evidence gap, shown as "—" — never
                  filled in with the declared ICP label. */}
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {lead.industry || "—"}
              </span>
              {lead.employeeRange && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {lead.employeeRange}
                </span>
              )}
              {lead.hqLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.hqLocation}
                </span>
              )}
              {host && (
                <a
                  href={lead.website || `https://${lead.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium text-zinc-500 hover:text-violet-600"
                >
                  <Globe className="h-3 w-3" /> {host}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Band 2: the prospect, their role, and how to reach them ──
          The person the decision is about. Split from the company above so the two bands
          are separately assertable, which is what `data-gtm-section` is for.

          What used to sit at the bottom of this card is gone, and R9.9 is why: the email
          source, the email confidence, the raw `status` value, the `handoffState` with its
          underscores swapped for spaces and the last-updated stamp. Two of those are
          evidence about a statement rather than a statement (R8.8), two were raw backend
          enum values in a primary band (R8.3), and none of the five changes what a rep does
          next. The handoff is still said, in words, as a chip. */}
      <div
        data-gtm-section="prospect"
        className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      >
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                {lead.contact?.name || "Decision-maker not resolved yet"}
              </h2>
              {action && (
                <Chip tone={action.tone} icon={Zap}>
                  {action.label}
                </Chip>
              )}
              {handed && <Chip tone="violet">With Max</Chip>}
            </div>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {[lead.contact?.role, lead.company].filter(Boolean).join(" · ")}
            </p>

            {/* Every prospect on this page has already been through Enrich Now, so the
                control below looks redundant and is not. An enrichment that *ran* and found
                nothing still promotes the lead — `enrich_lead_now` answers `no_email` and
                the `sales_leads` row is created either way — so a prospect can legitimately
                be here with no address yet, and re-running the waterfall is the thing to do
                about it. The retry is free: the credit charge is keyed on the lead, so a
                second click on the same one is not billed. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lead.contact?.email ? (
                <a
                  href={`mailto:${lead.contact.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  {lead.contact.emailVerified ? <MailCheck className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  {lead.contact.email}
                </a>
              ) : enrichable ? (
                <button
                  onClick={revealEmail}
                  disabled={enriching}
                  title="Resolve this decision-maker's email. Counts against the monthly enrichment cap and spends one workspace credit."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
                >
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  {enriching ? "Finding email…" : "Enrich Now"}
                  {/* The server's price, not a literal. Absent when the balance has not
                      been read, which is honest: a control that looks free and charges is
                      worse than one with no tag. */}
                  <CreditPriceTag credits={enrichPrice} />
                </button>
              ) : (
                <span
                  title="This record has no confirmed company identity (its own domain), so contact enrichment isn't offered."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[12px] font-medium text-zinc-400"
                >
                  <Mail className="h-3.5 w-3.5" /> Company not confirmed
                </span>
              )}
              {lead.contact?.linkedinUrl && (
                <a
                  href={lead.contact.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── The observed prospect, folded in from `GTMProspect` ──
            `ProspectHeader`, unmodified, inside band 2 because it is band 2's subject: who
            this person is. It costs nothing — `getProspect` is one of the three reads the
            selection already makes.

            **An assertion and an observation are different claims.** Everything above this
            line is what Eva asserted during enrichment; every field below it is an
            `ObservedFact` read off a LinkedIn page, which is why the same name can appear
            twice and why an unobserved profile reads "Unknown" here rather than falling back
            to the asserted value. A surface that rendered the two identically would be
            claiming Weez observed something nobody looked at.

            `headingAs="h2"` keeps the outline flat — the bands above are `<h2>`s — and
            `updatedAt` is deliberately not passed: the "observed 3d ago" line it adds is a
            timestamp, which is evidence about a statement rather than a statement, and R8.8
            puts that inside a disclosure. The per-fact provenance the primitive prints is the
            component's own and is left as it is; nothing here reaches into it. */}
        {detail && (
          <ProspectHeader
            profile={detail.profile}
            headingAs="h2"
            className="mt-4 rounded-xl border-zinc-100 p-4 shadow-none"
          />
        )}
      </div>

      {/* ── Band 3: current status ──
          One line, always present, naming the stage and what it means. This is what makes
          the page's transformation legible: the same dossier says "Ready to decide", then
          "Activating intelligence…", then "Watching for activity", then "Ready to act", and
          the operator can see which of those they are looking at without inferring it from
          which panels happen to be populated.

          The `WAITING` sentence is the load-bearing one. Observation is asynchronous, so an
          activated prospect legitimately shows empty panels for a while — and without this
          line that reads as a broken product rather than as a working one that has not been
          told anything yet.

          Every string is `PROSPECT_STAGE_LABELS`', including the failed-read case, which is
          `GTM_ABSENCE_LABELS.prospectReadFailed` rather than the sentence that used to be
          written here inline. The band renders in all cases, because R3.9 asks for the
          current status even when a secondary read did not land — and "we could not read it"
          is the honest status then. */}
      {/* The region, announced (R19.5). Not only the notice inside it: the label and the body
          are *replaced* on every transition — "Ready to decide" becomes "Activating
          intelligence…" becomes "Watching for activity" — and a rep using a screen reader
          learns that activation worked from that swap, not from a toast this page does not
          show. The notice paragraph keeps its own `aria-live` because it is the sentence that
          carries what activation actually did; the closest live ancestor owns each change, so
          the two do not announce twice. */}
      <div data-gtm-section="status" aria-live="polite">
        {decision.readFailed ? (
          /* Our failure, said as ours — with the retry R18.5 requires beside it. This band is
             the one place the prospect read's failure is stated with a control, and the two
             disclosure branches further down that repeat the sentence cannot render without
             this line being on screen above them. */
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
            <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-amber-800">
              {GTM_ABSENCE_LABELS.prospectReadFailed}
            </p>
            <RetryButton onClick={decision.refreshRead} className="border-amber-200" />
          </div>
        ) : (() => {
          const meta = PROSPECT_STAGE_LABELS[decision.stage];
          if (!meta) return null;
          const active = isIntelligenceActive(decision.stage);
          const journeyState = intelligence.stateFull?.journeyState ?? null;
          return (
            <div
              data-gtm-stage={decision.stage}
              className={cn(
                "rounded-2xl border px-4 py-3",
                active
                  ? "border-violet-200 bg-violet-50/50"
                  : "border-zinc-200/70 bg-white"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={active ? "violet" : "zinc"}>
                  {decision.activating && (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  )}
                  {meta.label}
                </Chip>
                <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-zinc-500">
                  {meta.body}
                </p>
              </div>
              {/* Where the belief places them, once there is a belief to place them in.
                  The shared badge, mounted unchanged, carrying its own display-only note:
                  the projection is recomputed from the dimensions on every read and this
                  band is not allowed to let it read as an observed fact. It is fed from
                  `ProspectStateFull` — the selection's own state read — and not from the
                  queue row, so a prospect with no live recommendation still shows where
                  they stand. */}
              {active && journeyState && (
                <div className="mt-2 border-t border-zinc-200/60 pt-2">
                  <JourneyStateBadge journeyState={journeyState} />
                </div>
              )}
              {/* What activation actually did, read off the acknowledgement rather than
                  assumed. Announced politely so the transition is spoken. */}
              {decision.notice && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p
                    aria-live="polite"
                    className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-violet-800"
                  >
                    {decision.notice}
                  </p>
                  {/* Only where another read could answer it — the verdict this page stopped
                      watching for (R6.9). Every other notice is settled, and a retry beside a
                      settled statement is an invitation to press something that changes
                      nothing. */}
                  {decision.noticeRetryable && (
                    <RetryButton onClick={decision.refreshRead} />
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Bands 4 and 7: why this matters, and what to do about it ──
          One region, because they are one read. Band 4 is the recommendation's headline and
          its reason; band 7 is its control. `NextBestActionCard` is both, which is why the
          hierarchy's fourth and seventh bands render as one card — and why that card sits
          *above* bands 5 and 6 rather than in seventh place (R7.5). The operator's first
          question is "what should I do with this person", not "what has Weez observed": the
          observations are the *argument* for the answer, and they follow it.

          The card's own `data-gtm-section="next-best-action"` marks band 7 from inside the
          component; this region marks band 4. Neither is written twice — the same reason
          band 8 has no wrapper of its own: `ProspectDecision` already carries the attribute,
          and a second element repeating it would put one band in the sequence twice.

          **The why-now prose is the server's, entire.** `NextBestActionCard` renders
          `action.explanation.whyNow`, the bullets the evaluation persisted, through the same
          `WhyNowList` the full explanation uses. Nothing here composes a timing sentence,
          and a recommendation with no persisted reasoning says so (R8.6, R8.7).

          Where there is no recommendation the band still has a job: Eva's persisted
          qualification is why this prospect is in the pipeline at all, which is the same
          question one level up. */}
      <div data-gtm-section="why-this-matters" className="space-y-4">
        {/* A ranking that could not be read. One line, not an alert: the dossier around it
            is intact and the operator's next move is to refresh, not to worry. Its sentence
            is `GTM_ABSENCE_LABELS.rankingReadFailed` — the same string that used to be
            inline here — and it is deliberately not one of the two absences below, because
            "we could not look" is not "there is nothing". */}
        {isIntelligenceActive(decision.stage) &&
          decision.rankingFailed &&
          !decision.recommended && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-amber-800">
                {GTM_ABSENCE_LABELS.rankingReadFailed}
              </p>
              {/* "The operator's next move is to refresh" — so the refresh is here rather than
                  described. Same callback as the other two: one `Promise.allSettled`. */}
              <RetryButton onClick={decision.refreshRead} className="border-amber-200" />
            </div>
          )}

        {decision.recommended ? (
          <>
            <NextBestActionCard
              action={decision.recommended}
              // `"row"` is the one kind that carries an item. The other three are absences —
              // and a tier is never defaulted from one, because `LATER` is a real band and
              // "we didn't read the queue" is not a claim that this prospect is in it.
              priorityTier={overlay.kind === "row" ? overlay.item.priorityTier : null}
              // Press two of the two that open the outreach region. It used to navigate to
              // a Retired_Route that redirects back here; the surface it wanted is below.
              onTakeAction={openOutreach}
            />
            {/* The EPS_Summary, from the queue row the page-wide read already returned. No
                row means no dimensions, and the reason is `OverlayState`'s own — never a zero
                and never a defaulted band.

                Two of the three absences are said out loud here and one is deliberately not.
                `unknown` and `failed` are statements about our read — the queue page was
                truncated, or the read errored — and both sit correctly beside a card that
                came from a different route. `none` says "nothing is ranked for this
                prospect", which is a row chip's sentence and a flat contradiction printed
                under a card naming a recommended action: the recommendation is persisted and
                simply not on the live queue. So there the block is silent, exactly as the
                card itself is silent about the tier it was not given. */}
            {overlay.kind === "row" ? (
              <EpsSummary item={overlay.item} />
            ) : overlay.kind === "none" ? null : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-zinc-200 px-4 py-3">
                <p className="min-w-0 flex-1 text-[12px] text-zinc-500">
                  {absenceSentence(overlay)}
                </p>
                {/* Only `failed` earns a retry: it is the one of the two that is about us.
                    `unknown` means the queue was longer than the page we took, which another
                    identical read would answer identically. */}
                {overlay.kind === "failed" && <RetryButton onClick={refreshOverlay} />}
              </div>
            )}
          </>
        ) : (
          nbaAbsence && (
            /* In place of the card, not inside it: there is no recommendation, so there is
               no card, and a card-shaped placeholder would imply one is loading. */
            <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-[12.5px] leading-relaxed text-zinc-600">
              {nbaAbsence}
            </p>
          )
        )}

        {/* ── Band 4's `ActionExplanation`: the argument for a *different* candidate ──
            Folded in from `GTMProspect`, where it sat beside the execution panel, and mounted
            here on the one condition that makes it say something new: the operator pressed
            "Edit reasoning" on one of the ranking's alternatives in band 7, and the reasoning
            on screen now has to be that candidate's.

            It is not mounted for the winner, and that is the point. `NextBestActionCard`
            renders this same component behind its own "View why" disclosure, so a second copy
            in the band would be four sections of persisted terms, signal ids, evidence and
            contributions restating an answer already on screen — the same thing twice, and
            all of it evidence-class detail sitting in a primary statement (R8.8, R9.9).

            Null explanation is a real answer and the panel says so itself: the candidate was
            scored and the argument for it was not persisted. */}
        {explainedCandidate && (
          <ActionExplanation explanation={explainedCandidate.explanation ?? null} />
        )}

        {/* ── Band 7: the execution panel, beside the recommendation it executes ──
            `NextActionPanel`, unmodified, from `getProspect`'s own `nextAction` and the
            ranking read the selection already made — no request of its own on mount beyond
            the `VIEWED` position `ActionCard` records for a recommendation it puts on screen,
            which is route 10's contract and not a read.

            Mounted only where there is something to execute: a prepared next action, or a
            ranked recommendation. Without either, the panel's own "nothing has been prepared"
            line would be a second answer beside the absence statement above it, and two
            sentences for one absence is what the three-way absence vocabulary exists to
            avoid.

            `onLifecycleRecorded` is deliberately not wired. `ActionCard` fires it from the
            `VIEWED` effect on mount, so bumping the dossier's refresh key from it would
            re-read every open disclosure on every prospect selection — the exact cost the
            disclosure inventory is built to avoid. The other three callbacks are operator
            presses and each re-reads once. */}
        {active && detail && (detail.nextAction || decision.recommended) && (
          <NextActionPanel
            brandId={intelligence.brandId}
            leadId={intelligence.gtmLeadId}
            nextAction={detail.nextAction}
            nextBestAction={intelligence.ranking}
            confirmationStatus={detail.state.confirmationStatus}
            messageVersions={detail.messageVersions}
            contactPrice={decision.contactPrice}
            onActionRequested={flows.onRecordChanged}
            onFeedbackRecorded={flows.onRecordChanged}
            onMessagePersisted={flows.onRecordChanged}
            onEditReasoning={flows.onExplainCandidate}
          />
        )}

        {/* Why this prospect at all — Eva's captured event and her qualification reason,
            both persisted fields. Rendered only where the server has no recommendation prose
            to carry the band, so the two never state the same thing twice.

            The "Why now" eyebrow that used to head the event is gone: R8.6 pins that phrase
            to the backend's own why-now bullets, and a second one over a different field
            would be two answers to one question. */}
        {!decision.recommended && (lead.primaryEvent || lead.qualificationReason) && (
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <PanelTitle icon={Target}>{PROSPECT_GTM_LABELS.whyThisProspect}</PanelTitle>
            <div className="space-y-2.5">
              {lead.primaryEvent && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  {lead.eventType && (
                    <Chip tone={SIGNAL_META[lead.eventType]?.tone || "zinc"}>
                      {SIGNAL_META[lead.eventType]?.label || lead.eventType}
                    </Chip>
                  )}
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-zinc-800">
                    {stripEventPrefix(lead.primaryEvent)}
                  </p>
                </div>
              )}
              {lead.qualificationReason && (
                <p className="text-[13px] leading-relaxed text-zinc-600">
                  {lead.qualificationReason}
                </p>
              )}
              {action?.desc && (
                <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /> {action.desc}
                </p>
              )}
              {lead.escalation && (
                <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />{" "}
                  {lead.escalation}
                </p>
              )}
              {lead.notes && (
                <p className="rounded-xl bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-500">
                  {lead.notes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Band 5: activity ──
          What has actually happened with this prospect, in the order the payload supplied
          it. Nothing is re-sorted here: R8.10 asks for activity ordered by sales impact and
          the backend is what ranks it, so a client-side sort would be this page asserting an
          impact ordering nobody computed.

          Two grounded sources, neither of them a new request. The observed activity rides on
          the `getProspect` payload the selection already read and is rendered by
          `ActivityPanel`, whose every value goes through `ObservedValue` — so an unobserved
          level reads "Unknown" rather than as a zero. Eva's captured channel events are on the
          workspace payload, and they are what makes an enriched-but-unactivated prospect
          legible (R4.1) — stated as *what happened*, with the per-signal strength, poster and
          confidence left to the evidence disclosures below (R8.8). */}
      {showActivityBand && (
        <div
          data-gtm-section="activity"
          className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <PanelTitle icon={Activity}>{PROSPECT_GTM_LABELS.activityHeading}</PanelTitle>
          {/* ── The observed activity, folded in from `GTMProspect` ──
              `ActivityPanel`, unmodified, in place of the single `ObservedValue` line this
              band carried: the same banded level, plus the band's own staleness flag, from
              the same `getProspect` payload and at no extra cost.

              Mounted only where the level was actually observed. The panel's honest empty is
              three "Unknown"s, and printing those for every enriched-but-unactivated prospect
              would fill a primary band with a table of nothings — `activityAbsence` below is
              the one sentence that case earns. */}
          {activityLevelObserved && detail && (
            <ActivityPanel
              activity={detail.activity}
              className="rounded-xl border-zinc-100 p-3.5 shadow-none"
            />
          )}
          {evaEvents.length > 0 && (
            <ul className={cn("space-y-1.5", activityLevelObserved && "mt-2.5")}>
              {evaEvents.map((event) => (
                <li key={event.id} className="text-[12.5px] leading-relaxed text-zinc-600">
                  <span className="font-semibold text-zinc-800">
                    {SIGNAL_META[event.signalType]?.label || event.signalType}
                  </span>
                  {event.detail ? <>{": "}{event.detail}</> : null}
                </li>
              ))}
            </ul>
          )}
          {activityAbsence && (
            <p className="text-[12.5px] leading-relaxed text-zinc-600">{activityAbsence}</p>
          )}
        </div>
      )}

      {/* ── Band 6: current buying intent ──
          Only once intelligence is active: before activation nothing has been evaluated, so
          this band could only report an absence, and an absence above the decision would
          bury the decision. */}
      {isIntelligenceActive(decision.stage) && <BuyingIntentPanel intent={intent} />}

      {/* ── Settling a candidate the resolver could not corroborate ──
          `IdentityConfirmPanel`, folded in from `GTMProspect` and mounted on exactly one
          condition: `hasCandidateToSettle(profile)`, which reads `identityCandidateUrl` — a
          field the server sends only while the identity is unsettled *and* a candidate
          exists. So visibility is the server's answer rather than a second rule of ours, and
          a search that reached no candidate correctly shows nothing to settle instead of an
          empty prompt.

          **This is not the identity gate and it is not an alternative to Activate
          Intelligence.** It is a question the server asked, which is why it sits beside the
          decision rather than in front of it (§4.2). `IdentityPanel` the component is not
          rendered anywhere on this surface (R6.6): nothing here is labelled with LinkedIn URL
          entry, profile finding or identity resolution, and the only thing this page imports
          from that module is `trackRefusal()`.

          No `data-gtm-section`: the hierarchy has eight bands and this is not one of them.
          Carrying an attribute here would put a ninth entry in a sequence the order property
          asserts against. */}
      {detail && hasCandidateToSettle(detail.profile) && (
        <IdentityConfirmPanel
          profile={detail.profile}
          onConfirm={flows.identityConfirm.onConfirm}
          submitting={flows.identityConfirm.submitting}
          notice={flows.identityConfirm.notice}
        />
      )}

      {/* ── Band 8: the decision controls ──
          Last in the hierarchy, and rendered at the one stage they mean anything. Never on a
          failed read: offering a paid choice about a prospect whose record could not be read
          would be guessing with the operator's credits. Before `ENRICHED` there is no
          confirmed identity to act on; after activation the choice has been made, and
          leaving the pair on screen would be offering a decision that no longer exists. */}
      {!decision.readFailed && showsDecision(decision.stage) && (
        <ProspectDecision
          // Band 8's marker is the panel's own `data-gtm-section="decision"`, exactly as
          // band 7's is `NextBestActionCard`'s. Wrapping either in a second element carrying
          // the same attribute would put one band in the sequence twice.
          //
          // Press one of the two. Straight to the surface: no channel chooser, no
          // confirmation and no identity prompt in between (R5.7). The channel section
          // label the operator does see is `ContactDirectlyPanel`'s own, inside the
          // surface, beside the draft — a heading, not a gate.
          onContactDirectly={openOutreach}
          contactUnavailableReason={decision.contactUnavailableReason}
          contactPrice={decision.contactPrice}
          onActivate={decision.onActivate}
          activating={decision.activating}
          activateUnavailableReason={decision.activateUnavailableReason}
          activatePrice={decision.activatePrice}
          onResolveIdentity={decision.onResolveIdentity}
          resolving={decision.resolvingIdentity}
          // No `resolveLabel`. The prop is gone from `ProspectDecisionProps`: it carried
          // `GTM_IDENTITY_LABELS.resolve` — "Find their LinkedIn profile" — into the
          // decision surface's interface, which is identity vocabulary crossing a boundary
          // R4.5 and R6.6 keep closed. Nothing rendered it, so nothing on screen changes;
          // what changes is that the card can no longer be handed the string.
        />
      )}

      {/* ── The Contextual_Outreach_Surface ──
          Five slots, all of them from reads this dossier already holds, so opening the region
          costs nothing: the prospect is the Eva workspace lead, the recommendation and its
          explanation are the `getNextBestAction` payload the selection read, the angle is
          composed from persisted fields, and the drafts are `getProspect`'s
          `messageVersions`. Generating a draft is a press, and it is the operator's.

          **A region, not a page (R12.3).** It is below the decision because that is what
          opened it — either card above hands the operator down here, and the layout effect
          puts it in front of them. Nothing about it is a destination: no route, no entry in
          the navigation, and neither press leaves this surface.

          **No prospect picker and no recommendation picker (R12.2).** Both are the current
          selection's, which is what makes this contextual rather than a second workspace.
          There is nothing to choose here and so nothing that could be chosen wrongly.

          `ContactDirectlyPanel` carries its own `data-gtm-section="contact-directly"`, which
          is a ninth value in a sequence the Dossier_Hierarchy order property asserts over —
          and it stays out of that sequence because this region is closed until pressed, which
          is the same reason the region itself carries `data-gtm-region` rather than
          `data-gtm-section`. It is not one of the eight bands. */}
      {outreachOpen && (
        <section
          ref={outreachRef}
          aria-labelledby={outreachHeadingId}
          data-gtm-region="contextual-outreach"
          className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4"
        >
          <div>
            <h2
              id={outreachHeadingId}
              className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900"
            >
              <Compass className="h-4 w-4 text-violet-500" aria-hidden="true" />
              {PROSPECT_GTM_LABELS.outreachHeading}
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
              {PROSPECT_GTM_LABELS.outreachNote}
            </p>
          </div>

          {/* ── Slot 1: the prospect ──
              The selection, restated so the operator can see who they are about to write to
              without scrolling back up. Every field is the workspace lead's own; an absent
              role or company is simply not printed rather than filled in. */}
          <div
            data-outreach-slot="prospect"
            className="rounded-xl border border-zinc-200/70 bg-white px-3.5 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {PROSPECT_GTM_LABELS.outreachProspect}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-zinc-800">
              <span className="font-semibold">{lead.contact?.name || lead.company}</span>
              {lead.contact?.role ? <span className="text-zinc-500"> · {lead.contact.role}</span> : null}
              {lead.contact?.name ? <span className="text-zinc-500"> · {lead.company}</span> : null}
            </p>
          </div>

          {/* ── Slot 2: the next best action ──
              Omitted pre-activation, and that is the design's own answer rather than a gap:
              nothing has been evaluated, and the Contact Directly path needs no
              recommendation to work. Where there is one, it is *stated* — one line through
              `GTM_NBA_ACTION_LABELS`, the table `NextBestActionCard` reads, so the action has
              one name on this surface. A second `NextBestActionCard` here would repeat band
              7's control and its `data-gtm-section` with it. */}
          {decision.recommended && (
            <div
              data-outreach-slot="next-best-action"
              className="rounded-xl border border-zinc-200/70 bg-white px-3.5 py-2.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                {PROSPECT_GTM_LABELS.outreachRecommendation}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold leading-snug text-zinc-800">
                {GTM_NBA_ACTION_LABELS[decision.recommended.actionType] ??
                  decision.recommended.actionType}
                {decision.recommended.channel && (
                  <span className="font-medium text-zinc-400">
                    {" · "}
                    {CHANNEL_LABEL[decision.recommended.channel] ??
                      decision.recommended.channel}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* ── Slot 3: the reason (R12.5) ──
              The backend's own explanation, through the component that renders it everywhere
              else. Never composed here: the four sections are the terms the evaluation
              persisted, and a null explanation is `ActionExplanation`'s own sentence rather
              than a blank. Pre-activation there is no recommendation to argue for and the
              panel says exactly that — which is the honest reading, not a placeholder. */}
          <div data-outreach-slot="reason">
            <ActionExplanation
              explanation={decision.recommended?.explanation ?? null}
              className="border-zinc-200/70"
            />
          </div>

          {/* ── Slot 4: the conversation angle ──
              Moved here from the foot of the dossier, not copied: this is the one angle panel
              on the surface, and it is `angleBlocks(lead, icp)` unchanged — Eva's captured
              event, her qualification reason and the saved ICP positioning, each labelled
              with where it came from. It belongs beside the composer, because the angle is
              what the draft is grounded in, and it was evidence with no decision attached
              where it used to sit. */}
          <div
            data-outreach-slot="conversation-angle"
            className="rounded-xl border border-zinc-200/70 bg-white p-4"
          >
            <PanelTitle
              icon={Sparkles}
              right={
                blocks.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-full border-zinc-200 text-[11px]"
                    onClick={copyBrief}
                  >
                    <Copy className="h-3 w-3" /> {PROSPECT_GTM_LABELS.outreachAngleCopy}
                  </Button>
                ) : undefined
              }
            >
              {PROSPECT_GTM_LABELS.outreachAngleHeading}
            </PanelTitle>
            {blocks.length > 0 ? (
              <>
                <div className="space-y-2">
                  {blocks.map((b) => (
                    <div
                      key={b.label}
                      className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                          {b.label}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-400">{b.source}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">{b.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 text-[10.5px] leading-relaxed text-zinc-400">
                  {PROSPECT_GTM_LABELS.outreachAngleNote}
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-[12px] text-zinc-400">
                {PROSPECT_GTM_LABELS.outreachAngleEmpty}
              </p>
            )}
          </div>

          {/* ── Slot 5: the Contact Directly control → the composer ──
              `ContactDirectlyPanel`, whole and unmodified, which is what makes R5.7 hold: it
              renders the channel section label, the Generate control and the composer in one
              pass, so between the press that opened this region and a draft there is exactly
              one press — the operator's own request for a draft — and no question of ours.

              `versions` is the held payload's, so the panel opens with whatever drafts already
              exist and generates only when asked. `unavailableReason` is `contactGateOf()`'s
              answer, the single Contact gate (R5.5), rendered in the control's place rather
              than beside a disabled one (R5.8). The channel to open is the enriched address or
              the profile url — the same two facts the gate reads, so a live control always has
              somewhere to go.

              Both write callbacks land on `onRecordChanged`: filing a contact action and
              persisting a draft are writes whose effect the held payload cannot describe, and
              a pre-activation draft comes back `persisted: false`, which is
              `MessageComposer`'s own business (task 12.5) and not this region's. */}
          <div data-outreach-slot="contact-directly">
            <ContactDirectlyPanel
              brandId={intelligence.brandId}
              leadId={intelligence.gtmLeadId}
              versions={detail?.messageVersions ?? []}
              contactEmail={lead.contact?.email ?? null}
              profileUrl={detail?.profile.profileUrl ?? lead.contact?.linkedinUrl ?? null}
              onMessagePersisted={flows.onRecordChanged}
              onContactRecorded={flows.onRecordChanged}
              contactPrice={decision.contactPrice}
              unavailableReason={decision.contactUnavailableReason}
              className="border-zinc-200/70 shadow-none"
            />
          </div>
        </section>
      )}

      {/* ── Deeper intelligence: the seven-section disclosure inventory ──
          The argument for the recommendation above, and nothing an operator has to read in
          order to act. Seven sections in the order the questions arrive — where do they
          stand, how do we reach them, where does the relationship stand, what moved them,
          what did we read, what happened when, and what have we learned from prospects like
          this — under one always-open reading of the current state.

          **This is where every evidence-class value on the surface lives (R8.8).** Signals,
          raw evidence, per-dimension and per-intent confidences, sources, timestamps, state
          history and the scoring components behind a recommendation are all in here, each
          beside the statement it supports, and none of them is a primary band's business.

          **Four of the seven fetch, and only when opened (R3.8).** `IntelligenceSection` is
          unchanged: its `children` is a function, and a collapsed `<details>` never calls it,
          so the panel is never constructed and never reads. `StateHistoryPanel`, `SignalList`
          and `ProspectTimeline` each own a collection, a pager and a failure;
          `LearningInsights` holds the one `/debug` read for the panel that takes its
          collection as a prop. The other three read *nothing* on open — they render slices of
          the two payloads the selection already holds — and `ChannelRecommendationPanel` is
          the one with a caveat: its `recommendChannel` fires on the explicit re-evaluate
          press and never on open, which is why "How to reach them" sits with the free
          sections.

          So a prospect selection costs three reads however many sections exist, which is what
          it cost before the fold-in. Every panel here is the existing component, unmodified. */}
      {isIntelligenceActive(decision.stage) && intelligence.gtmLeadId && (
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {PROSPECT_INTELLIGENCE_SECTIONS.regionHeading}
            </p>
            <p className="min-w-0 text-[11px] text-zinc-400">
              {PROSPECT_INTELLIGENCE_SECTIONS.regionNote}
            </p>
          </div>

          {/* Current state. Rendered from the payload the page already holds, so it costs
              nothing and needs no disclosure. Absent only when the prospect read failed —
              and then the amber line above has already said so. */}
          {detail && (
            <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <StateDimensionGrid
                state={detail.state}
                stateFull={intelligence.stateFull}
              />
            </div>
          )}

          {/* ── Where this prospect stands ──
              The three readings behind the dimension grid above, each with its own
              confidence and its own supporting signal ids: their own buying stage, all
              eleven intent types rather than band 6's strongest three, and each channel read
              on its own evidence. Every field is on a payload the selection already holds, so
              opening this issues no request. */}
          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.standing}
            note={PROSPECT_INTELLIGENCE_SECTIONS.standingNote}
          >
            {() => (
              <div className="space-y-4">
                {buyingStage && <BuyingStagePanel buyingStage={buyingStage} />}
                {intents && <IntentPanel intents={intents} />}
                {channelStates && <ChannelIntelligencePanel channels={channelStates} />}
                {/* Nothing read is not the same as nothing observed, and the three panels
                    above each say the second for themselves. This says the first. */}
                {!buyingStage && !intents && !channelStates && (
                  <p className="text-[12px] leading-relaxed text-zinc-500">
                    {GTM_PAGE_LABELS.noIntelligenceRead}
                  </p>
                )}
              </div>
            )}
          </IntelligenceSection>

          {/* ── How to reach them ──
              The three scored channels with the server's own winner, and whether the
              conversation is ready for an ask. Both render from the held `getProspect`
              payload, so opening this reads nothing; the re-evaluate control inside the
              channel panel is the only thing on this surface that calls
              `recommendChannel`, and it calls it on the press. */}
          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.reach}
            note={PROSPECT_INTELLIGENCE_SECTIONS.reachNote}
          >
            {() =>
              detail ? (
                <div className="space-y-4">
                  {/* A re-evaluation that did not land, said where it was asked for. One
                      line rather than an alert: the panel below still holds the last
                      persisted evaluation, and its own control is the retry. */}
                  {flows.channelError && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                      {flows.channelError}
                    </p>
                  )}
                  <ChannelRecommendationPanel
                    channels={detail.channels}
                    recommendedChannel={detail.recommendedChannel}
                    onReevaluate={flows.onReevaluateChannels}
                    evaluating={flows.evaluatingChannels}
                  />
                  <CTAReadinessPanel cta={detail.cta} />
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-zinc-500">
                  {GTM_ABSENCE_LABELS.prospectReadFailed}
                </p>
              )
            }
          </IntelligenceSection>

          {/* ── Relationship & connection ──
              Whether the operator can actually talk to this person yet, and the two answers
              only they have. `ConnectionPanel` reads `detail.state.relationshipState` and
              writes nothing on open: each control either records what the operator tells us
              or, for the two honest "nothing happened" answers, calls nothing at all. */}
          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.relationship}
            note={PROSPECT_INTELLIGENCE_SECTIONS.relationshipNote}
          >
            {() =>
              detail ? (
                <ConnectionPanel
                  relationship={detail.state.relationshipState}
                  awaitingSendAnswer={flows.connection.awaitingSendAnswer}
                  onSendRequest={flows.connection.onSendRequest}
                  sending={flows.connection.sending}
                  onConfirm={flows.connection.onConfirm}
                  confirming={flows.connection.confirming}
                  onDismissPrompt={flows.connection.onDismissPrompt}
                  onStillAwaiting={flows.connection.onStillAwaiting}
                  notice={flows.connection.notice}
                />
              ) : (
                <p className="text-[12px] leading-relaxed text-zinc-500">
                  {GTM_ABSENCE_LABELS.prospectReadFailed}
                </p>
              )
            }
          </IntelligenceSection>

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.stateHistory}
            note={PROSPECT_INTELLIGENCE_SECTIONS.stateHistoryNote}
          >
            {() => (
              <StateHistoryPanel
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.signals}
            note={PROSPECT_INTELLIGENCE_SECTIONS.signalsNote}
          >
            {() => (
              <SignalList
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.timeline}
            note={PROSPECT_INTELLIGENCE_SECTIONS.timelineNote}
          >
            {() => (
              <ProspectTimeline
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>

          {/* ── What we've learned ──
              Where the retired standalone Learning page lands (R8.11, R8.12): what worked
              with prospects like this one, every rate carrying its sample size and its
              interval, and the scope decision this evaluation actually applied. Learning is a
              property of a prospect rather than a destination, so it is the last question in
              the prospect's own sequence and not a fifth item in the navigation.

              One `/debug` read, on open, held by `LearningInsights` above. */}
          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.learned}
            note={PROSPECT_INTELLIGENCE_SECTIONS.learnedNote}
          >
            {() => (
              <LearningInsights
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
                scope={learningScope}
              />
            )}
          </IntelligenceSection>
        </div>
      )}

      {/* Two panels stood here and both are accounted for above.
          "Why this prospect" is band 4's occupant now, where the hierarchy puts the reason
          this prospect matters — and it renders only where the server has no recommendation
          prose, so the two never answer the same question twice. Eva's "Signal activity"
          timeline is gone: see the note where `SignalTimeline` used to be defined. What a rep
          needs from those signals — what happened — is band 5; the strength, source,
          timestamp and confidence behind each are in the evidence disclosures. */}

      {/* The conversation angle stood here and is slot 4 of the outreach region now (§7),
          which is the one place it means something: it is what a draft is grounded in, and
          below the disclosure inventory it was a panel of context with no act attached to it.
          Moved, not copied — `angleBlocks(lead, icp)` has one call site on this surface and
          `copyBrief` still copies the same brief from the same blocks. */}

      {/* Handoff */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900">
            {handed ? "Handed to Max" : "Ready to hand to Max?"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">
            {handed
              ? "Max owns the outreach for this lead. Pull it back if it shouldn't be in the queue."
              : "Max picks up the company, contact and captured event — no research repeated."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Two controls stood here and the fold-in removed both, which is what §1.3 names
              as this rule's two known call sites.

              The first was "Open prospect", the entry to the LinkedIn GTM execution surface.
              There is no second surface to open any more: every panel that page rendered is
              now on this one, which is the whole point of one prospect being one surface
              (R3.2). A control offering to take the operator to a redirect back to here is
              worse than no control.

              The second was "Open in Max" on a handed lead. It targeted a Compatibility_Route,
              and R2.4 keeps every retired destination out of in-page navigation, cross-links
              and empty-state calls to action. Handing to Max is unchanged and still says so;
              what is gone is the affordance that navigated there. */}
          {handed ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => onAction(lead, "reject")}
            >
              <Ban className="h-3.5 w-3.5" /> Pull back
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs text-zinc-500 hover:text-red-600"
                onClick={() => onAction(lead, "reject")}
              >
                <Ban className="h-3.5 w-3.5" /> Not a fit
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full bg-violet-600 text-xs hover:bg-violet-700"
                onClick={() => onAction(lead, "hand_to_max")}
              >
                Hand to Max <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

type TierFilter = "all" | ACVTier;
type QualityFilter = "all" | "latest" | "high" | "low";

const QUALITY_FILTERS: { key: QualityFilter; label: string }[] = [
  { key: "all", label: "All quality" },
  { key: "latest", label: "Latest" },
  { key: "high", label: "High quality" },
  { key: "low", label: "Low quality" },
];
const HIGH_QUALITY_FIT = 70;
const LOW_QUALITY_FIT = 50;

function PillGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  // NoInfer keeps `onChange` out of inference for T. React's setState is
  // `Dispatch<SetStateAction<T>>`, so its parameter is `T | ((prev: T) => T)` —
  // as an inference candidate that union violates `T extends string` and TS
  // silently widens T to `string`. Infer T from `value`/`options` only.
  onChange: (v: NoInfer<T>) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-fit items-center gap-1 rounded-full bg-zinc-100/80 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
            value === o.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProspectIntelligence() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [ws, setWs] = useState<EvaWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ScanStage | null>(null);

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [actionFilter, setActionFilter] = useState<EvaAction | "all">("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");

  const [companyKey, setCompanyKey] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");

  /**
   * The prospect a deep link asked for, by `sales_leads.id`.
   *
   * Enrich Now is pressed on Market Intelligence and the prospect becomes workable
   * *here*, so that handoff has to be able to name which one. Without this the link
   * landed on the page and selected whatever sorted first, which made the most important
   * transition in the product feel like it had lost the prospect.
   *
   * Applied once per requested id, in an effect below, rather than used directly as the
   * selection: the operator must be able to click a different prospect afterwards
   * without the URL dragging them back. It is read as the GTM id because that is what
   * every other id on this page now is (see `gtmLeadIdOf`).
   */
  // `urlParams`, not `search`: this page already has a `search` state holding the
  // search-box text.
  const [urlParams] = useSearchParams();
  const requestedGtmLeadId = (urlParams.get("lead_id") ?? "").trim();
  const appliedDeepLinkRef = useRef<string>("");

  // The GTM state overlay. Held apart from `ws` / `loading` / `error` on purpose:
  // these are secondary reads and neither one is allowed to take the dossier down.
  const [queue, setQueue] = useState<QueueOverlay | null>(null);
  const [queueFailed, setQueueFailed] = useState(false);
  /**
   * The three GTM reads for the *selected* prospect, held together.
   *
   * One read per selection rather than per row, which is the same argument this page
   * already made for the intent summary: the dossier shows one prospect at a time, and
   * that is what makes a per-prospect read affordable here at all. Firing these per row
   * would be three requests per decision-maker on mount.
   *
   * `Promise.allSettled`, and a failure flag per read. They are three routes with three
   * failure modes: a ranking that could not be read must not take the belief down with
   * it, and neither may touch `ws` / `loading` / `error` — Eva's rows and the dossier
   * render whether or not the GTM layer answers.
   *
   *   `detail`   `getProspect` — the profile row (the activation flag), the identity
   *              verdict (the activation gate), and the asserted contact.
   *   `state`    `getProspectState` — the belief. Carries `stateVersion`, which is how
   *              "activated and nothing observed yet" is told from "intelligence
   *              working", and the eleven intent records the dossier summarises.
   *   `ranking`  `getNextBestAction` — whether there is a recommendation, and the
   *              explanation behind it.
   */
  const [selected, setSelected] = useState<SelectedProspectRead>(EMPTY_SELECTED_READ);

  const reqRef = useRef(0);
  const queueReqRef = useRef(0);
  const intentReqRef = useRef(0);

  // ── Credits ──
  //
  // Enrich Now is priced at 1 credit and charged on this page. The balance read is a third
  // *secondary* call, on the same terms as the two GTM reads above it: its failure lives in
  // its own state and never touches `ws` / `loading` / `error`. A workspace whose balance
  // could not be read still renders its prospects — it just renders no price tags, which is
  // the honest fallback.
  const {
    balance: creditBalance,
    refresh: refreshCredits,
    priceFor,
  } = useCredits();
  const enrichPrice = priceFor("ENRICH");
  const activatePrice = priceFor("ACTIVATE");
  const contactPrice = priceFor("CONTACT");
  const [paywall, setPaywall] = useState<string | null>(null);

  /**
   * Whether the workspace has been started, from the workspace-level provider.
   *
   * Used by exactly one thing on this page: the outermost empty state, which says "Eva is
   * discovering your accounts" and asks the operator to wait. That is the right sentence
   * for a workspace whose discovery is running and has not landed anything yet, and the
   * wrong one for a workspace where discovery was never started — it asks somebody to wait
   * for work nobody has commissioned. Read, never derived, and `false` while unread, so
   * the sentence that shipped is what a failed read falls back to.
   */
  const {
    needsSetup: workspaceNeedsSetup,
    websiteConnected,
    goalSet,
    launched,
    nextStep: setupNextStep,
  } = useWorkspaceSetup();

  // ── Activate Intelligence ──
  //
  // The one write this page makes against the GTM layer. `activationAck` holds the
  // acknowledgement so the dossier can report what activation actually started — two
  // queued reads, or none — instead of claiming something nobody queued. `activating` is
  // what makes the transition visible: it drives the `ACTIVATING` stage, so the operator
  // watches the prospect change rather than receiving a toast that says "Activated".
  const [activating, setActivating] = useState(false);
  const [activationAck, setActivationAck] = useState<ProspectTracking | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  /** An identity search this page asked for, so activation can become available. */
  const [resolvingIdentity, setResolvingIdentity] = useState(false);
  /**
   * A queued identity lookup whose verdict has not landed yet.
   *
   * `resolve-identity` navigates nothing itself: it enqueues a job the LinkedIn worker picks
   * up, so the *verdict* arrives on a later read and there is nothing to await in the
   * request. Without this, a rep pressed the button, got "we're looking", and then sat on a
   * page that never changed — the answer had landed in the database and nothing on screen
   * went back for it. That is the whole reason this exists: the copy promises the page
   * updates itself, and this is what makes that true.
   */
  const [awaitingIdentity, setAwaitingIdentity] = useState(false);
  /**
   * The freshest identity verdict this page holds, once an Activate press has asked for one.
   *
   * Preferred over `getProspect`'s copy because it was read after it — the same rule
   * `IdentityPanel` applies to the same two sources. It also carries the one field the
   * prospect payload cannot: the lead's own LinkedIn address. `ProspectProfile.profileUrl` is
   * `li_gtm_profiles.profile_url`, and that row does not exist until activation has *happened*
   * — so before the first activation the dossier holds a verdict with no address, and the gate
   * would read a verified prospect as `cannotTrack.noAddress` forever. `IdentityResolution`
   * answers with `sales_leads.linkedin_url`, which is the address the track route itself
   * reads.
   */
  const [identity, setIdentity] = useState<IdentityResolution | null>(null);
  /**
   * The verdict as it stood when the lookup was queued, and how many times we have looked.
   *
   * Refs and not state, for two different reasons. The baseline must not re-arm the poll when
   * it is written. And the count must *survive* a re-read: every poll tick replaces
   * `selected.detail`, which the poll effect depends on, so a counter local to the effect went
   * back to zero on each tick and `IDENTITY_POLL_LIMIT` was never reached — the bound R6.8
   * asks for existed in the code and not in the behaviour.
   */
  const identityBaselineRef = useRef<string | null>(null);
  const identityTriesRef = useRef(0);
  /**
   * The lead whose activation is waiting on a verdict, or null when nothing is.
   *
   * This is what makes the sequence in §4.3 one press rather than two. The Activate control
   * routes to the identity lookup when the gate refuses (R6.2), so the operator's intent was
   * *activation* — and when the verdict lands verified, activation continues on its own
   * (R6.5) instead of asking them to press the same button again. Held per lead id, because a
   * verdict that arrives after the operator has moved on must not activate whoever is on
   * screen now.
   */
  const activationIntentRef = useRef<string | null>(null);

  /**
   * Bumped to make the four fetching intelligence panels re-read their collections.
   *
   * Bumped on activation, on a selection change and when a write lands that the held payload
   * cannot describe — not on a timer: those are the moments the ledgers behind them can have
   * gained a row that this page knows about. Polling them would be four requests a cycle for
   * panels that are usually closed.
   */
  const [intelligenceKey, setIntelligenceKey] = useState(0);

  // ── The four flows the fold-in brought with it ──
  //
  // Every one of them is a press, so none of them touches what a prospect selection costs.
  // They are held here rather than in the dossier because the dossier renders and the page
  // decides — the same split `decision` and `intelligence` already draw.

  /** The channel re-evaluation: the one write behind "How to reach them". */
  const [evaluatingChannels, setEvaluatingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  /**
   * The connection question, and the fact that only the operator can answer it.
   *
   * `awaitingSendAnswer` is armed by the send press and by nothing else. Weez never learns
   * whether an invitation was actually sent — LinkedIn shows that to the operator's own
   * account and to nobody else — so the flow ends in a question rather than an assumption.
   */
  const [awaitingSendAnswer, setAwaitingSendAnswer] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [confirmingRelationship, setConfirmingRelationship] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  /** Settling the identity candidate the resolver could not corroborate. */
  const [confirmingIdentity, setConfirmingIdentity] = useState(false);
  const [identityConfirmNotice, setIdentityConfirmNotice] = useState<string | null>(null);

  /**
   * The candidate whose reasoning band 4 argues for, when the operator asked about one.
   *
   * Null is the ordinary case and means the ranking's own winner, whose argument the
   * recommendation card already carries behind its own disclosure. This holds the answer to
   * "why that one instead", pressed on an alternative in the execution panel.
   */
  const [explained, setExplained] = useState<CandidateAction | null>(null);

  const load = useCallback(
    async (force: boolean, silent = false) => {
      const my = ++reqRef.current;
      if (!silent) {
        setError(null);
        setStage("starting");
        if (force) setRefreshing(true);
        else setLoading(true);
      }
      try {
        const data = await evaAPI.getWorkspace(
          spaceId || "demo",
          force,
          (s) => !silent && my === reqRef.current && setStage(s)
        );
        if (my !== reqRef.current) return;
        setWs(data);
        if (force && !silent) toast.success("Prospect dossiers refreshed");
      } catch (e) {
        // A silent (auto) refresh must never blank the page or nag — keep the
        // current workspace and try again later.
        if (my !== reqRef.current || silent) return;
        const message = e instanceof Error ? e.message : "Couldn't load your qualified accounts";
        setError(message);
        if (force) toast.error("Couldn't refresh prospects");
        else setWs(null);
      } finally {
        if (my === reqRef.current && !silent) {
          setStage(null);
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [spaceId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  /**
   * The one action-queue read this page makes, joined onto Eva's leads by lead id.
   *
   * The same monotonic-ticket idiom `load` uses, for the same reason: a slow read must
   * not land on top of a newer one. A failure sets `queueFailed` and nothing else —
   * `ws`, `loading` and `error` are untouched, so the rows and the dossier render
   * exactly as they did before whether or not the GTM layer answers.
   */
  const loadQueue = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId) {
      setQueue(null);
      setQueueFailed(false);
      return;
    }
    const my = ++queueReqRef.current;
    setQueueFailed(false);
    try {
      const page = await gtmAPI.getActionQueue(brandId, {
        sort: "priority",
        limit: PROSPECT_QUEUE_PAGE_SIZE,
      });
      if (my !== queueReqRef.current) return;
      setQueue({
        byLead: new Map(page.items.map((item) => [item.leadId, item])),
        // Only a page that reached the end licenses "no live recommendation" for a
        // lead that isn't on it.
        complete: !page.hasMore,
      });
    } catch {
      if (my !== queueReqRef.current) return;
      setQueue(null);
      setQueueFailed(true);
    }
  }, [spaceId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  /**
   * The queue read's own `refresh()`, for the row and dossier lines that say it failed.
   *
   * Kept separate from `refreshSelected` because it is a separate read with a separate
   * failure: one page of the queue for the whole surface, versus three routes for the
   * selection. Re-reading the queue must not re-read the prospect, and the reverse.
   */
  const refreshOverlay = useCallback(() => {
    void loadQueue();
  }, [loadQueue]);

  /** Eva's workspace and the GTM overlay, re-read together when the operator asks. */
  const refreshAll = useCallback(() => {
    void load(true);
    void loadQueue();
  }, [load, loadQueue]);

  /**
   * Every qualified lead in the workspace, rejections aside — discovery's whole output.
   *
   * Not what this page lists. It is kept because the two counts answer different questions
   * and the empty states below need both: "discovery has found nothing yet" and "discovery
   * found accounts and none of them has been enriched" look identical if you only count one.
   */
  const qualifiedLeads = useMemo(
    () => (ws ? ws.leads.filter((l) => l.status !== "rejected") : []),
    [ws]
  );

  /**
   * The prospects this page is about: the ones Enrich Now promoted into the GTM flow.
   *
   * **This is the page's subject, not a filter on it.** Prospect Intelligence is the GTM
   * surface — the dossier, the enriched contact, Activate Intelligence, the ranked next
   * move — and every one of those keys on `sales_leads.id`. A lead that has not been
   * enriched has no such row, so listing it here would offer controls that are certain to
   * 404 and a dossier with nothing in it. Discovery's full output belongs on Revenue
   * Intelligence, which is where Enrich Now is pressed.
   *
   * `isEnrichedProspect` is `evaAPI`'s, stated once there with the reason it reads
   * `gtmLeadId` rather than the enrichment status — which the workspace sweep also sets, for
   * leads that arrive carrying an email with no enrichment at all.
   */
  const activeLeads = useMemo(
    () => qualifiedLeads.filter(isEnrichedProspect),
    [qualifiedLeads]
  );

  // Cold start: Eva publishes a fast-ready (often empty) workspace while it
  // finishes discovery in the background. Silently re-fetch a few times so
  // freshly-found accounts appear without the founder having to hit Refresh.
  const autoRefreshRef = useRef(0);
  useEffect(() => {
    if (!ws || loading || refreshing) return;
    // Keyed on `qualifiedLeads`, not on this page's enriched subset. The retry exists for
    // one thing — Eva publishes a fast-ready empty workspace while discovery finishes — and
    // a workspace full of accounts nobody has enriched is not that. Polling it five times
    // would spend five reads to re-learn something the operator has to act on.
    if (qualifiedLeads.length > 0) {
      autoRefreshRef.current = 0; // discovery landed — stop auto-refreshing
      return;
    }
    if (autoRefreshRef.current >= 5) return; // cap: ~5 tries (~2.5 min)
    const t = setTimeout(() => {
      autoRefreshRef.current += 1;
      load(false, true); // silent re-read (no new scan, no loader/toast)
    }, 30000);
    return () => clearTimeout(t);
  }, [ws, loading, refreshing, qualifiedLeads.length, load]);

  // Which recommendations actually exist in this workspace — never show empty filters.
  const actionOptions = useMemo(() => {
    const present = new Set<EvaAction>();
    activeLeads.forEach((l) => present.add(l.recommendedAction));
    const options: { key: EvaAction | "all"; label: string }[] = [{ key: "all", label: "All routing" }];
    (Object.keys(ACTION_META) as EvaAction[]).forEach((key) => {
      if (present.has(key)) options.push({ key, label: ACTION_META[key].label });
    });
    return options;
  }, [activeLeads]);

  const query = search.trim().toLowerCase();

  const filteredLeads = useMemo(() => {
    let list = activeLeads
      .filter((l) => tierFilter === "all" || l.acvTier === tierFilter)
      .filter((l) => actionFilter === "all" || l.recommendedAction === actionFilter)
      .filter((l) => !query || leadHaystack(l).includes(query));
    if (qualityFilter === "high") list = list.filter((l) => l.icpFit >= HIGH_QUALITY_FIT);
    else if (qualityFilter === "low") list = list.filter((l) => l.icpFit < LOW_QUALITY_FIT);
    return [...list].sort((a, b) =>
      qualityFilter === "latest"
        ? +new Date(b.createdAt) - +new Date(a.createdAt)
        : b.icpFit - a.icpFit
    );
  }, [activeLeads, tierFilter, actionFilter, qualityFilter, query]);

  const companies = useMemo(() => groupByCompany(filteredLeads), [filteredLeads]);

  /**
   * Honour `?lead_id=` once, then get out of the way.
   *
   * Enrich Now happens on Market Intelligence and the prospect becomes workable here, so
   * that handoff names the prospect it just created. This selects it.
   *
   * **Once**, keyed on the requested id in a ref. The selection is ordinary local state
   * afterwards, so an operator who clicks a different prospect stays there instead of
   * being dragged back by a URL that has not changed. Re-running on every render would
   * make the rest of the list unclickable.
   *
   * It does nothing while the workspace is still loading, and nothing if the requested
   * prospect is not in the current view — a filter can hide it, and silently widening the
   * operator's filters to reveal one row would be a surprising thing for a link to do.
   * The ref is only stamped once the prospect is actually found, so a link that arrives
   * before the workspace does still applies when it lands.
   */
  useEffect(() => {
    if (!requestedGtmLeadId) return;
    if (appliedDeepLinkRef.current === requestedGtmLeadId) return;
    if (companies.length === 0) return;
    const group = companies.find((c) =>
      c.leads.some((l) => gtmLeadIdOf(l) === requestedGtmLeadId)
    );
    const lead = group?.leads.find((l) => gtmLeadIdOf(l) === requestedGtmLeadId);
    if (!group || !lead) return;
    appliedDeepLinkRef.current = requestedGtmLeadId;
    setCompanyKey(group.key);
    // Eva's document id: `leadId` is this page's *local* selection key and is compared
    // against `lead.id` throughout. Only the GTM-bound calls translate through
    // `gtmLeadIdOf`.
    setLeadId(lead.id);
  }, [companies, requestedGtmLeadId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === companyKey) || companies[0] || null,
    [companies, companyKey]
  );

  const prospects = useMemo(() => selectedCompany?.leads || [], [selectedCompany]);

  const selectedLead = useMemo(
    () => prospects.find((p) => p.id === leadId) || prospects[0] || null,
    [prospects, leadId]
  );

  // The GTM id, not Eva's. See `gtmLeadIdOf`.
  const selectedGtmLeadId = selectedLead ? gtmLeadIdOf(selectedLead) : "";

  /**
   * The intent records for the *selected* lead, and only for it.
   *
   * The eleven Intent rows live on `ProspectStateFull` and on no list payload, so this
   * is the one read that has to be keyed on a prospect. Keyed on the *selected* one
   * rather than fired per row: the dossier shows one prospect at a time, so the cost is
   * one request per selection instead of one per decision-maker on mount.
   *
   * Same ticket idiom, same isolation — a failure lands in `intent.failed` and the
   * dossier renders around it.
   */
  const loadSelected = useCallback(
    async (silent = false) => {
      const brandId = spaceId ?? "";
      if (!brandId || !selectedGtmLeadId) {
        setSelected(EMPTY_SELECTED_READ);
        return;
      }
      const my = ++intentReqRef.current;
      // A silent re-read keeps whatever is held on screen. Blanking it would make the
      // dossier flicker back to "nothing observed" every time a write refreshed it.
      if (!silent) setSelected({ ...EMPTY_SELECTED_READ, loading: true });
      const [detail, state, ranking] = await Promise.allSettled([
        gtmAPI.getProspect(brandId, selectedGtmLeadId),
        gtmAPI.getProspectState(brandId, selectedGtmLeadId),
        gtmAPI.getNextBestAction(brandId, selectedGtmLeadId),
      ]);
      if (my !== intentReqRef.current) return;
      setSelected({
        loading: false,
        detail: detail.status === "fulfilled" ? detail.value : null,
        detailFailed: detail.status === "rejected",
        state: state.status === "fulfilled" ? state.value : null,
        stateFailed: state.status === "rejected",
        ranking: ranking.status === "fulfilled" ? ranking.value : null,
        rankingFailed: ranking.status === "rejected",
      });
    },
    [spaceId, selectedGtmLeadId]
  );

  useEffect(() => {
    void loadSelected();
  }, [loadSelected]);

  /**
   * The `refresh()` behind every failure statement the three per-selection reads can produce.
   *
   * One callback because there is one request. `loadSelected` issues all three in a single
   * `Promise.allSettled`, so the prospect, the belief and the ranking are re-read together and
   * a retry pressed beside any of their sentences re-reads the other two with it.
   *
   * Not silent: the operator asked, so the dossier is allowed to show that it is looking.
   * Wrapped rather than passed as the handler directly — `onClick` would hand the click event
   * to the `silent` parameter and turn every retry into a re-read that shows nothing.
   */
  const refreshSelected = useCallback(() => {
    void loadSelected();
  }, [loadSelected]);

  /**
   * A different prospect is a different decision: nothing from the last one may survive.
   *
   * An activation acknowledgement or notice left behind would be a claim about one person
   * rendered beside another person's name, which is the one mistake this surface must not
   * make.
   */
  useEffect(() => {
    setActivationAck(null);
    setActivationNotice(null);
    setPaywall(null);
    setAwaitingIdentity(false);
    // The verdict, the baseline it is compared against and the activation waiting on it all
    // belong to the prospect that was on screen. A verdict that lands for them must not
    // activate whoever is on screen now, and must not be read as this prospect's.
    setIdentity(null);
    identityBaselineRef.current = null;
    identityTriesRef.current = 0;
    activationIntentRef.current = null;
    // The folded-in flows, on the same rule and for the same reason: a notice about one
    // person must never be rendered beside another person's name, and a connection question
    // asked about one prospect is not a question about the next. `explained` goes too — it
    // names a candidate from the previous prospect's ranking.
    setChannelError(null);
    setAwaitingSendAnswer(false);
    setConnectionNotice(null);
    setIdentityConfirmNotice(null);
    setExplained(null);
    // A different prospect is a different ledger. The panels are keyed on this, so
    // bumping it is what stops an open section from showing the previous person's
    // signals while its own request is in flight.
    setIntelligenceKey((key) => key + 1);
  }, [selectedGtmLeadId]);

  /**
   * ── Two handlers stood here, and both are gone ──
   *
   * `onContactDirectly` and `onTakeAction`. Each read `selectedGtmLeadId` and navigated to
   * `/relationship-intelligence/{space}?lead_id=…&intent=contact|act`, the per-prospect
   * execution surface, differing only in the `intent` they announced themselves with.
   *
   * That surface is not there any more. Every panel it rendered folded into this dossier, and
   * its path is a Retired_Route whose only job is a redirect back to this page — so both
   * presses were a navigation that left and came straight back, carrying a query parameter
   * nothing at the far end could read. R2.4 keeps a retired destination out of in-page
   * navigation, and R12.3 says why: outreach is a region on the prospect's own surface, never
   * a destination.
   *
   * The `Contextual_Outreach_Surface` is where both presses land now. It lives inside
   * `Dossier`, opened by `openOutreach()` and scrolled into view in the same commit, so the
   * page holds no state for it and no handler to forward — see the note on the `decision`
   * prop contract.
   */

  /**
   * The intent slice, in the shape the dossier already takes.
   *
   * Derived rather than held separately so there is one read and one source of truth. The
   * dossier's own signature is untouched: the intent summary was always a projection of
   * the belief, and now the belief is fetched beside two other things.
   */
  const intent: IntentReadState = useMemo(
    () => ({
      loading: selected.loading,
      failed: selected.stateFailed,
      state: selected.state,
      refresh: refreshSelected,
    }),
    [selected.loading, selected.stateFailed, selected.state, refreshSelected]
  );

  /**
   * Where this prospect stands, and therefore what the dossier renders.
   *
   * Every input is a persisted field or an in-flight write of this page's — see
   * `prospectStageOf` for which field each stage is read from. `busy` is what makes the
   * transition legible: activation is a state change, and the operator watches it happen
   * rather than being handed a toast.
   */
  // `prospectStage`, not `stage`: this page already has a `stage` holding Eva's scan
  // progress, which is a fact about a sweep and not about a prospect.
  const prospectStage = useMemo(
    () =>
      prospectStageOf({
        // The identity verdict is deliberately not an input. It gates the *activate
        // control*, beside that control, and not whether the operator gets a choice.
        profileId:
          activationAck?.profileId ?? selected.detail?.profile.profileId ?? null,
        stateVersion: selected.state?.stateVersion ?? null,
        hasRecommendation: (selected.ranking?.recommended ?? null) !== null,
        // `awaitingIdentity`, not just `resolvingIdentity`. The POST that queues the lookup
        // returns in milliseconds, so keying the stage on the request alone made "Finding
        // their profile" flash once and vanish while the job it started was still running.
        // What the rep is waiting on is the verdict, and that is what this tracks.
        busy: activating
          ? "activating"
          : resolvingIdentity || awaitingIdentity
            ? "resolving"
            : null,
      }),
    [
      selected.detail,
      selected.state,
      selected.ranking,
      activationAck,
      activating,
      resolvingIdentity,
      awaitingIdentity,
    ]
  );

  /**
   * Activate Intelligence for the selected prospect.
   *
   * **The `recommendChannel` call afterwards is deliberate and cannot move to the server.**
   * The track route provisions the rows and sets `nba_recompute_requested_at`, and that
   * mark is all it sets — it computes no score and writes no recommendation. Only
   * `recommend-channel` may score, which the backend's own
   * `test_only_the_re_evaluation_route_scores` pins. So without this second call the
   * prospect is activated but invisible to the ranked queue until a worker happens to pick
   * them up. `GTMProspect` has always done exactly this, and the sequence is asserted by
   * `GTMProspect.identity.test.tsx`.
   *
   * A 402 is not a failure and is kept out of the page's error slot: the backend charges
   * before it acts, so nothing was provisioned and nothing was billed. Saying "activation
   * failed" would leave the operator wondering what state their prospect is in.
   */
  const onActivateIntelligence = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId || !selectedGtmLeadId) return;
    setActivating(true);
    setActivationNotice(null);
    setPaywall(null);
    try {
      const ack = await gtmAPI.trackProspect(brandId, selectedGtmLeadId);
      setActivationAck(ack);
      // What happened, read off the acknowledgement: the transition, what comes next, and
      // whether both first reads were actually queued. See `activationNoticeFor`.
      setActivationNotice(activationNoticeFor(ack));
      // Only when something actually moved: a repeat activation comes back
      // `charged: false` and a needless read makes the badge flicker for nothing.
      if (ack.credit?.charged) void refreshCredits();
      // Score, so the prospect can reach the Action Queue. See the docblock.
      try {
        await gtmAPI.recommendChannel(brandId, selectedGtmLeadId);
      } catch {
        // The prospect is activated either way. A ranking that could not be computed
        // yet is what the WAITING stage already says, so this is not worth an error.
      }
      // Re-read silently: the notice above is the message that matters, and the stage
      // should move on the strength of the rows rather than on this page's optimism.
      await loadSelected(true);
      void loadQueue();
      // Activation wrote a genesis signal and opened the belief rows, so any open
      // intelligence section is now describing a prospect one row out of date.
      setIntelligenceKey((key) => key + 1);
    } catch (e) {
      if (isCreditRefusal(e)) {
        setPaywall(e instanceof Error ? e.message : null);
        void refreshCredits();
      } else {
        setActivationNotice(
          e instanceof Error ? e.message : GTM_IDENTITY_LABELS.trackFailed
        );
        toast.error(GTM_IDENTITY_LABELS.trackFailed);
      }
    } finally {
      setActivating(false);
    }
  }, [spaceId, selectedGtmLeadId, refreshCredits, loadSelected, loadQueue]);

  /**
   * The first half of an Activate press on a prospect whose identity is not settled (R6.2).
   *
   * **Not a control of its own.** `ProspectDecision` renders one button; this is where it goes
   * when `trackRefusal()` says activation would be refused, which is why no surface here is
   * labelled with LinkedIn URL entry or profile finding (R6.6). The operator asked to
   * activate — identity work is plumbing, and `activationIntentRef` is what remembers that so
   * the verdict can finish the job they actually pressed for (R6.5).
   *
   * The route queues a job and navigates nothing itself, so the *verdict* lands on a later
   * read — which is why the notice says a search is under way rather than reporting a result,
   * and why this does not optimistically move the stage. The poll below picks it up.
   *
   * The response is kept: it carries the verdict as the server has it *now*, which is both the
   * baseline the poll compares against and the lead's own LinkedIn address — the one thing
   * `getProspect` cannot supply before activation exists. See `identity`.
   */
  const onResolveIdentity = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId || !selectedGtmLeadId) return;
    setResolvingIdentity(true);
    setActivationNotice(null);
    try {
      const resolution = await gtmAPI.resolveIdentity(brandId, selectedGtmLeadId);
      setIdentity(resolution);
      // The verdict as it stood when this search was queued. Anything that differs from it is
      // this search's answer; anything equal to it is the previous one's.
      identityBaselineRef.current = identityVerdict(
        resolution.verificationStatus,
        resolution.verifiedAt,
        resolution.matchConfidence
      );
      // Already verified, with an address the track route can observe: the lookup had nothing
      // to add and the press was an activation all along, so it continues here rather than
      // asking the operator to press the same button a second time (R6.5). The freshest
      // verdict is this response's — `getProspect` cannot see the address at all.
      if (trackRefusal(resolution.verificationStatus, resolution.linkedinUrl) === null) {
        activationIntentRef.current = null;
        await onActivateIntelligence();
        return;
      }
      setActivationNotice(
        resolution.deduped
          ? GTM_IDENTITY_LABELS.resolveDeduped
          : GTM_IDENTITY_LABELS.resolveQueued
      );
      await loadSelected(true);
      // Start watching for the verdict, on behalf of the activation that asked for it.
      identityTriesRef.current = 0;
      activationIntentRef.current = selectedGtmLeadId;
      setAwaitingIdentity(true);
    } catch (e) {
      setActivationNotice(
        e instanceof Error ? e.message : GTM_IDENTITY_LABELS.resolveFailed
      );
      toast.error(GTM_IDENTITY_LABELS.resolveFailed);
    } finally {
      setResolvingIdentity(false);
    }
  }, [spaceId, selectedGtmLeadId, loadSelected, onActivateIntelligence]);

  /**
   * Re-read until the identity verdict lands, then finish what the press started.
   *
   * Bounded on both sides. It polls only while a lookup this page started is outstanding,
   * every `IDENTITY_POLL_MS`, and gives up after `IDENTITY_POLL_LIMIT` tries so a job that
   * never completes cannot leave a tab re-reading forever. Every read is silent, so nothing
   * blanks and nothing toasts.
   *
   * **It is the second half of an Activate press, not a side quest.** The verdict decides
   * three different things and this is where each is said:
   *
   *   verified          activation continues on its own (R6.5). The operator asked to
   *                     activate; the lookup was the step in the way, and now it is not.
   *   not verified      `activationStopped`, and **no track request** (R6.3, R6.4). The
   *                     sentence states both halves, because the operator pressed a control
   *                     tagged with a price and is owed "nothing was activated".
   *   no verdict yet    keep looking, up to the limit, then `resolveStillRunning` beside a
   *                     retry (R6.9) — our watching timed out, the search did not.
   *
   * Nothing arms it but a press. No effect on this page calls `resolveIdentity`, and becoming
   * enriched starts no identity work of any kind (R6.1).
   *
   * What counts as "the verdict landed" is a *change* from the baseline, never merely a
   * non-null value: see `identityVerdict` for why a re-run on a `NO_MATCH` lead would
   * otherwise report the previous search's answer as this one's.
   */
  useEffect(() => {
    if (!awaitingIdentity) return;
    const profile = selected.detail?.profile ?? null;
    // A profile row exists, so this prospect is already tracked and no verdict would unlock
    // anything. Stop watching and claim nothing.
    if (profile?.profileId) {
      setAwaitingIdentity(false);
      activationIntentRef.current = null;
      return;
    }
    const status = profile?.linkedinVerificationStatus ?? null;
    const landed =
      status !== null &&
      identityVerdict(
        status,
        profile?.linkedinVerifiedAt ?? null,
        profile?.linkedinMatchConfidence ?? null
      ) !== identityBaselineRef.current;
    if (landed) {
      setAwaitingIdentity(false);
      // Only the press that asked to activate may act on this. A verdict that lands for a
      // prospect the operator has left behind updates the screen and nothing else.
      const intended = activationIntentRef.current === selectedGtmLeadId;
      activationIntentRef.current = null;
      if (!intended) return;
      // The verdict alone, and not `trackRefusal()`, decides this. The refusal helper also
      // asks whether there is an address to observe, and the address lives on
      // `sales_leads.linkedin_url` — which `getProspect` does not carry until activation has
      // created the profile row. So the verdict is read here and the address is left to the
      // route that actually holds it: a verified prospect with nothing to observe comes back
      // as the track route's own 409, and `onActivateIntelligence` renders the server's
      // sentence rather than this page guessing at one (R17.8).
      if (status === "VERIFIED") {
        void onActivateIntelligence();
        return;
      }
      setActivationNotice(GTM_IDENTITY_LABELS.activationStopped);
      return;
    }
    const timer = setInterval(() => {
      identityTriesRef.current += 1;
      if (identityTriesRef.current > IDENTITY_POLL_LIMIT) {
        setAwaitingIdentity(false);
        activationIntentRef.current = null;
        setActivationNotice(GTM_IDENTITY_LABELS.resolveStillRunning);
        return;
      }
      void loadSelected(true);
    }, IDENTITY_POLL_MS);
    return () => clearInterval(timer);
  }, [
    awaitingIdentity,
    selected.detail,
    selectedGtmLeadId,
    loadSelected,
    onActivateIntelligence,
  ]);

  /**
   * A write landed whose effect the held payload cannot describe.
   *
   * One callback for the execution panel's three outcomes — an action requested, feedback
   * recorded, a message version persisted — because the honest response to all three is the
   * same: re-read rather than patch one field and let the rest drift. Silent, so the panel's
   * own toast stays the message that matters, and the refresh key goes with it because each
   * of the three put a row on a ledger an open disclosure is showing.
   */
  const onRecordChanged = useCallback(() => {
    setIntelligenceKey((key) => key + 1);
    void loadSelected(true);
  }, [loadSelected]);

  /** Which candidate band 4 argues for. Selects; asks for nothing and edits nothing. */
  const onExplainCandidate = useCallback((action: CandidateAction) => {
    setExplained(action);
  }, []);

  /**
   * Recompute the channel recommendation — the one request behind "How to reach them".
   *
   * Fired by the re-evaluate press alone. `ChannelRecommendationPanel` renders the persisted
   * evaluation from the payload the selection already read, so opening the section costs
   * nothing and this is the only thing on the surface that calls the scoring route.
   *
   * The result is patched into the held payload rather than re-read: the response *is* the
   * new evaluation — the three scored channels and the server's own argmax — so a re-read
   * would spend three requests to learn what this one already returned. The refresh key goes
   * up because the evaluation put a row on the ledger behind the timeline.
   */
  const onReevaluateChannels = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId || !selectedGtmLeadId) return;
    setEvaluatingChannels(true);
    setChannelError(null);
    try {
      const evaluation = await gtmAPI.recommendChannel(brandId, selectedGtmLeadId);
      setSelected((held) =>
        held.detail
          ? {
              ...held,
              detail: {
                ...held.detail,
                channels: evaluation.channels,
                recommendedChannel: evaluation.recommendedChannel,
              },
            }
          : held
      );
      setIntelligenceKey((key) => key + 1);
      toast.success(GTM_PAGE_LABELS.reevaluatedToast);
    } catch (e) {
      setChannelError(
        e instanceof Error ? e.message : GTM_PAGE_LABELS.reevaluateFailed
      );
    } finally {
      setEvaluatingChannels(false);
    }
  }, [spaceId, selectedGtmLeadId]);

  /**
   * Send Connection Request: record the intent, open their profile, then ask.
   *
   * Three steps and the order matters. `requestAction` writes the intent under a UI-click
   * attribution and hands back the profile url — it moves no relationship state, and the
   * backend guarantees that rather than trusting this page. `markOpened` records that LinkedIn
   * was opened, which is also only ever a fact about us. Then, and only then, the prompt
   * appears.
   *
   * **The prompt is the point.** We never learn whether an invitation was actually sent, so
   * the flow ends in a question. If the window fails to open we still ask, because the
   * operator may well have gone to LinkedIn by hand. A failed `markOpened` aborts nothing: it
   * is a timeline nicety, and losing it must not cost the operator the prompt that carries the
   * real evidence.
   */
  const onSendConnectionRequest = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId || !selectedGtmLeadId) return;
    setSendingRequest(true);
    setConnectionNotice(null);
    setPaywall(null);
    try {
      const action = await gtmAPI.requestAction(brandId, selectedGtmLeadId, {
        actionType: "CONNECT",
        idempotencyKey: actionIdempotencyKey(selectedGtmLeadId, "CONNECT", null, null),
      });
      // The charge rides on this response. Re-read the balance only when it actually moved:
      // the charge shares this request's own idempotency key, so a repeat comes back
      // `charged: false` and changed nothing.
      if (action?.credit?.charged) void refreshCredits();
      // The server's destination first; the observed profile url is the fallback for a
      // response that carried none. Never a url composed here.
      const destination =
        action?.destinationUrl ?? selected.detail?.profile.profileUrl ?? null;
      if (destination) {
        window.open(destination, "_blank", "noopener,noreferrer");
      }
      if (action?.actionId) {
        try {
          await gtmAPI.markOpened(brandId, action.actionId);
        } catch {
          /* ignored on purpose — see the docblock */
        }
      }
      setIntelligenceKey((key) => key + 1);
      // Ask. Never assume.
      setAwaitingSendAnswer(true);
    } catch (e) {
      if (isCreditRefusal(e)) {
        // No action was filed and nothing was charged. The operator has not half-sent an
        // invitation, and the prompt must not appear as though they had.
        setPaywall(e instanceof Error ? e.message : null);
        void refreshCredits();
      } else {
        setConnectionNotice(
          e instanceof Error ? e.message : GTM_CONNECTION_LABELS.sendFailed
        );
        toast.error(GTM_CONNECTION_LABELS.sendFailed);
      }
    } finally {
      setSendingRequest(false);
    }
  }, [spaceId, selectedGtmLeadId, selected.detail, refreshCredits]);

  /**
   * Record what the operator told us about the connection.
   *
   * **A refusal is not thrown and is not hidden.** The route answers 200 with the reconciler's
   * verdict, and `applied === false` means the assertion was declined — an illegal transition,
   * or `UNKNOWN`, which no transition targets. The notice then carries the engine's own reason
   * rather than a sentence invented here.
   *
   * The re-read is what keeps that promise. `confirmRelationship` returns the persisted value,
   * but everything derived from it — the warm-up action a confirmed connection unblocks, the
   * belief, the ledger — is not on that response, so the honest move is to re-read rather than
   * to patch one field and let the others drift. Silent: the notice is the message.
   */
  const onConfirmRelationship = useCallback(
    async (confirmed: RelationshipState) => {
      const brandId = spaceId ?? "";
      if (!brandId || !selectedGtmLeadId) return;
      setConfirmingRelationship(true);
      setConnectionNotice(null);
      try {
        const result = await gtmAPI.confirmRelationship(
          brandId,
          selectedGtmLeadId,
          confirmed
        );
        setAwaitingSendAnswer(false);
        if (!result.applied) {
          setConnectionNotice(
            result.reason
              ? `${GTM_CONNECTION_LABELS.confirmDeclined}: ${result.reason}`
              : GTM_CONNECTION_LABELS.confirmDeclined
          );
        } else if (result.relationshipState === "CONNECTED") {
          setConnectionNotice(GTM_CONNECTION_LABELS.recordedAccepted);
        } else if (result.relationshipState === "REJECTED") {
          setConnectionNotice(GTM_CONNECTION_LABELS.recordedDeclined);
        } else {
          setConnectionNotice(GTM_CONNECTION_LABELS.recordedPending);
        }
        setIntelligenceKey((key) => key + 1);
        await loadSelected(true);
      } catch (e) {
        setConnectionNotice(
          e instanceof Error ? e.message : GTM_CONNECTION_LABELS.confirmFailed
        );
        toast.error(GTM_CONNECTION_LABELS.confirmFailed);
      } finally {
        setConfirmingRelationship(false);
      }
    },
    [spaceId, selectedGtmLeadId, loadSelected]
  );

  /**
   * "No, not yet" — close the prompt and write nothing.
   *
   * There is no call to make. The operator did not send an invitation, so there is no fact to
   * record, and the intent the press already logged is the honest extent of what happened.
   */
  const onDismissSendPrompt = useCallback(() => {
    setAwaitingSendAnswer(false);
    setConnectionNotice(null);
  }, []);

  /**
   * "Still awaiting" — acknowledge, and write nothing.
   *
   * Nothing was observed. The state is already pending, and re-asserting it would refresh the
   * very clock the age on screen is measured from — making the invitation look newer than it
   * is and resetting the wait the operator is reporting on.
   */
  const onStillAwaiting = useCallback(() => {
    setConnectionNotice(GTM_CONNECTION_LABELS.awaitingAcknowledged);
  }, []);

  /**
   * Settle the candidate the resolver could not corroborate.
   *
   * The url is never sent: the server writes the address from its own attempt row, so this
   * call carries one boolean and cannot verify something nobody searched for. A rejection is a
   * real answer and records `NO_MATCH`.
   *
   * The re-read is not optional. A confirmation changes the verification verdict, which is the
   * gate the activate control renders on — patching one field would leave the rest of the
   * dossier describing a prospect that no longer exists.
   */
  const onConfirmIdentity = useCallback(
    async (confirmed: boolean) => {
      const brandId = spaceId ?? "";
      if (!brandId || !selectedGtmLeadId) return;
      setConfirmingIdentity(true);
      setIdentityConfirmNotice(null);
      try {
        const result = await gtmAPI.confirmIdentity(brandId, selectedGtmLeadId, confirmed);
        setIdentityConfirmNotice(
          result.confirmed
            ? GTM_IDENTITY_CONFIRM_LABELS.confirmed
            : GTM_IDENTITY_CONFIRM_LABELS.rejected
        );
        setIntelligenceKey((key) => key + 1);
        await loadSelected(true);
      } catch (e) {
        setIdentityConfirmNotice(
          e instanceof Error ? e.message : GTM_IDENTITY_CONFIRM_LABELS.confirmFailed
        );
        toast.error(GTM_IDENTITY_CONFIRM_LABELS.confirmFailed);
      } finally {
        setConfirmingIdentity(false);
      }
    },
    [spaceId, selectedGtmLeadId, loadSelected]
  );

  const onLeadAction = (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => {
    setWs((prev) =>
      prev
        ? {
            ...prev,
            leads: prev.leads.map((l) =>
              l.id === lead.id
                ? {
                    ...l,
                    status: action === "reject" ? "rejected" : action === "reset" ? "qualified" : "handed",
                    handoffState:
                      action === "hand_to_max" ? "handed_to_max" : action === "reject" ? "held" : "enriched",
                  }
                : l
            ),
          }
        : prev
    );

    if (action === "hand_to_max") {
      toast.success(`${lead.contact?.name || lead.company} handed to Max for outreach`);
    } else if (action === "reject") {
      toast(`${lead.company} marked not a fit`, {
        action: { label: "Undo", onClick: () => onLeadAction(lead, "reset") },
      });
    }
    void evaAPI.leadAction(spaceId, lead.id, action);
  };

  // On-demand enrichment ("Enrich Now"): resolve the email only when the founder asks,
  // because it spends both a provider credit and one of the workspace's own.
  //
  // **Two different limits, and they are reported differently on purpose.** `usage` is the
  // per-brand monthly cap on enrichment *attempts* and the remedy is to wait for the month
  // to roll over; the credit balance is a purchased thing and the remedy is to top up.
  // Telling an operator to wait when they should top up — or the reverse — is the failure
  // this separation exists to prevent.
  const onShowEmail = async (lead: QualifiedLead) => {
    try {
      const res = await evaAPI.enrichLead(spaceId, lead.id);
      if (res.status === "limit_reached") {
        toast.error(
          `Monthly enrichment limit reached (${res.usage?.limit ?? 100}). It resets next month.`
        );
        return;
      }
      if (res.status === "unresolved_company") {
        // Refused before any provider was touched, so no credit was spent. The backend
        // charges first and reverses the charge on this path, so the balance is unchanged
        // rather than merely never debited — but either way there is nothing to re-read.
        toast.info(res.reason || `${lead.company} isn't a confirmed company — no credit spent.`);
        return;
      }
      // A charge landed, so the badge is stale. Only when something was actually charged:
      // a repeat click on the same lead comes back `charged: false`, and an email that was
      // already on file comes back with no `credit` at all.
      if (res.credit?.charged) void refreshCredits();
      if (res.lead) {
        const updated = res.lead;
        setWs((prev) =>
          prev
            ? {
                ...prev,
                leads: prev.leads.map((l) => (l.id === lead.id ? updated : l)),
                enrichmentUsage: res.usage || prev.enrichmentUsage,
              }
            : prev
        );
      }
      const remaining = res.usage ? ` · ${res.usage.remaining} left this month` : "";
      if (res.found && res.email) {
        toast.success(`Email found — ${res.email}. Handed to Max${remaining}.`);
      } else {
        toast(`No email found for ${lead.company}. That counts as one enrichment${remaining}.`);
      }
    } catch (e: any) {
      if (isInsufficientCredits(e)) {
        // No provider was called and nothing was charged. Said as its own thing rather than
        // as an error, because the operator's next step is to top up and not to retry.
        setPaywall(e instanceof Error ? e.message : null);
        void refreshCredits();
        return;
      }
      toast.error(e?.message || "Couldn't enrich this lead right now");
    }
  };

  const tierOptions: { key: TierFilter; label: string }[] = useMemo(() => {
    const counts = ws?.metrics?.byTier;
    return [
      { key: "all", label: `All ${activeLeads.length}` },
      { key: "low", label: `${TIER_META.low.label}${counts ? ` ${counts.low}` : ""}` },
      { key: "medium", label: `${TIER_META.medium.label}${counts ? ` ${counts.medium}` : ""}` },
      { key: "high", label: `${TIER_META.high.label}${counts ? ` ${counts.high}` : ""}` },
    ];
  }, [ws, activeLeads.length]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar spaceId={spaceId!} onNewChat={() => navigate("/spaces")} onSelectConversation={() => {}} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm ring-2 ring-violet-100">
              <Brain className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Prospect Intelligence
              </span>
              <span className="text-sm font-semibold text-zinc-900">Enriched decision-makers &amp; dossiers</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden gap-1 border-violet-200 bg-violet-50 text-[9px] font-bold uppercase tracking-wider text-violet-700 sm:flex"
            >
              <SignalIcon className="h-3 w-3" /> Eva → Max
            </Badge>
            {/* The balance, in chrome. Enrich Now is on every dossier on this page, so the
                operator can see what they have before they spend it. */}
            <CreditBalanceBadge balance={creditBalance} className="hidden sm:inline-flex" />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={refreshAll}
              disabled={loading || refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <ResearchProgress stage={stage} />
            ) : error && !ws ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">We couldn't load your qualified accounts</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button
                  onClick={refreshAll}
                  className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
                >
                  {/* The same words every other retry on this page uses. Eva's workspace read
                      is the one whose failure takes the page down, and it is still one of the
                      reads R18.5 counts. */}
                  <RefreshCw className="h-4 w-4" /> {GTM_PAGE_LABELS.retry}
                </Button>
              </div>
            ) : ws ? (
              <>
                {/* The paywall (402). Its own surface, not the error state above: nothing
                    broke, no provider was called and nothing was charged. */}
                {paywall !== null && (
                  <InsufficientCreditsAlert detail={paywall} balance={creditBalance} />
                )}
                {refreshing && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-[12px] font-medium text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Refreshing prospects — {SCAN_STEPS[scanStepIndex(stage)]?.label ?? "working"}…</span>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 rounded-full border-amber-200 bg-white text-[11px]"
                      onClick={refreshAll}
                    >
                      <RotateCcw className="h-3 w-3" /> {GTM_PAGE_LABELS.retry}
                    </Button>
                  </div>
                )}
                {ws.isDemo && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      Showing <span className="font-semibold">sample prospects</span> — this space isn't linked to a
                      real brand, so no live accounts are available here.
                    </span>
                  </div>
                )}

                <SummaryHeader
                  ws={ws}
                  companies={companies}
                  prospects={activeLeads}
                  qualifiedTotal={qualifiedLeads.length}
                />

                {/* filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full max-w-sm">
                    <label htmlFor="prospect-search" className="sr-only">
                      Search companies, people, roles and events
                    </label>
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                      id="prospect-search"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search company, person, role, event…"
                      className="h-9 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-3 text-[12.5px] text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-300"
                    />
                  </div>
                  <PillGroup label="ACV tier" value={tierFilter} options={tierOptions} onChange={setTierFilter} />
                  <PillGroup
                    label="Lead quality"
                    value={qualityFilter}
                    options={QUALITY_FILTERS}
                    onChange={setQualityFilter}
                  />
                  {actionOptions.length > 1 && (
                    <PillGroup
                      label="Recommended routing"
                      value={actionFilter}
                      options={actionOptions}
                      onChange={setActionFilter}
                    />
                  )}
                  <span className="ml-auto text-[11px] font-medium text-zinc-400">
                    {companies.length} compan{companies.length === 1 ? "y" : "ies"} · {filteredLeads.length} lead
                    {filteredLeads.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Three different empty states, because they call for three different
                    things. Collapsing them into "Eva is discovering your accounts" would
                    tell an operator with forty qualified accounts to wait for discovery —
                    when what they actually need to do is go and enrich one — and would tell
                    an operator whose workspace has never been started to wait for discovery
                    that nobody has started. */}
                {workspaceNeedsSetup ? (
                  <WorkspaceSetupChecklist
                    variant="panel"
                    headingLevel="h2"
                    completed={{
                      website: websiteConnected,
                      goal: goalSet,
                      launch: launched,
                    }}
                    activeStep={setupNextStep}
                    onAdvance={() => navigate(`/ninna/${spaceId ?? ""}?start=goal`)}
                  />
                ) : qualifiedLeads.length === 0 ? (
                  <EmptyPanel
                    icon={Target}
                    title="Eva is discovering your accounts"
                    subtitle="Eva is scanning channels for companies that match your ICP and hitting your trigger events. Good-fit accounts appear on Market Intelligence as she finds them — this can take a few minutes on a fresh campaign."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
                      onClick={refreshAll}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh now
                    </Button>
                  </EmptyPanel>
                ) : activeLeads.length === 0 ? (
                  <EmptyPanel
                    icon={Mail}
                    title="No prospects enriched yet"
                    subtitle={`Eva has qualified ${qualifiedLeads.length} account${
                      qualifiedLeads.length === 1 ? "" : "s"
                    }. This page is the enriched ones — decision-maker resolved, email and LinkedIn on file, and the GTM lifecycle available. Click Enrich Now on Market Intelligence and the prospect appears here.`}
                  >
                    <Button
                      size="sm"
                      className="mt-1 h-8 gap-1.5 rounded-full text-xs"
                      onClick={() => navigate(`/eva/${spaceId ?? ""}`)}
                    >
                      <SignalIcon className="h-3.5 w-3.5" /> Go to Market Intelligence
                    </Button>
                  </EmptyPanel>
                ) : companies.length === 0 ? (
                  <EmptyPanel
                    title="Nothing matches these filters"
                    subtitle="Clear the search or widen the tier, quality and routing filters."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 rounded-full border-zinc-200 text-xs"
                      onClick={() => {
                        setSearch("");
                        setTierFilter("all");
                        setActionFilter("all");
                        setQualityFilter("all");
                      }}
                    >
                      Reset filters
                    </Button>
                  </EmptyPanel>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[280px_320px_minmax(0,1fr)]">
                    {/* companies */}
                    <section aria-label="Qualified companies" className="min-w-0">
                      <PanelTitle
                        icon={Building2}
                        right={<span className="text-[10px] font-medium text-zinc-400">{companies.length}</span>}
                      >
                        Qualified by Eva
                      </PanelTitle>
                      <div className="max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto pr-1">
                        {companies.map((c) => (
                          <CompanyCard
                            key={c.key}
                            group={c}
                            active={c.key === selectedCompany?.key}
                            onSelect={() => {
                              setCompanyKey(c.key);
                              setLeadId(c.leads[0]?.id || "");
                            }}
                          />
                        ))}
                      </div>
                    </section>

                    {/* prospects */}
                    <section aria-label="Decision makers" className="min-w-0">
                      <PanelTitle
                        icon={Users}
                        right={<span className="text-[10px] font-medium text-zinc-400">{prospects.length}</span>}
                      >
                        {selectedCompany?.company || "Decision-makers"}
                      </PanelTitle>
                      <div className="max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto pr-1">
                        {prospects.length === 0 ? (
                          <EmptyPanel
                            icon={Users}
                            title="No decision-makers on this account"
                            subtitle="Eva enriches contacts after qualification — check back after the next scan."
                          />
                        ) : (
                          prospects.map((p) => (
                            <ProspectCard
                              key={p.id}
                              lead={p}
                              active={p.id === selectedLead?.id}
                              overlay={overlayFor(gtmLeadIdOf(p), queue, queueFailed)}
                              onSelect={() => setLeadId(p.id)}
                            />
                          ))
                        )}
                      </div>
                    </section>

                    {/* dossier */}
                    <section aria-label="Prospect dossier" className="min-w-0">
                      {selectedLead && selectedCompany ? (
                        <Dossier
                          key={selectedLead.id}
                          lead={selectedLead}
                          group={selectedCompany}
                          icp={ws.icp}
                          overlay={overlayFor(gtmLeadIdOf(selectedLead), queue, queueFailed)}
                          refreshOverlay={refreshOverlay}
                          intent={intent}
                          onAction={onLeadAction}
                          onShowEmail={onShowEmail}
                          enrichPrice={enrichPrice}
                          decision={{
                            stage: prospectStage,
                            // ── THE ONE ISOLATED CONDITION ──
                            //
                            // It said `isIntelligenceActive(prospectStage) ? null :
                            // CONTACT_DIRECTLY_LABELS.needsActivation` until the profile
                            // guard was relaxed. `_require_profile` now takes
                            // `allow_missing`, and both `POST /message/generate` and
                            // `POST /action/request` answer for a lead with no
                            // `li_gtm_profiles` row — so activation is no longer a gate on
                            // this path (R5.5) and the label it pointed at is deleted.
                            //
                            // What remains is having somewhere to open, which `contactGateOf`
                            // reads from backend facts alone — no `prospectStage` anywhere in
                            // it, so an enriched, unactivated prospect gets a live control
                            // (R5.4). The sentence it returns is rendered in the control's
                            // place rather than beside a disabled button (R5.8).
                            contactUnavailableReason: contactGateOf(
                              selectedLead,
                              selected.detail
                            ),
                            contactPrice,
                            onActivate: () => void onActivateIntelligence(),
                            activating,
                            // The identity gate, from the same rule the route applies, so a
                            // control that would be refused is never on screen and the
                            // reason appears in its place.
                            //
                            // **Two sources, and the payload wins.** `getProspect` is re-read
                            // on every poll tick and after every write, so its verdict is the
                            // fresher of the two whenever it has one. What it cannot supply is
                            // the address: `profile.profileUrl` is `li_gtm_profiles`', and
                            // that row is created *by* activation — so before the first
                            // activation the payload holds a verdict with nowhere to point,
                            // and a verified prospect would read as
                            // `cannotTrack.noAddress` for ever. The resolve response carries
                            // `sales_leads.linkedin_url`, which is the address the track route
                            // itself reads, so it is the fallback for both fields.
                            activateUnavailableReason: trackRefusal(
                              selected.detail?.profile.linkedinVerificationStatus ??
                                identity?.verificationStatus ??
                                null,
                              selected.detail?.profile.profileUrl ??
                                identity?.linkedinUrl ??
                                null
                            ),
                            activatePrice,
                            notice: activationNotice,
                            // The one notice another read could answer. Compared against the
                            // label this page set rather than tracked in a second piece of
                            // state that could disagree with it.
                            noticeRetryable:
                              activationNotice ===
                              GTM_IDENTITY_LABELS.resolveStillRunning,
                            refreshRead: refreshSelected,
                            // Only the prospect read gates the stage. A ranking or belief
                            // that could not be read is a *narrower* absence the stage
                            // machine already handles honestly — it lands on WAITING, which
                            // claims less rather than more.
                            readFailed: selected.detailFailed,
                            recommended: selected.ranking?.recommended ?? null,
                            rankingFailed: selected.rankingFailed,
                            onResolveIdentity: () => void onResolveIdentity(),
                            // Spins for as long as the lookup is genuinely outstanding, not
                            // just for the request that queued it.
                            resolvingIdentity: resolvingIdentity || awaitingIdentity,
                          }}
                          intelligence={{
                            brandId: spaceId ?? "",
                            gtmLeadId: gtmLeadIdOf(selectedLead),
                            // The three reads the selection already made, handed over whole.
                            // Nine folded-in panels read different parts of them and not one
                            // of them adds a request: `detail` is `getProspect`, `stateFull`
                            // is `getProspectState`, `ranking` is `getNextBestAction`.
                            detail: selected.detail,
                            stateFull: selected.state,
                            ranking: selected.ranking,
                            refreshKey: intelligenceKey,
                          }}
                          flows={{
                            onReevaluateChannels: () => void onReevaluateChannels(),
                            evaluatingChannels,
                            channelError,
                            connection: {
                              awaitingSendAnswer,
                              onSendRequest: () => void onSendConnectionRequest(),
                              sending: sendingRequest,
                              onConfirm: (state) => void onConfirmRelationship(state),
                              confirming: confirmingRelationship,
                              onDismissPrompt: onDismissSendPrompt,
                              onStillAwaiting,
                              notice: connectionNotice,
                            },
                            identityConfirm: {
                              onConfirm: (confirmed) => void onConfirmIdentity(confirmed),
                              submitting: confirmingIdentity,
                              notice: identityConfirmNotice,
                            },
                            explained,
                            onExplainCandidate,
                            onRecordChanged,
                          }}
                        />
                      ) : (
                        <EmptyPanel
                          icon={Brain}
                          title="Select a decision-maker"
                          subtitle="Pick a person to see why they qualified, the signals behind it and the angle to open with."
                        />
                      )}
                    </section>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
