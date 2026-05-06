// services/linkedinAnalyticsAPI.ts
//
// Frontend API service for LinkedIn Analytics dashboard.
// Follows the existing fetchWithBypass pattern from weezAPI.ts.

const WEEZ_BASE_URL = "https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net";

const fetchWithBypass = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem("token");
  const headers = {
    ...options.headers,
    "ngrok-skip-browser-warning": "69420",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
};

export interface HighlightCard {
  icon: string;
  label: string;
  metric_key: string;
  current: number | string;
  previous: number | string;
  delta: number;
  delta_pct: number;
  direction: "up" | "down" | "flat";
  suffix?: string;
  is_text?: boolean;
}

export interface PostMetric {
  post_urn: string;
  text_snippet: string;
  content_type: string;
  posted_at: string;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  is_org_post: boolean;
  is_top_performing?: boolean;
}

export interface ContentBreakdown {
  content_type: string;
  count: number;
  total_impressions: number;
  total_reactions: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
}

export interface HeatmapEntry {
  day: string;
  day_index: number;
  hour: number;
  avg_engagement_rate: number;
  post_count: number;
}

export interface BenchmarkData {
  client_rate: number;
  benchmark_rate: number;
  multiplier: number;
  status: "above" | "below" | "at";
  label: string;
}

export interface Recommendation {
  icon: string;
  title: string;
  description: string;
}

export interface ValueInsight {
  icon: string;
  text: string;
}

export interface LinkedInDashboardData {
  brand_id: string;
  period: string;
  person_urn: string | null;
  org_urn: string | null;
  person_name: string | null;
  org_name: string | null;
  highlights: HighlightCard[];
  individual: {
    posts: PostMetric[];
    post_count: number;
    total_impressions: number;
    total_reactions: number;
    total_comments: number;
    total_shares: number;
  };
  content_breakdown: ContentBreakdown[];
  heatmap: HeatmapEntry[];
  best_day: string;
  organization: {
    followers: any;
    page_stats: any;
    share_stats: any;
    posts: PostMetric[];
    demographics: Record<string, Record<string, number>>;
  };
  benchmark: BenchmarkData;
  decision_maker_pct: number;
  lead_intelligence: {
    available: boolean;
    message: string;
    insights: ValueInsight[];
  };
  recommendations: Recommendation[];
  top_post: PostMetric | null;
}

export type Period = "7d" | "30d" | "90d" | "custom";

export const linkedinAnalyticsAPI = {
  /**
   * Fetches the full LinkedIn analytics dashboard payload
   */
  getDashboard: async (
    brandId: string,
    period: Period = "30d",
    customStart?: string,
    customEnd?: string
  ): Promise<LinkedInDashboardData> => {
    let url = `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/dashboard?period=${period}`;
    if (period === "custom" && customStart && customEnd) {
      url += `&custom_start=${customStart}&custom_end=${customEnd}`;
    }
    const response = await fetchWithBypass(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to load dashboard" }));
      throw new Error(err.detail || "Dashboard load failed");
    }
    return await response.json();
  },

  /**
   * Fetches individual post performance table
   */
  getIndividualPosts: async (
    brandId: string,
    period: Period = "30d",
    customStart?: string,
    customEnd?: string
  ): Promise<{ posts: PostMetric[]; avg_engagement_rate: number; count: number }> => {
    let url = `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/individual/posts?period=${period}`;
    if (period === "custom" && customStart && customEnd) {
      url += `&custom_start=${customStart}&custom_end=${customEnd}`;
    }
    const response = await fetchWithBypass(url);
    if (!response.ok) throw new Error("Failed to fetch posts");
    return await response.json();
  },

  /**
   * Fetches best-time-to-post heatmap data
   */
  getHeatmapData: async (
    brandId: string
  ): Promise<{ heatmap: HeatmapEntry[]; best_day: string }> => {
    const response = await fetchWithBypass(
      `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/individual/heatmap`
    );
    if (!response.ok) throw new Error("Failed to fetch heatmap");
    return await response.json();
  },

  /**
   * Fetches org follower analytics with demographics
   */
  getOrgFollowers: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(
      `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/org/followers`
    );
    if (!response.ok) throw new Error("Failed to fetch org followers");
    return await response.json();
  },

  /**
   * Fetches org page visitor analytics
   */
  getOrgVisitors: async (
    brandId: string,
    period: Period = "30d",
    customStart?: string,
    customEnd?: string
  ): Promise<any> => {
    let url = `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/org/visitors?period=${period}`;
    if (period === "custom" && customStart && customEnd) {
      url += `&custom_start=${customStart}&custom_end=${customEnd}`;
    }
    const response = await fetchWithBypass(url);
    if (!response.ok) throw new Error("Failed to fetch visitors");
    return await response.json();
  },

  /**
   * Fetches org content/post analytics
   */
  getOrgContent: async (
    brandId: string,
    period: Period = "30d",
    customStart?: string,
    customEnd?: string
  ): Promise<any> => {
    let url = `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/org/content?period=${period}`;
    if (period === "custom" && customStart && customEnd) {
      url += `&custom_start=${customStart}&custom_end=${customEnd}`;
    }
    const response = await fetchWithBypass(url);
    if (!response.ok) throw new Error("Failed to fetch content");
    return await response.json();
  },

  /**
   * Fetches engagement rate benchmark
   */
  getBenchmark: async (brandId: string): Promise<BenchmarkData> => {
    const response = await fetchWithBypass(
      `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/org/benchmark`
    );
    if (!response.ok) throw new Error("Failed to fetch benchmark");
    return await response.json();
  },

  /**
   * Triggers a manual analytics sync (clears caches)
   */
  triggerSync: async (brandId: string): Promise<{ status: string; message: string }> => {
    const response = await fetchWithBypass(
      `${WEEZ_BASE_URL}/linkedin-analytics/${brandId}/sync`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error("Sync failed");
    return await response.json();
  },
};
