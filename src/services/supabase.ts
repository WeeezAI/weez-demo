// src/services/supabase.ts
//
// Browser client for the "Dexraflow-Form" Supabase project. It uses the publishable key,
// which is meant to ship to the browser: row-level security decides what it may do
// (today: insert into public.access_requests, nothing else).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Project "Dexraflow-Form". The publishable key is a public, browser-side key by design
// (it ships in the bundle either way); VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// override it for another project or environment.
const PROJECT_URL = "https://hspuqszulbwoywlcvpoc.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_Bit2vK6vzFwb5Lbok3OecQ_egy1UoOl";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || PROJECT_URL;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;
