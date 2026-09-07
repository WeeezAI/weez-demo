// components/gtm/IdentityPanel.tsx
//
// Who this prospect is on LinkedIn, whether anybody has checked, and the two
// decisions that follow from the answer (R30.7, R3.2, R14.2).
//
// This block is the gate everything else on the page depends on. A recommendation
// about somebody we cannot identify is a recommendation about a stranger, and the
// backend agrees: `POST /gtm/prospect/{lead_id}/track` refuses with a 409 unless the
// lead's verdict is `VERIFIED` and an address came with it. So the panel renders the
// verdict first, and offers Track Prospect **only** where the verdict admits it.
//
// **NULL is not NO_MATCH, and that is the one thing this file exists to get right.**
// A null verification status means *nobody has tried*. `NO_MATCH` means a search ran
// and found nobody. `models/lead.py` states the prohibition at the column and
// `GTM_VERIFICATION_LABELS` carries the two sentences that keep them apart on
// screen. Absence reaches the value slot as `ObservedFact.isUnknown` — the word
// "Unknown", the same spelling every other fact on the page uses — and the
// "not yet resolved" sentence is printed beside it, exactly the way
// `BuyingStagePanel` prints why an unplaced stage is not `UNAWARE`.
//
// **A url is not a verdict.** A lead can arrive from a data provider carrying a
// LinkedIn address that nothing in this system has opened. So the address is
// labelled by what we actually know about it: `verifiedUrl` only where the verdict is
// `VERIFIED`, and `candidateUrl` plus `candidateNote` everywhere else. It is rendered
// as text rather than as a second link, because `ProspectHeader` already owns the one
// control that opens this address and two controls for one destination is a choice
// the operator should not have to make.
//
// **Every fact goes through `ObservedValue`** (R28.3), so the `derived` badge, the
// unknown branch and the provenance line all come from the one primitive allowed to
// render a fact. There is no second way to spell absence on this screen.
//
// What is derived here, and why it is labelled as such
// ---------------------------------------------------
// Two things, both marked `isDerived` so they cannot pass for readings:
//
//   • **The verdict.** `identity_search` computes it by scoring candidates and
//     comparing the best one against what the lead row claims. `VERIFIED` also
//     carries the surface and instant of that comparison, because a profile page
//     really was opened; `POSSIBLE_MATCH` and `NO_MATCH` carry neither, because for
//     `NO_MATCH` no page was opened at all and claiming one would be a fabricated
//     provenance.
//   • **The tracking state.** Nothing in the schema records "is this prospect
//     tracked" — the presence of an `li_gtm_profiles` row *is* the flag, which is
//     why `TrackProspectOut.tracking_state` has one member and derives it the same
//     way. So `profileId != null` reads as tracked here, by the server's own rule
//     rather than by a second one invented in the browser.
//
// There is no `PAUSED` and no `STOPPED`. See `GTM_TRACKING_STATE_LABELS`.
//
// No heading. The page's sections deliberately carry none — every panel that owns an
// `<h2>` owns it because it names one subject — and this block's subjects are named
// by the `ObservedValue` labels inside it. A heading here would add a ninth `<h2>` to
// a closed page whose outline is pinned at eight.

import { Loader2, Radar, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  IdentityResolution,
  LinkedInVerificationStatus,
  ObservedFact,
  ProspectProfile,
  ProspectTracking,
} from "@/services/gtmAPI";
import { ObservedValue } from "./ObservedValue";
import {
  GTM_IDENTITY_LABELS,
  GTM_TRACKING_STATE_LABELS,
  GTM_TRACKING_STATE_TONE,
  GTM_VERIFICATION_LABELS,
  GTM_VERIFICATION_TONE,
  TONE,
} from "./labels";

/** The one verdict that admits tracking, mirroring the route's own gate. */
export const VERIFIED = "VERIFIED";

/** The three verdicts the layer can reach. A value outside this set is unrecognised. */
export const VERIFICATION_STATUSES: readonly string[] = [
  VERIFIED,
  "POSSIBLE_MATCH",
  "NO_MATCH",
];

/** `data-testid` / `data-*` hook, so a test can scope to this block by structure. */
export const IDENTITY_SECTION = "identity";

/**
 * Which refusal sentence applies, or `null` when tracking is actually offerable.
 *
 * One branch per 409 the track route returns, in the route's own order, so a screen
 * never shows "run Enrich Now" for a search that already ran or "we found nobody"
 * for a search nobody started.
 */
