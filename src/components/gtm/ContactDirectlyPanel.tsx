// components/gtm/ContactDirectlyPanel.tsx
//
// The Contact Directly execution path:
//
//     choose a channel → generate a personalised message (free) → review → copy → open
//
// Deliberately lightweight. An operator who chose this has already decided to reach out;
// the only thing they need is something good to say and a way to go and say it. They are
// not sent through the EPS/NBA experience, which is the whole distinction between this path
// and the recommended-action path.
//
// ─── What this composes rather than rebuilds ───────────────────────────────────
//
// `MessageComposer` owns the draft entirely — the version selector, the textarea, the edit,
// the regenerate, the character counter against the server's own `charLimit`, and the note
// saying Weez never sends anything. It is mounted as-is. What this panel adds is the two
// things around it that did not exist: the channel choice, and the *first* generation.
// `MessageComposer` takes `versions` and NextActionPanel only mounts it once there is at
// least one, so nothing in the product could previously ask for a draft that did not exist
// yet.
//
// ─── Channels are the server's answer, not a list ─────────────────────────────
//
// LinkedIn is the executable channel. EMAIL has no registered adapter, so the backend
// reports `CHANNEL_NOT_IMPLEMENTED` for it and `request_action` would raise — which means
// there is no honest way to charge a credit for "contact by email" or to record it as a
// Weez action. So email is offered as **the address, to copy**, with a sentence saying why,
// and the draft works for either. That is the truthful version of the choice rather than a
// button that takes a credit and fails.
//
// ─── Prices ───────────────────────────────────────────────────────────────────
//
// Generation carries a literal `0`, and it is the one price tag in the product that is not
// read off the wire. `credits.PRICES` serves ENRICH, CONTACT and ACTIVATE only — message
// generation is deliberately absent from it, so `priceFor` returns null and a tag driven by
// it would render nothing at all. The zero is real and enforced (the route touches the
// credit module nowhere, and a backend test walks its AST to keep it that way), so stating
// it here is reporting a fact rather than inventing one.
//
// The contact action's own price comes from the server list like every other.
//
// ─── Property 30 ──────────────────────────────────────────────────────────────
//
// No control here is named "Send". `openChannel` is "Open LinkedIn", because that is what
// the click does: it opens a tab. The operator sends. `MessageComposer`'s own note says so
// under the textarea, and `pages/__tests__/GTMProspect.labels.test.tsx` holds the whole
// screen to it.

