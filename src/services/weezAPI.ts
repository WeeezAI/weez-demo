// services/weezAPI.ts

const WEEZ_BASE_URL = "http://localhost:8000"//"https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net";

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
  const token = localStorage.getItem("token");
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
    imageModel: string = "imagen4"
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
    imageModel: string = "imagen4"
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
  }
};
