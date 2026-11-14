/* The downloadable "GTM Workflow Inventory" workbook: dark title band, score line, teal header row,
   hint row, coloured answer cells and dropdowns. Mirrors the Dexraflow Google Sheets template.
   ExcelJS is large, so it is imported on demand by downloadWorkbook(). */
import { DECISION_LABELS, FINDOUT_LABELS, NOTICE_LABELS, named, type Score, type Workflow } from "./inventory";

const TITLE = "GTM Workflow Inventory";
const SUBTITLE = "Would anyone notice if it broke? List every workflow that touches a lead or deal, then answer honestly.   |   Template by Dexraflow";
const COLUMNS: { head: string; hint: string; width: number }[] = [
  { head: "Workflow name", hint: "Name it so a new hire would recognise it", width: 30 },
  { head: "Tool (HubSpot / Salesforce / Zapier / other)", hint: "HubSpot, Salesforce, Zapier, Make, Clay...", width: 24 },
  { head: "What it does (one line)", hint: "What it does, in one line", width: 34 },
  { head: "What triggers it", hint: "Form submit, new contact, field change, schedule", width: 30 },
  { head: "Owner (who fixes it)", hint: "A named person, not a team", width: 22 },
  { head: "Last changed", hint: "Month and year, rough is fine", width: 15 },
  { head: "If it broke, would anyone notice within a day? (Yes / No / Not sure)", hint: "Pick Yes, No or Not sure", width: 24 },
  { head: "How would we find out?", hint: "Alert, report, a rep complains, or we wouldn't", width: 28 },
  { head: "Leads or deals it touches per week", hint: "A rough number is fine", width: 16 },
  { head: "Keep / Fix / Kill", hint: "Pick Keep, Fix or Kill", width: 16 },
];
const NOTICE_COL = 7, DECISION_COL = 10, CENTERED = new Set([6, 7, 9, 10]);

export const sheetRows = (ws: Workflow[]) =>
  named(ws).map((w) => [
    w.name.trim(), w.tool || "", w.does || "", w.trigger || "", w.owner || "", w.lastChanged || "",
    w.notice ? NOTICE_LABELS[w.notice] : "", w.findOut ? FINDOUT_LABELS[w.findOut] : "",
    Number.isFinite(w.leadsPerWeek) ? (w.leadsPerWeek as number) : "", w.decision ? DECISION_LABELS[w.decision] : "",
  ]);

export function xlsxFilename(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `dexraflow-workflow-inventory-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.xlsx`;
}

const C = {
  ink: "FF0F1A1F", night: "FF0C1315", brand: "FF0B6E69", brandNight: "FF3BBFAF", amber: "FFE8962E", amberInk: "FFB86A0C",
  amberSoft: "FFFCEFDC", amberPale: "FFFDF6EA", tealSoft: "FFDCEFEC", greenSoft: "FFE3F2EA", green: "FF1E7A4A", redSoft: "FFFBE7E5", red: "FFB8322B",
  surface: "FFF5F7F6", sunken: "FFE9EEEC", line: "FFD3DCD9", muted: "FF4F5E5B", white: "FFFFFFFF", pale: "FFE6EEEC",
};
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: C.line } };
const font = (o: Record<string, unknown>) => ({ name: "Arial", size: 11, ...o });

