/* Silent Break Score: pure scoring for the workflow inventory at /inventory.
   Ported from the dexraflow.in tool so both sites score the same way. No DOM, no side effects. */

export type Notice = "yes" | "not_sure" | "no";
export type FindOut = "alert" | "report" | "complaint" | "wouldnt";
export type Decision = "keep" | "fix" | "kill";

export type Workflow = {
  id: string;
  name: string;
  notice?: Notice;
  tool?: string;
  does?: string;
  trigger?: string;
  owner?: string;
  lastChanged?: string;
  findOut?: FindOut;
  leadsPerWeek?: number;
  decision?: Decision;
};

export const MAX_WORKFLOWS = 50;
export const TOOLS = ["HubSpot", "Salesforce", "Zapier", "Make", "n8n", "Clay", "Outreach", "Salesloft", "Apollo", "Other"];
export const NOTICE_LABELS: Record<Notice, string> = { yes: "Yes", not_sure: "Not sure", no: "No" };
export const FINDOUT_LABELS: Record<FindOut, string> = { alert: "An alert fires", report: "A report shows it", complaint: "A rep or customer complains", wouldnt: "We wouldn't" };
export const DECISION_LABELS: Record<Decision, string> = { keep: "Keep", fix: "Fix", kill: "Kill" };
export const COMPANY_SIZES: [string, string][] = [["1-50", "1–50"], ["51-200", "51–200"], ["201-500", "201–500"], ["500+", "500+"]];
export const ROLES = ["Head of RevOps", "RevOps / Sales Ops", "GTM engineer", "CRM admin", "Founder / exec", "Other"];
export const COMMON = ["Demo form → CRM", "Lead routing (round-robin)", "Enrichment (Clay / Apollo)", "Outbound sequence sync", "Webinar registrants → CRM", "Chatbot → CRM", "Lead scoring update", "New-lead Slack alert"];

export const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const EXAMPLE = (): Workflow[] => [
  { id: newId(), name: "Demo form → HubSpot", notice: "no", tool: "HubSpot", does: "Creates a contact when someone requests a demo", trigger: "Demo form submitted", owner: "Priya (RevOps)", lastChanged: "Aug 2026", findOut: "complaint", leadsPerWeek: 40, decision: "keep" },
  { id: newId(), name: "Round-robin routing", notice: "not_sure", tool: "HubSpot", does: "Assigns new demo leads to an AE", trigger: "Contact created with source = Demo", owner: "", lastChanged: "2024", findOut: "report", leadsPerWeek: 40, decision: "fix" },
  { id: newId(), name: "Old webinar sync", notice: "no", tool: "Zapier", does: "Pushes webinar signups into the CRM", trigger: "New webinar registrant", owner: "", lastChanged: "2023", findOut: "wouldnt", leadsPerWeek: 0, decision: "kill" },
];

const has = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
export const leads = (w: Workflow) => (Number.isFinite(w.leadsPerWeek) && (w.leadsPerWeek as number) > 0 ? Math.floor(w.leadsPerWeek as number) : 0);
export const named = (ws: Workflow[]) => ws.filter((w) => has(w.name));

export type Score = { total: number; yes: number; notSure: number; no: number; unanswered: number; noOwner: number; fix: number; kill: number; leadsAtRisk: number; tools: string[] };

export function score(ws: Workflow[]): Score {
  const n = named(ws);
  const count = (fn: (w: Workflow) => boolean) => n.filter(fn).length;
  const atRisk = n.filter((w) => w.notice === "no" || w.notice === "not_sure");
  return {
    total: n.length,
    yes: count((w) => w.notice === "yes"),
    notSure: count((w) => w.notice === "not_sure"),
    no: count((w) => w.notice === "no"),
    unanswered: count((w) => !w.notice),
    noOwner: count((w) => !has(w.owner)),
    fix: count((w) => w.decision === "fix"),
    kill: count((w) => w.decision === "kill"),
    leadsAtRisk: atRisk.reduce((sum, w) => sum + leads(w), 0),
    tools: [...new Set(n.map((w) => (w.tool || "").trim()).filter(Boolean))],
  };
}

export function verdict(s: Score) {
  if (!s.total) return "";
  const blind = s.no + s.notSure;
  if (blind === 0) return "You'd catch breaks fast. Nice.";
  if (blind <= 2) return "A couple of blind spots worth watching.";
  return "Several workflows could fail silently. These are where leads disappear.";
}

/** Rank: No before Not sure, then most leads touched, then no owner first. */
export function fixFirst(ws: Workflow[], limit = 3) {
  const rank = (w: Workflow) => (w.notice === "no" ? 0 : 1);
  return named(ws)
    .filter((w) => w.notice === "no" || w.notice === "not_sure")
    .map((w, i) => ({ w, i }))
    .sort((a, b) => rank(a.w) - rank(b.w) || leads(b.w) - leads(a.w) || Number(has(a.w.owner)) - Number(has(b.w.owner)) || a.i - b.i)
    .slice(0, limit)
    .map(({ w }) => w);
}

export const shareText = (s: Score) => `${s.no} of ${s.total} of our lead workflows could break with nobody noticing. Checked with dexraflow.com/inventory`;

export const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && email.trim().length <= 254;

const cut = (v: unknown, n: number) => (has(v) ? v.trim().slice(0, n) : undefined);

/** The workflow rows that go with a spreadsheet request: named rows only, text cut to the lengths the sheet uses. */
export const sheetPayload = (ws: Workflow[]) =>
  named(ws).slice(0, MAX_WORKFLOWS).map((w) => ({
    name: w.name.trim().slice(0, 120),
    tool: cut(w.tool, 40),
    does: cut(w.does, 200),
    trigger: cut(w.trigger, 160),
    owner: cut(w.owner, 120),
    lastChanged: cut(w.lastChanged, 40),
    notice: w.notice,
    findOut: w.findOut,
    leadsPerWeek: Number.isFinite(w.leadsPerWeek) ? w.leadsPerWeek : undefined,
    decision: w.decision,
  }));

/** The Supabase row: the form, the score summary, and the workflow rows the emailed spreadsheet is built from. */
export function buildPayload({ s, ws, email, companySize, role }: { s: Score; ws: Workflow[]; email: string; companySize: string; role: string }) {  const q = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const utm = (k: string) => (has(q.get(k)) ? (q.get(k) as string).slice(0, 200) : null);
  return {
    email: email.trim().toLowerCase(),
    consent: true,
    company_size: COMPANY_SIZES.some(([v]) => v === companySize) ? companySize : null,
    role: has(role) ? role.trim().slice(0, 60) : null,
    total_workflows: Math.min(MAX_WORKFLOWS, s.total),
    no_count: s.no,
    not_sure_count: s.notSure,
    no_owner_count: s.noOwner,
    fix_count: s.fix,
    kill_count: s.kill,
    leads_at_risk_per_week: s.leadsAtRisk,
    tools_used: s.tools.slice(0, 15),
    workflows: sheetPayload(ws),
    utm_source: utm("utm_source"),
    utm_medium: utm("utm_medium"),
    utm_campaign: utm("utm_campaign"),
    referrer: typeof document !== "undefined" && has(document.referrer) ? document.referrer.slice(0, 500) : null,
  };
}