export function trackRefusal(
  status: string | null,
  url: string | null,
): string | null {
  if (status == null) return GTM_IDENTITY_LABELS.cannotTrack.unresolved;
  if (status === "POSSIBLE_MATCH") return GTM_IDENTITY_LABELS.cannotTrack.possibleMatch;
  if (status === "NO_MATCH") return GTM_IDENTITY_LABELS.cannotTrack.noMatch;
  if (status !== VERIFIED) return GTM_IDENTITY_LABELS.cannotTrack.unrecognised;
  // VERIFIED, defensively without an address: a verification with nothing to point at
  // cannot be tracked, because there is no page to observe.
  if (!url) return GTM_IDENTITY_LABELS.cannotTrack.noAddress;
  return null;
}

/**
 * The verdict as an `ObservedFact`.
 *
 * The absence collapse happens *first*, so there is no order of operations in which a
 * null verdict picks up a label — the only path from "nobody has tried" to the screen
 * is `ObservedValue`'s unknown branch.
 *
 * The provenance is only claimed where it exists. `VERIFIED` means a profile page was
 * opened and compared, so the surface and the instant of that comparison travel with
 * it; the other two verdicts carry neither, because `NO_MATCH` opened no page at all.
 */
export function verificationFact(
  // Widened to `string` on purpose: the column is CHECK-constrained at the database and
  // the union mirrors it, but a fourth verdict added there would reach this function
  // before it reached the union, and it must render as itself rather than fail to
  // type-check the day it lands. The unmapped-key convention does the rest.
  status: LinkedInVerificationStatus | string | null | undefined,
  verifiedAt: string | null | undefined,
): ObservedFact {
  if (status == null || status === "") {
    return {
      value: null,
      isUnknown: true,
      sourceSurface: null,
      observedAt: null,
      isStale: false,
      isDerived: false,
    };
  }
  const verified = status === VERIFIED;
  return {
    value: GTM_VERIFICATION_LABELS[status] ?? status,
    isUnknown: false,
    sourceSurface: verified ? "LINKEDIN_PROFILE_PAGE" : null,
    observedAt: verified ? verifiedAt ?? null : null,
    isStale: false,
    // A verdict is the resolver's judgement over what a search returned, not a value
    // read off a page. Labelling it derived is what R14.5 asks for.
    isDerived: true,
  };
}

/**
 * The tracking state, by the server's own rule: the profile row *is* the flag.
 *
 * Three answers and no fourth. `UNRESOLVED` is not "not tracking" — it is "cannot be
 * tracked yet", which is a different thing for an operator to read and needs a
 * different control beside it.
 */
export function trackingState(status: string | null, profileId: string | null): string {
  if (profileId) return "TRACKING";
  return status === VERIFIED ? "NOT_TRACKING" : "UNRESOLVED";
}

/** The tracking state as a derived fact, so it renders through the one primitive. */
function trackingFact(state: string): ObservedFact {
  return {
    value: GTM_TRACKING_STATE_LABELS[state] ?? state,
    isUnknown: false,
    sourceSurface: null,
    observedAt: null,
    isStale: false,
    isDerived: true,
  };
}

export interface IdentityPanelProps {
  /** The profile block of the payload the page already fetched. No read of our own. */
  profile: ProspectProfile;
  /**
   * The freshest resolution the page holds, once Enrich Now has been pressed.
   *
   * Preferred over the payload's copy where it exists, because it was read after it.
   * Absent on arrival, which is why the panel renders from `profile` alone by default.
   */
  identity?: IdentityResolution | null;
  /** The tracking acknowledgement, once Track Prospect has been pressed. */
  trackingAck?: ProspectTracking | null;
  /** Ask for an identity search. Rendered wherever the verdict is not `VERIFIED`. */
  onResolveIdentity: () => void;
  resolving?: boolean;
  /** Start tracking. Rendered **only** where the verdict is `VERIFIED` with an address. */
  onTrackProspect: () => void;
  starting?: boolean;
  /** The last thing either control did, or the server's refusal. Announced politely. */
  notice?: string | null;
  className?: string;
}

