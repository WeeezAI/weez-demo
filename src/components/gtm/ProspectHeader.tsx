// components/gtm/ProspectHeader.tsx
//
// Who this prospect is, and the one control that asks LinkedIn to be read again
// (R18.1, R18.7).
//
// Every fact here goes through `ObservedValue`, including the name: a profile we
// have never observed reads "Unknown" rather than falling back to an id, a blank,
// or an em dash. That is why the heading is a heading *containing* a fact rather
// than a heading built from a string this file trusted.
//
// The ICP match, intent signal, and ACV tier are the three chips R18.1 names. They
// arrive from Eva's qualification marked `isDerived`, so they render with the
// `derived` badge `ObservedValue` already carries — a chip that looks like an
// observation but is a judgement is exactly the confusion this layer exists to
// avoid. Their tone comes from the shared `TONE` table, which clears 4.5:1.
//
// Nothing here computes. `STATE_LABEL` lookup and `relTime` formatting happen
// inside `ObservedValue`; this file picks a label and a tone and stops.

import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProspectContact, ProspectProfile } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { ObservedValue } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, TONE, absTime, relTime } from "./labels";

/**
 * What the asserted block says about itself.
 *
 * Two sentences, and both are load-bearing. The first names where these values came from,
 * so nobody reads them as something Weez observed. The second says what happens next, which
 * is the difference between "this is all we will ever know" and "a LinkedIn read will
 * replace this" — and R18.4 asks every absence to name one or the other.
 */
export const ASSERTED_IDENTITY_LABELS = {
  heading: "From enrichment",
  note: "What the enrichment provider returned. Nothing has been read off a LinkedIn profile for this person yet — activate intelligence and these are replaced by what Weez observes.",
  /** The per-value marker, so an assertion is never mistaken for an observation. */
  marker: "reported",
} as const;

export interface ProspectHeaderProps {
  profile: ProspectProfile;
  /**
   * What enrichment asserted about this person, for a prospect no LinkedIn page has been
   * read for yet. Omit it and the observed grid renders as it always has.
   *
   * See `nothingObserved` below for why this is here: the six identity fields are
   * observations, they are legitimately unknown until a profile has been read, and a grid
   * of six "Unknown"s sitting directly under a header showing the person's name reads as a
   * broken product rather than as an honest one.
   */
  contact?: ProspectContact | null;
  /** Ask for a fresh read. Omit and the control is not rendered at all. */
  onRefresh?: () => void;
  /** True while a refresh is in flight: the control stays visible and disabled. */
  refreshing?: boolean;
  /** When the persisted payload was last written, for the "as of" line. */
  updatedAt?: string | null;
  /**
   * The heading element for the prospect's name. `h1` by default because this is
   * the page's title; a host that owns its own `<h1>` passes `h2` and keeps the
   * outline flat.
   */
  headingAs?: "h1" | "h2";
  className?: string;
}

/** The three qualification chips. Tone is decoration; the label carries meaning. */
const QUALIFICATION_TONE: Record<string, string> = {
  icp_match: "violet",
  intent_signal: "sky",
  acv_tier: "teal",
};