import { useCallback, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Mail, Linkedin, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import gtmAPI, { type Message } from "@/services/gtmAPI";
import { CreditPriceTag } from "./CreditBalance";
import { MessageComposer } from "./MessageComposer";
import { actionIdempotencyKey } from "./NextActionPanel";
import { CONTACT_DIRECTLY_LABELS, PROSPECT_DECISION_LABELS } from "./labels";

/** The two channels an operator can choose between here. */
export type ContactChannel = "LINKEDIN" | "EMAIL";

export interface ContactDirectlyPanelProps {
  brandId: string;
  /** `sales_leads.id`. */
  leadId: string;
  /** Retained drafts for this prospect — `ProspectDetail.messageVersions`. */
  versions: Message[];
  /** The enriched address, when Eva resolved one. Absent removes the email choice. */
  contactEmail?: string | null;
  /** The verified profile url, for the LinkedIn destination. */
  profileUrl?: string | null;
  /** A row the server rewrote, so the page can merge it into its payload. */
  onMessagePersisted?: (message: Message) => void;
  /** Called after a contact action is filed, so the page can refresh what it holds. */
  onContactRecorded?: () => void;
  /** What Contact Directly costs, from the server's price list. */
  contactPrice?: number | null;
  /**
   * Why this whole path is unavailable, or `null` when it is available.
   *
   * The isolated backend condition. Today the contact and generate routes both require a
   * GTM profile row, which only activation creates.
   */
  unavailableReason?: string | null;
  className?: string;
}

export function ContactDirectlyPanel({
  brandId,
  leadId,
  versions,
  contactEmail = null,
  profileUrl = null,
  onMessagePersisted,
  onContactRecorded,
  contactPrice = null,
  unavailableReason = null,
  className,
}: ContactDirectlyPanelProps) {
  const [channel, setChannel] = useState<ContactChannel>("LINKEDIN");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeText, setActiveText] = useState("");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  /** Drafts generated in this session, so the composer can show one before a refetch. */
  const [generated, setGenerated] = useState<Message[]>([]);

  const rows = [...versions, ...generated];
  const hasDraft = rows.length > 0;

  const onActiveMessageChange = useCallback((message: Message | null, text: string) => {
    setActiveMessageId(message?.messageId ?? null);
    setActiveText(text);
    setCopied(false);
  }, []);

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const message = await gtmAPI.generateMessage(brandId, leadId, { purpose: "WARMUP" });
      // A generation that could not be written comes back as a *record* with
      // `generatedContent: null` and a failure reason on it, not as a rejection. The
      // composer renders that as the record it is, with a Regenerate control, so it is
      // merged like any other version rather than treated as an error here.
      if (message) setGenerated((held) => [...held, message]);
    } catch (e) {
      // The server's own sentence, except for the one refusal whose cause is structural
      // and whose remedy the operator needs spelled out: no observed conversation yet.
      const detail = e instanceof Error ? e.message : "";
      setGenerateError(
        /conversation/i.test(detail)
          ? CONTACT_DIRECTLY_LABELS.needsConversation
          : detail || CONTACT_DIRECTLY_LABELS.generateFailed
      );
    } finally {
      setGenerating(false);
    }
  }, [brandId, leadId]);

  const onCopy = useCallback(async () => {
    if (!activeText) return;
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
    } catch {
      // A clipboard the browser refused. The text is on screen and selectable, so this
      // costs the operator a keystroke rather than the flow.
      setCopied(false);
    }
  }, [activeText]);

  /**
   * File the intent, then open the channel. Never the other way round.
   *
   * `requestAction` records that the operator intends to act and hands back the
   * destination; it moves no relationship or conversation state, because a click proves
   * somebody asked and proves nothing about LinkedIn. Then the tab opens with `noopener`,
   * so Weez holds no handle to it and cannot script the channel. Then `markOpened`, which
   * is a fact about us and not about them.
   *
   * This is the one credit-bearing control on this panel.
   */
  const onOpenLinkedIn = useCallback(async () => {
    setOpening(true);
    try {
      const action = await gtmAPI.requestAction(brandId, leadId, {
        actionType: "SEND_MESSAGE",
        messageId: activeMessageId,
        idempotencyKey: actionIdempotencyKey(leadId, "SEND_MESSAGE", activeMessageId, null),
      });
      const destination = action?.destinationUrl ?? profileUrl ?? null;
      if (destination) window.open(destination, "_blank", "noopener,noreferrer");
      if (action?.actionId) {
        // Best effort: a missing "opened" entry costs a timeline line, not the flow.
        try {
          await gtmAPI.markOpened(brandId, action.actionId);
        } catch {
          /* ignored on purpose */
        }
      }
      onContactRecorded?.();
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : CONTACT_DIRECTLY_LABELS.generateFailed);
    } finally {
      setOpening(false);
    }
  }, [brandId, leadId, activeMessageId, profileUrl, onContactRecorded]);

  return (
    <section
      aria-labelledby="contact-directly-heading"
      data-gtm-section="contact-directly"
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
    >
      <h2 id="contact-directly-heading" className="text-sm font-semibold text-zinc-900">
        {PROSPECT_DECISION_LABELS.contact.label}
      </h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
        {PROSPECT_DECISION_LABELS.contact.body}
      </p>

      {unavailableReason !== null ? (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-500">{unavailableReason}</p>
      ) : (
        <>
          {/* ── 1. Channel ── */}
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {CONTACT_DIRECTLY_LABELS.chooseChannel}
            </p>
            <div
              role="group"
              aria-label={CONTACT_DIRECTLY_LABELS.chooseChannel}
              className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-zinc-100/80 p-1"
            >
              <button
                type="button"
                aria-pressed={channel === "LINKEDIN"}
                onClick={() => setChannel("LINKEDIN")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  channel === "LINKEDIN"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                <Linkedin className="h-3 w-3" aria-hidden="true" />
                {CONTACT_DIRECTLY_LABELS.linkedin}
              </button>
              {/* Offered only where an address exists. A channel with nothing to send to is
                  an absence, not a choice. */}
              {contactEmail && (
                <button
                  type="button"
                  aria-pressed={channel === "EMAIL"}
                  onClick={() => setChannel("EMAIL")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    channel === "EMAIL"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  {CONTACT_DIRECTLY_LABELS.email}
                </button>
              )}
            </div>

            {channel === "EMAIL" && (
              <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-[11.5px] leading-relaxed text-slate-600">
                  {CONTACT_DIRECTLY_LABELS.emailNote}
                </p>
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-1 inline-flex items-center gap-1 font-mono text-[11.5px] text-sky-700 hover:underline"
                >
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  {contactEmail}
                </a>
              </div>
            )}
          </div>

          {/* ── 2. The draft ── */}
          <div className="mt-4 border-t border-zinc-100 pt-4">
            {generateError && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription className="text-[12px]">{generateError}</AlertDescription>
              </Alert>
            )}

            {hasDraft ? (
              <MessageComposer
                brandId={brandId}
                versions={rows}
                onActiveMessageChange={onActiveMessageChange}
                onMessagePersisted={onMessagePersisted}
                disabled={opening}
              />
            ) : (
              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onGenerate()}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {generating
                    ? CONTACT_DIRECTLY_LABELS.generating
                    : CONTACT_DIRECTLY_LABELS.generate}
                  {/* A literal 0 — see the note at the top of this file. The server does not
                      publish this price, and the zero is real and enforced. */}
                  <CreditPriceTag credits={0} className="ml-1.5" />
                </Button>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                  {PROSPECT_DECISION_LABELS.contact.generateNote}
                </p>
              </div>
            )}
          </div>

          {/* ── 3. Copy, and open the channel ── */}
          {hasDraft && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onCopy()}
                disabled={!activeText}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? CONTACT_DIRECTLY_LABELS.copied : CONTACT_DIRECTLY_LABELS.copy}
              </Button>

              {/* The credit-bearing control, and only on the channel that has an adapter.
                  On EMAIL there is nothing to file: the address is copied and the operator
                  writes from their own inbox, which Weez cannot record as an action. */}
              {channel === "LINKEDIN" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onOpenLinkedIn()}
                  disabled={opening}
                >
                  {opening ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {CONTACT_DIRECTLY_LABELS.openChannel}
                  <CreditPriceTag credits={contactPrice} className="ml-1.5" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ContactDirectlyPanel;
