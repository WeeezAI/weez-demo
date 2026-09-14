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
// **A price the workspace cannot cover keeps its control non-executing, and states the
// gap.** Both controls ask `shortfallOf(balance, price)` — the one place §11's rule lives —
// rather than comparing numbers here, so a third priced control cannot be added to this card
// without a gate. The balance comes from `useCredits()` and not from a prop: it is a property
// of the workspace, read once above the routes, and a prop would let a call site hand this
// card a number the ledger disagrees with. Outside a provider the hook answers "unread",
// which blocks nothing, so the card still renders standalone.
//
// Both `null`s are load-bearing. An unread balance blocks nothing — the workspace may well
// have the credits and the client simply has not asked — and an unread price is nothing to
// compare against. Only a known balance below a known price is a shortfall.
//
// **Contact Directly can be unavailable, and says why.** Rather than render a control
// certain to be refused, the card explains the dependency in words.
// `contactUnavailableReason` is the single isolated condition that carries this, and it is
// the caller's answer rather than this card's: message generation and action requests no
// longer need a GTM profile row, so the reasons left are a lead that is not enriched yet
// and a lead with no channel to reach.
//
// **The identity lookup is not on this card.** Not in the label, not in the icon, not in a
// note underneath, not in the busy text — and, since the `resolveLabel` prop was removed,
// not in the props either. Pressing Activate on an unresolved prospect runs the lookup and
// says "Starting intelligence", exactly as it does on a resolved one. The card is invariant
// under the identity verdict; `needsIdentity` chooses the handler and nothing else.

import { ArrowRight, Brain, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreditPriceTag, shortfallOf } from "./CreditBalance";
import { useCredits } from "@/hooks/useCredits";
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
   *
   * There is no `resolveLabel` beside it, and there must not be one. This control has no
   * label of its own — pressing Activate *is* the lookup — so a prop naming it would put
   * identity vocabulary into this component's interface, which R4.5 and R6.6 close off at
   * the card. The prop existed, carried `GTM_IDENTITY_LABELS.resolve` from
   * `ProspectIntelligence.tsx`, and reached nothing; it is removed rather than left as a
   * declared way in.
   */
  onResolveIdentity?: () => void;
  resolving?: boolean;

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
  className,
}: ProspectDecisionProps) {
  /**
   * Activation is blocked, and a lookup is what unblocks it.
   *
   * Still needed — it decides which handler the one button calls, and it suppresses the
   * server's refusal sentence for the refusals a lookup *does* fix — but it no longer
   * decides any copy. The lookup is plumbing, so the card must read identically whether
   * or not it is about to run one (R4.6).
   */
  const needsIdentity = activateUnavailableReason !== null && Boolean(onResolveIdentity);
  const busy = activating || resolving;

  /**
   * What the workspace is short by for each control, or `null` when it is not short (R17.5).
   *
   * One balance, two prices, one rule — `shortfallOf` — so the two cards cannot drift apart
   * on the question of whether a press is worth offering.
   */
  const { balance } = useCredits();
  const contactShortfall = shortfallOf(balance, contactPrice);
  const activateShortfall = shortfallOf(balance, activatePrice);

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
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-zinc-900">
              {PROSPECT_DECISION_LABELS.contact.label}
            </p>
            {/* Always visible — see the note on the activation card's price. */}
            <CreditPriceTag credits={contactPrice} />
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

          {contactUnavailableReason !== null ? (
            // In words, where the control would have been. A disabled button with no
            // explanation tells the operator they cannot do something and not why.
            //
            // Ahead of the shortfall on purpose: the backend's reason says this path cannot be
            // taken at all, and topping up would not change that answer.
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {contactUnavailableReason}
            </p>
          ) : contactShortfall !== null ? (
            // The gap, in the control's place, before any press (R17.5). Not a disabled
            // button: the reason a rep cannot press this is a number, and the number is what
            // tells them how much to top up by.
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {contactShortfall.statement}
            </p>
          ) : (
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
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-zinc-900">
              {PROSPECT_DECISION_LABELS.activate.label}
            </p>
            {/* The price, in the header, always.
                It used to live only on the button — so the moment a control was blocked for
                any reason the cost disappeared, which is precisely when a rep is weighing
                the two options. What something costs is a property of the action, not of
                whether it happens to be pressable right now. */}
            <CreditPriceTag credits={activatePrice} />
          </div>
          <p className="mt-2 text-[12px] font-medium text-zinc-700">
            {PROSPECT_DECISION_LABELS.activate.tagline}
          </p>
          {/* Label → tagline → body → price, and nothing between the tagline and the body.
              `activate.headline` used to sit here carrying the promise; the tagline above
              now *is* that promise, pinned word for word (R4.4), so the second line was
              restating the first. `body` still comes from `GTM_IDENTITY_LABELS` so this
              pitch and the identity block's cannot drift. */}
          <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
            {PROSPECT_DECISION_LABELS.activate.body}
          </p>

          <div className="mt-3.5 flex-1" />

          {/* ── One button, one label, whatever the identity verdict says ──
              This card is called Activate Intelligence, so its button says Activate
              Intelligence — and says it for a resolved and an unresolved prospect alike
              (R4.6). An earlier version relabelled it "Find their LinkedIn profile" when the
              identity was unresolved, then swapped the icon for a radar and explained the
              lookup in a note underneath. All three took the product concept off the screen
              and put a piece of plumbing in its place, on the one surface where the operator
              is choosing between two outcomes.

              The identity lookup is a *prerequisite*, so it stays behind this button and out
              of the copy (R4.5, R6.6): pressing Activate on an unresolved prospect starts the
              lookup, and `needsIdentity` exists only to route that press. Nothing about the
              rendered card changes, which is why the busy branch reads "Starting
              intelligence" either way. */}
          {activateShortfall !== null ? (
            // The one thing that takes this control off the card, and it is not the identity
            // verdict (R4.6 still holds — see Property 12): a known balance below the server's
            // known price. The gap is stated where the control was, so a rep reads how much to
            // top up by instead of pressing into a refusal (R17.5).
            //
            // The lookup behind `needsIdentity` goes with it. It exists only to unblock an
            // activation this workspace cannot pay for, so offering it would spend the rep's
            // time on a press the ledger has already answered.
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {activateShortfall.statement}
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-center gap-1.5 rounded-full border-violet-300 bg-white text-xs text-violet-800 hover:bg-violet-100"
              onClick={needsIdentity ? onResolveIdentity : onActivate}
              disabled={busy || (needsIdentity && !onResolveIdentity)}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {busy
                ? PROSPECT_DECISION_LABELS.activate.starting
                : PROSPECT_DECISION_LABELS.activate.label}
            </Button>
          )}

          {/* The server's own refusal, kept for the cases a lookup cannot fix — a rejected
              candidate, a verified identity with no address. Below the control rather than
              instead of it. */}
          {activateUnavailableReason !== null && !needsIdentity && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
              {activateUnavailableReason}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProspectDecision;