export function ProspectHeader({
  profile,
  contact = null,
  onRefresh,
  refreshing = false,
  updatedAt,
  headingAs = "h1",
  className,
}: ProspectHeaderProps) {
  const Heading = headingAs;
  const chips: Array<{ key: string; fact: typeof profile.icpMatch }> = [
    { key: "icp_match", fact: profile.icpMatch },
    { key: "intent_signal", fact: profile.intentSignal },
    { key: "acv_tier", fact: profile.acvTier },
  ];

  /**
   * Nothing has been read off a LinkedIn page for this person.
   *
   * All six identity fields come from `li_gtm_profiles.observed_*`, and that row is created
   * by activation — so every prospect who has been enriched but not activated has six
   * unknowns here. That is *correct*: an observation nobody made must not borrow the value
   * Eva asserted, or the screen would claim Weez looked at something it never opened.
   *
   * It was also the whole of what this box said, directly beneath a header showing the
   * person's name and email. So the absence is kept and the assertion is shown beside it,
   * clearly marked and clearly separate — which is the distinction the vocabulary exists to
   * preserve, rather than a fallback that erases it.
   *
   * Keyed on `profileId` rather than on the facts: the profile row is what makes an
   * observation possible, and a tracked prospect whose first read has not landed yet should
   * show the observed grid with its honest unknowns rather than fall back to enrichment.
   */
  const nothingObserved = profile.profileId === null;
  const asserted: Array<{ label: string; value: string }> = !nothingObserved
    ? []
    : ([
        [FIELD_LABEL.name, contact?.name],
        [FIELD_LABEL.company, contact?.company],
        [FIELD_LABEL.role, contact?.role],
      ] as const)
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => ({ label, value: value as string }));

  return (
    <header className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/*
            The heading names the region; the name itself is a fact and goes
            through `ObservedValue` beside it. Putting the primitive *inside* the
            heading would nest flow content in an element that only takes phrasing
            content, and the fact is worth more than the styling shortcut: an
            unobserved profile has to be able to read "Unknown" here.
          */}
          <Heading className="sr-only">{GTM_UI_LABELS.prospectTitle}</Heading>
          <ObservedValue
            variant="inline"
            label={FIELD_LABEL.name}
            fact={profile.name}
            hideProvenance
            className="[&_span]:text-xl [&_span]:leading-tight"
          />
          <div className="mt-2">
            <ObservedValue variant="inline" label={FIELD_LABEL.headline} fact={profile.headline} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {profile.profileUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {GTM_UI_LABELS.viewProfile}
              </a>
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {refreshing ? GTM_UI_LABELS.refreshing : GTM_UI_LABELS.refresh}
            </Button>
          )}
        </div>
      </div>

      {/* What enrichment asserted, when nothing has been observed. Above the observed grid
          because it is the part that is actually known, and visually distinct from it
          because an assertion and an observation are different claims — every value here
          carries its own marker and the block names its source in its heading. */}
      {asserted.length > 0 && (
        <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">
            {ASSERTED_IDENTITY_LABELS.heading}
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {asserted.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {label}
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-zinc-900">{value}</span>
                  <Badge
                    variant="outline"
                    className="border-sky-200 bg-white px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-sky-700"
                  >
                    {ASSERTED_IDENTITY_LABELS.marker}
                  </Badge>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {ASSERTED_IDENTITY_LABELS.note}
          </p>
        </div>
      )}

      {/* Observed identity. A `<dl>`, so `ObservedValue` can stay in its default
          `<dt>`/`<dd>` variant and the pairing is real markup rather than layout. */}
      <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <ObservedValue label={FIELD_LABEL.company} fact={profile.company} />
        <ObservedValue label={FIELD_LABEL.role} fact={profile.role} />
        <ObservedValue label={FIELD_LABEL.location} fact={profile.location} />
        <ObservedValue label={FIELD_LABEL.seniority} fact={profile.seniority} />
      </dl>

      {/* Eva's qualification (R18.1). Chips, but chips that keep their provenance:
          a derived judgement rendered as a bare badge is indistinguishable from an
          observation, which is precisely the confusion to avoid. */}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {chips.map(({ key, fact }) => (
          <ObservedValue
            key={key}
            label={FIELD_LABEL[key] ?? key}
            fact={fact}
            className={cn(
              "rounded-md border px-3 py-2",
              TONE[QUALIFICATION_TONE[key] ?? "zinc"] ?? TONE.zinc,
            )}
          />
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-zinc-100 pt-4">
        <DerivedScore score={profile.leadScore} label={FIELD_LABEL.lead_score} size="sm" />
        {updatedAt && (
          <p className="text-[11px] text-slate-500">
            {GTM_UI_LABELS.observed}{" "}
            <time dateTime={updatedAt} title={absTime(updatedAt)}>
              {relTime(updatedAt)}
            </time>
          </p>
        )}
      </div>
    </header>
  );
}

export default ProspectHeader;