export async function buildWorkbook(workflows: Workflow[], s: Score) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dexraflow";
  const ws = wb.addWorksheet("Inventory", { views: [{ state: "frozen", ySplit: 6, showGridLines: false }] });
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));
  const cols = COLUMNS.length;
  const band = (n: number, height: number) => {
    const r = ws.getRow(n);
    r.height = height;
    for (let c = 1; c <= cols; c++) r.getCell(c).fill = fill(C.night);
    return r;
  };

  const r1 = band(1, 36);
  ws.mergeCells(1, 1, 1, cols);
  Object.assign(r1.getCell(1), { value: TITLE, font: font({ size: 22, bold: true, color: { argb: C.white } }), alignment: { vertical: "middle", indent: 1 } });
  const r2 = band(2, 22);
  ws.mergeCells(2, 1, 2, cols);
  Object.assign(r2.getCell(1), { value: SUBTITLE, font: font({ color: { argb: C.brandNight } }), alignment: { vertical: "middle", indent: 1 } });
  const r3 = band(3, 34);
  ws.mergeCells(3, 1, 3, 6);
  ws.mergeCells(3, 7, 3, cols);
  Object.assign(r3.getCell(1), { value: `${s.no} of ${s.total} workflows could break and nobody would notice within a day`, font: font({ size: 13, bold: true, color: { argb: C.amber } }), alignment: { vertical: "middle", indent: 1 } });
  Object.assign(r3.getCell(7), { value: `Not sure: ${s.notSure}     To fix: ${s.fix}     To kill: ${s.kill}`, font: font({ color: { argb: C.pale } }), alignment: { vertical: "middle", horizontal: "right", indent: 1 } });
  ws.getRow(4).height = 8;

  const head = ws.getRow(5);
  head.height = 64;
  const hint = ws.getRow(6);
  hint.height = 30;
  COLUMNS.forEach((col, i) => {
    Object.assign(head.getCell(i + 1), { value: col.head, fill: fill(C.brand), font: font({ bold: true, color: { argb: C.white } }), alignment: { vertical: "middle", wrapText: true } });
    Object.assign(hint.getCell(i + 1), { value: col.hint, fill: fill(C.sunken), font: font({ size: 9, italic: true, color: { argb: C.muted } }), alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(i + 1) ? "center" : "left" }, border: { bottom: { style: "medium", color: { argb: C.line } } } });
  });

  const noticeStyle: Record<string, [string, string, boolean]> = { No: [C.amberSoft, C.amberInk, true], "Not sure": [C.amberPale, C.amberInk, false], Yes: [C.tealSoft, C.brand, true] };
  const decisionStyle: Record<string, [string, string, boolean]> = { Keep: [C.greenSoft, C.green, false], Fix: [C.amberSoft, C.amberInk, true], Kill: [C.redSoft, C.red, true] };
  const rows = sheetRows(workflows);
  rows.forEach((vals, i) => {
    const r = ws.getRow(7 + i);
    r.height = 34;
    vals.forEach((v, j) => {
      Object.assign(r.getCell(j + 1), { value: v, font: font({ color: { argb: C.ink } }), fill: fill(i % 2 ? C.white : C.surface), border: { bottom: thin }, alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(j + 1) ? "center" : "left" } });
    });
    const notice = String(vals[NOTICE_COL - 1]), decision = String(vals[DECISION_COL - 1]);
    r.getCell(1).font = font({ bold: true, color: { argb: notice === "No" ? C.amberInk : C.ink } });
    if (noticeStyle[notice]) {
      const [bg, fg, bold] = noticeStyle[notice];
      Object.assign(r.getCell(NOTICE_COL), { fill: fill(bg), font: font({ bold, color: { argb: fg } }) });
    }
    if (decisionStyle[decision]) {
      const [bg, fg, bold] = decisionStyle[decision];
      Object.assign(r.getCell(DECISION_COL), { fill: fill(bg), font: font({ bold, color: { argb: fg } }) });
    }
  });

  // Dropdowns on the two pick columns, for the filled rows plus 30 spare ones to keep adding to.
  for (let n = 7; n < 7 + rows.length + 30; n++) {
    const r = ws.getRow(n);
    if (n >= 7 + rows.length) {
      r.height = 34;
      for (let c = 1; c <= cols; c++) Object.assign(r.getCell(c), { border: { bottom: thin }, font: font({ color: { argb: C.ink } }), alignment: { vertical: "middle", wrapText: true, horizontal: CENTERED.has(c) ? "center" : "left" } });
    }
    r.getCell(NOTICE_COL).dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No,Not sure"'] };
    r.getCell(DECISION_COL).dataValidation = { type: "list", allowBlank: true, formulae: ['"Keep,Fix,Kill"'] };
  }
  return wb;
}

export async function downloadWorkbook(workflows: Workflow[], s: Score) {
  const wb = await buildWorkbook(workflows, s);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = xlsxFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
