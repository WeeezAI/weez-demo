// src/services/aiJobAPI.ts

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const fetchWithBypass = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem("token");
  const headers = {
    ...options.headers,
    "ngrok-skip-browser-warning": "69420",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
};

export interface JobStatusResponse {
  status: "PENDING" | "CLAIMED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  message: string;
  error?: string | null;
}

export interface JobStartResponse {
  job_id: string;
  status: "PENDING";
}

export interface JobResultsResponse {
  job_id: string;
  status: string;
  founder_post: any;
  discovered_posts: any[];
  engagers: any[];
  metrics: {
    engagers_found: number;
    qualified_leads: number;
  };
}

export const aiJobAPI = {
  /**
   * Starts a market discovery job
   */
  startDiscovery: async (
    founderPostId: string,
    linkedinPostUrl: string,
    postContent: string
  ): Promise<JobStartResponse> => {
    const response = await fetchWithBypass(`${API_BASE}/api/v1/market-discovery/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        founder_post_id: founderPostId,
        linkedin_post_url: linkedinPostUrl,
        post_content: postContent,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to start discovery job" }));
      throw new Error(err.detail || "Failed to start discovery job");
    }
    return await response.json();
  },

  /**
   * Retrieves the current status, progress, and logs of a job
   */
  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const response = await fetchWithBypass(`${API_BASE}/api/v1/market-discovery/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch job status for job ${jobId}`);
    }
    return await response.json();
  },

  /**
   * Retrieves the final results of a job
   */
  getResults: async (jobId: string): Promise<JobResultsResponse> => {
    const response = await fetchWithBypass(`${API_BASE}/api/v1/market-discovery/results/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch job results for job ${jobId}`);
    }
    return await response.json();
  },

  /**
   * Cancels a running/pending job (for future extensibility)
   */
  cancelJob: async (jobId: string): Promise<{ status: string }> => {
    const response = await fetchWithBypass(`${API_BASE}/api/v1/market-discovery/jobs/${jobId}/cancel`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to cancel job ${jobId}`);
    }
    return await response.json();
  },
};

export default aiJobAPI;
