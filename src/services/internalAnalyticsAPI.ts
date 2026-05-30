// src/services/internalAnalyticsAPI.ts
//
// Client for the INTERNAL (Dexraflow staff only) product-analytics dashboard.
// Talks to the main pipeline API (WEEZ_BASE_URL) under /internal/analytics.
// The internal session token is stored separately from the customer token.

import CONFIG from "./config";

const BASE = `${CONFIG.WEEZ_BASE_URL}/internal/analytics`;
const TOKEN_KEY = "dexra_internal_token";

export const internalToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

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
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// ---- Types -----------------------------------------------------------------
export interface TimeSaved {
  minutes: number;
  hours: number;
  days: number;
  minutes_saved_per_post: number;
}

export interface Overview {
  total_clients: number;
  total_brands: number;
  new_clients_30d: number;
  total_campaigns: number;
  active_campaigns: number;
  completed_campaigns: number;
  posts_created: number;
  posts_published: number;
  posts_deleted_excluded: number;
  avg_posts_per_brand: number;
  time_saved: TimeSaved;
  assumptions: Record<string, any>;
  generated_at: string;
}

export interface GrowthPoint {
  date: string;
  count: number;
}
export interface CumulativePoint {
  date: string;
  total_clients: number;
}
export interface Growth {
  range_days: number;
  start_date: string;
  end_date: string;
  new_signups: GrowthPoint[];
  new_brands: GrowthPoint[];
  posts_created: GrowthPoint[];
  cumulative_clients: CumulativePoint[];
  new_clients_this_period: number;
  new_clients_prev_period: number;
  growth_rate_pct: number;
}

export interface Segments {
  campaign_status: { status: string; count: number }[];
  industries: { industry: string; count: number }[];
}

export interface Engagement {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  impressions: number;
  reach: number;
  total_interactions: number;
}

export interface TopClient {
  brand_id: string;
  brand_name: string;
  space_name: string | null;
  posts_created: number;
  hours_saved: number;
  impressions: number;
  reach: number;
  total_interactions: number;
}

export interface ClientMember {
  email: string;
  name: string | null;
  role: string;
}

export interface ClientRow {
  brand_id: string;
  brand_name: string;
  space_name: string | null;
  industry: string;
  owner_email: string | null;
  owner_name: string | null;
  members: ClientMember[];
  member_count: number;
  created_at: string | null;
  posts_created: number;
  posts_published: number;
  hours_saved: number;
  impressions: number;
  reach: number;
  total_interactions: number;
  avg_engagement_rate: number;
}

export interface Snapshot {
  overview: Overview;
  growth: Growth;
  segments: Segments;
  engagement: Engagement;
  top_clients: TopClient[];
  clients: ClientRow[];
}

// ---- API --------------------------------------------------------------------
export const internalAnalyticsAPI = {
  async login(user_id: string, password: string) {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" },
      body: JSON.stringify({ user_id, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Invalid internal credentials");
    internalToken.set(data.access_token);
    return data;
  },

  logout() {
    internalToken.clear();
  },

  isAuthenticated() {
    return !!internalToken.get();
  },

  async getSnapshot(days = 90): Promise<Snapshot> {
    const res = await fetch(`${BASE}/snapshot?days=${days}`, { headers: authHeaders() });
    return handle(res);
  },
};

export default internalAnalyticsAPI;
