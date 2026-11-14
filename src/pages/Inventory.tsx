import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, Download, Plus, X } from "lucide-react";
import { BlogLayout } from "@/components/blog/BlogLayout";
import { FOCUS } from "@/components/landing/primitives";
import {
  COMMON, COMPANY_SIZES, DECISION_LABELS, EXAMPLE, FINDOUT_LABELS, MAX_WORKFLOWS, NOTICE_LABELS, ROLES, TOOLS,
  buildPayload, fixFirst, isValidEmail, leads, newId, score, shareText, verdict,
  type Decision, type FindOut, type Notice, type Workflow,
} from "@/lib/inventory";
import { downloadWorkbook } from "@/lib/inventoryWorkbook";
import { useSeo } from "@/lib/seo";
import { submitInventory } from "@/services/inventoryAPI";

/* /inventory: the Silent Break Score. List the workflows that move your leads, answer one question
   each, get a score and a fix-first list. The list lives in the browser (localStorage). It goes to
   Supabase only if the visitor asks for the spreadsheet by email: then the email, the score summary
   and the workflow rows are sent, and the server builds the attached workbook from them. */

const STORE_KEY = "dxf_inventory_v1";
// The founder's Google Calendar appointment schedule: the short link to open, and its embeddable form.
const BOOKING_LINK = "https://calendar.app.google/Msq6N5qQR57XfPGy9";
const BOOKING_EMBED = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3BLlrrKFLqAFhPBu8WZ3-wxPj4gq3H7U_LzXH9nctQsc4PqKhI0kXQvPYD7S8uve3XMsc6oIkJ?gv=true";
const MONO = "font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em]";
const LABEL = "font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted";
const INPUT = `h-11 w-full rounded-[8px] border border-dx-line-strong bg-dx-raised px-3 text-[15px] text-dx-ink placeholder:text-dx-ink-muted/70 ${FOCUS}`;
const CARD = "rounded-[8px] border border-dx-line bg-dx-raised";
const BTN = `inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-5 text-[14px] font-medium transition active:scale-[0.98] disabled:opacity-60 ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-dx-brand text-white hover:bg-dx-brand-hover`;
const BTN_GHOST = `${BTN} border border-dx-line-strong text-dx-ink hover:bg-dx-sunken`;

type Action =
  | { type: "add"; name: string }
  | { type: "patch"; id: string; patch: Partial<Workflow> }
  | { type: "remove"; id: string }
  | { type: "example" }
  | { type: "clear" };

const reducer = (ws: Workflow[], a: Action): Workflow[] => {
  switch (a.type) {
    case "add":
      return ws.length >= MAX_WORKFLOWS ? ws : [...ws, { id: newId(), name: a.name }];
    case "patch":
      return ws.map((w) => (w.id === a.id ? { ...w, ...a.patch } : w));
    case "remove":
      return ws.filter((w) => w.id !== a.id);
    case "example":
      return EXAMPLE();
    case "clear":
      return [];
  }
};

const load = (): Workflow[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((w) => w && typeof w.id === "string" && typeof w.name === "string").slice(0, MAX_WORKFLOWS) : [];
  } catch {
    return [];
  }
};

const NOTICE_TONE: Record<Notice, string> = {
  yes: "border-dx-success bg-dx-success-soft text-dx-success",
  not_sure: "border-dx-signal bg-dx-signal-soft text-dx-signal-ink",
  no: "border-dx-signal bg-dx-signal text-dx-ink",
};

