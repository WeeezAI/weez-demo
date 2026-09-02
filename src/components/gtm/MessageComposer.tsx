// components/gtm/MessageComposer.tsx
//
// The draft, and the three different claims a draft can carry (R7.2, R7.3, R7.4,
// R7.6, R7.7).
//
// `generatedContent`, `editedContent`, and `sentContent` are three separate facts
// and this component never lets one stand in for another:
//
//   generatedContent  what the model wrote. Read here, never written here.
//   editedContent     what the operator decided to say. The only field this
//                     component ever writes, and it writes it through
//                     `gtmAPI.saveEdit`, which PATCHes `edited_content` alone.
//   sentContent       what was observed in the LinkedIn thread, or what the
//                     operator explicitly confirmed. Render-only here: there is no
//                     code path in this file that assigns it, and the block that
//                     shows it mounts only when the server already reported it.
//
// The textarea therefore reads `editedContent ?? generatedContent` — the operator's
// decision when there is one, the model's text otherwise — and is `readOnly` until
// Edit is pressed. Saving an edit does not touch `generatedContent`; regenerating
// appends a version and leaves every predecessor selectable, because "what was I
// shown before I changed it" is a question the timeline has to be able to answer.
//
// Nothing here computes. `charLimit` arrives on the payload, so the counter reports
// the server's cap rather than a constant this file remembers, and a failed
// generation renders as the record it is — the reason, plus a Regenerate control —
// rather than as an error banner.

import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import gtmAPI, { type Message } from "@/services/gtmAPI";
import { GTM_ACTION_LABELS, SURFACE_LABEL, absTime, relTime } from "./labels";

/**
 * The note that sits under the textarea and is pointed at by `aria-describedby`.
 *
 * It is the composer's half of the honesty contract: the operator is told, in the
 * form itself, that pressing anything in Weez does not send this text.
 */
export const COMPOSER_SEND_NOTE = "Weez never sends this. You paste it into LinkedIn and send it yourself.";

/** The heading over the read-only block, shown only when the server observed it. */
export const SENT_CONTENT_HEADING = "Seen in LinkedIn";

export interface MessageComposerProps {
  brandId: string;
  /**
   * Every retained version for this prospect, newest first — `ProspectDetail.
   * messageVersions`. Prior versions are not pruned: they populate the selector.
   */
  versions: Message[];
  /**
   * The version the operator is looking at and the text that would be copied,
   * reported upward so the panel's primary control carries the same bytes the
   * operator can see. Memoise it: it is an effect dependency.
   */
  onActiveMessageChange?: (message: Message | null, text: string) => void;
  /** A row the server rewrote (a saved edit, a new version) so the page can merge it. */
  onMessagePersisted?: (message: Message) => void;
  /** Set while the panel is mid-request, so two writes cannot race. */
  disabled?: boolean;
  className?: string;
}

/** The text the operator is looking at: their decision when there is one. */
function resolveDraft(message: Message | null): string {
  if (!message) return "";
  return message.editedContent ?? message.generatedContent ?? "";
}

