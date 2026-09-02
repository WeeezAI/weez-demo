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
import { Button } from "@/components/ui/button";
import type { ProspectProfile } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { ObservedValue } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, TONE, absTime, relTime } from "./labels";

export interface ProspectHeaderProps {
  profile: ProspectProfile;
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