const Tag = ({ notice }: { notice: Notice }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-dx-mono text-[10px] font-medium uppercase tracking-[0.08em] ${NOTICE_TONE[notice]}`}>{NOTICE_LABELS[notice]}</span>
);

const meta = (w: Workflow) => [`${leads(w)} leads/wk`, !w.owner?.trim() && "no owner"].filter(Boolean).join(" · ");

/** A small radio group drawn as pills. */
function Pills<T extends string>({ name, value, options, onChange, tone }: { name: string; value?: T; options: Record<T, string>; onChange: (v: T) => void; tone?: Partial<Record<T, string>> }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => {
        const on = value === k;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(k)} className={`h-9 rounded-full border px-3.5 text-[14px] font-medium transition ${on ? tone?.[k] ?? "border-dx-ink bg-dx-ink text-white" : "border-dx-line-strong bg-dx-raised text-dx-ink hover:bg-dx-sunken"} ${FOCUS}`}>
            {options[k]}
          </button>
        );
      })}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block">
    <span className={LABEL}>{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-[12px] text-dx-ink-muted">{hint}</span>}
  </label>
);

const Row = ({ w, i, dispatch }: { w: Workflow; i: number; dispatch: (a: Action) => void }) => {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<Workflow>) => dispatch({ type: "patch", id: w.id, patch: p });
  const blind = w.notice === "no" || w.notice === "not_sure";
  const status = !w.notice ? "" : w.notice === "yes" ? "You'd catch this one." : `${w.decision === "kill" ? "Marked to kill. " : ""}${w.notice === "no" ? "Blind spot. This could fail silently." : "Worth checking. Counted as a blind spot."}`;
  return (
    <li className={`${CARD} ${blind ? "border-l-[3px] border-l-dx-signal" : ""} p-4 sm:p-5`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="font-dx-mono text-[12px] text-dx-ink-muted">{String(i + 1).padStart(2, "0")}</span>
          <input aria-label="Workflow name" value={w.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Workflow name" maxLength={120} className={`h-10 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-[16px] font-semibold text-dx-ink hover:border-dx-line focus:border-dx-line-strong ${FOCUS}`} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div>
            <p className={`${LABEL} mb-1.5 md:hidden`}>Would anyone notice within a day?</p>
            <Pills name={`Would anyone notice within a day if ${w.name || "this workflow"} broke?`} value={w.notice} options={NOTICE_LABELS} onChange={(v) => patch({ notice: v })} tone={NOTICE_TONE} />
          </div>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`inline-flex h-9 items-center gap-1 rounded-[8px] px-2.5 ${MONO} text-dx-brand hover:bg-dx-brand-soft ${FOCUS}`}>
            Details <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => dispatch({ type: "remove", id: w.id })} aria-label={`Remove ${w.name || "this workflow"}`} className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-dx-ink-muted hover:bg-dx-sunken hover:text-dx-ink ${FOCUS}`}>
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
      {status && <p className={`mt-2 pl-8 text-[13px] ${blind ? "text-dx-signal-ink" : "text-dx-success"}`}>{status}</p>}
      {open && (
        <div className="mt-4 grid gap-4 border-t border-dx-line pt-4 sm:grid-cols-2">
          <Field label="Tool">
            <select className={INPUT} value={w.tool || ""} onChange={(e) => patch({ tool: e.target.value })}>
              <option value="">Choose a tool</option>
              {TOOLS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="What it does">
            <input className={INPUT} value={w.does || ""} onChange={(e) => patch({ does: e.target.value })} placeholder="One line" maxLength={200} />
          </Field>
          <Field label="What triggers it">
            <input className={INPUT} value={w.trigger || ""} onChange={(e) => patch({ trigger: e.target.value })} placeholder="Form submit, new contact, field change, schedule" maxLength={160} />
          </Field>
          <Field label="Owner" hint="No owner = nobody fixes it.">
            <input className={INPUT} value={w.owner || ""} onChange={(e) => patch({ owner: e.target.value })} placeholder="A named person, not a team" maxLength={120} />
          </Field>
          <Field label="Last changed">
            <input className={INPUT} value={w.lastChanged || ""} onChange={(e) => patch({ lastChanged: e.target.value })} placeholder="Month and year, rough is fine" maxLength={40} />
          </Field>
          <Field label="How would we find out?">
            <select className={INPUT} value={w.findOut || ""} onChange={(e) => patch({ findOut: (e.target.value || undefined) as FindOut | undefined })}>
              <option value="">Choose one</option>
              {(Object.keys(FINDOUT_LABELS) as FindOut[]).map((k) => (
                <option key={k} value={k}>
                  {FINDOUT_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Leads touched per week">
            <input className={INPUT} type="number" min={0} inputMode="numeric" value={Number.isFinite(w.leadsPerWeek) ? w.leadsPerWeek : ""} onChange={(e) => patch({ leadsPerWeek: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value))) })} placeholder="0" />
          </Field>
          <div>
            <span className={LABEL}>Decision</span>
            <div className="mt-1.5">
              <Pills name="Decision" value={w.decision} options={DECISION_LABELS} onChange={(v: Decision) => patch({ decision: v })} />
            </div>
          </div>
        </div>
      )}
    </li>
  );
};

