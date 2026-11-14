// send-email: called by a database trigger when a row lands in public.inventory_submissions.
// It emails the person their Silent Break Score and the checklist from the dexraflow.com domain,
// with their workflow inventory attached as a formatted Excel workbook when the row carries one.
//
// Body: { kind: "report", id: uuid }. The function only ever mails the address already stored on
// that row, and only once (it claims the row first), so it needs no caller auth. The workbook is
// built here from plain row data, never from a file the browser supplies.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   RESEND_API_KEY   required. Until it is set, nothing is sent and the row records why.
//   RESEND_FROM      optional. Default "Dexraflow <hello@dexraflow.com>". The domain must be verified in Resend.
//   REPLY_TO         optional. Default support@dexraflow.com.
//   SITE_URL         optional. Default https://www.dexraflow.com
//   BOOKING_LINK     optional. Default the founder's Google Calendar appointment page.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("RESEND_FROM") ?? "Dexraflow <hello@dexraflow.com>";
const REPLY_TO = Deno.env.get("REPLY_TO") ?? "support@dexraflow.com";
const SITE = (Deno.env.get("SITE_URL") ?? "https://www.dexraflow.com").replace(/\/$/, "");
const BOOKING = Deno.env.get("BOOKING_LINK") ?? "https://calendar.app.google/Msq6N5qQR57XfPGy9";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- the workbook (keep in step with src/lib/inventoryWorkbook.ts) ---------- */
const NOTICE: Record<string, string> = { yes: "Yes", not_sure: "Not sure", no: "No" };
const FINDOUT: Record<string, string> = { alert: "An alert fires", report: "A report shows it", complaint: "A rep or customer complains", wouldnt: "We wouldn't" };
const DECISION: Record<string, string> = { keep: "Keep", fix: "Fix", kill: "Kill" };
const COLUMNS: [string, string, number][] = [
  ["Workflow name", "Name it so a new hire would recognise it", 30],
  ["Tool (HubSpot / Salesforce / Zapier / other)", "HubSpot, Salesforce, Zapier, Make, Clay...", 24],
  ["What it does (one line)", "What it does, in one line", 34],
  ["What triggers it", "Form submit, new contact, field change, schedule", 30],
  ["Owner (who fixes it)", "A named person, not a team", 22],
  ["Last changed", "Month and year, rough is fine", 15],
  ["If it broke, would anyone notice within a day? (Yes / No / Not sure)", "Pick Yes, No or Not sure", 24],
  ["How would we find out?", "Alert, report, a rep complains, or we wouldn't", 28],
  ["Leads or deals it touches per week", "A rough number is fine", 16],
  ["Keep / Fix / Kill", "Pick Keep, Fix or Kill", 16],
];
const NOTICE_COL = 7, DECISION_COL = 10, CENTERED = new Set([6, 7, 9, 10]);
const C = {
  ink: "FF0F1A1F", night: "FF0C1315", brand: "FF0B6E69", brandNight: "FF3BBFAF", amber: "FFE8962E", amberInk: "FFB86A0C",
  amberSoft: "FFFCEFDC", amberPale: "FFFDF6EA", tealSoft: "FFDCEFEC", greenSoft: "FFE3F2EA", green: "FF1E7A4A", redSoft: "FFFBE7E5", red: "FFB8322B",
  surface: "FFF5F7F6", sunken: "FFE9EEEC", line: "FFD3DCD9", muted: "FF4F5E5B", white: "FFFFFFFF", pale: "FFE6EEEC",
};
const fill = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: C.line } };
const font = (o: Record<string, unknown>) => ({ name: "Arial", size: 11, ...o });
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Rows from the stored jsonb. Every value is re-checked here: text is cut to length, picks must be known keys. */
function sheetRows(workflows: unknown): (string | number)[][] {
  if (!Array.isArray(workflows)) return [];
  return workflows.slice(0, 50).filter((w) => w && typeof w === "object" && str(w.name, 120)).map((w) => [
    str(w.name, 120), str(w.tool, 40), str(w.does, 200), str(w.trigger, 160), str(w.owner, 120), str(w.lastChanged, 40),
    NOTICE[w.notice] ?? "", FINDOUT[w.findOut] ?? "",
    Number.isFinite(w.leadsPerWeek) && w.leadsPerWeek >= 0 ? Math.min(1_000_000, Math.floor(w.leadsPerWeek)) : "", DECISION[w.decision] ?? "",
  ]);
}

