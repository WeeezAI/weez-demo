// components/gtm/IdentityConfirmPanel.tsx
//
// The candidate profile the resolver found but could not corroborate, and the one
// question that settles it (R30.7, R14.2, R14.3).
//
// Why this block exists
// ---------------------
// `POSSIBLE_MATCH` was never a failure. `identity_search` has said from its first
// commit that it means "a candidate worth a look that the scorer will not claim on
// its own", and that such a verdict is one "a human can settle". The resolver does
// the work a machine is good at — compose queries, score candidates on up to five
// attributes, pick the strongest, open it — and stops short of claiming an identity
// it could not corroborate.
//
// What made this urgent rather than nice: the corroboration step reads LinkedIn's
// markup, so it is hostage to LinkedIn's markup. A real attempt scored a candidate
// at 80 with `{"name":"exact","company":"compact","email_domain":"domain"}` and
// returned `PROFILE_IDENTITY_UNREADABLE` — a renamed CSS class, not a doubt about
// who the person was. Meanwhile the operator was about to open that same profile by
// hand in the connection flow anyway. So the judgement was already happening; it
// just had nowhere to be recorded.
//
// What this panel is careful about
// --------------------------------
// **It shows the evidence, not just the answer.** The url, the confidence, which
// attributes matched and how, and why the machine stopped. A confirmation button
// with no evidence beside it is a button people press without looking, and the
// entire value of this surface is that a human really looked.
//
// **It tells the operator to open the profile first.** `confirmHint` is an
// instruction, and it is the most important string in the file.
//
// **Rejection is an answer, not a cancel.** It records `NO_MATCH` — a finding that
// somebody looked and this is a different person — which is the only way that fact
// ever enters the system, and what stops the same wrong profile being re-offered.
//
// **It renders only while there is something to settle.** `identityCandidateUrl` is
// present on the payload only when the identity is unsettled and a candidate exists,
// so the panel's own visibility is the server's answer rather than a second rule
// invented here.
//
// **It claims nothing about tracking.** Confirming makes Track Prospect offerable.
// Provisioning stays the separate explicit decision it has always been.
//
// No heading of its own beyond a plain `<p>`: the page's `<h2>` outline is closed at
// eight and this block is a prompt inside the identity section, not a ninth section.

import { Check, ExternalLink, Loader2, ShieldQuestion, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProspectProfile } from "@/services/gtmAPI";
import { GTM_IDENTITY_CONFIRM_LABELS as L, TONE } from "./labels";

/** `data-*` hook so a test can scope to this block by structure. */
export const IDENTITY_CONFIRM_SECTION = "identity-confirm";

/** One attribute the resolver matched, as a person would read it. */
export interface MatchedAttribute {
  /** The raw key, e.g. `"email_domain"`. Kept for the test hook and the fallback. */
  key: string;
  /** `"Email domain"`, or the raw key when it is one we have no label for. */
  label: string;
  /** `"exact"`, `"close"`, …, or the raw kind when unmapped. */
  kind: string;
}

/**
 * The resolver's `match_evidence` JSON as a display list.
 *
 * Returns `[]` for anything unreadable — absent, malformed, or not an object. An
 * unparseable evidence blob must not take the panel down, and it must not silently
 * become "matched on nothing" either: the caller shows the confidence and the url
 * regardless, so the operator can still make the judgement with less to go on.
 *
 * Unmapped keys and kinds pass through as themselves rather than being dropped. A
 * new attribute the resolver starts matching on should appear on screen the day it
 * ships, spelled its own way, instead of vanishing until somebody adds a label.
 */
export function matchedAttributes(raw: string | null): MatchedAttribute[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.entries(parsed as Record<string, unknown>)
    .filter(([, kind]) => typeof kind === "string" && kind.length > 0)
    .map(([key, kind]) => ({
      key,
      label: L.attribute[key] ?? key,
      kind: L.matchKind[String(kind)] ?? String(kind),
    }));
}

