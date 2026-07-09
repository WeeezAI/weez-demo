// src/services/internalSessionAPI.ts
//
// API client for the Internal LinkedIn Research Account Wizard.
// Talks to the LinkedIn Engagement Intelligence service under
// /api/v1/internal/research-session.
// Reuses the internal JWT token from internalAnalyticsAPI.

import CONFIG from "./config";
import { internalToken } from "./internalAnalyticsAPI";

// The wizard endpoints live on the LinkedIn Engagement Intelligence service.
// In development this is localhost:3000; in production it's the same pipeline.
const ENGAGEMENT_BASE =
  import.meta.env.VITE_ENGAGEMENT_BASE_URL || "http://localhost:3000";
const BASE = `${ENGAGEMENT_BASE}/api/v1/internal/research-session`;

const authHeaders = (): Record<string, string> => {
  const t = internalToken.get();
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "69420",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
};

async function handle(res: Response) {
  if (res.status === 401 || res.status === 403) {
    internalToken.clear();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Session expired. Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

// ---- Types -----------------------------------------------------------------
export interface SessionStatus {
  browser_active: boolean;
  browser_launched_at: string | null;
  profile_exists: boolean;
  profile_dir: string;
  profile_size_bytes: number;
  stored_session_exists: boolean;
  stored_session_cookies: number;
  research_customer_id: string;
  timestamp: string;
}

export interface BrowserLaunchResult {
  status: "launched" | "already_active" | "error";
  message: string;
  profile_dir?: string;
  launched_at?: string;
}

export interface BrowserStatus {
  active: boolean;
  launched_at?: string;
  current_url?: string;
  profile_dir?: string;
  message?: string;
  error?: string;
}

export interface CaptureResult {
  status: "captured" | "error";
  cookies_count?: number;
  storage_state_size?: number;
  is_authenticated?: boolean;
  customer_id?: string;
  captured_at?: string;
  message?: string;
}

export interface CloseResult {
  status: "closed" | "not_active" | "error";
  message: string;
  launched_at?: string;
  closed_at?: string;
}

export interface ProfileResult {
  status: "exported" | "imported" | "error";
  message: string;
  size_bytes?: number;
  encrypted?: boolean;
  exported_at?: string;
  imported_at?: string;
  profile_dir?: string;
}

export interface ValidateResult {
  status: "valid" | "expired" | "error";
  result?: string;
  validated_at?: string;
  customer_id?: string;
  message?: string;
}

// ---- API --------------------------------------------------------------------
export const internalSessionAPI = {
  async getStatus(): Promise<SessionStatus> {
    const res = await fetch(`${BASE}/status`, { headers: authHeaders() });
    return handle(res);
  },

  async launchBrowser(): Promise<BrowserLaunchResult> {
    const res = await fetch(`${BASE}/launch-browser`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async getBrowserStatus(): Promise<BrowserStatus> {
    const res = await fetch(`${BASE}/browser-status`, {
      headers: authHeaders(),
    });
    return handle(res);
  },

  async captureSession(): Promise<CaptureResult> {
    const res = await fetch(`${BASE}/capture-session`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async closeBrowser(): Promise<CloseResult> {
    const res = await fetch(`${BASE}/close-browser`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async uploadProfile(): Promise<ProfileResult> {
    const res = await fetch(`${BASE}/upload-profile`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async downloadProfile(): Promise<ProfileResult> {
    const res = await fetch(`${BASE}/download-profile`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },

  async validateSession(): Promise<ValidateResult> {
    const res = await fetch(`${BASE}/validate`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handle(res);
  },
};

export default internalSessionAPI;