async function buildWorkbook(rows: (string | number)[][], r: Record<string, any>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dexraflow";
  // deno-lint-ignore no-explicit-any
  const ws: any = wb.addWorksheet("Inventory", { views: [{ state: "frozen", ySplit: 6, showGridLines: false }] });
  ws.columns = COLUMNS.map(([, , width]) => ({ width }));
  const cols = COLUMNS.length;
  const band = (n: number, height: number) => {
    const row = ws.getRow(n);
    row.height = height;
    for (let c = 1; c <= cols; c++) row.getCell(c).fill = fill(C.night);
    return row;
  };
  const r1 = band(1, 36);
  ws.mergeCells(1, 1, 1, cols);
  Object.assign(r1.getCell(1), { value: "GTM Workflow Inventory", font: font({ size: 22, bold: true, color: { argb: C.white } }), alignment: { vertical: "middle", indent: 1 } });
  const r2 = band(2, 22);
  ws.mergeCells(2, 1, 2, cols);
  Object.assign(r2.getCell(1), { value: "Would anyone notice if it broke? List every workflow that touches a lead or deal, then answer honestly.   |   Template by Dexraflow", font: font({ color: { argb: C.brandNight } }), alignment: { vertical: "middle", indent: 1 } });
  const r3 = band(3, 34);
  ws.mergeCells(3, 1, 3, 6);
  ws.mergeCells(3, 7, 3, cols);
  Object.assign(r3.getCell(1), { value: `${r.no_count} of ${r.total_workflows} workflows could break and nobody would notice within a day`, font: font({ size: 13, bold: true, color: { argb: C.amber } }), alignment: { vertical: "middle", indent: 1 } });
  Object.assign(r3.getCell(7), { value: `Not sure: ${r.not_sure_count}     To fix: ${r.fix_count}     To kill: ${r.kill_count}`, font: font({ color: { argb: C.pale } }), alignment: { vertical: "middle", horizontal: "right", indent: 1 } });
  ws.getRow(4).height = 8;

  const head = ws.getRow(5), hint = ws.getRow(6);
  head.height = 64;
  hint.height = 30;
  COLUMNS.forEach(([h, tip], i) => {
    Object.assign(head.getCell(i + 1), { value: h, fill: fill(C.brand), font: font({ bold: true, color: { argb: C.white } }), alignment: { vertical: "middle", wrapText: true } });
    Object.assign(hint.getCell(i + 1), { value: tip, fill: fill(C.sunken), font: font({ size: 9, italic: true, color: { argb: C.muted } }), alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(i + 1) ? "center" : "left" }, border: { bottom: { style: "medium", color: { argb: C.line } } } });
  });

  const noticeStyle: Record<string, [string, string, boolean]> = { No: [C.amberSoft, C.amberInk, true], "Not sure": [C.amberPale, C.amberInk, false], Yes: [C.tealSoft, C.brand, true] };
  const decisionStyle: Record<string, [string, string, boolean]> = { Keep: [C.greenSoft, C.green, false], Fix: [C.amberSoft, C.amberInk, true], Kill: [C.redSoft, C.red, true] };
  rows.forEach((vals, i) => {
    const row = ws.getRow(7 + i);
    row.height = 34;
    vals.forEach((v, j) => Object.assign(row.getCell(j + 1), { value: v, font: font({ color: { argb: C.ink } }), fill: fill(i % 2 ? C.white : C.surface), border: { bottom: thin }, alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(j + 1) ? "center" : "left" } }));
    const notice = String(vals[NOTICE_COL - 1]), decision = String(vals[DECISION_COL - 1]);
    row.getCell(1).font = font({ bold: true, color: { argb: notice === "No" ? C.amberInk : C.ink } });
    if (noticeStyle[notice]) Object.assign(row.getCell(NOTICE_COL), { fill: fill(noticeStyle[notice][0]), font: font({ bold: noticeStyle[notice][2], color: { argb: noticeStyle[notice][1] } }) });
    if (decisionStyle[decision]) Object.assign(row.getCell(DECISION_COL), { fill: fill(decisionStyle[decision][0]), font: font({ bold: decisionStyle[decision][2], color: { argb: decisionStyle[decision][1] } }) });
  });
  for (let n = 7; n < 7 + rows.length + 30; n++) {
    const row = ws.getRow(n);
    if (n >= 7 + rows.length) {
      row.height = 34;
      for (let c = 1; c <= cols; c++) Object.assign(row.getCell(c), { border: { bottom: thin }, font: font({ color: { argb: C.ink } }), alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(c) ? "center" : "left" } });
    }
    row.getCell(NOTICE_COL).dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No,Not sure"'] };
    row.getCell(DECISION_COL).dataValidation = { type: "list", allowBlank: true, formulae: ['"Keep,Fix,Kill"'] };
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/* ---------- the email ---------- */
const button = (href: string, label: string, solid = true) =>
  `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;${solid ? "background:#0b6e69;color:#ffffff;" : "background:#ffffff;color:#0f1a1f;border:1px solid #b9c6c2;"}text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${label}</a>`;

