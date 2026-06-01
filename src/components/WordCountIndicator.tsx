// src/components/WordCountIndicator.tsx
//
// Founder-facing word-count indicator for the LinkedIn post preview (Section 7).
//
// LinkedIn's completion-rate sweet spot is 150–250 words; long posts lose
// readers and short posts struggle to build credibility. This pure component
// renders a colored dot + count + an optional note:
//
//   [●] 187 words  → green   when within [min, max]
//   [●] 312 words  → red     when over max  ("Long posts lose readers...")
//   [●]  95 words  → yellow  when under min ("This might be too short...")
//
// The thresholds come from the backend per-intent WORD_COUNT_LIMITS (mirrored
// below as a default) and are passed in so the indicator matches whatever intent
// the pipeline classified. The founder can always override and publish anyway;
// logging that override is the caller's responsibility (see weezAPI
// .overrideQualityBlock with word_count_flag).

import { cn } from "@/lib/utils";

export type WordCountFlag = "OK" | "TOO_SHORT" | "TOO_LONG" | null;

export interface WordCountLimits {
  min: number;
  max: number;
  target?: number;
}

/**
 * Per-intent limits — mirror of backend
 * core.linkedin.quality_enforcement.WORD_COUNT_LIMITS. Exported so callers can
 * resolve limits by intent without a round-trip when the backend hasn't echoed
 * them.
 */
export const WORD_COUNT_LIMITS: Record<string, WordCountLimits> = {
  founder_story: { min: 150, max: 250, target: 200 },
  opinion_post: { min: 100, max: 200, target: 150 },
  customer_story: { min: 120, max: 220, target: 175 },
  product_post: { min: 100, max: 180, target: 140 },
  default: { min: 150, max: 250, target: 200 },
};

export function resolveWordCountLimits(postIntent?: string | null): WordCountLimits {
  const key = (postIntent ?? "").trim().toLowerCase();
  return WORD_COUNT_LIMITS[key] ?? WORD_COUNT_LIMITS.default;
}

/** Word tokeniser — mirrors the backend count_words regex so counts agree. */
const WORD_RE = /[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g;

export function countWords(post: string): number {
  if (!post) return 0;
  return post.match(WORD_RE)?.length ?? 0;
}

type Status = "ok" | "short" | "long";

function statusFor(wordCount: number, limits: WordCountLimits): Status {
  if (wordCount < limits.min) return "short";
  if (wordCount > limits.max) return "long";
  return "ok";
}

const NOTES: Record<Status, string | null> = {
  ok: null,
  long: "Long posts lose readers. Consider trimming.",
  short: "This might be too short to build credibility.",
};

const DOT_COLOR: Record<Status, string> = {
  ok: "bg-emerald-500",
  long: "bg-rose-500",
  short: "bg-amber-500",
};

const TEXT_COLOR: Record<Status, string> = {
  ok: "text-emerald-700 dark:text-emerald-300",
  long: "text-rose-700 dark:text-rose-300",
  short: "text-amber-700 dark:text-amber-300",
};

interface WordCountIndicatorProps {
  /** The post text. Either this OR `wordCount` must be provided. */
  post?: string;
  /** Pre-computed word count (e.g. word_count_final from the pipeline). */
  wordCount?: number;
  /** Post intent used to resolve the min/max thresholds. */
  postIntent?: string | null;
  /** Explicit limits — overrides `postIntent` resolution when provided. */
  limits?: WordCountLimits;
  /** Hide the helper note (dot + count only). */
  hideNote?: boolean;
  className?: string;
}

/**
 * `WordCountIndicator` — pure presentational pill. No side effects; safe to
 * unit-test in isolation. The founder is never blocked by this component; it
 * informs, and the override decision lives with the publish action.
 */
export function WordCountIndicator({
  post,
  wordCount,
  postIntent,
  limits,
  hideNote = false,
  className,
}: WordCountIndicatorProps) {
  const count = typeof wordCount === "number" ? wordCount : countWords(post ?? "");
  const effectiveLimits = limits ?? resolveWordCountLimits(postIntent);
  const status = statusFor(count, effectiveLimits);
  const note = NOTES[status];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden="true"
          className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_COLOR[status])}
        />
        <span className={TEXT_COLOR[status]}>{count} words</span>
      </span>
      {!hideNote && note && (
        <span className="text-xs text-muted-foreground">{note}</span>
      )}
    </div>
  );
}

export default WordCountIndicator;