/**
 * Whether there is a candidate awaiting a human verdict.
 *
 * Derived from the payload rather than from the verification status: the server
 * sends `identityCandidateUrl` only while the identity is unsettled AND a candidate
 * exists, so this is the server's own answer. Reconstructing it from
 * `linkedinVerificationStatus === "POSSIBLE_MATCH"` would be a second rule that
 * could disagree — and would show an empty prompt for a `POSSIBLE_MATCH` that
 * reached no candidate at all.
 */
export function hasCandidateToSettle(profile: ProspectProfile): boolean {
  return Boolean((profile.identityCandidateUrl || "").trim());
}

export interface IdentityConfirmPanelProps {
  /** The profile block of the payload the page already fetched. No read of our own. */
  profile: ProspectProfile;
  /** Record the verdict. `true` confirms, `false` records a different person. */
  onConfirm: (confirmed: boolean) => void;
  /** True while either answer is in flight; both controls disable together. */
  submitting?: boolean;
  /** What the last answer did, or the server's refusal. Announced politely. */
  notice?: string | null;
  className?: string;
}

export function IdentityConfirmPanel({
  profile,
  onConfirm,
  submitting = false,
  notice = null,
  className,
}: IdentityConfirmPanelProps) {
  const candidate = (profile.identityCandidateUrl || "").trim();
  if (!candidate) return null;

  // The lead's own confidence, not a second copy from the attempt: the resolver
  // writes `linkedin_match_confidence` on EVERY verdict including `POSSIBLE_MATCH`
  // (`observation_vm._write_verdict_to_lead`), so this is already the scorer's
  // number for the candidate below and there is nothing to reconcile.
  const confidence = profile.linkedinMatchConfidence;
  const attributes = matchedAttributes(profile.identityMatchEvidence);
  const reason = (profile.identityFailureReason || "").trim();
  const reasonSentence = reason ? L.failureReason[reason] : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm",
        className,
      )}
      data-gtm-block={IDENTITY_CONFIRM_SECTION}
      data-candidate-url={candidate}
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
        <ShieldQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />
        {L.heading}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-800">{L.why}</p>

      {/* Why the machine stopped, in a sentence rather than as a constant. An
          unmapped reason is simply omitted: a raw enum on screen tells an operator
          nothing they can act on. */}
      {reasonSentence && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
          {reasonSentence}
        </p>
      )}

      {/* The evidence. Everything the operator needs to judge, before the buttons. */}
      <dl className="mt-4 space-y-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">
            {L.candidateField}
          </dt>
          <dd className="mt-0.5">
            <a
              href={candidate}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-sky-800 underline underline-offset-2 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            >
              {candidate}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">{L.open}</span>
            </a>
          </dd>
        </div>

        {typeof confidence === "number" && Number.isFinite(confidence) && (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">
              {L.confidenceField}
            </dt>
            <dd className="mt-0.5 text-[12px] font-semibold text-amber-900">
              {confidence}
              <span className="sr-only"> out of 100</span>
            </dd>
          </div>
        )}

        {attributes.length > 0 && (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">
              {L.matchedField}
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {attributes.map((attribute) => (
                <span
                  key={attribute.key}
                  data-match-attribute={attribute.key}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    TONE.emerald ?? TONE.zinc,
                  )}
                >
                  {attribute.label}
                  <span className="font-normal opacity-75"> · {attribute.kind}</span>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* The instruction, before the controls and not after them. */}
      <p className="mt-4 text-[11px] leading-relaxed text-amber-800">
        {L.confirmHint}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirm(true)}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {submitting ? L.confirming : L.confirm}
        </Button>
        {/* Not a cancel, and deliberately not worded as one. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onConfirm(false)}
          disabled={submitting}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {L.reject}
        </Button>
      </div>

      {/*
        `aria-live` without `role="status"`: the page owns exactly one
        `role="status"` region and a second would compete with it.
      */}
      <p
        aria-live="polite"
        className="mt-2 min-h-[1rem] text-[11px] leading-relaxed text-amber-800"
      >
        {notice ?? ""}
      </p>
    </div>
  );
}

export default IdentityConfirmPanel;
