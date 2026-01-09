// src/services/metadataAPI.ts

const METADATA_BACKEND = "https://dexraflow-generate-metadata-c5b3cyagb3b7dchz.eastus2-01.azurewebsites.net";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ProcessingJob {
  job_id: string;
  space_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "partially_completed";
  total_assets: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  progress_percentage: number;
  current_file: string | null;
  estimated_time_remaining: number | null;
  started_at: string;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessingProgress {
  job_id: string;
  status: string;
  progress_percentage: number;
  current_file: string | null;
  total_assets: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  estimated_time_remaining: number | null;
  is_complete: boolean;
}

export interface JobError {
  id: number;
  file_name: string;
  error_message: string;
  error_type: string;
  occurred_at: string;
}

export interface JobAsset {
  id: number;
  asset_id: string;
  file_name: string;
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  indexed_to_pinecone: boolean;
}

export interface ProcessAllResponse {
  success: boolean;
  job_id: string;
  space_id: string;
  total_assets: number;
  message: string;
  status_endpoint: string;
  progress_endpoint: string;
}

export interface SearchResult {
  success: boolean;
  query: string;
  results: any[];
  total_results: number;
}

// =====================================================
// API CLIENT
// =====================================================

export const metadataAPI = {
  /* -------------------------------------------------------
   * 1️⃣ PROCESS ALL ASSETS FROM COSMOS FOR A SPACE
   * Endpoint: POST /process-all-from-cosmos/{space_id}
   * Returns job_id for tracking progress
   * ----------------------------------------------------- */
  async processAll(spaceId: string, indexToPinecone = true): Promise<ProcessAllResponse> {
    const res = await fetch(
      `${METADATA_BACKEND}/process-all-from-cosmos/${spaceId}?index_to_pinecone=${indexToPinecone}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to process all metadata for this space");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 2️⃣ GET PROCESSING STATUS (Full Details)
   * Endpoint: GET /processing-status/{job_id}
   * Returns complete job information from database
   * ----------------------------------------------------- */
  async getProcessingStatus(jobId: string): Promise<ProcessingJob> {
    const res = await fetch(`${METADATA_BACKEND}/processing-status/${jobId}`);

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch processing status");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 3️⃣ GET PROCESSING PROGRESS (Optimized for UI)
   * Endpoint: GET /processing-progress/{job_id}
   * Returns minimal data optimized for progress bars
   * ----------------------------------------------------- */
  async getProcessingProgress(jobId: string): Promise<ProcessingProgress> {
    const res = await fetch(`${METADATA_BACKEND}/processing-progress/${jobId}`);

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch processing progress");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 4️⃣ GET ALL JOBS FOR A SPACE
   * Endpoint: GET /processing-status/space/{space_id}
   * Returns all processing jobs for a specific space
   * ----------------------------------------------------- */
  async getSpaceJobs(spaceId: string, limit = 50): Promise<{
    space_id: string;
    jobs: ProcessingJob[];
    total_jobs: number;
    message?: string;
  }> {
    const res = await fetch(
      `${METADATA_BACKEND}/processing-status/space/${spaceId}?limit=${limit}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch space jobs");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 5️⃣ GET ALL ACTIVE JOBS
   * Endpoint: GET /all-active-jobs
   * Returns all currently processing or pending jobs
   * ----------------------------------------------------- */
  async getAllActiveJobs(): Promise<{
    total_active_jobs: number;
    jobs: ProcessingJob[];
  }> {
    const res = await fetch(`${METADATA_BACKEND}/all-active-jobs`);

    if (!res.ok) {
      throw new Error("Failed to fetch active jobs");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 6️⃣ GET JOB ERRORS
   * Endpoint: GET /job-errors/{job_id}
   * Returns all errors for a specific job
   * ----------------------------------------------------- */
  async getJobErrors(jobId: string, limit = 100): Promise<{
    job_id: string;
    total_errors: number;
    errors: JobError[];
  }> {
    const res = await fetch(
      `${METADATA_BACKEND}/job-errors/${jobId}?limit=${limit}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch job errors");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 7️⃣ GET JOB ASSETS
   * Endpoint: GET /job-assets/{job_id}
   * Returns all assets in a job with their status
   * ----------------------------------------------------- */
  async getJobAssets(
    jobId: string,
    status?: "pending" | "processing" | "completed" | "failed" | "skipped"
  ): Promise<{
    job_id: string;
    total_assets: number;
    filter_status: string | null;
    assets: JobAsset[];
  }> {
    const url = status
      ? `${METADATA_BACKEND}/job-assets/${jobId}?status=${status}`
      : `${METADATA_BACKEND}/job-assets/${jobId}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch job assets");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 8️⃣ PROCESS SINGLE ASSET
   * Endpoint: POST /process-asset
   * ----------------------------------------------------- */
  async processAsset(metadata: any, indexToPinecone = true): Promise<{
    success: boolean;
    result: any;
    indexing: any;
    timestamp: string;
  }> {
    const res = await fetch(
      `${METADATA_BACKEND}/process-asset?index_to_pinecone=${indexToPinecone}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to process asset metadata");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 9️⃣ BULK PROCESS ASSETS
   * Endpoint: POST /bulk-process
   * ----------------------------------------------------- */
  async bulkProcess(assets: any[], indexToPinecone = true): Promise<{
    success: boolean;
    processed: number;
    results: any[];
  }> {
    const res = await fetch(
      `${METADATA_BACKEND}/bulk-process?index_to_pinecone=${indexToPinecone}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assets),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to bulk process metadata");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 🔟 INDEX SINGLE ASSET TO PINECONE
   * Endpoint: POST /index-asset
   * ----------------------------------------------------- */
  async indexAsset(assetData: any): Promise<{
    success: boolean;
    result: any;
  }> {
    const res = await fetch(`${METADATA_BACKEND}/index-asset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assetData),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to index asset");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 1️⃣1️⃣ BULK INDEX ASSETS TO PINECONE
   * Endpoint: POST /bulk-index/{space_id}
   * Returns job_id for tracking indexing progress
   * ----------------------------------------------------- */
  async bulkIndex(spaceId: string): Promise<ProcessAllResponse> {
    const res = await fetch(`${METADATA_BACKEND}/bulk-index/${spaceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to start bulk indexing");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 1️⃣2️⃣ SEMANTIC SEARCH
   * Endpoint: POST /search
   * ----------------------------------------------------- */
  async search(
    queryText: string,
    userId: string,
    limit = 10,
    similarityThreshold = 0.7
  ): Promise<SearchResult> {
    const res = await fetch(`${METADATA_BACKEND}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_text: queryText,
        user_id: userId,
        limit,
        similarity_threshold: similarityThreshold,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Search request failed");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 1️⃣3️⃣ CLEANUP OLD JOBS
   * Endpoint: DELETE /cleanup-old-jobs
   * ----------------------------------------------------- */
  async cleanupOldJobs(days = 30): Promise<{
    success: boolean;
    deleted_jobs: number;
    message: string;
  }> {
    const res = await fetch(
      `${METADATA_BACKEND}/cleanup-old-jobs?days=${days}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to cleanup old jobs");
    }

    return res.json();
  },

  /* -------------------------------------------------------
   * 1️⃣4️⃣ HEALTH CHECK
   * GET /health
   * ----------------------------------------------------- */
  async health(): Promise<{
    status: string;
    database?: string;
    [key: string]: any;
  }> {
    const res = await fetch(`${METADATA_BACKEND}/health`);
    return res.json();
  },

  /* -------------------------------------------------------
   * 1️⃣5️⃣ SERVICE STATUS
   * GET /status
   * ----------------------------------------------------- */
  async status(): Promise<{
    status: string;
    service: string;
    version: string;
    environment: string;
    active_jobs: number | string;
    database: string;
  }> {
    const res = await fetch(`${METADATA_BACKEND}/status`);
    return res.json();
  },
};

// =====================================================
// UTILITY HOOKS FOR REACT (OPTIONAL)
// =====================================================

/**
 * Poll for job progress until completion
 * Usage in React component:
 * 
 * const { progress, isPolling } = useJobProgress(jobId);
 */
export const pollJobProgress = async (
  jobId: string,
  onProgress: (progress: ProcessingProgress) => void,
  onComplete?: (progress: ProcessingProgress) => void,
  onError?: (error: Error) => void,
  intervalMs = 2000
): Promise<() => void> => {
  let intervalId: NodeJS.Timeout;
  let isCancelled = false;

  const poll = async () => {
    if (isCancelled) return;

    try {
      const progress = await metadataAPI.getProcessingProgress(jobId);
      onProgress(progress);

      if (progress.is_complete) {
        clearInterval(intervalId);
        onComplete?.(progress);
      }
    } catch (error) {
      clearInterval(intervalId);
      onError?.(error as Error);
    }
  };

  // Initial fetch
  await poll();

  // Start polling
  intervalId = setInterval(poll, intervalMs);

  // Return cancel function
  return () => {
    isCancelled = true;
    clearInterval(intervalId);
  };
};

/**
 * Format estimated time remaining
 */
export const formatTimeRemaining = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return "Calculating...";

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case "completed":
      return "green";
    case "processing":
      return "blue";
    case "pending":
      return "yellow";
    case "failed":
      return "red";
    case "partially_completed":
      return "orange";
    default:
      return "gray";
  }
};

/**
 * Get status icon
 */
export const getStatusIcon = (status: string): string => {
  switch (status) {
    case "completed":
      return "✅";
    case "processing":
      return "🔄";
    case "pending":
      return "⏳";
    case "failed":
      return "❌";
    case "partially_completed":
      return "⚠️";
    default:
      return "📄";
  }
};