export function IdentityPanel({
  profile,
  identity = null,
  trackingAck = null,
  onResolveIdentity,
  resolving = false,
  onTrackProspect,
  starting = false,
  notice = null,
  className,
}: IdentityPanelProps) {
  // The freshest verdict wins, and `??` rather than `||`: a resolution that came back
  // with a null status is still "nobody has tried", not a reason to fall back.
  const status = identity?.verificationStatus ?? profile.linkedinVerificationStatus ?? null;
  const verifiedAt = identity?.verifiedAt ?? profile.linkedinVerifiedAt ?? null;
  const confidence = identity?.matchConfidence ?? profile.linkedinMatchConfidence ?? null;
  const url = identity?.linkedinUrl ?? profile.profileUrl ?? null;

  const fact = verificationFact(status, verifiedAt);
  const verified = status === VERIFIED;
  const refusal = trackRefusal(status, url);
  const state = trackingState(status, trackingAck ? trackingAck.profileId : profile.profileId);

  const verdictTone =
    TONE[GTM_VERIFICATION_TONE[status ?? "UNRESOLVED"] ?? "zinc"] ?? TONE.zinc;
  const stateTone = TONE[GTM_TRACKING_STATE_TONE[state] ?? "zinc"] ?? TONE.zinc;

  return (
    <div
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      data-gtm-block={IDENTITY_SECTION}
      data-verification-status={status ?? "UNRESOLVED"}
      data-tracking-state={state}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* The verdict. `hideProvenance` follows `StateDimensionGrid`'s rule: print the
            surface / instant line only where there is a surface or an instant to print,
            so a verdict that opened no page does not render "Unknown · Unknown". */}
        <ObservedValue
          variant="inline"
          label={GTM_IDENTITY_LABELS.verificationField}
          fact={fact}
          hideProvenance={fact.sourceSurface == null && fact.observedAt == null}
          className={cn("rounded-md border px-3 py-2", verdictTone)}
        >
          {/* Only beside a verdict there is something to qualify. A confidence next to
              "Unknown" would put a measurement where a reading is missing (R14.2). */}
          {!fact.isUnknown && typeof confidence === "number" && Number.isFinite(confidence) && (
            <span
              className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}
            >
              <span className="sr-only">{GTM_IDENTITY_LABELS.confidenceField}: </span>
              {confidence}
            </span>
          )}
        </ObservedValue>

        {/* Whether Weez is watching. Derived from row existence, labelled derived. */}
        <ObservedValue
          variant="inline"
          label={GTM_IDENTITY_LABELS.trackingField}
          fact={trackingFact(state)}
          hideProvenance
          className={cn("rounded-md border px-3 py-2", stateTone)}
        />
      </div>

      {/*
        The most important sentence in this block. A null verdict renders "Unknown" in
        the slot above — the page's one spelling of absence — and this says which
        absence it is. It is deliberately *not* the `NO_MATCH` copy: nobody has looked,
        which is a different claim from having looked and found nobody.
      */}
      {fact.isUnknown && (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
          {GTM_VERIFICATION_LABELS.UNRESOLVED}
        </p>
      )}

      {/*
        The address, labelled by what we actually know about it. Text rather than a
        second link to the destination `ProspectHeader` already links to.
      */}
      {url && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {verified ? GTM_IDENTITY_LABELS.verifiedUrl : GTM_IDENTITY_LABELS.candidateUrl}
          </p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-700">{url}</p>
          {!verified && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {GTM_IDENTITY_LABELS.candidateNote}
            </p>
          )}
        </div>
      )}

      {/*
        The controls. Track Prospect exists only where the verdict admits it, which is
        the same gate the route applies — a control that is certain to be refused is a
        control that should not be on screen. Where it is absent, the reason is printed
        in its place and the search that would change the answer is offered instead.
      */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {refusal === null ? (
          <Button type="button" size="sm" onClick={onTrackProspect} disabled={starting}>
            {starting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {starting ? GTM_IDENTITY_LABELS.tracking : GTM_IDENTITY_LABELS.track}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResolveIdentity}
            disabled={resolving}
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {resolving ? GTM_IDENTITY_LABELS.resolving : GTM_IDENTITY_LABELS.resolve}
          </Button>
        )}
      </div>

      {/* Why tracking is not on offer, in words rather than as a disabled control with
          no explanation. One sentence per case the route actually refuses. */}
      {refusal !== null && (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{refusal}</p>
      )}

      {/*
        What the last control did. `aria-live` without `role="status"` on purpose: the
        page already owns exactly one `role="status"` live region for its own
        announcements, and a second one would compete with it for the reader's
        attention and for any query that looks for it.
      */}
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-[11px] leading-relaxed text-slate-500">
        {notice ?? ""}
      </p>
    </div>
  );
}

export default IdentityPanel;
