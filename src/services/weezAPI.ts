// services/weezAPI.ts

const WEEZ_BASE_URL = "https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net";

export interface BrandMemoryFacts {
  brand_name?: string;
  brand_summary?: string;
  brand_vision?: string;
  industry?: string;
  business_model?: string;
  location?: string;
  service_or_product?: string[];
  color_schema?: string[];
}

export interface ContentIdea {
  content_type: string;
  template_id: string;
  angle: string;
  headline: string;
  description?: string;
  visual_focus: string;
  placeholders?: Record<string, string>;
  template_layout?: any;
  image_prompt?: string;
  expected_outcome: string;
  impact?: string;
  is_recommended?: boolean;
}

export interface CreativeResponse {
  content_type: string;
  angle: string;
  image_url: string;
  blob_name: string;
  caption: string;
  hashtags: string[];
}

const fetchWithBypass = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem("token");
  const headers = {
    ...options.headers,
    "ngrok-skip-browser-warning": "69420",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
};

export const weezAPI = {
  /**
   * Generates the Instagram OAuth link for a brand (Redirects to Backend first)
   */
  getInstagramAuthUrl: (brandId: string) => {
    const backendRedirectUri = `${WEEZ_BASE_URL}/instagram/callback`;
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=1904435020191340&redirect_uri=${encodeURIComponent(
      backendRedirectUri
    )}&scope=instagram_basic, instagram_content_publish,pages_show_list&response_type=code&state=${brandId}`;
  },

  /**
   * Generates the LinkedIn OAuth authorization URL (Redirects to Backend)
   */
  getLinkedInAuthUrl: (brandId: string) => {
    return `${WEEZ_BASE_URL}/connectors/linkedin/authorize?brand_id=${brandId}`;
  },

  /**
   * Fetches all connector statuses for a brand (Instagram, LinkedIn, Website)
   */
  getConnectorsStatus: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/connectors/status?brand_id=${brandId}`);
    if (!response.ok) throw new Error("Failed to fetch connector status");
    return await response.json();
  },

  /**
   * Connects a website to a brand and triggers analysis
   */
  connectWebsite: async (brandId: string, websiteUrl: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/connectors/website`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, website_url: websiteUrl }),
    });
    if (!response.ok) throw new Error("Failed to connect website");
    return await response.json();
  },

  /**
   * Disconnects LinkedIn from a brand
   */
  disconnectLinkedIn: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/connectors/linkedin/disconnect?brand_id=${brandId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to disconnect LinkedIn");
    return await response.json();
  },


  /**
   * Explicitly triggers the Brand Analysis Pipeline
   */
  triggerAnalysis: async (brandId: string) => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/instagram/analyze?brand_id=${brandId}`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Brand analysis failed");
    return await response.json();
  },

  /**
   * Checks the connection status of Instagram for a brand
   */
  getInstagramStatus: async (brandId: string): Promise<{ connected: boolean; username?: string }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/instagram/status?brand_id=${brandId}`);
    if (!response.ok) return { connected: false };
    try {
      return await response.json();
    } catch {
      return { connected: false };
    }
  },

  /**
   * Fetches content ideas for a brand
   */
  getIdeas: async (brandId: string): Promise<ContentIdea[]> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/ideas?brand_id=${brandId}`);
    if (!response.ok) throw new Error("Failed to fetch ideas");
    const data = await response.json();
    return data.ideas || [];
  },

  /**
   * Refreshes content ideas using brand memory
   */
  refreshIdeas: async (brandId: string): Promise<ContentIdea[]> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/ideas/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId }),
    });
    if (!response.ok) throw new Error("Failed to refresh ideas");
    const data = await response.json();
    return data.ideas || [];
  },

  /**
   * Generates a poster and caption from a selected idea
   */
  generateFromIdea: async (
    brandId: string,
    idea: ContentIdea,
    aspectRatio: string = "1:1",
    imageModel: string = "gpt-image-2"
  ): Promise<CreativeResponse> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/generate-from-idea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_id: brandId,
        idea,
        aspect_ratio: aspectRatio,
        image_model: imageModel,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Generation failed" }));
      throw new Error(err.detail || "Failed to generate creative");
    }
    return await response.json();
  },

  /**
   * Generates a poster from a custom user prompt (aligned to brand memory)
   */
  generateFromPrompt: async (
    brandId: string,
    userPrompt: string,
    aspectRatio: string = "1:1",
    imageModel: string = "gpt-image-2"
  ): Promise<CreativeResponse> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/generate-from-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_id: brandId,
        user_prompt: userPrompt,
        aspect_ratio: aspectRatio,
        image_model: imageModel,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Generation failed" }));
      throw new Error(err.detail || "Strategic alignment failed");
    }
    return await response.json();
  },

  /**
   * Fetches all generated posters for the brand gallery
   */
  getGallery: async (brandId: string): Promise<any[]> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/gallery?brand_id=${brandId}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.posters || [];
  },

  /**
   * Approves a creative and publishes it to Instagram
   */
  approveAndPost: async (
    brandId: string,
    creative: { image_url: string; blob_name: string; caption: string; hashtags: string[] }
  ): Promise<{ post_id: string; status: string }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/approve-and-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_id: brandId,
        image_url: creative.image_url,
        blob_name: creative.blob_name,
        caption: creative.caption,
        hashtags: creative.hashtags,
      }),
    });
    if (!response.ok) throw new Error("Failed to post to Instagram");
    return await response.json();
  },

  /**
   * Edits an existing generated poster using gpt-image-1.5
   */
  editPoster: async (
    brandId: string,
    blobName: string,
    editPrompt: string,
    aspectRatio: string = "1:1"
  ): Promise<{ image_url: string; blob_name: string }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_id: brandId,
        blob_name: blobName,
        edit_prompt: editPrompt,
        aspect_ratio: aspectRatio,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Edit failed" }));
      throw new Error(err.detail || "Failed to edit creative");
    }
    return await response.json();
  },

  /**
   * Fetches historical analytics for a brand
   */
  getAnalytics: async (brandId: string, limit: number = 7): Promise<any[]> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/instagram/analytics?brand_id=${brandId}&limit=${limit}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (!response.ok) {
        throw new Error(data.message || data.detail || "Failed to fetch analytics");
      }
      return data;
    } catch (e: any) {
      if (text.includes("<!DOCTYPE html>")) {
        throw new Error("Server returned HTML (Check Ngrok/Backend link)");
      }
      throw new Error(e.message || "Failed to parse intelligence data");
    }
  },

  /**
   * Manually triggers an analytics sync
   */
  syncAnalytics: async (brandId: string) => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/instagram/analytics/sync?brand_id=${brandId}`, {
      method: "POST",
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (!response.ok || data.status === "error") {
        throw new Error(data.message || data.detail || "Analytics sync failed");
      }
      return data;
    } catch (e: any) {
      if (text.includes("<!DOCTYPE html>")) {
        throw new Error("Server connection interrupted (HTML response)");
      }
      throw new Error(e.message || "Sync handshake failed");
    }
  },

  /**
   * Fetches performance metrics for recent posts
   */
  getRecentMedia: async (brandId: string, limit: number = 10): Promise<any[]> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/instagram/media/recent?brand_id=${brandId}&limit=${limit}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data.data || [];
    } catch {
      // Fallback for non-JSON or timeout
      return [];
    }
  },

  // --- Payment Endpoints ---

  getPlans: async () => {
    // Auth service URL might be different from WEEZ_BASE_URL if microservices
    // Using the AUTH URL from usage in Plans.tsx (or configuring it)
    const AUTH_URL = "https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net";

    // For local testing if configured:
    // const AUTH_URL = "http://localhost:8000/auth"; 

    const response = await fetchWithBypass(`${AUTH_URL}/payments/plans`);
    if (!response.ok) throw new Error("Failed to fetch plans");
    return await response.json();
  },

  createPaymentOrder: async (planId: string) => {
    const AUTH_URL = "https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net";
    const response = await fetchWithBypass(`${AUTH_URL}/payments/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Order creation failed" }));
      throw new Error(err.detail);
    }
    return await response.json();
  },

  verifyPayment: async (paymentDetails: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    const AUTH_URL = "https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net";
    const response = await fetchWithBypass(`${AUTH_URL}/payments/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentDetails),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Verification failed" }));
      throw new Error(err.detail);
    }
    return await response.json();
  },

  /**
   * Transcribes an audio blob using the backend STT endpoint
   */
  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/creatives/stt/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Transcription failed" }));
      throw new Error(err.detail || "Failed to transcribe audio");
    }
    return await response.json();
  },

  // ─── Autopilot / Campaign Endpoints ─────────────────────────────────────────

  /**
   * Checks the active campaign status for a brand
   */
  getActiveCampaignStatus: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${brandId}/active-status`);
    if (!response.ok) return { active: false };
    return await response.json();
  },

  /**
   * Fetches the full autopilot dashboard data for a brand
   */
  getAutopilotDashboard: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${brandId}/dashboard`);
    if (!response.ok) throw new Error("Failed to fetch dashboard");
    return await response.json();
  },

  /**
   * Fetches 48-hour performance reports for a campaign
   */
  getPerformanceReports: async (campaignId: string, brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/performance-reports?brand_id=${brandId}`);
    if (!response.ok) throw new Error("Failed to fetch performance reports");
    return await response.json();
  },

  /**
   * Fetches conversation history for a campaign
   */
  getCampaignConversation: async (brandId: string, campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${brandId}/conversation?campaign_id=${campaignId}`);
    if (!response.ok) throw new Error("Failed to fetch conversation");
    return await response.json();
  },

  /**
   * Generates a campaign brief from a user's marketing goal
   */
  getCampaignBrief: async (
    brandId: string,
    userPrompt: string,
    duration?: string,
    campaignType?: string,
    marketingMode?: string
  ): Promise<any> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let url = `${WEEZ_BASE_URL}/autopilot/campaign/brief?brand_id=${brandId}&user_prompt=${encodeURIComponent(userPrompt)}&user_timezone=${encodeURIComponent(tz)}`;
    if (duration) url += `&duration=${duration}`;
    if (campaignType) url += `&campaign_type=${campaignType}`;
    if (marketingMode) url += `&marketing_mode=${marketingMode}`;
    const response = await fetchWithBypass(url, { method: "POST" });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Brief generation failed" }));
      throw new Error(err.detail || "Failed to generate campaign brief");
    }
    return await response.json();
  },

  /**
   * Generates the content planner/calendar for a campaign
   */
  generateCampaignPlanner: async (campaignId: string, currentLocalTime?: string): Promise<any> => {
    let url = `${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/planner`;
    if (currentLocalTime) url += `?current_local_time=${encodeURIComponent(currentLocalTime)}`;
    const response = await fetchWithBypass(url, { method: "POST" });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Planner generation failed" }));
      throw new Error(err.detail || "Failed to generate planner");
    }
    return await response.json();
  },

  /**
   * Approves the planner and starts the campaign
   */
  approveAndStartCampaign: async (campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/approve`, {
      method: "POST",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Campaign start failed" }));
      throw new Error(err.detail || "Failed to start campaign");
    }
    return await response.json();
  },

  /**
   * Rejects the campaign briefing and resets to draft
   */
  rejectBriefing: async (campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/reject-briefing`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to reject briefing");
    return await response.json();
  },

  /**
   * Rejects the planner and resets campaign to briefing status
   */
  rejectPlanner: async (campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/reject-planner`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to reject planner");
    return await response.json();
  },

  /**
   * Fetches poster jobs for a campaign
   */
  getCampaignPosterJobs: async (campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/poster-jobs`);
    if (!response.ok) throw new Error("Failed to fetch poster jobs");
    return await response.json();
  },

  /**
   * Regenerates a poster job
   */
  regeneratePosterJob: async (campaignId: string, jobId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/poster-jobs/${jobId}/regenerate`, {
      method: "POST",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Regeneration failed" }));
      throw new Error(err.detail || "Failed to regenerate poster");
    }
    return await response.json();
  },

  /**
   * Instantly publishes a poster job to its target platform (Instagram/LinkedIn)
   */
  postNow: async (campaignId: string, jobId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/poster-jobs/${jobId}/post-now`, {
      method: "POST",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Publish failed" }));
      throw new Error(err.detail || "Failed to publish poster");
    }
    return await response.json();
  },

  /**
   * Deletes a content post
   */
  deleteContentPost: async (postId: string, brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/content-posts/${postId}?brand_id=${brandId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete content post");
    return await response.json();
  },

  /**
   * Fetches all campaigns for a brand
   */
  getAllCampaigns: async (brandId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${brandId}/all`);
    if (!response.ok) throw new Error("Failed to fetch campaigns");
    return await response.json();
  },

  /**
   * Deletes a campaign and all associated data
   */
  deleteCampaign: async (campaignId: string): Promise<any> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Delete failed" }));
      throw new Error(err.detail || "Failed to delete campaign");
    }
    return await response.json();
  },

  // ── Unified Poster Editor API ────────────────────────────────────────
  
  /**
   * Fetches the content (JSX or HTML) for a poster job
   */
  getPosterContent: async (jobId: string): Promise<{
    job_id: string;
    markup: string;
    engine: "jsx" | "html";
    editable_fields: string[];
    aspect_ratio: string;
    width: number;
    height: number;
    poster_idea: string;
    status: string;
  }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/content`);
    if (!response.ok) throw new Error("Failed to fetch poster content");
    return await response.json();
  },

  /**
   * Saves edited markup content back to the job
   */
  savePosterContent: async (jobId: string, markup: string, engine: "jsx" | "html" = "jsx"): Promise<void> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markup, engine }),
    });
    if (!response.ok) throw new Error("Failed to save poster content");
  },

  /**
   * Re-renders the saved JSX markup to PNG via the microservice
   */
  renderPosterJSX: async (jobId: string): Promise<{ asset_url: string }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/render`, {
      method: "POST"
    });
    if (!response.ok) throw new Error("Failed to render JSX poster");
    return await response.json();
  },

  /**
   * Finalizes a poster: uploads the PNG capture and marks job as completed
   */
  finalizePoster: async (jobId: string, pngBase64: string): Promise<{ asset_url: string }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ png_base64: pngBase64 }),
    });
    if (!response.ok) throw new Error("Failed to finalize poster");
    return await response.json();
  },

  /**
   * Ad-hoc JSX generation
   */
  generateJSX: async (params: {
    poster_idea: string;
    brand_memory?: any;
    platform?: string;
    width?: number;
    height?: number;
  }): Promise<{ markup: string; engine: string; width: number; height: number }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/generate-jsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error("Failed to generate JSX poster");
    return await response.json();
  },

  // ── Legacy HTML Poster Editor API (Backward Compatibility) ─────────

  /**
   * Fetches the HTML content for a poster job
   */
  getPosterHtml: async (jobId: string): Promise<{
    job_id: string;
    html: string;
    editable_fields: string[];
    aspect_ratio: string;
    width: number;
    height: number;
    poster_idea: string;
    status: string;
  }> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/html`);
    if (!response.ok) throw new Error("Failed to fetch poster HTML");
    return await response.json();
  },

  /**
   * Saves edited HTML content back to the job
   */
  savePosterHtml: async (jobId: string, html: string): Promise<void> => {
    const response = await fetchWithBypass(`${WEEZ_BASE_URL}/editor/poster/${jobId}/html`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });
    if (!response.ok) throw new Error("Failed to save poster HTML");
  },
};