function reportEmail(r: Record<string, any>, attached: boolean) {
  const total = r.total_workflows, no = r.no_count, notSure = r.not_sure_count, blind = no + notSure;
  const verdict = blind === 0 ? "You'd catch breaks fast. Nice." : blind <= 2 ? "A couple of blind spots worth watching." : "Several workflows could fail silently. These are where leads disappear.";
  const row = (label: string, value: unknown) => `<tr><td style="padding:8px 0;border-top:1px solid #d3dcd9">${label}</td><td align="right" style="padding:8px 0;border-top:1px solid #d3dcd9;color:#0f1a1f;font-weight:600">${esc(value)}</td></tr>`;
  const item = (title: string, body: string) => `<li style="margin:0 0 8px"><strong style="color:#0f1a1f">${title}</strong> ${body}</li>`;
  const sheet = attached
    ? `<p style="margin:8px 0 0">Your inventory is attached as an Excel file. It opens in Excel and Google Sheets, with your score, every row, and dropdowns so you can keep updating it.</p>`
    : `<p style="margin:8px 0 0">Your list is still saved in the browser you used. Open the tool there and download the formatted spreadsheet in one click.</p><p style="margin:16px 0 0">${button(`${SITE}/inventory#results`, "Download my spreadsheet")}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f1a1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d3dcd9;border-radius:8px">
<tr><td style="padding:28px 28px 0"><p style="margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0b6e69;font-weight:600">Dexraflow</p>
<h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;font-weight:600">Your Silent Break Score</h1></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#4f5e5b">
<p style="margin:12px 0 0;font-size:17px;color:#0f1a1f"><strong>${no} of ${total}</strong> of your lead workflows could break and nobody would notice within a day.</p>
<p style="margin:8px 0 0">${verdict}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;font-size:14px">
${row("Workflows listed", total)}${row("Nobody would notice (No)", no)}${row("Not sure", notSure)}${row("No named owner", r.no_owner_count)}${row("Marked to fix", r.fix_count)}${row("Marked to kill", r.kill_count)}${r.leads_at_risk_per_week != null ? row("Leads at risk per week", r.leads_at_risk_per_week) : ""}
</table>
<h2 style="margin:28px 0 0;font-size:17px;color:#0f1a1f">Your spreadsheet</h2>
${sheet}
<h2 style="margin:24px 0 0;font-size:17px;color:#0f1a1f">A checklist for fixing the blind spots</h2>
<ol style="margin:12px 0 0;padding-left:20px">
${item("Give every workflow one named owner.", "A person, not a team. No owner means nobody fixes it.")}
${item("Count what went in and what came out.", "Form fills against leads created, leads created against leads with an owner. Do it per day, per source.")}
${item("Set a minimum volume for each one.", "A workflow that normally moves 40 leads a week and moves zero for a day is broken, whatever its run log says.")}
${item("Send a test lead through every week.", "Check that it reaches the CRM, gets an owner and gets a first touch.")}
${item("Check before you change a field, form or rule.", "Look up which workflows read it first.")}
${item("Kill what you marked to kill.", "A workflow nobody owns and nobody needs is a break waiting to happen.")}
</ol>
<p style="margin:20px 0 0">Want a second pair of eyes on the blind spots? Pick a time for a short call. No pitch deck.</p>
<p style="margin:16px 0 0">${button(BOOKING, "Pick a time", !attached)}</p>
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#4f5e5b">You are getting this because you asked for your spreadsheet on dexraflow.com. Reply to this email to reach us or to stop hearing from us.</p>
</td></tr></table></body></html>`;
  const text = `Your Silent Break Score\n\n${no} of ${total} of your lead workflows could break and nobody would notice within a day. ${verdict}\n\nNot sure: ${notSure}\nNo named owner: ${r.no_owner_count}\nMarked to fix: ${r.fix_count}\nMarked to kill: ${r.kill_count}\n\n${attached ? "Your inventory is attached as an Excel file. It opens in Excel and Google Sheets." : `Your list is still saved in the browser you used. Download the spreadsheet at ${SITE}/inventory#results`}\n\nChecklist:\n1. Give every workflow one named owner.\n2. Count what went in and what came out, per day, per source.\n3. Set a minimum volume for each workflow.\n4. Send a test lead through every week.\n5. Check which workflows read a field, form or rule before you change it.\n6. Kill what you marked to kill.\n\nPick a time for a call: ${BOOKING}`;
  return { subject: `Your Silent Break Score and spreadsheet: ${no} of ${total} workflows could break unnoticed`, html, text };
}

/* ---------- handler ---------- */
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: { kind?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (body.kind !== "report" || !body.id || !UUID.test(body.id)) return json({ error: "bad request" }, 400);
  const id = body.id;

  // Claim the row: only the first caller gets it back, so a row is mailed at most once.
  const { data: row, error } = await db.from("inventory_submissions").update({ report_sent_at: new Date().toISOString(), report_error: null }).eq("id", id).is("report_sent_at", null).select().maybeSingle();
  if (error) return json({ error: "lookup failed" }, 500);
  if (!row) return json({ ok: true, skipped: "already sent or not found" });
  const release = (reason: string) => db.from("inventory_submissions").update({ report_sent_at: null, report_error: reason.slice(0, 500) }).eq("id", id);

  // Build the attachment first, so a workbook problem is visible even before email is switched on.
  let attachment: { filename: string; content: string } | null = null;
  let sheetNote = "no workflow rows on this submission";
  const rows = sheetRows(row.workflows);
  if (rows.length) {
    try {
      const bytes = await buildWorkbook(rows, row);
      attachment = { filename: `dexraflow-workflow-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`, content: encodeBase64(bytes) };
      sheetNote = `spreadsheet built, ${rows.length} rows, ${bytes.length} bytes`;
    } catch (e) {
      sheetNote = `spreadsheet failed: ${String(e).slice(0, 200)}`;
    }
  }

  if (!KEY) {
    await release(`RESEND_API_KEY is not set (${sheetNote})`);
    return json({ ok: false, skipped: "RESEND_API_KEY is not set", sheet: sheetNote });
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [row.email], ...reportEmail(row, !!attachment), ...(attachment ? { attachments: [attachment] } : {}) }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
    if (!attachment && rows.length) await db.from("inventory_submissions").update({ report_error: `sent without attachment: ${sheetNote}` }).eq("id", id);
    return json({ ok: true, sheet: sheetNote });
  } catch (e) {
    await release(String(e));
    return json({ ok: false, error: "send failed" }, 502);
  }
});
