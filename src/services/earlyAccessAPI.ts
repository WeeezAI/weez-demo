// src/services/earlyAccessAPI.ts
//
// Early-access and founder-conversation requests from the landing page.
//
// There is no dedicated endpoint for these yet, so both ride the existing public
// lead-capture route the site already uses — `POST /demo/request` on the poster
// pipeline, which emails the team via SES (see backend `api/demo.py`). That route's
// model only knows `name / position / company / businessEmail / phone` and silently
// drops anything else, so the fields it has no column for (intent, LinkedIn, the
// free-text note) are folded into `position` to reach the inbox intact.
//
// The structured fields are sent alongside as well. Once the backend model grows
// `intent`, `role`, `linkedin` and `note`, it can read them directly and the folding
// in `toLegacyPosition` can be deleted — this file is the only place that changes.

import CONFIG from "./config";

export type AccessIntent = "early-access" | "founder-conversation";

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

const INTENT_LABEL: Record<AccessIntent, string> = {
  "early-access": "Early access",
  "founder-conversation": "Founder conversation",
};

const toLegacyPosition = (req: AccessRequest): string =>
  [
    `[${INTENT_LABEL[req.intent]}] ${req.role}`,
    req.linkedin ? `LinkedIn: ${req.linkedin}` : "",
    req.note ? `Note: ${req.note}` : "",
  ]
    .filter(Boolean)
    .join(" — ");

export async function submitAccessRequest(req: AccessRequest): Promise<void> {
  const resp = await fetch(`${CONFIG.WEEZ_BASE_URL}/demo/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Fields the current endpoint reads.
      name: req.name,
      company: req.company,
      businessEmail: req.email,
      position: toLegacyPosition(req),
      phone: "",
      // Structured fields for when the endpoint learns them.
      intent: req.intent,
      role: req.role,
      linkedin: req.linkedin ?? "",
      note: req.note ?? "",
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.detail || "Something went wrong. Please try again.");
  }
}
