// services/commentResponseAPI.ts
//
// Frontend API service for the LinkedIn Comment Response System.
// Follows the existing fetchWithBypass pattern from linkedinAnalyticsAPI.ts.

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

// ── Types ───────────────────────────────────────────────────────────────

export type IntentClass =
  | "HIGH_INTENT_LEAD"
  | "QUESTION"
  | "POSITIVE_SENTIMENT"
  | "NEGATIVE_SENTIMENT"
  | "SPAM"
  | "COMPETITOR_MENTION"
  | "REFERRAL"
  | "IGNORE";

export interface TrackedCommentDTO {
  id: string;
  post_urn: string;
  comment_urn: string;
  actor_urn: string | null;
  actor_name: string | null;
  actor_headline: string | null;
  actor_profile_url: string | null;
  message_text: string | null;
  created_at_li: string | null;
  intent_class: IntentClass | null;
  confidence: number | null;
  lead_score: number | null;
  reply_urgency: string | null;
  should_reply: boolean;
  status: string;
  generated_reply: string | null;
  edited_reply: string | null;
  posted_reply_urn: string | null;
  replied_at: string | null;
  human_reviewed_at: string | null;
  synced_to_crm: boolean;
  error_message: string | null;
  created_at: string | null;
}

export interface CommentReplyConfigDTO {
  auto_reply_enabled: boolean;
  reply_as_org_on_org_posts: boolean;
  max_replies_per_hour: number;
  max_replies_per_day: number;
  min_delay_seconds: number;
  auto_reply_intents: string[];
  human_review_intents: string[];
  skip_intents: string[];
  persona_tone: string | null;
  persona_context: string | null;
  hubspot_connected: boolean;
  rate_limit_stats: {
    hourly_count: number;
    daily_count: number;
    last_reply_at: number | null;
  };
}

export interface IntentBreakdown {
  intent: IntentClass;
  count: number;
}

export interface CommentAnalyticsDTO {
  period_days: number;
  total_comments: number;
  auto_replies_sent: number;
  pending_review: number;
  skipped: number;
  failed: number;
  auto_reply_rate: number;
  avg_response_time_seconds: number | null;
  avg_response_time_minutes: number | null;
  leads_generated: number;
  intent_breakdown: IntentBreakdown[];
  rate_limit_stats: {
    hourly_count: number;
    daily_count: number;
    last_reply_at: number | null;
  };
}

export interface MonitoredPostDTO {
  id: string;
  post_urn: string;
  post_text_snippet: string | null;
  is_org_post: boolean;
  published_at: string | null;
  last_polled_at: string | null;
  comment_count: number;
  poll_tier: string;
  monitoring_active: boolean;
}

// ── API Methods ─────────────────────────────────────────────────────────

export const commentResponseAPI = {
  /** Get auto-reply configuration */
  getConfig: async (brandId: string): Promise<CommentReplyConfigDTO> => {
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/config`);
    if (!resp.ok) throw new Error("Failed to load config");
    return resp.json();
  },

  /** Update auto-reply configuration */
  updateConfig: async (brandId: string, data: Partial<CommentReplyConfigDTO>): Promise<void> => {
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to update config");
  },

  /** Get human review queue */
  getQueue: async (brandId: string, page = 1): Promise<{ total: number; items: TrackedCommentDTO[] }> => {
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/queue?page=${page}`);
    if (!resp.ok) throw new Error("Failed to load queue");
    return resp.json();
  },

  /** Approve a comment reply */
  approveComment: async (brandId: string, commentId: string, editedReply?: string): Promise<any> => {
    const resp = await fetchWithBypass(
      `${WEEZ_BASE_URL}/comment-response/${brandId}/queue/${commentId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_reply: editedReply || null }),
      }
    );
    if (!resp.ok) throw new Error("Failed to approve");
    return resp.json();
  },

  /** Reject a comment */
  rejectComment: async (brandId: string, commentId: string): Promise<any> => {
    const resp = await fetchWithBypass(
      `${WEEZ_BASE_URL}/comment-response/${brandId}/queue/${commentId}/reject`,
      { method: "POST" }
    );
    if (!resp.ok) throw new Error("Failed to reject");
    return resp.json();
  },

  /** Browse all tracked comments */
  getComments: async (
    brandId: string,
    opts: { status?: string; intent?: string; page?: number } = {}
  ): Promise<{ total: number; items: TrackedCommentDTO[] }> => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.intent) params.set("intent", opts.intent);
    if (opts.page) params.set("page", String(opts.page));
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/comments?${params}`);
    if (!resp.ok) throw new Error("Failed to load comments");
    return resp.json();
  },

  /** Get analytics */
  getAnalytics: async (brandId: string, days = 30): Promise<CommentAnalyticsDTO> => {
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/analytics?days=${days}`);
    if (!resp.ok) throw new Error("Failed to load analytics");
    return resp.json();
  },

  /** Get monitored posts */
  getMonitoredPosts: async (brandId: string): Promise<{ total: number; posts: MonitoredPostDTO[] }> => {
    const resp = await fetchWithBypass(`${WEEZ_BASE_URL}/comment-response/${brandId}/monitored-posts`);
    if (!resp.ok) throw new Error("Failed to load monitored posts");
    return resp.json();
  },
};
