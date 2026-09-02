// components/gtm/ActivityPanel.tsx
//
// Observed LinkedIn activity: the score, the band, when it was seen, and whether
// that observation has gone cold (R18.2, R2.6, R14.5).
//
// Three separate claims, kept separate:
//
//   `activity.score`   a derived number, so it goes through `DerivedScore` and
//                      arrives with its disclaimer attached (R1.8)
//   `activity.level`   the band the engine mapped that score to, an `ObservedFact`
//                      whose value is `UNKNOWN` when no activity has been observed
//   `isStale`          the age of the observation, which is not the same as its
//                      absence: a stale fact is a fact with a date on it, and the
//                      band does *not* change because the observation aged (R2.6)
//
// An empty activity set arrives as `score: null` and `level: UNKNOWN`. It renders
// "Unknown" both times. A zero would say we looked and found a dormant person,
// which is a different and unearned claim.
//
// The banded score components the engine persisted are deliberately not rendered:
// they are derived numbers, and a derived number on this screen has to carry a
// disclaimer. The score already does.

import { useId } from "react";
import { Activity as ActivityIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { ObservedValue, UNKNOWN_TEXT } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, SURFACE_LABEL, TONE, absTime, relTime } from "./labels";

export interface ActivityPanelProps {
  activity: Activity;
  className?: string;
}

export function ActivityPanel({ activity, className }: ActivityPanelProps) {
  const titleId = useId();
  // `activity.isStale` is the panel-level flag the API sends; the level's own
  // `isStale` is the same fact travelling with the value. Either one showing means
  // the observation is past the freshness window.
  const isStale = Boolean(activity.isStale || activity.level?.isStale);

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-sm font-semibold text-zinc-900"
        >
          <ActivityIcon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          {GTM_UI_LABELS.activityTitle}
        </h2>
        {isStale && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              TONE.amber,
            )}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Stale observation
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DerivedScore score={activity.score} label={FIELD_LABEL.activity_score} />
        <dl>
          <ObservedValue label={FIELD_LABEL.activity_level} fact={activity.level} hideProvenance />
        </dl>
      </div>

      {/* The observation itself, printed once for the panel (R18.2, R14.3). The
          level above suppresses its own provenance line so this is not said twice. */}
      <p className="mt-4 border-t border-zinc-100 pt-3 text-[11px] text-slate-500">
        {GTM_UI_LABELS.observed}
        {": "}
        {activity.sourceSurface ? SURFACE_LABEL[activity.sourceSurface] : UNKNOWN_TEXT}
        {" · "}
        {activity.observedAt ? (
          <time dateTime={activity.observedAt} title={absTime(activity.observedAt)}>
            {relTime(activity.observedAt)}
          </time>
        ) : (
          UNKNOWN_TEXT
        )}
      </p>
    </section>
  );
}

export default ActivityPanel;