const FAQ = [
  { q: "Do you see my workflows?", a: "Only if you ask us to email your spreadsheet. Until then, everything you type stays in your browser. When you ask for the email, we store your email, your score and your workflow list so we can build the attachment." },
  { q: "What counts as a workflow?", a: "Anything that moves a lead or deal automatically: form syncs, routing rules, enrichment, Zaps, sequences, AI agents writing to your CRM." },
  { q: "Why 'within a day'?", a: "Most silent breaks are found weeks later, by a rep or a customer. A day is the bar worth aiming for." },
  { q: "What's Dexraflow?", a: "We catch lead workflows that silently break and tell you the same day, with the leads affected." },
];

const Inventory = () => {
  useSeo({
    title: "Silent Break Score: free GTM workflow inventory | Dexraflow",
    description: "List the workflows that move your leads. See how many could fail silently, which to fix first, and get a spreadsheet of your inventory. Free, five minutes, no signup.",
    path: "/inventory",
  });

  const [ws, dispatch] = useReducer(reducer, undefined, load);
  const [draft, setDraft] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const toolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(ws));
    } catch {
      /* private mode: the page still works, it just won't remember */
    }
  }, [ws]);

  // Arriving at /inventory#book from the report email.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 80);
    return () => window.clearTimeout(t);
  }, []);

  const s = useMemo(() => score(ws), [ws]);
  const top = useMemo(() => fixFirst(ws), [ws]);
  const used = new Set(ws.map((w) => w.name.trim().toLowerCase()));
  const answered = s.total > 0 && s.unanswered === 0;

  const add = (name: string) => {
    const n = name.trim();
    if (!n) return addRef.current?.focus();
    dispatch({ type: "add", name: n });
  };
  const start = () => {
    toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => addRef.current?.focus({ preventScroll: true }), 500);
  };
  const example = () => {
    if (ws.some((w) => w.name.trim()) && !window.confirm("Replace your workflows with the example? Your current list will be replaced by three sample rows.")) return;
    dispatch({ type: "example" });
    toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const clear = () => {
    if (window.confirm("Clear all workflows? This removes every row from this browser. There is no undo.")) dispatch({ type: "clear" });
  };

  /* results: download, copy, email */
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<"idle" | "building" | "error">("idle");
  const download = async () => {
    setSheet("building");
    try {
      await downloadWorkbook(ws, s);
      setSheet("idle");
    } catch {
      setSheet("error");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(s));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is on screen to select by hand */
    }
  };

  const [mail, setMail] = useState({ email: "", size: "", role: "", consent: false, website: "" });
  const [mailState, setMailState] = useState<{ kind: "idle" | "sending" | "error" | "done"; msg?: string }>({ kind: "idle" });
  const sendReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(mail.email)) return setMailState({ kind: "error", msg: "Enter a valid work email." });
    if (!mail.consent) return setMailState({ kind: "error", msg: "Tick the consent box so we can send the spreadsheet." });
    if (mail.website) return setMailState({ kind: "done" }); // honeypot: bots fill it, people never see it
    setMailState({ kind: "sending" });
    try {
      await submitInventory(buildPayload({ s, ws, email: mail.email, companySize: mail.size, role: mail.role }));
      setMailState({ kind: "done" });
    } catch {
      setMailState({ kind: "error", msg: "That didn't send. Your inventory is still here. Check your connection and try again." });
    }
  };

  return (
    <BlogLayout>
      <div className="mx-auto max-w-6xl">
        {/* hero */}
        <section aria-labelledby="inv-title" className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className={`${MONO} text-dx-brand`}>Free tool · 5 minutes</p>
            <h1 id="inv-title" className="mt-4 text-[38px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[52px]">
              If this workflow broke today, would anyone notice?
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-dx-ink-muted">List the workflows that move your leads. See how many could fail silently, and which to fix first.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={start} className={BTN_PRIMARY}>
                Start the inventory <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button type="button" onClick={example} className={BTN_GHOST}>
                See an example
              </button>
            </div>
            <p className="mt-4 text-[13px] text-dx-ink-muted">No signup to use it. Your workflow details stay in your browser unless you ask us to email them.</p>
          </div>
          <div className={`${CARD} p-6 shadow-dx-overlay`} role="img" aria-label="Example result: 2 of 3 workflows could break and nobody would notice.">
            <p className={`${MONO} text-dx-ink-muted`}>What you get</p>
            <p className="mt-3 text-[20px] font-semibold leading-snug">
              <span className="text-dx-signal-ink">2 of 3</span> workflows could break and nobody would notice
            </p>
            <ul className="mt-4 space-y-2">
              {[["no", "Demo form → HubSpot", "40 leads/wk"], ["no", "Old webinar sync", "no owner"], ["not_sure", "Round-robin routing", "40 leads/wk"]].map(([n, name, m]) => (
                <li key={name} className="flex items-center gap-3 rounded-[8px] border border-dx-line bg-dx-surface px-3 py-2.5">
                  <Tag notice={n as Notice} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{name}</span>
                  <span className="font-dx-mono text-[12px] text-dx-ink-muted">{m}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-dx-ink-muted">A score, a fix-first list, and a ready-made spreadsheet of your inventory.</p>
          </div>
        </section>

        {/* steps */}
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {[["List your workflows", "Type a name or tap a common one. Three is enough to start."], ["Answer one honest question each", "If it broke today, would anyone notice within a day?"], ["See your blind spots", "Your score updates as you go, with what to fix first."]].map(([t, d], i) => (
            <li key={t} className={`${CARD} p-5`}>
              <p className="font-dx-mono text-[12px] text-dx-brand">0{i + 1}</p>
              <p className="mt-2 text-[17px] font-semibold">{t}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-dx-ink-muted">{d}</p>
            </li>
          ))}
        </ol>

        {/* the tool */}
        <div ref={toolRef} id="tool" className="mt-16 grid scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section aria-labelledby="list-title" className="min-w-0">
            <h2 id="list-title" className="text-[26px] font-semibold tracking-[-0.02em]">
              Your lead workflows
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); add(draft); setDraft(""); }} className={`${CARD} mt-5 border-dx-brand/50 p-4 sm:p-5`}>
              <label htmlFor="inv-add" className="text-[15px] font-semibold">
                Add a workflow that moves your leads
              </label>
              <div className="mt-3 flex gap-2">
                <input id="inv-add" ref={addRef} className={INPUT} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Demo form → HubSpot" maxLength={120} />
                <button type="submit" className={`${BTN_PRIMARY} shrink-0`} disabled={ws.length >= MAX_WORKFLOWS}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="font-dx-mono text-[12px] text-dx-ink-muted">Common ones</span>
                {COMMON.filter((c) => !used.has(c.toLowerCase())).map((c) => (
                  <button key={c} type="button" onClick={() => add(c)} className={`h-8 rounded-full border border-dashed border-dx-line-strong px-3 text-[13px] text-dx-ink transition hover:border-dx-brand hover:bg-dx-brand-soft ${FOCUS}`}>
                    + {c}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-dx-ink-muted">Zaps, routing rules, form syncs, enrichment, sequences, AI agents writing to your CRM. Anything that touches a lead on its own.</p>
            </form>

            {ws.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between text-[13px] text-dx-ink-muted">
                  <p aria-live="polite">{answered ? "All answered. Your score is ready." : `${s.unanswered || ws.length - s.total} still to answer.`}</p>
                  <p className="font-dx-mono">
                    {ws.length} of {MAX_WORKFLOWS}
                  </p>
                </div>
                <ul className="mt-3 space-y-3">
                  {ws.map((w, i) => (
                    <Row key={w.id} w={w} i={i} dispatch={dispatch} />
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-[13px] text-dx-ink-muted">Open a row's Details to add the tool, owner and lead volume. Optional, but it sharpens the fix-first list.</p>
                  <button type="button" onClick={clear} className={`rounded ${MONO} text-dx-ink-muted underline underline-offset-4 hover:text-dx-ink ${FOCUS}`}>
                    Clear all
                  </button>
                </div>
              </>
            )}
          </section>

          {/* score */}
          <aside aria-labelledby="score-title" aria-live="polite" className="rounded-[8px] border border-dx-night-line bg-dx-night p-6 text-dx-night-ink lg:sticky lg:top-24">
            <p id="score-title" className={`${MONO} text-dx-night-ink-muted`}>
              Your Silent Break Score
            </p>
            {s.total === 0 ? (
              <p className="mt-4 text-[17px] leading-relaxed">Add your first workflow to see your score.</p>
            ) : (
              <>
                <p className="mt-4 text-[22px] font-semibold leading-snug tracking-[-0.01em]">
                  <span className="font-dx-mono text-[44px] font-medium leading-none text-dx-signal">{s.no}</span> <span className="text-dx-night-ink-muted">of</span> <span className="font-dx-mono text-[28px] font-medium">{s.total}</span>
                  <span className="mt-2 block">workflows could break and nobody would notice within a day</span>
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-dx-night-ink-muted">{verdict(s)}</p>
                {top.length > 0 && (
                  <div className="mt-5">
                    <p className={`${MONO} text-dx-night-ink-muted`}>Fix first</p>
                    <ul className="mt-2 space-y-2">
                      {top.map((w) => (
                        <li key={w.id} className="rounded-[8px] border border-dx-night-line px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Tag notice={w.notice as Notice} />
                            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{w.name}</span>
                          </div>
                          <p className="mt-1 font-dx-mono text-[12px] text-dx-night-ink-muted">{meta(w)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <dl className="mt-5 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-dx-night-line pt-4 text-[12px] text-dx-night-ink-muted">
                  {[[s.notSure, "Not sure"], [s.noOwner, "No owner"], [s.fix, "To fix"], [s.kill, "To kill"], [s.leadsAtRisk, "Leads at risk / wk"], [s.yes, "Covered"]].map(([v, l]) => (
                    <div key={l as string}>
                      <dd className="font-dx-mono text-[20px] font-medium text-dx-night-ink">{v}</dd>
                      <dt className="mt-0.5">{l}</dt>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="mt-5 text-[12px] leading-relaxed text-dx-night-ink-muted">A "No" means a broken workflow would quietly drop leads until a rep or a customer complains.</p>
          </aside>
        </div>

        {/* results */}
        {s.total > 0 && (
          <section id="results" aria-labelledby="results-title" className="mt-16 grid scroll-mt-24 gap-6 lg:grid-cols-2">
            <div className={`${CARD} p-6`}>
              <p className={`${MONO} text-dx-ink-muted`}>Results and next step</p>
              <h2 id="results-title" className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
                Take your score with you.
              </h2>
              <p className="mt-4 rounded-[8px] border border-dx-line bg-dx-surface p-4 text-[15px] leading-relaxed text-dx-ink">{shareText(s)}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={download} disabled={sheet === "building"} className={BTN_PRIMARY}>
                  <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> {sheet === "building" ? "Preparing…" : "Download for Excel / Sheets"}
                </button>
                <button type="button" onClick={copy} className={BTN_GHOST}>
                  {copied ? "Copied" : "Copy my score"}
                </button>
              </div>
              <p className="mt-3 text-[13px] text-dx-ink-muted" role={sheet === "error" ? "alert" : undefined}>
                {sheet === "error" ? "The spreadsheet couldn't be built right now. Check your connection and try again." : "A formatted spreadsheet with your score, every row, and dropdowns to keep updating it. No email needed."}
              </p>
            </div>

            <div className={`${CARD} p-6`}>
              {mailState.kind === "done" ? (
                <div role="status">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-dx-success-soft text-dx-success">
                    <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[20px] font-semibold">Sent. Check your inbox.</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-dx-ink-muted">Your spreadsheet, score and checklist are on their way. Want a second pair of eyes on the blind spots? Pick a time below.</p>
                  <a href="#book" className={`${BTN_GHOST} mt-5`}>
                    Book a call
                  </a>
                </div>
              ) : (
                <form onSubmit={sendReport} noValidate>
                  <h3 className="text-[18px] font-semibold leading-snug">Email me my spreadsheet and a checklist for fixing the blind spots</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Work email">
                        <input className={INPUT} type="email" autoComplete="email" placeholder="you@company.com" value={mail.email} onChange={(e) => setMail({ ...mail, email: e.target.value })} maxLength={254} required />
                      </Field>
                    </div>
                    <Field label="Company size · optional">
                      <select className={INPUT} value={mail.size} onChange={(e) => setMail({ ...mail, size: e.target.value })}>
                        <option value="">Prefer not to say</option>
                        {COMPANY_SIZES.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Role · optional">
                      <select className={INPUT} value={mail.role} onChange={(e) => setMail({ ...mail, role: e.target.value })}>
                        <option value="">Prefer not to say</option>
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <label>
                      Website
                      <input tabIndex={-1} autoComplete="off" value={mail.website} onChange={(e) => setMail({ ...mail, website: e.target.value })} />
                    </label>
                  </div>
                  <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed text-dx-ink-muted">
                    <input type="checkbox" checked={mail.consent} onChange={(e) => setMail({ ...mail, consent: e.target.checked })} className={`mt-1 h-4 w-4 shrink-0 accent-dx-brand ${FOCUS}`} />
                    <span>Send me the spreadsheet. Dexraflow may follow up once about it. Unsubscribe anytime.</span>
                  </label>
                  {mailState.kind === "error" && (
                    <p role="alert" className="mt-3 text-[14px] text-dx-signal-ink">
                      {mailState.msg}
                    </p>
                  )}
                  <button type="submit" disabled={mailState.kind === "sending"} className={`${BTN_PRIMARY} mt-5`}>
                    {mailState.kind === "sending" ? "Sending…" : "Email me my spreadsheet"}
                  </button>
                  <p className="mt-3 text-[13px] text-dx-ink-muted">To attach your spreadsheet, we store your email, your score and the workflow list above.</p>
                </form>
              )}
            </div>
          </section>
        )}

        {/* book a call */}
        <section id="book" aria-labelledby="book-title" className="mt-16 scroll-mt-24">
          <p className={`${MONO} text-dx-ink-muted`}>Talk it through</p>
          <h2 id="book-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
            Want a second pair of eyes? Pick a time.
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">A short call with the founder about your blind spots and what to fix first. No pitch deck.</p>
          <div className={`${CARD} mt-6 overflow-hidden`}>
            <iframe src={BOOKING_EMBED} title="Pick a time on the founder's calendar" loading="lazy" className="block h-[720px] w-full border-0 bg-white" />
          </div>
          <p className="mt-3 text-[14px] text-dx-ink-muted">
            Calendar not loading?{" "}
            <a href={BOOKING_LINK} target="_blank" rel="noopener noreferrer" className={`rounded font-medium text-dx-brand underline underline-offset-4 ${FOCUS}`}>
              Open it in a new tab
            </a>
            .
          </p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="inv-faq-title" className="mt-16 max-w-3xl">
          <p className={`${MONO} text-dx-ink-muted`}>FAQ</p>
          <h2 id="inv-faq-title" className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">
            Short answers.
          </h2>
          <div className="mt-5">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-dx-line py-4">
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded text-[16px] font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-dx-ink-muted transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
                </summary>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-dx-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </BlogLayout>
  );
};

export default Inventory;
