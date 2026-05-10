// src/services/salesAPI.ts
//
// Sales Assistant API Client
// ──────────────────────────────────────────────────────────────────────────────
// Handles all communication with the Sales Assistant and HubSpot endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import CONFIG from "./config";

const BASE = CONFIG.WEEZ_BASE_URL;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Types ───────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  brand_id: string;
  source_type: string;
  source_detail: string | null;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  profile_image_url: string | null;
  lead_score: number;
  priority: number;
  intent_class: string | null;
  signal_reasoning: string | null;
  exclusion_passed: boolean;
  icp_passed: boolean;
  intent_passed: boolean;
  hubspot_contact_id: string | null;
  hubspot_company_id: string | null;
  hubspot_deal_id: string | null;
  hubspot_synced_at: string | null;
  hubspot_contact_url: string | null;
  attribution: string;
  attribution_confirmed: boolean;
  was_in_pipeline: boolean;
  already_known: boolean;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadStats {
  period_days: number;
  total_leads: number;
  by_status: {
    new: number;
    reviewed: number;
    contacted: number;
    qualified: number;
    converted: number;
    archived: number;
  };
  by_priority: {
    p1_high_intent: number;
    p2_referral: number;
    p3_question: number;
  };
  by_attribution: {
    platform: number;
    user: number;
    both: number;
  };
  unconfirmed_attributions: number;
  synced_to_hubspot: number;
  avg_lead_score: number;
}

export interface HubSpotStatus {
  connected: boolean;
  brand_id: string;
  token_valid?: boolean;
  expires_at?: string | null;
}

export interface LeadListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Lead[];
}

// ── Lead Endpoints ──────────────────────────────────────────────────────

export async function getLeads(
  brandId: string,
  filters: {
    status?: string;
    source_type?: string;
    priority?: number;
    min_score?: number;
    attribution?: string;
    unconfirmed_only?: boolean;
    page?: number;
    page_size?: number;
  } = {}
): Promise<LeadListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.source_type) params.set("source_type", filters.source_type);
  if (filters.priority) params.set("priority", String(filters.priority));
  if (filters.min_score) params.set("min_score", String(filters.min_score));
  if (filters.attribution) params.set("attribution", filters.attribution);
  if (filters.unconfirmed_only) params.set("unconfirmed_only", "true");
  params.set("page", String(filters.page || 1));
  params.set("page_size", String(filters.page_size || 20));

  const resp = await fetch(
    `${BASE}/sales/${brandId}/leads?${params.toString()}`,
    { headers: authHeaders() }
  );
  if (!resp.ok) throw new Error(`Failed to fetch leads: ${resp.status}`);
  return resp.json();
}

export async function getLeadDetails(
  brandId: string,
  leadId: string
): Promise<Lead> {
  const resp = await fetch(`${BASE}/sales/${brandId}/leads/${leadId}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Failed to fetch lead: ${resp.status}`);
  return resp.json();
}

export async function confirmAttribution(
  brandId: string,
  leadId: string,
  data: {
    already_known: boolean;
    was_in_pipeline: boolean;
    attribution: string;
  }
): Promise<{ status: string; lead_id: string; attribution: string }> {
  const resp = await fetch(
    `${BASE}/sales/${brandId}/leads/${leadId}/confirm-attribution`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!resp.ok) throw new Error(`Attribution confirmation failed: ${resp.status}`);
  return resp.json();
}

export async function updateLead(
  brandId: string,
  leadId: string,
  data: { status?: string; notes?: string }
): Promise<{ status: string }> {
  const resp = await fetch(`${BASE}/sales/${brandId}/leads/${leadId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Lead update failed: ${resp.status}`);
  return resp.json();
}

export async function createManualLead(
  brandId: string,
  data: {
    name: string;
    company?: string;
    role?: string;
    email?: string;
    linkedin_url?: string;
    notes?: string;
  }
): Promise<{ status: string; lead_id: string }> {
  const resp = await fetch(`${BASE}/sales/${brandId}/leads`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Manual lead creation failed: ${resp.status}`);
  return resp.json();
}

export async function syncToHubSpot(
  brandId: string,
  leadId: string
): Promise<{
  status: string;
  hubspot_contact_id: string | null;
  hubspot_company_id: string | null;
  hubspot_contact_url: string | null;
}> {
  const resp = await fetch(
    `${BASE}/sales/${brandId}/leads/${leadId}/sync-hubspot`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
  if (!resp.ok) throw new Error(`HubSpot sync failed: ${resp.status}`);
  return resp.json();
}

export async function scanForLeads(
  brandId: string
): Promise<{ status: string; leads_created: number }> {
  const resp = await fetch(`${BASE}/sales/${brandId}/leads/scan`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Lead scan failed: ${resp.status}`);
  return resp.json();
}

// ── Stats ───────────────────────────────────────────────────────────────

export async function getLeadStats(
  brandId: string,
  days: number = 30
): Promise<LeadStats> {
  const resp = await fetch(
    `${BASE}/sales/${brandId}/leads/stats?days=${days}`,
    { headers: authHeaders() }
  );
  if (!resp.ok) throw new Error(`Failed to fetch lead stats: ${resp.status}`);
  return resp.json();
}

// ── HubSpot ─────────────────────────────────────────────────────────────

export async function getHubSpotStatus(
  brandId: string
): Promise<HubSpotStatus> {
  const resp = await fetch(`${BASE}/hubspot/${brandId}/status`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`HubSpot status check failed: ${resp.status}`);
  return resp.json();
}

export function getHubSpotAuthorizeUrl(brandId: string): string {
  return `${BASE}/hubspot/authorize?brand_id=${brandId}`;
}

export async function disconnectHubSpot(
  brandId: string
): Promise<{ status: string }> {
  const resp = await fetch(`${BASE}/hubspot/${brandId}/disconnect`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`HubSpot disconnect failed: ${resp.status}`);
  return resp.json();
}

// ── WebSocket ───────────────────────────────────────────────────────────

export function connectLeadWebSocket(
  brandId: string,
  onMessage: (data: any) => void
): WebSocket {
  const wsUrl = BASE.replace("https://", "wss://").replace("http://", "ws://");
  const ws = new WebSocket(`${wsUrl}/ws/leads/${brandId}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type !== "pong") {
        onMessage(data);
      }
    } catch {
      // ignore
    }
  };

  // Keepalive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);

  ws.onclose = () => clearInterval(pingInterval);
  ws.onerror = () => clearInterval(pingInterval);

  return ws;
}