export function MessageComposer({
  brandId,
  versions,
  onActiveMessageChange,
  onMessagePersisted,
  disabled = false,
  className,
}: MessageComposerProps) {
  const textareaId = useId();
  const counterId = useId();
  const noteId = useId();
  const selectorId = useId();

  // Rows the server rewrote during this session, merged over the prop by id. A
  // regenerate lands here before the page refetches, so the new version is
  // selectable immediately without this component owning the list outright.
  const [persisted, setPersisted] = useState<Record<string, Message>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // `null` means "not editing". An empty string is a legitimate draft, so the
  // editing flag cannot be `draft !== ""`.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "regenerate">(null);

  const rows = useMemo(() => {
    const byId = new Map<string, Message>();
    versions.forEach((row) => byId.set(row.messageId, row));
    Object.values(persisted).forEach((row) => byId.set(row.messageId, row));
    return [...byId.values()].sort((a, b) => b.version - a.version);
  }, [versions, persisted]);

  // Selection falls back to the head rather than to nothing: a version that
  // disappeared from the payload must not blank the composer.
  const active = rows.find((row) => row.messageId === selectedId) ?? rows[0] ?? null;
  const resolved = resolveDraft(active);
  const isEditing = draft !== null;
  const shown = isEditing ? (draft as string) : resolved;

  const charCount = shown.length;
  const charLimit = active?.charLimit ?? null;
  const overLimit = charLimit !== null && charCount > charLimit;

  const generationFailed = Boolean(active && active.generatedContent === null && active.editedContent === null);

  useEffect(() => {
    onActiveMessageChange?.(active, resolved);
  }, [active, resolved, onActiveMessageChange]);

  const merge = useCallback(
    (row: Message | null) => {
      if (!row) return;
      setPersisted((prior) => ({ ...prior, [row.messageId]: row }));
      onMessagePersisted?.(row);
    },
    [onMessagePersisted],
  );

  const onSave = useCallback(async () => {
    if (!active || draft === null) return;
    setBusy("save");
    try {
      // `saveEdit` PATCHes `edited_content` and nothing else, so
      // `generatedContent` comes back byte-identical to what the model wrote.
      const row = await gtmAPI.saveEdit(brandId, active.messageId, draft);
      merge(row);
      setDraft(null);
    } finally {
      setBusy(null);
    }
  }, [active, brandId, draft, merge]);

  const onRegenerate = useCallback(async () => {
    if (!active) return;
    setBusy("regenerate");
    try {
      // A new version. The predecessor is left alone and stays in the selector.
      const row = await gtmAPI.regenerate(brandId, active.messageId);
      if (row) {
        merge(row);
        setSelectedId(row.messageId);
        setDraft(null);
      }
    } finally {
      setBusy(null);
    }
  }, [active, brandId, merge]);

  // Cmd/Ctrl+Enter saves, Escape cancels — the shortcuts the design names, so the
  // composer is completely operable without reaching for the mouse.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isEditing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void onSave();
    }
  };

  if (!active) {
    return (
      <div className={cn("rounded-lg border border-zinc-200 bg-zinc-50/60 p-4", className)}>
        <p className="text-[13px] text-slate-500">No draft has been prepared yet.</p>
      </div>
    );
  }

  const locked = disabled || busy !== null;

  return (
    <div className={cn("space-y-3", className)}>
      {rows.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor={selectorId} className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            Version
          </label>
          <select
            id={selectorId}
            value={active.messageId}
            disabled={locked}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setDraft(null);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-[13px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {rows.map((row) => (
              <option key={row.messageId} value={row.messageId}>
                {`Version ${row.version}`}
                {row.editedContent !== null ? " (edited)" : ""}
                {row.sentContent !== null ? " (seen in LinkedIn)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {generationFailed ? (
        // R7.7 — a draft that could not be written is a record, not an error.
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[13px] font-semibold text-amber-800">Couldn't draft this message</p>
          <p className="mt-1 text-[12px] text-amber-700">
            {active.generationFailureReason ?? "The reason was not recorded."}
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor={textareaId} className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            Message draft
          </label>
          <Textarea
            id={textareaId}
            className="mt-1 min-h-[140px] text-[13px] leading-relaxed"
            value={shown}
            readOnly={!isEditing}
            aria-readonly={!isEditing}
            aria-invalid={overLimit}
            aria-describedby={`${counterId} ${noteId}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <p id={counterId} className={cn("text-[11px]", overLimit ? "font-semibold text-rose-700" : "text-slate-500")}>
              {charLimit === null
                ? `${charCount} characters`
                : `${charCount} of ${charLimit} characters`}
              {overLimit ? ` — ${charCount - charLimit} over the LinkedIn limit` : ""}
            </p>
          </div>
          <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {COMPOSER_SEND_NOTE}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
            <Button type="button" size="sm" onClick={() => void onSave()} disabled={locked}>
              {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {GTM_ACTION_LABELS.SAVE}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)} disabled={locked}>
              {GTM_ACTION_LABELS.CANCEL}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDraft(resolved)}
            disabled={locked || generationFailed}
          >
            {GTM_ACTION_LABELS.EDIT}
          </Button>
        )}

        {/* R7.6 — Edit and Regenerate are present for every draft this shows. */}
        <Button type="button" size="sm" variant="outline" onClick={() => void onRegenerate()} disabled={locked}>
          {busy === "regenerate" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {GTM_ACTION_LABELS.REGENERATE}
        </Button>
      </div>

      {/* R7.5 — read-only, and mounted only because the server reported the text
          present in the thread or explicitly confirmed. Nothing in this file writes
          it: there is no control here that could. */}
      {active.sentContent !== null && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3" aria-label={SENT_CONTENT_HEADING}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">{SENT_CONTENT_HEADING}</p>
            <Badge
              variant="outline"
              className="border-emerald-200 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-700"
            >
              observed
            </Badge>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-emerald-900">{active.sentContent}</p>
          <p className="mt-1.5 text-[11px] text-slate-600">
            <span className="sr-only">Observed on </span>
            {active.sourceSurface ? SURFACE_LABEL[active.sourceSurface] : "Unknown"}
            {" · "}
            {active.observedAt ? (
              <time dateTime={active.observedAt} title={absTime(active.observedAt)}>
                {relTime(active.observedAt)}
              </time>
            ) : (
              "Unknown"
            )}
          </p>
        </section>
      )}
    </div>
  );
}

export default MessageComposer;
