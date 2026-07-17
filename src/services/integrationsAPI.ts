// src/services/integrationsAPI.ts
//
// Mailbox + Calendar integrations (Gmail / Outlook + Google / Microsoft Calendar).
// ──────────────────────────────────────────────────────────────────────────────
// These hit the MAIN poster-pipeline backend's `/integrations/*` OAuth API — the
// same connection Max uses to send outbound email — instead of the old
// localhost:3000 engagement endpoints. A single Google connection grants Gmail
// send + Google Calendar; a single Microsoft connection grants Outlook + Calendar.
// ──────────────────────────────────────────────────────────────────────────────

import CONFIG from "./config";

const BASE = CONFIG.WEEZ_BASE_URL;

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface IntegrationConnection {
  provider: string; // canonical: "google" | "microsoft"
  email?: string;
  displayName?: string;
  capabilities?: string[];
  connected: boolean;
}

export interface IntegrationsStatus {
  connections: IntegrationConnection[];
  // UI-key map from the backend (gmail/outlook/*_calendar → connected).
  connected: {
    gmail: boolean;
    outlook: boolean;
    google_calendar: boolean;
    microsoft_calendar: boolean;
  };
}

/** Connected mailbox/calendar providers for a brand. */
export async function getIntegrationsStatus(brandId: string): Promise<IntegrationsStatus> {
  const resp = await fetch(`${BASE}/integrations/status?brand_id=${brandId}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Integrations status failed: ${resp.status}`);
  return resp.json();
}

/**
 * Browser-navigation URL that starts the OAuth consent flow. Public GET redirect
 * (no auth header needed) — use with `window.location.href`.
 * `provider` accepts the friendly keys gmail | outlook | google_calendar | microsoft_calendar.
 */
export function getIntegrationAuthorizeUrl(provider: string, brandId: string): string {
  return `${BASE}/integrations/${provider}/authorize?brand_id=${brandId}`;
}

/** Remove a stored mailbox/calendar connection. */
export async function disconnectIntegration(
  provider: string,
  brandId: string
): Promise<{ disconnected: boolean; provider: string }> {
  const resp = await fetch(`${BASE}/integrations/${provider}/disconnect?brand_id=${brandId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Integration disconnect failed: ${resp.status}`);
  return resp.json();
}
