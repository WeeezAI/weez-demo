// src/services/inventoryAPI.ts
//
// The /inventory page's one call into the "Dexraflow-Form" Supabase project: the Silent Break Score
// summary and workflow rows go to public.inventory_submissions, and a database trigger then emails
// the report with the spreadsheet attached.
// (Call booking is the founder's Google Calendar appointment page, embedded on the page.)

import { supabase } from "./supabase";
import type { buildPayload } from "@/lib/inventory";

export async function submitInventory(row: ReturnType<typeof buildPayload>): Promise<void> {
  if (!supabase) throw new Error("unavailable");
  const { error } = await supabase.from("inventory_submissions").insert(row);
  if (error) throw new Error(error.message);
}
