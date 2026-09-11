// components/gtm/ProspectDecision.tsx
//
// The central choice in this product, rendered once, at the one stage it means anything.
//
//     Contact Directly       "I already know enough. Help me reach them now."
//     Activate Intelligence  "I don't want to reach out blind. Keep understanding this
//                             prospect and tell me who, how and why now."
//
// An operator should be able to choose between these in a few seconds without knowing what
// a Signal, a belief or a recommendation engine is. So each card is a headline, one line
// saying which of the two the reader is, a sentence of substance, and a price — and
// nothing else.
//
// ─── Design decisions worth stating ───────────────────────────────────────────
//
// **Neither card is the default.** Both are `variant="outline"` and neither is accented.
// These are two legitimate answers to a real question, and styling one as primary would be
// the product answering it on the operator's behalf. Activation costs more, which is a
// reason to be *clearer* about it, not a reason to push it.
//
// **Both prices are on the card, before the click.** From the server's price list through
// `CreditPriceTag`, never a literal: a control that advertises a number the backend will
// not honour is the exact failure the credit feature exists to remove. An unread price
// renders no tag rather than an optimistic "free".
//
// **No duration on the activation card.** There is no activation expiry in this product —
// `TrackProspectOut` carries no expiry field and the profile row's existence is the flag —
// so the copy says "continuously" and stops. "30 days of Prospect Intelligence" would be a
// window nothing enforces.
//
// **Contact Directly can be unavailable, and says why.** Today the backend requires a GTM
// profile row before it will draft a message or file an action, and only activation creates
// one. Rather than render a control certain to 404, the card explains the dependency in
// words. `contactUnavailableReason` is the single isolated condition that carries this: the
// day the backend supports pre-activation contact, the caller passes `null` and this card
// becomes live with no redesign.

import { ArrowRight, Brain, Loader2, Radar, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreditPriceTag } from "./CreditBalance";
import { PROSPECT_DECISION_LABELS } from "./labels";

export interface ProspectDecisionProps {
  /** Start the Contact Directly path. Not called while `contactUnavailableReason` is set. */
  onContactDirectly: () => void;
  /**
   * Why Contact Directly cannot be offered, or `null` when it can.
   *
   * The one condition gating this path. See the note above: pass `null` and the control
   * goes live.
   */
  contactUnavailableReason?: string | null;
  /** What Contact Directly costs, from the server's price list. */
  contactPrice?: number | null;

  /** Activate intelligence for this prospect. */
  onActivate: () => void;
  activating?: boolean;
  /**
   * Why activation cannot be offered, or `null` when it can — the identity gate, from
   * `trackRefusal()`. The same rule the route applies, so a control that would be refused
   * is never rendered.
   */
  activateUnavailableReason?: string | null;
  /** What Activate Intelligence costs, from the server's price list. */
  activatePrice?: number | null;
  /**
   * Ask for a LinkedIn identity search, when that is what activation is waiting on.
   *
   * Offered *beside* `activateUnavailableReason` rather than instead of it. Every refusal
   * the track route returns is about the identity, and all but one of them are answered by
   * running a search — so a card that stated the problem and offered nothing left the
   * operator reading a dead end. This is the control that changes the answer.
   */
  onResolveIdentity?: () => void;
  resolving?: boolean;
  /** The label for that control, from the identity block's own table. */
  resolveLabel?: string;

  className?: string;
}

export function ProspectDecision({
  onContactDirectly,
  contactUnavailableReason = null,
  contactPrice = null,
  onActivate,
  activating = false,
  activateUnavailableReason = null,
  activatePrice = null,
  onResolveIdentity,
  resolving = false,
  resolveLabel,
  className,
}: ProspectDecisionProps) {
  return (
    <section
      aria-labelledby="prospect-decision-heading"
      data-gtm-section="decision"
      className={cn(
        "rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      <h2
        id="prospect-decision-heading"
        className="text-[13px] font-semibold text-zinc-900"
      >
        {PROSPECT_DECISION_LABELS.heading}
      </h2>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        {/* ── Contact Directly ── */}
        <div className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"
            >
              <Send className="h-3.5 w-3.5" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-900">
              {PROSPECT_DECISION_LABELS.contact.label}
            </p>
          </div>
          <p className="mt-2 text-[12px] font-medium text-zinc-700">
            {PROSPECT_DECISION_LABELS.contact.tagline}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
            {PROSPECT_DECISION_LABELS.contact.body}
          </p>
          {/* Message generation is genuinely free and it is worth saying here rather than
              two screens later: "will drafting this cost me anything" is a question the
              operator has at the moment they choose, not at the moment they generate. */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
            {PROSPECT_DECISION_LABELS.contact.generateNote}
          </p>

          <div className="mt-3.5 flex-1" />

          {contactUnavailableReason === null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-center gap-1.5 rounded-full text-xs"
              onClick={onContactDirectly}
            >
              {PROSPECT_DECISION_LABELS.contact.label}
              <CreditPriceTag credits={contactPrice} className="ml-0.5" />
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : (
            // In words, where the control would have been. A disabled button with no
            // explanation tells the operator they cannot do something and not why.
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {contactUnavailableReason}
            </p>
          )}
        </div>

        {/* ── Activate Intelligence ── */}
        <div className="flex min-w-0 flex-col rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"
            >
              <Brain className="h-3.5 w-3.5" />
            </span>
            <p className="text-[13px] font-semibold text-zinc-900">
              {PROSPECT_DECISION_LABELS.activate.label}
            </p>
          </div>
          <p className="mt-2 text-[12px] font-medium text-zinc-700">
            {PROSPECT_DECISION_LABELS.activate.tagline}
          </p>
          {/* The promise, then what the product does to keep it. Both come from
              `GTM_IDENTITY_LABELS` so this pitch and the identity block's cannot drift. */}
          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-violet-900">
            {PROSPECT_DECISION_LABELS.activate.headline}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
            {PROSPECT_DECISION_LABELS.activate.body}
          </p>

          <div className="mt-3.5 flex-1" />

          {activateUnavailableReason === null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-center gap-1.5 rounded-full border-violet-300 bg-white text-xs text-violet-800 hover:bg-violet-100"
              onClick={onActivate}
              disabled={activating}
            >
              {activating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {PROSPECT_DECISION_LABELS.activate.label}
              <CreditPriceTag credits={activatePrice} className="ml-0.5" />
            </Button>
          ) : (
            // The reason, and the thing that resolves it. Never a dead end: activation is
            // refused only ever because of the identity, and a search is what settles that.
            <div className="space-y-2">
              <p className="text-[11.5px] leading-relaxed text-slate-500">
                {activateUnavailableReason}
              </p>
              {onResolveIdentity && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-center gap-1.5 rounded-full border-violet-300 bg-white text-xs text-violet-800 hover:bg-violet-100"
                  onClick={onResolveIdentity}
                  disabled={resolving}
                >
                  {resolving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {resolveLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProspectDecision;
