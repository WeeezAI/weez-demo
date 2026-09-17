// components/gtm/ObservedValue.tsx
//
// The only way an observed fact reaches the screen (R14.2, R14.3, R14.5, R2.6).
//
// It has exactly one branch for absence, and that branch is the reason the
// component exists: an `ObservedFact` with `isUnknown` renders the word "Unknown"
// and nothing else. Never `0`, never `false`, never `NOT_CONNECTED`, never an em
// dash standing in for a fact. A screen-reader-only note says why — "not yet
// observed" — so the gap is legible to someone who cannot see that the value slot
// is muted.
//
// A fact that *is* known never renders alone. It carries:
//   • a `derived` badge when the layer computed it rather than read it (R14.5)
//   • a `stale` badge when the observation is older than the freshness window (R2.6)
//   • the surface it was seen on and when, as real text (R14.3)
//
// Nothing here computes. `resolveStateValue` and `relTime` formatting are the two
// transforms, and both are dictionary-or-format operations over what the server
// sent. A value `STATE_LABEL` does not map is not given a meaning it did not arrive
// with: if it is shaped like a backend token it is re-cased into `Newly declared
// state`, which is the server's own word with its capitals and underscores taken
// out, and it renders with the `as reported` marker beside it so nobody mistakes it
// for copy somebody wrote. A value that is not token-shaped — `3/5 criteria
// matched`, `high` — renders exactly as it arrived.

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ObservedFact } from "@/services/gtmAPI";
import { SURFACE_LABEL, absTime, relTime, resolveStateValue } from "./labels";

/**
 * The default spelling of absence, and the fallback for any fact with nothing truer to say.
 *
 * Still exported and still the default, because a great many callers and assertions are
 * written against it. What changed is that it is no longer the *only* thing an absence can
 * say: see the `absence` prop, and `ABSENCE_LABEL` in `labels.ts`.
 */
export const UNKNOWN_TEXT = "Unknown";

/**
 * Why it is unknown, for a screen reader. Visually redundant, semantically not.
 *
 * No em dash: an em dash is the character this screen uses for "we put something
 * here so the layout would not wobble", and the unknown branch must not contain
 * one anywhere near the value slot.
 */
export const UNKNOWN_SR_NOTE = " (not yet observed)";

/**
 * The marker on a value whose text is the server's own token, re-cased.
 *
 * Rendered as text rather than as a tooltip or a colour, for the same reason `derived`
 * and `stale` are: a reader has to be able to tell a sentence somebody wrote from a
 * token this layer tidied, and a fact nobody has written copy for is still a display
 * gap even once it is legible.
 */
export const AS_REPORTED_TEXT = "as reported";

/**
 * Whether a fact carries nothing a reader could act on.
 *
 * The one rule, exported because three surfaces were each spelling it inline and a
 * fourth got it wrong. `isUnknown` alone is not enough — the server also flags a fact
 * whose value arrived without provenance — and `value == null` alone is not enough
 * either, so both halves are required and the disjunction is the whole test.
 *
 * `== null` is loose on purpose: it catches `undefined` from a payload that dropped the
 * key as well as an explicit `null`.
 */
export function isFactUnknown(fact: Pick<ObservedFact, "isUnknown" | "value">): boolean {
  return fact.isUnknown || fact.value == null;
}

export interface ObservedValueProps {
  /** The fact's name, e.g. "Relationship". Always rendered. */
  label: string;
  fact: ObservedFact;
  /**
   * What to say when the fact carries nothing — e.g. "No conversation recorded".
   *
   * ── Why this exists ──
   *
   * Every absence on this surface said the same word, so a dossier for a real prospect with
   * real company signals rendered "Unknown" a dozen times in one column. Each one was
   * literally true and the column as a whole read as "Weez knows nothing about this person",
   * which is the opposite of what the page is for — and a rep's fair reaction to it is "then
   * why am I looking at this prospect".
   *
   * The distinction worth keeping is between *kinds* of absence, which one word cannot make:
   *
   *     not observed     nobody has looked yet          "No activity observed"
   *     not recorded     looked, and there is no such   "No conversation recorded"
   *                      event on file
   *     not determined   evidence exists, and it does   "Not determined yet"
   *                      not place them yet
   *     not requested    nothing has been asked for     "Nothing requested yet"
   *
   * Each of those tells the rep something different about what to do next; "Unknown" tells
   * them nothing about any of them.
   *
   * **It must never read as a claim.** "Not connected" would assert a fact nobody observed —
   * an unobserved relationship is not a negative relationship. So the phrasings say what the
   * record does *not* contain, never what is false about the prospect. `ABSENCE_LABEL` in
   * `labels.ts` is the table, and its comment carries the same rule.
   *
   * Defaults to `UNKNOWN_TEXT`, so a caller that passes nothing renders exactly as before.
   */
  absence?: string;
  /**
   * `definition` (the default) renders `<dt>`/`<dd>` and must sit inside a `<dl>`
   * — that is how `StateDimensionGrid` uses it. `inline` renders plain elements for
   * places with no definition list, such as the header's identity block.
   */
  variant?: "definition" | "inline";
  /** Suppress the surface / observation-time line where the panel prints it once itself. */
  hideProvenance?: boolean;
  className?: string;
  /** Extra nodes rendered after the value, e.g. a panel-specific chip. */
  children?: ReactNode;
}

// The muted tones below are `text-slate-500`, not `text-slate-400`: 400 does not
// clear 4.5:1 on white and "Unknown" is a value a reader has to be able to read.

export function ObservedValue({
  label,
  fact,
  absence = UNKNOWN_TEXT,
  variant = "definition",
  hideProvenance = false,
  className,
  children,
}: ObservedValueProps) {
  const isUnknown = isFactUnknown(fact);
  // One resolution for the value, so the text and the marker that qualifies it cannot
  // disagree about how that text was produced.
  const shown = isUnknown ? null : resolveStateValue(fact.value as string);

  const body: ReactNode = isUnknown ? (
    // `UNKNOWN_SR_NOTE` rides along whatever the visible wording is. The note says the
    // value was not observed, which stays true of every phrasing in `ABSENCE_LABEL` — and a
    // screen-reader user has to be able to tell an absence from a value however it is
    // worded, which a phrase like "Nothing requested yet" does not do on its own.
    <span className="text-[13px] font-medium text-slate-500">
      {absence}
      <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
    </span>
  ) : (
    <>
      {/* A `div` rather than a `span`: `Badge` renders a `div`, and the value row
          has to stay valid flow content wherever this primitive is dropped. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-semibold text-zinc-900">{shown?.text}</span>
        {shown?.origin === "humanised" && (
          <Badge variant="outline" className="border-zinc-200 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            {AS_REPORTED_TEXT}
          </Badge>
        )}
        {fact.isDerived && (
          <Badge variant="outline" className="border-zinc-200 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            derived
          </Badge>
        )}
        {fact.isStale && (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
            stale
          </Badge>
        )}
        {children}
      </div>
      {!hideProvenance && (
        <span className="mt-0.5 block text-[11px] text-slate-500">
          <span className="sr-only">Observed on </span>
          {fact.sourceSurface ? SURFACE_LABEL[fact.sourceSurface] : UNKNOWN_TEXT}
          {" · "}
          {fact.observedAt ? (
            <time dateTime={fact.observedAt} title={absTime(fact.observedAt)}>
              {relTime(fact.observedAt)}
            </time>
          ) : (
            UNKNOWN_TEXT
          )}
        </span>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
        <div className="mt-0.5">{body}</div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</dt>
      <dd className="mt-0.5">{body}</dd>
    </div>
  );
}

export default ObservedValue;
