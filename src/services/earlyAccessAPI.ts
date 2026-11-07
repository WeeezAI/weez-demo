// src/services/earlyAccessAPI.ts
//
// Requests from the landing page forms (Missed Pipeline Audit, early access, founder
// conversation). Each one is inserted straight into `public.access_requests` in the
// "Dexraflow-Form" Supabase project, where the team triages them (every row starts with
// status = 'new'). The old poster-pipeline endpoint this used to post to is stopped.

import { supabase } from "./supabase";

export type AccessIntent = "early-access" | "founder-conversation" | "audit";

export interface AccessRequest {
  intent: AccessIntent;
  name: string;
  email: string;
  company: string;
  role: string;
  linkedin?: string;
  note?: string;
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TABLE = "access_requests";
const FALLBACK = "We couldn't send your request just now.";

/** Where the visitor came from, so inbound can be attributed. All optional, all trimmed to the column limits. */
function attribution() {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const cut = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);
  return {
    source_page: cut(window.location.pathname + window.location.hash, 300),
    referrer: cut(document.referrer, 500),
    utm_source: cut(q.get("utm_source"), 120),
    utm_medium: cut(q.get("utm_medium"), 120),
    utm_campaign: cut(q.get("utm_campaign"), 120),
    user_agent: cut(navigator.userAgent, 500),
  };
}

export async function submitAccessRequest(req: AccessRequest): Promise<void> {
  if (!supabase) throw new Error(FALLBACK);
  const { error } = await supabase.from(TABLE).insert({
    intent: req.intent,
    name: req.name,
    email: req.email,
    company: req.company,
    role: req.role,
    linkedin: req.linkedin ?? null,
    note: req.note ?? null,
    ...attribution(),
  });
  if (error) {
    // A check constraint (e.g. a malformed email) is the only error worth surfacing as the visitor's own.
    const theirs = error.code === "23514" ? "Please check the details you entered." : "";
    throw new Error(theirs || FALLBACK);
  }
}
