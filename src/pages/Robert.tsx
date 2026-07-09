import { useState, useEffect, useRef, useMemo, useCallback, type KeyboardEvent, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  User as UserIcon,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Users as UsersIcon,
  HeartHandshake,
  Calendar,
  Image as ImageIcon,
  ImageOff,
  Check,
  CheckCheck,
  RefreshCw,
  Pencil,
  Trash2,
  Send,
  Bot,
  Loader2,
  Info,
  Lightbulb,
  ChevronRight,
  MessageSquare,
  X,
  Layers,
  Quote,
  Maximize2,
  Copy,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ConversationSidebar from "@/components/ConversationSidebar";
import {
  robertAPI,
  computeMetrics,
  TIER_CONFIG,
  type ACVTier,
  type Author,
  type Funnel,
  type RiskTag,
  type ContentCard,
  type WeeklyPlan,
  type PlanMetrics,
  type RobertChatMessage,
  type GenStage,
} from "@/services/robertAPI";

// ─── Visual token maps ──────────────────────────────────────────────────────────

const AUTHOR_META: Record<Author, { label: string; icon: typeof UserIcon; chip: string; dot: string }> = {
  founder: {
    label: "Founder",
    icon: UserIcon,
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  org: {
    label: "Org page",
    icon: Building2,
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
};

const FUNNEL_META: Record<Funnel, { label: string; icon: typeof TrendingUp; chip: string }> = {
  growth: { label: "Growth", icon: TrendingUp, chip: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  leads: { label: "Leads", icon: UsersIcon, chip: "bg-violet-50 text-violet-700 border-violet-200" },
  trust: { label: "Trust", icon: HeartHandshake, chip: "bg-teal-50 text-teal-700 border-teal-200" },
};

const RISK_META: Record<RiskTag, { label: string; icon: typeof ShieldCheck; chip: string; ring: string }> = {
  safe: {
    label: "Safe",
    icon: ShieldCheck,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-100",
  },
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    ring: "ring-amber-100",
  },
};

const STATUS_LABEL: Record<ContentCard["approvalState"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-zinc-500" },
  approved: { label: "Approved", className: "text-emerald-600" },
  needs_explicit_approval: { label: "Needs your approval", className: "text-amber-600" },
  scheduled: { label: "Scheduled", className: "text-blue-600" },
  skipped: { label: "Skipped", className: "text-zinc-400" },
};

// ─── Robert avatar (portrait with graceful gradient fallback) ─────────────────────
// Portrait lives at frontend/public/assets/robert.png. If it's ever missing the
// UI falls back to a gradient "Bot" mark so nothing breaks.
const ROBERT_AVATAR = "/assets/robert.png";

function RobertAvatar({ className = "h-9 w-9" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
      {ok ? (
        <img
          src={ROBERT_AVATAR}
          alt="Robert, Content Head"
          onError={() => setOk(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <Bot className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}

// ─── Generation progress (real-time stages from the backend job) ──────────────────

const GEN_STEPS: { keys: GenStage[]; label: string; hint: string; Icon: typeof Layers }[] = [
  {
    keys: ["starting", "context"],
    label: "Reading your brand & founder voice",
    hint: "Pulling brand facts, founder writing style, product and customer context.",
    Icon: Layers,
  },
  {
    keys: ["writing"],
    label: "Writing this week's posts with GPT-5.2",
    hint: "Drafting founder and org posts in your voice — grounded, no fabricated claims.",
    Icon: Pencil,
  },
  {
    keys: ["reviewing"],
    label: "Reviewing each post — safe vs critical",
    hint: "Tagging risk, checking evidence, and assembling your approval board.",
    Icon: ShieldCheck,
  },
];

function genStepIndex(stage: GenStage | null): number {
  if (!stage) return 0;
  const i = GEN_STEPS.findIndex((s) => s.keys.includes(stage));
  return i === -1 ? 0 : i;
}

function GenerationProgress({ stage }: { stage: GenStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const current = genStepIndex(stage);
  const activeHint = GEN_STEPS[current]?.hint;

  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-indigo-400/20" />
        <RobertAvatar className="relative h-16 w-16 ring-2 ring-indigo-100" />
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-700">Robert is building your week</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Real posts from your brand &amp; founder voice · {elapsed}s elapsed
        </p>
      </div>

      <div className="w-full max-w-md space-y-3 text-left">
        {GEN_STEPS.map((step, i) => {
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
                state === "active" ? "border-indigo-200 bg-indigo-50/50" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  state === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : state === "active"
                    ? "bg-indigo-600 text-white"
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
                {state === "active" && (
                  <>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{activeHint}</p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-indigo-100">
                      <motion.div
                        className="h-full w-1/3 rounded-full bg-indigo-500"
                        animate={{ x: ["-120%", "320%"] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────────────

function Chip({
  className,
  icon: Icon,
  children,
}: {
  className?: string;
  icon?: typeof TrendingUp;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

function ContextWeightBar({ card }: { card: ContentCard }) {
  const parts: { key: string; value: number; color: string }[] = [
    { key: "Founder", value: card.contextWeighting.founder, color: "bg-indigo-400" },
    { key: "Product", value: card.contextWeighting.product, color: "bg-sky-400" },
    { key: "Customer", value: card.contextWeighting.customer, color: "bg-violet-400" },
    { key: "Industry", value: card.contextWeighting.industry, color: "bg-teal-400" },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        {parts.map((p) => (
          <div key={p.key} className={p.color} style={{ width: `${p.value}%` }} title={`${p.key} ${p.value}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {parts.map((p) => (
          <span key={p.key} className="text-[9px] font-medium text-zinc-400">
            <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle", p.color)} />
            {p.key} {p.value}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Content card ─────────────────────────────────────────────────────────────────

function ContentCardView({
  card,
  onUpdate,
  onRegenerate,
  onSkip,
  onGenerateImage,
}: {
  card: ContentCard;
  onUpdate: (patch: Partial<ContentCard>) => void;
  onRegenerate: () => Promise<void>;
  onSkip: () => void;
  onGenerateImage: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.draft);
  const [regenerating, setRegenerating] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [imgGenerating, setImgGenerating] = useState(false);

  const handleGenerateImage = async () => {
    setImgGenerating(true);
    try {
      await onGenerateImage();
      toast.success("Image ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate the image");
    } finally {
      setImgGenerating(false);
    }
  };

  useEffect(() => setDraft(card.draft), [card.draft]);

  const authorMeta = AUTHOR_META[card.author];
  const funnelMeta = FUNNEL_META[card.funnel];
  const riskMeta = RISK_META[card.risk];
  const status = STATUS_LABEL[card.approvalState];
  const AuthorIcon = authorMeta.icon;

  const isApproved = card.approvalState === "approved" || card.approvalState === "scheduled";
  const isSkipped = card.approvalState === "skipped";

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
      toast.success("Robert refreshed this draft");
    } finally {
      setRegenerating(false);
    }
  };

  const saveEdit = () => {
    onUpdate({ draft });
    setEditing(false);
    toast.success("Draft updated");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isSkipped ? 0.5 : 1, y: 0 }}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all",
        card.risk === "critical" ? "border-amber-200/80" : "border-zinc-200/80",
        isApproved && "border-emerald-200 ring-1 ring-emerald-100"
      )}
    >
      {/* Accent rail by author */}
      <span className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-full", authorMeta.dot)} />

      <div className="flex flex-col gap-3 p-5 pl-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Chip className={authorMeta.chip} icon={AuthorIcon}>
                {authorMeta.label}
              </Chip>
              <Chip className="border-zinc-200 bg-zinc-50 text-zinc-500">{card.postType}</Chip>
              <Chip className={funnelMeta.chip} icon={funnelMeta.icon}>
                {funnelMeta.label}
              </Chip>
            </div>
            <h3 className="text-[15px] font-semibold leading-snug text-zinc-900">{card.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <Calendar className="h-3 w-3" />
              {card.scheduledSlot}
              <span className="text-zinc-300">·</span>
              {card.targetPersona}
            </p>
          </div>
          <Chip className={riskMeta.chip} icon={riskMeta.icon}>
            {riskMeta.label}
          </Chip>
        </div>

        {/* Objective */}
        <p className="text-[13px] leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-700">Objective:</span> {card.objective}
        </p>

        {/* Draft */}
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3.5">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={7}
                className="resize-none border-zinc-200 bg-white text-[13px] leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(card.draft); setEditing(false); }}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 bg-zinc-900 text-xs hover:bg-zinc-800" onClick={saveEdit}>
                  Save draft
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-300">Draft post</span>
                <button
                  onClick={() => setFullOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 transition-colors hover:text-indigo-600"
                  title="Open the full post in a reading view"
                >
                  <Maximize2 className="h-3 w-3" /> View full post
                </button>
              </div>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">{card.draft}</p>
            </>
          )}

          {card.cta && !editing && (
            <p className="mt-2.5 border-t border-zinc-200/70 pt-2.5 text-[12px] font-medium text-zinc-500">
              <span className="font-semibold text-zinc-600">CTA:</span> {card.cta}
            </p>
          )}
        </div>

        {/* Full-post reading modal */}
        <Dialog open={fullOpen} onOpenChange={setFullOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="pr-6 text-base leading-snug">{card.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip className={authorMeta.chip} icon={AuthorIcon}>{authorMeta.label}</Chip>
                <Chip className="border-zinc-200 bg-zinc-50 text-zinc-500">{card.postType}</Chip>
                <Chip className={funnelMeta.chip} icon={funnelMeta.icon}>{funnelMeta.label}</Chip>
                <Chip className={riskMeta.chip} icon={riskMeta.icon}>{riskMeta.label}</Chip>
                <span className="text-[11px] font-medium text-zinc-400">{card.scheduledSlot}</span>
              </div>
              {card.image.url && (
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <img
                    src={card.image.url}
                    alt={`${card.image.type || "visual"} for ${card.title}`}
                    className="w-full object-cover"
                  />
                </div>
              )}
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-zinc-800">{card.draft}</p>
                {card.cta && (
                  <p className="mt-3 border-t border-zinc-200 pt-3 text-[13px] font-medium text-zinc-600">
                    <span className="font-semibold text-zinc-700">CTA:</span> {card.cta}
                  </p>
                )}
              </div>
              {card.proofBlocks && card.proofBlocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {card.proofBlocks.map((p, i) => (
                    <span key={i} className="rounded-lg bg-teal-50 px-2 py-1 text-[12px] font-medium text-teal-700">{p}</span>
                  ))}
                </div>
              )}
              {card.hookAlternatives.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Alternative hooks</p>
                  <ul className="space-y-1">
                    {card.hookAlternatives.map((h, i) => (
                      <li key={i} className="rounded-lg bg-zinc-50 px-3 py-1.5 text-[13px] italic text-zinc-500">“{h}”</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(card.cta ? `${card.draft}\n\n${card.cta}` : card.draft);
                    toast.success("Post copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy post
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Proof blocks */}
        {card.proofBlocks && card.proofBlocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.proofBlocks.map((p, i) => (
              <span key={i} className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700">
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Risk explanation */}
        <div
          className={cn(
            "rounded-xl border p-3 text-[12px] leading-relaxed",
            card.risk === "critical" ? "border-amber-200/70 bg-amber-50/50" : "border-emerald-200/60 bg-emerald-50/40"
          )}
        >
          <p className={cn("mb-0.5 flex items-center gap-1.5 font-semibold", card.risk === "critical" ? "text-amber-700" : "text-emerald-700")}>
            <riskMeta.icon className="h-3.5 w-3.5" />
            {card.risk === "critical" ? "Why this is critical" : "Why this is safe"}
          </p>
          <p className="text-zinc-600">{card.riskReason}</p>
          {card.softenTip && (
            <p className="mt-1.5 flex gap-1.5 text-zinc-500">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <span>{card.softenTip}</span>
            </p>
          )}
        </div>

        {/* Image */}
        {card.image.recommended ? (
          <div className="space-y-2">
            {card.image.url ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <img
                  src={card.image.url}
                  alt={`${card.image.type || "visual"} for ${card.title}`}
                  className="w-full object-cover"
                  loading="lazy"
                />
                <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    <ImageIcon className="h-3 w-3" /> {card.image.type || "visual"}
                  </span>
                  <button
                    onClick={handleGenerateImage}
                    disabled={imgGenerating}
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-zinc-400 hover:text-indigo-600 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", imgGenerating && "animate-spin")} /> Regenerate
                  </button>
                </div>
              </div>
            ) : imgGenerating || card.image.status === "generating" ? (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-[12px] font-medium text-indigo-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating a {card.image.type || "visual"} visual… this can take a minute or two
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-700">
                  <ImageIcon className="h-3.5 w-3.5" /> {card.image.type || "visual"} recommended
                </span>
                <Button
                  size="sm"
                  onClick={handleGenerateImage}
                  className="h-7 gap-1.5 bg-indigo-600 text-[11px] font-semibold hover:bg-indigo-700"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Generate image
                </Button>
              </div>
            )}
            {card.image.reason && !card.image.url && (
              <p className="text-[11px] leading-relaxed text-zinc-400">{card.image.reason}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 font-semibold text-zinc-500">
              <ImageOff className="h-3.5 w-3.5" /> No image
            </span>
            <span className="text-zinc-400">{card.image.reason}</span>
          </div>
        )}

        {/* Expandable strategy detail */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-fit items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-600"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
          {expanded ? "Hide" : "Show"} Robert's reasoning
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl bg-zinc-50/70 p-3.5">
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Why this week</p>
                  <p className="text-[12px] leading-relaxed text-zinc-600">{card.whyThisWeek}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Content-type rationale</p>
                  <p className="text-[12px] leading-relaxed text-zinc-600">{card.contentTypeRationale}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Context weighting</p>
                  <ContextWeightBar card={card} />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Context sources</p>
                  <ul className="space-y-0.5">
                    {card.contextSources.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[12px] text-zinc-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                {card.followsFounderVoice && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-600">
                    <Quote className="h-3 w-3" /> Written to the founder's stated voice (Nina onboarding)
                  </p>
                )}
                {card.hookAlternatives.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Alternative hooks</p>
                    <ul className="space-y-1">
                      {card.hookAlternatives.map((h, i) => (
                        <li key={i} className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] italic text-zinc-500">
                          “{h}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 pl-6">
        <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold", status.className)}>
          {isApproved ? <CheckCheck className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          {status.label}
        </span>

        <div className="flex items-center gap-1">
          <IconAction title="Edit manually" onClick={() => setEditing((e) => !e)} icon={Pencil} />
          <IconAction title="Regenerate" onClick={handleRegenerate} icon={RefreshCw} spinning={regenerating} />
          {!card.image.recommended && (
            <IconAction
              title="Recommend an image for this post"
              onClick={() => onUpdate({ image: { recommended: true, type: "framework", reason: "Manually added by user." } })}
              icon={ImageIcon}
            />
          )}
          <IconAction title="Skip this post" onClick={onSkip} icon={Trash2} danger />

          {isApproved ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px] text-zinc-500"
              onClick={() => onUpdate({ approvalState: card.risk === "critical" ? "needs_explicit_approval" : "pending" })}
            >
              Undo
            </Button>
          ) : card.requiresExplicitApproval ? (
            <Button
              size="sm"
              className="h-7 gap-1 bg-amber-500 text-[11px] font-semibold hover:bg-amber-600"
              onClick={() => onUpdate({ approvalState: "approved" })}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Explicit approve
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 gap-1 bg-zinc-900 text-[11px] font-semibold hover:bg-zinc-800"
              onClick={() => onUpdate({ approvalState: "approved" })}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function IconAction({
  title,
  onClick,
  icon: Icon,
  spinning,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: typeof Pencil;
  spinning?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700",
        danger && "hover:bg-red-50 hover:text-red-600"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
    </button>
  );
}

// ─── Weekly summary header ──────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold leading-none text-zinc-900">{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function MixBar({ mix, label }: { mix: { growth: number; leads: number; trust: number }; label: string }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-cyan-400" style={{ width: `${mix.growth}%` }} title={`Growth ${mix.growth}%`} />
        <div className="bg-violet-400" style={{ width: `${mix.leads}%` }} title={`Leads ${mix.leads}%`} />
        <div className="bg-teal-400" style={{ width: `${mix.trust}%` }} title={`Trust ${mix.trust}%`} />
      </div>
      <div className="mt-1 flex gap-3 text-[10px] font-medium text-zinc-400">
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 align-middle" />G {mix.growth}</span>
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-400 align-middle" />L {mix.leads}</span>
        <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-teal-400 align-middle" />T {mix.trust}</span>
      </div>
    </div>
  );
}

function WeeklySummary({
  plan,
  metrics,
  acvTier,
  onTierChange,
}: {
  plan: WeeklyPlan;
  metrics: PlanMetrics;
  acvTier: ACVTier;
  onTierChange: (t: ACVTier) => void;
}) {
  const cfg = TIER_CONFIG[acvTier];
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Week of</span>
            <span className="text-sm font-semibold text-zinc-900">{plan.weekRange}</span>
          </div>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-zinc-500">{plan.objective}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">ACV tier</span>
          <Select value={acvTier} onValueChange={(v) => onTierChange(v as ACVTier)}>
            <SelectTrigger className="h-9 w-[190px] rounded-xl border-zinc-200 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low · {TIER_CONFIG.low.range}</SelectItem>
              <SelectItem value="medium">Medium · {TIER_CONFIG.medium.range}</SelectItem>
              <SelectItem value="high">High · {TIER_CONFIG.high.range}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-zinc-400">
            {cfg.founderPerWeek} founder · {cfg.orgPerWeek} org / week
          </span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Posts" value={metrics.total} sub={`${metrics.founderCount} founder · ${metrics.orgCount} org`} />
        <StatTile
          label="Safe / Critical"
          value={<span>{metrics.safeCount}<span className="text-zinc-300"> / </span><span className="text-amber-600">{metrics.criticalCount}</span></span>}
          sub={`${metrics.needsApprovalCount} need approval`}
        />
        <StatTile label="Scheduled" value={metrics.scheduledCount} sub={`${metrics.pendingCount} pending`} />
        <div className="col-span-2 rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5 sm:col-span-1 lg:col-span-1">
          <MixBar mix={plan.targetMix} label="Target mix" />
        </div>
        <div className="col-span-2 rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5 sm:col-span-1 lg:col-span-1">
          <MixBar mix={metrics.actualMix} label="This week" />
        </div>
      </div>

      {/* Strategy note */}
      <div className="mt-4 flex gap-2.5 rounded-2xl bg-indigo-50/60 p-3.5">
        <RobertAvatar className="h-7 w-7 ring-2 ring-white" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Robert's weekly strategy</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">{plan.strategyNote}</p>
        </div>
      </div>

      {/* Founder voice */}
      <div className="mt-2.5 flex items-start gap-2 rounded-2xl border border-zinc-100 bg-white/60 p-3">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
        <p className="text-[12px] leading-relaxed text-zinc-500">
          <span className="font-semibold text-zinc-600">Founder voice:</span> {plan.founderVoice}
        </p>
      </div>
    </div>
  );
}

// ─── Filter bar ─────────────────────────────────────────────────────────────────

interface Filters {
  author: "all" | Author;
  risk: "all" | RiskTag;
  funnel: "all" | Funnel;
  status: "all" | "pending" | "needs" | "scheduled";
}

function FilterBar({
  filters,
  onChange,
  counts,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  counts: { all: number; founder: number; org: number; safe: number; critical: number };
}) {
  const group = <K extends keyof Filters>(
    key: K,
    options: { value: Filters[K]; label: string }[]
  ) => (
    <div className="flex items-center gap-1 rounded-full bg-zinc-100/80 p-1">
      {options.map((o) => {
        const active = filters[key] === o.value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange({ ...filters, [key]: o.value } as Filters)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
              active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {group("author", [
        { value: "all", label: `All ${counts.all}` },
        { value: "founder", label: `Founder ${counts.founder}` },
        { value: "org", label: `Org ${counts.org}` },
      ])}
      {group("risk", [
        { value: "all", label: "Any risk" },
        { value: "safe", label: `Safe ${counts.safe}` },
        { value: "critical", label: `Critical ${counts.critical}` },
      ])}
      {group("funnel", [
        { value: "all", label: "Any goal" },
        { value: "growth", label: "Growth" },
        { value: "leads", label: "Leads" },
        { value: "trust", label: "Trust" },
      ])}
      {group("status", [
        { value: "all", label: "Any status" },
        { value: "pending", label: "Pending" },
        { value: "needs", label: "Needs approval" },
        { value: "scheduled", label: "Scheduled" },
      ])}
    </div>
  );
}

// ─── Robert chat sidebar ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "Why is this week planned like this?",
  "Why is a post critical?",
  "Change the mix for our ACV",
  "Make the founder posts sound like me",
  "What's working in our category?",
];

function RobertChat({
  plan,
  metrics,
  spaceId,
  open,
  onClose,
}: {
  plan: WeeklyPlan;
  metrics: PlanMetrics;
  spaceId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<RobertChatMessage[]>([
    {
      role: "robert",
      content:
        "I'm Robert, your content head. I plan and package your week, tag what's safe vs critical, and explain every call I make. Ask me anything about this week's plan.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await robertAPI.chat(text, plan, metrics, spaceId);
      setMessages((m) => [...m, { role: "robert", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "robert", content: "I hit a snag answering that. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden",
          open ? "block" : "hidden"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-zinc-200/70 bg-white shadow-2xl transition-transform duration-300",
          "lg:static lg:z-auto lg:w-[380px] lg:max-w-none lg:shrink-0 lg:bg-white/70 lg:shadow-none lg:backdrop-blur-xl lg:transition-none",
          open ? "translate-x-0" : "translate-x-full lg:hidden"
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <RobertAvatar className="h-9 w-9 ring-2 ring-indigo-100" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">Robert</p>
            <p className="text-[10px] font-medium text-zinc-400">Content Head · always on</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                  m.role === "user"
                    ? "whitespace-pre-line rounded-br-sm bg-zinc-900 text-white"
                    : "rounded-bl-sm bg-zinc-100 text-zinc-700"
                )}
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
                      li: ({ children }) => <li className="marker:text-zinc-400">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
                      code: ({ children }) => (
                        <code className="rounded bg-zinc-200 px-1 py-0.5 text-[11px]">{children}</code>
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3">
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-4 py-2.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-zinc-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 focus-within:border-indigo-300">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask Robert about the plan…"
            className="max-h-28 min-h-[36px] resize-none border-0 bg-transparent p-1 text-[13px] shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="h-9 w-9 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      </aside>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function Robert() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [acvTier, setAcvTier] = useState<ACVTier>("medium");
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingWeek, setRegeneratingWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genStage, setGenStage] = useState<GenStage | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [filters, setFilters] = useState<Filters>({ author: "all", risk: "all", funnel: "all", status: "all" });
  const reqRef = useRef(0);

  // Single loader used by initial load, tier changes, retry, and regenerate.
  // `force` asks the backend for a fresh GPT-5.2 generation; `isRegen` keeps the
  // current board visible (spinner on the button) instead of the full-page loader.
  const loadPlan = useCallback(
    async (force: boolean, isRegen: boolean) => {
      const my = ++reqRef.current;
      setError(null);
      setGenStage("starting");
      if (isRegen) setRegeneratingWeek(true);
      else setLoading(true);
      try {
        const p = await robertAPI.getWeeklyPlan(spaceId || "demo", acvTier, force, (stage) => {
          if (my === reqRef.current) setGenStage(stage);
        });
        if (my !== reqRef.current) return; // a newer request superseded this one
        setPlan(p);
        setCards(p.cards);
        if (isRegen) toast.success("Robert replanned your week");
      } catch (e) {
        if (my !== reqRef.current) return;
        const msg = e instanceof Error ? e.message : "Couldn't load this week's plan";
        setError(msg);
        if (isRegen) toast.error("Couldn't regenerate the week");
        else {
          setPlan(null);
          setCards([]);
        }
      } finally {
        if (my !== reqRef.current) return;
        setGenStage(null);
        if (isRegen) setRegeneratingWeek(false);
        else setLoading(false);
      }
    },
    [spaceId, acvTier]
  );

  useEffect(() => {
    loadPlan(false, false);
  }, [loadPlan]);

  const metrics = useMemo(() => computeMetrics(cards), [cards]);

  const counts = useMemo(() => {
    const active = cards.filter((c) => c.approvalState !== "skipped");
    return {
      all: active.length,
      founder: active.filter((c) => c.author === "founder").length,
      org: active.filter((c) => c.author === "org").length,
      safe: active.filter((c) => c.risk === "safe").length,
      critical: active.filter((c) => c.risk === "critical").length,
    };
  }, [cards]);

  const visibleCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.approvalState === "skipped") return false;
      if (filters.author !== "all" && c.author !== filters.author) return false;
      if (filters.risk !== "all" && c.risk !== filters.risk) return false;
      if (filters.funnel !== "all" && c.funnel !== filters.funnel) return false;
      if (filters.status === "pending" && c.approvalState !== "pending") return false;
      if (filters.status === "needs" && c.approvalState !== "needs_explicit_approval") return false;
      if (filters.status === "scheduled" && c.approvalState !== "scheduled") return false;
      return true;
    });
  }, [cards, filters]);

  const updateCard = (id: string, patch: Partial<ContentCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    // Best-effort persistence (no-op for demo/non-UUID spaces).
    void robertAPI.updateCard(spaceId, acvTier, id, patch);
  };

  const regenerateCard = async (card: ContentCard) => {
    // The backend regenerates AND persists the whole card (content + recomputed
    // risk/approval), so we replace local state directly rather than PATCHing.
    const next = await robertAPI.regenerateCard(card, spaceId, acvTier);
    setCards((prev) => prev.map((c) => (c.id === card.id ? next : c)));
  };

  const generateImage = async (card: ContentCard) => {
    // Throws on failure — the card's handler surfaces the toast.
    const image = await robertAPI.generateCardImage(spaceId, acvTier, card);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, image } : c)));
  };

  const regenerateWeek = () => loadPlan(true, true);

  const scheduleEligible = () => {
    const toSchedule = cards.filter(
      (c) => c.approvalState === "approved" || (c.approvalState === "pending" && c.risk === "safe")
    );
    if (toSchedule.length === 0) {
      toast.message("Nothing eligible to schedule yet");
      return;
    }
    const ids = new Set(toSchedule.map((c) => c.id));
    setCards((prev) =>
      prev.map((c) => (ids.has(c.id) ? { ...c, approvalState: "scheduled" as const } : c))
    );
    // Persist each newly-scheduled card (best-effort; no-op for demo spaces).
    toSchedule.forEach((c) => void robertAPI.updateCard(spaceId, acvTier, c.id, { approvalState: "scheduled" }));
    toast.success(`Scheduled ${toSchedule.length} post${toSchedule.length > 1 ? "s" : ""} for the week`);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar spaceId={spaceId!} onNewChat={() => navigate("/spaces")} onSelectConversation={() => {}} />

      {/* Main workspace */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <RobertAvatar className="h-9 w-9 ring-2 ring-indigo-100 shadow-sm" />
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Content Head</span>
              <span className="text-sm font-semibold text-zinc-900">Robert · Weekly approval board</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-50 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
              <Layers className="h-3 w-3" /> {TIER_CONFIG[acvTier].label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={regenerateWeek}
              disabled={regeneratingWeek || loading}
              title="Ask Robert to replan the whole week"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", regeneratingWeek && "animate-spin")} />
              <span className="hidden sm:inline">Regenerate week</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs lg:hidden"
              onClick={() => setChatOpen((o) => !o)}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Robert
            </Button>
          </div>
        </header>

        {/* Approval action bar — pinned at the top so it never overlaps content */}
        {!loading && plan && (
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/70 px-6 py-2.5 backdrop-blur-xl lg:px-8">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <CheckCheck className="h-4 w-4 text-emerald-500" />
                {metrics.eligibleToSchedule} eligible to schedule
              </span>
              {metrics.blockedCritical > 0 && (
                <span className="flex items-center gap-1.5 font-medium text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  {metrics.blockedCritical} critical awaiting approval
                </span>
              )}
            </div>
            <Button
              onClick={scheduleEligible}
              disabled={metrics.eligibleToSchedule === 0}
              className="h-9 shrink-0 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800 disabled:opacity-40"
            >
              <Calendar className="h-4 w-4" />
              Approve &amp; schedule week
            </Button>
          </div>
        )}

        {/* Scrollable board */}
        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <GenerationProgress stage={genStage} />
            ) : error && !plan ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">Robert couldn't generate this week</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button
                  onClick={() => loadPlan(true, false)}
                  className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : plan ? (
              <>
                {regeneratingWeek && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-[12px] font-medium text-indigo-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Robert is rewriting your week — {GEN_STEPS[genStepIndex(genStage)]?.label ?? "working"}…</span>
                    <span className="ml-auto flex-1" />
                    <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-indigo-200 sm:block">
                      <motion.div
                        className="h-full w-1/3 rounded-full bg-indigo-500"
                        animate={{ x: ["-120%", "320%"] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                )}
                {plan.isDemo && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      Showing <span className="font-semibold">sample content</span> — this space isn't linked to a real brand,
                      so Robert can't generate live posts here. Open a real workspace to get GPT-5.2 content grounded in your brand.
                    </span>
                  </div>
                )}
                <WeeklySummary plan={plan} metrics={metrics} acvTier={acvTier} onTierChange={setAcvTier} />

                <div className="sticky top-0 z-20 -mx-2 bg-[#FAFAFB]/80 px-2 py-2 backdrop-blur-md">
                  <FilterBar filters={filters} onChange={setFilters} counts={counts} />
                </div>

                {visibleCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 py-16 text-zinc-400">
                    <Info className="h-5 w-5" />
                    <p className="text-sm font-medium">No posts match these filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <AnimatePresence>
                      {visibleCards.map((card) => (
                        <ContentCardView
                          key={card.id}
                          card={card}
                          onUpdate={(patch) => updateCard(card.id, patch)}
                          onRegenerate={() => regenerateCard(card)}
                          onGenerateImage={() => generateImage(card)}
                          onSkip={() => {
                            updateCard(card.id, { approvalState: "skipped" });
                            toast.message("Post skipped for this week");
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            ) : null}
          </div>

        </div>
      </div>

      {/* Robert chat sidebar (persistent on lg+) */}
      {plan && <RobertChat plan={plan} metrics={metrics} spaceId={spaceId} open={chatOpen} onClose={() => setChatOpen(false)} />}

      {/* Floating reopen button when chat closed on xl */}
      {plan && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 hidden h-12 items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 pl-2 pr-5 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105 lg:flex"
        >
          <RobertAvatar className="h-8 w-8 ring-1 ring-white/40" /> Ask Robert
        </button>
      )}
    </div>
  );
}
