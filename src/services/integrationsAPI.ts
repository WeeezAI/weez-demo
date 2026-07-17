// src/services/integrationsAPI.ts
//
// Mailbox + calendar integrations (Gmail / Outlook + Google / Microsoft
// Calendar). These live on the MAIN backend (WEEZ_BASE_URL) — not the external
// platform-connection service — because Max uses the stored connection to send
// outbound email and book meetings.
//
// OAuth is backend-driven (same pattern as LinkedIn): the browser navigates to
// `/integrations/{provider}/authorize`, the backend redirects to the provider's
// consent screen, and the callback bounces back to `/platform/success`.

import CONFIG from "./config";

const BASE = `${CONFIG.WEEZ_BASE_URL}/integrations`;

// UI provider keys — a single Google connection powers both gmail + google_calendar;
// a single Microsoft connection powers both outlook + microsoft_calendar.
export type IntegrationProviderKey =
  | "gmail"
  | "outlook"
  | "google_calendar"
  | "microsoft_calendar";

export const INTEGRATION_PROVIDER_KEYS: IntegrationProviderKey[] = [
  "gmail",
  "outlook",
  "google_calendar",
  "microsoft_calendar",
];

export interface IntegrationConnection {
  provider: string; // canonical: "google" | "microsoft"
  email?: string;
  displayName?: string;
  capabilities: string[];
  connected: boolean;
  connectedAt?: string;
  updatedAt?: string;
}

export interface IntegrationsStatus {
  connections: IntegrationConnection[];
  connected: Record<string, boolean>; // { gmail, google_calendar, outlook, microsoft_calendar }
}

export const integrationsAPI = {
  /** The backend authorize URL to navigate the browser to (starts OAuth). */
  authorizeUrl(spaceId: string, provider: string): string {
    return `${BASE}/${provider}/authorize?brand_id=${encodeURIComponent(spaceId)}`;
  },

  /** Kick off the OAuth consent flow for a provider. */
  startConnect(spaceId: string, provider: string): void {
    window.location.href = this.authorizeUrl(spaceId, provider);
  },

  /** Connected mailbox/calendar providers for a space (+ a UI-key map). */
  async getStatus(spaceId: string, token: string): Promise<IntegrationsStatus> {
    try {
      const res = await fetch(`${BASE}/status?brand_id=${encodeURIComponent(spaceId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "69420",
        },
      });
      if (!res.ok) return { connections: [], connected: {} };
      return (await res.json()) as IntegrationsStatus;
    } catch (e) {
      console.error("Failed to load integrations status:", e);
      return { connections: [], connected: {} };
    }
  },

  /** Disconnect a provider (google | microsoft, or any UI alias). */
  async disconnect(spaceId: string, provider: string, token: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE}/${provider}/disconnect?brand_id=${encodeURIComponent(spaceId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.disconnected;
    } catch (e) {
      console.error("Failed to disconnect integration:", e);
      return false;
    }
  },
};

export default integrationsAPI;
