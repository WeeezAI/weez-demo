// services/rfpAPI.ts

const RFP_BASE_URL = "http://localhost:8000"; // Replace with actual base URL of the RFP API

/* =======================
   REQUEST / RESPONSE TYPES
   ======================= */

export interface GenerateRFPRequest {
  user_id: string;
  brief_name: string;
  space_id: string;
}

export interface GenerateRFPResponse {
  job_id: string;
  status: string;
  message: string;
  user_id: string;
  brief_name: string;
  space_id: string;
}

export type PipelineStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface PipelineStatusResponse {
  job_id: string;
  status: PipelineStatus;
  user_id: string;
  brief_name: string;
  space_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  current_step: string | null;
  progress_percentage: number | null;
  error_message: string | null;
  result_summary: Record<string, any> | null;
  persuasion_sas_url?: string | null;
  parsed_sas_url?: string | null;
}

export interface PipelineResultResponse {
  job_id: string;
  status: string;
  user_id: string;
  brief_name: string;
  space_id: string;
  created_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  result: Record<string, any> | null;
  documents: {
    persuasion_document: {
      local_path: string | null;
      blob_url: string | null;
      sas_url: string | null;
    };
    parsed_document: {
      local_path: string | null;
      blob_url: string | null;
      sas_url: string | null;
    };
  };
}

export interface JobListItem {
  job_id: string;
  user_id: string;
  brief_name: string;
  space_id: string;
  status: PipelineStatus;
  progress_percentage: number | null;
  current_step: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  persuasion_doc_path: string | null;
  parsed_doc_path: string | null;
  persuasion_sas_url?: string | null;
  parsed_sas_url?: string | null;
}

export interface JobsListResponse {
  total: number;
  jobs: JobListItem[];
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  database: string;
  blob_storage?: string;
  active_pipelines: number;
}

export interface CancelResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface DeleteResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface DocumentInfo {
  document_type: string;
  file_path: string | null;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
  blob_url: string | null;
  sas_url: string | null;
}

export interface StatisticsResponse {
  total_jobs: number;
  jobs_by_status: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  active_pipelines: number;
  average_completion_time_seconds: number | null;
  timestamp: string;
}

export interface JobLogsResponse {
  job_id: string;
  total_lines: number;
  returned_lines: number;
  logs: string;
}

export interface RootInfoResponse {
  message: string;
  version: string;
  status: string;
  docs: string;
}

export interface CorsTestResponse {
  cors_configured: boolean;
  message: string;
  error?: string;
  instructions?: {
    manual_setup: string;
    allowed_origins: string[];
    allowed_methods: string[];
    allowed_headers: string[];
    exposed_headers: string[];
  };
}

/* =======================
   DOWNLOAD OPTIONS
   ======================= */

export interface DownloadOptions {
  /**
   * Use proxy mode (download through backend) to avoid CORS issues
   * Default: true (recommended)
   */
  useProxy?: boolean;
  
  /**
   * Custom filename for the downloaded file
   */
  filename?: string;
  
  /**
   * Show download progress (requires proxy mode)
   */
  onProgress?: (loaded: number, total: number) => void;
}

/* =======================
   API FUNCTIONS
   ======================= */

/**
 * Start RFP generation pipeline
 */
export async function generateRFP(
  payload: GenerateRFPRequest
): Promise<GenerateRFPResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to start RFP generation (${res.status})`
    );
  }

  return res.json();
}

/**
 * Get status of RFP generation pipeline from database
 */
export async function getRFPStatus(
  jobId: string
): Promise<PipelineStatusResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/status/${jobId}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch RFP status (${res.status})`
    );
  }

  return res.json();
}

/**
 * Get complete result of RFP generation pipeline
 */
export async function getRFPResult(
  jobId: string
): Promise<PipelineResultResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/result/${jobId}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    
    // Handle 202 (still running) as a special case
    if (res.status === 202) {
      throw new Error("Pipeline is still running. Check status endpoint for progress.");
    }
    
    throw new Error(
      errorData.detail || `Failed to fetch RFP result (${res.status})`
    );
  }

  return res.json();
}

/**
 * List all RFP generation jobs from database
 */
export async function listJobs(
  status?: PipelineStatus,
  limit: number = 50
): Promise<JobsListResponse> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("limit", limit.toString());

  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/jobs?${params}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to list jobs (${res.status})`
    );
  }

  return res.json();
}

/**
 * Get list of documents for a specific job
 */
export async function getJobDocuments(
  jobId: string
): Promise<DocumentInfo[]> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/documents/${jobId}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to get job documents (${res.status})`
    );
  }

  return res.json();
}

/**
 * Download a generated document (CORS-safe with proxy mode)
 * @param jobId - Job ID
 * @param documentType - Either "persuasion_document" or "parsed_document"
 * @param options - Download options (proxy mode, filename, etc.)
 * @returns Blob of the document file
 */
export async function downloadDocument(
  jobId: string,
  documentType: "persuasion_document" | "parsed_document",
  options: DownloadOptions = {}
): Promise<Blob> {
  const { useProxy = true, onProgress } = options;
  
  // Build URL with proxy parameter
  const params = new URLSearchParams();
  params.append("proxy", useProxy.toString());
  
  const url = `${RFP_BASE_URL}/api/v1/rfp/download/${jobId}/${documentType}?${params}`;
  
  try {
    // Use XMLHttpRequest for progress tracking if needed
    if (onProgress && useProxy) {
      return await downloadWithProgress(url, onProgress);
    }
    
    // Standard fetch
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to download document (${res.status})`
      );
    }

    return await res.blob();
    
  } catch (error) {
    // If proxy mode fails, try without proxy as fallback
    if (useProxy && error instanceof Error) {
      console.warn("Proxy download failed, attempting direct download:", error.message);
      
      try {
        return await downloadDocument(jobId, documentType, { ...options, useProxy: false });
      } catch (fallbackError) {
        // If both fail, throw original error
        throw error;
      }
    }
    
    throw error;
  }
}

/**
 * Download with progress tracking using XMLHttpRequest
 */
function downloadWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open("GET", url, true);
    xhr.responseType = "blob";
    xhr.setRequestHeader("Accept", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Download failed with status ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error during download"));
    };
    
    xhr.send();
  });
}

/**
 * Helper to trigger document download in browser
 */
export async function downloadDocumentToFile(
  jobId: string,
  documentType: "persuasion_document" | "parsed_document",
  options: DownloadOptions = {}
): Promise<void> {
  const { filename } = options;
  
  // Show download started notification (optional)
  console.log(`Starting download of ${documentType}...`);
  
  try {
    const blob = await downloadDocument(jobId, documentType, options);
    
    // Generate filename
    let finalFilename = filename;
    if (!finalFilename) {
      // Try to get original filename from blob
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      finalFilename = `${documentType}_${timestamp}.docx`;
    }
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalFilename;
    a.style.display = "none";
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    
    console.log(`Download completed: ${finalFilename}`);
    
  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  }
}

/**
 * Download document directly from SAS URL (bypasses backend)
 * Only works if CORS is configured on Azure Blob Storage
 */
export async function downloadDocumentDirect(
  jobId: string,
  documentType: "persuasion_document" | "parsed_document"
): Promise<void> {
  try {
    // Get job status to retrieve SAS URL
    const status = await getRFPStatus(jobId);
    
    const sasUrl = documentType === "persuasion_document" 
      ? status.persuasion_sas_url 
      : status.parsed_sas_url;
    
    if (!sasUrl) {
      throw new Error("SAS URL not available for this document");
    }

    // Open in new tab or trigger download
    const link = document.createElement("a");
    link.href = sasUrl;
    link.target = "_blank";
    link.download = `${documentType}.docx`;
    link.style.display = "none";
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    
  } catch (error) {
    console.error("Direct download failed, falling back to proxy:", error);
    // Fallback to proxy method
    return downloadDocumentToFile(jobId, documentType, { useProxy: true });
  }
}

/**
 * Cancel a running pipeline
 */
export async function cancelPipeline(jobId: string): Promise<CancelResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/cancel/${jobId}`, {
    method: "POST",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to cancel pipeline (${res.status})`
    );
  }

  return res.json();
}

/**
 * Delete a job from database
 */
export async function deleteJob(
  jobId: string,
  deleteBlobs: boolean = false
): Promise<DeleteResponse> {
  const params = new URLSearchParams();
  params.append("delete_blobs", deleteBlobs.toString());
  
  const res = await fetch(
    `${RFP_BASE_URL}/api/v1/rfp/job/${jobId}?${params}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to delete job (${res.status})`
    );
  }

  return res.json();
}

/**
 * Get job logs
 */
export async function getJobLogs(
  jobId: string,
  tail: number = 100
): Promise<JobLogsResponse> {
  const params = new URLSearchParams();
  params.append("tail", tail.toString());

  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/logs/${jobId}?${params}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to get job logs (${res.status})`
    );
  }

  return res.json();
}

/**
 * Get overall statistics
 */
export async function getStatistics(): Promise<StatisticsResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/rfp/stats`);

  if (!res.ok) {
    throw new Error(`Failed to get statistics (${res.status})`);
  }

  return res.json();
}

/**
 * Health check with database and blob storage status
 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const res = await fetch(`${RFP_BASE_URL}/health`);

  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }

  return res.json();
}

/**
 * Root endpoint info
 */
export async function getRootInfo(): Promise<RootInfoResponse> {
  const res = await fetch(`${RFP_BASE_URL}/`);

  if (!res.ok) {
    throw new Error(`Failed to fetch root info (${res.status})`);
  }

  return res.json();
}

/**
 * Test CORS configuration on Azure Blob Storage
 */
export async function testCorsConfiguration(): Promise<CorsTestResponse> {
  const res = await fetch(`${RFP_BASE_URL}/api/v1/blob/cors-test`);

  if (!res.ok) {
    throw new Error(`Failed to test CORS configuration (${res.status})`);
  }

  return res.json();
}

/* =======================
   POLLING UTILITIES
   ======================= */

export interface PollOptions {
  interval?: number; // milliseconds between polls (default: 2000)
  timeout?: number; // max time to poll in milliseconds (default: 1800000 = 30 minutes)
  onProgress?: (status: PipelineStatusResponse) => void;
}

/**
 * Poll for job completion with progress callbacks
 */
export async function pollUntilComplete(
  jobId: string,
  options: PollOptions = {}
): Promise<PipelineStatusResponse> {
  const {
    interval = 2000,
    timeout = 1800000, // 30 minutes
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      throw new Error("Polling timeout: Job did not complete in time");
    }

    // Get status
    const status = await getRFPStatus(jobId);

    // Call progress callback
    if (onProgress) {
      onProgress(status);
    }

    // Check if completed
    if (status.status === "completed") {
      return status;
    }

    // Check if failed
    if (status.status === "failed") {
      throw new Error(
        status.error_message || "Pipeline failed with no error message"
      );
    }

    // Check if cancelled
    if (status.status === "cancelled") {
      throw new Error("Pipeline was cancelled");
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Generate RFP and wait for completion
 */
export async function generateAndWaitForRFP(
  payload: GenerateRFPRequest,
  options: PollOptions = {}
): Promise<PipelineStatusResponse> {
  const { job_id } = await generateRFP(payload);
  return await pollUntilComplete(job_id, options);
}

/* =======================
   UTILITY FUNCTIONS
   ======================= */

/**
 * Get document paths from job status
 */
export function getDocumentPaths(status: PipelineStatusResponse): {
  persuasion: string | null;
  parsed: string | null;
  persuasionSasUrl: string | null;
  parsedSasUrl: string | null;
} {
  const summary = status.result_summary;
  
  return {
    persuasion: summary?.final_documents?.persuasion_document || null,
    parsed: summary?.final_documents?.parsed_document || null,
    persuasionSasUrl: status.persuasion_sas_url || null,
    parsedSasUrl: status.parsed_sas_url || null,
  };
}

/**
 * Check if documents are available for download
 */
export function hasDownloadableDocuments(status: PipelineStatusResponse): boolean {
  return status.status === "completed" && (
    !!status.persuasion_sas_url || 
    !!status.parsed_sas_url ||
    !!status.result_summary?.final_documents?.persuasion_document ||
    !!status.result_summary?.final_documents?.parsed_document
  );
}

/**
 * Check if job has completed successfully
 */
export function isJobCompleted(status: PipelineStatusResponse): boolean {
  return status.status === "completed";
}

/**
 * Check if job is still running
 */
export function isJobRunning(status: PipelineStatusResponse): boolean {
  return status.status === "running" || status.status === "pending";
}

/**
 * Check if job has failed
 */
export function isJobFailed(status: PipelineStatusResponse): boolean {
  return status.status === "failed";
}

/**
 * Check if job was cancelled
 */
export function isJobCancelled(status: PipelineStatusResponse): boolean {
  return status.status === "cancelled";
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "N/A";
  
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: PipelineStatus): string {
  const statusMap: Record<PipelineStatus, string> = {
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled"
  };
  
  return statusMap[status] || status;
}

/**
 * Get progress percentage with fallback
 */
export function getProgressPercentage(status: PipelineStatusResponse): number {
  if (status.progress_percentage !== null) {
    return status.progress_percentage;
  }
  
  // Fallback based on status
  switch (status.status) {
    case "pending":
      return 0;
    case "running":
      return 50;
    case "completed":
      return 100;
    case "failed":
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "N/A";
  
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/* =======================
   USAGE EXAMPLES
   ======================= */

/*
// Example 1: Basic download (proxy mode - CORS-safe)
await downloadDocumentToFile(jobId, "parsed_document");

// Example 2: Download with progress tracking
await downloadDocumentToFile(jobId, "parsed_document", {
  useProxy: true,
  filename: "My_RFP_Proposal.docx",
  onProgress: (loaded, total) => {
    const percent = (loaded / total) * 100;
    console.log(`Download progress: ${percent.toFixed(1)}%`);
  }
});

// Example 3: Direct download (requires CORS)
await downloadDocumentDirect(jobId, "parsed_document");

// Example 4: Download without proxy (requires CORS)
await downloadDocumentToFile(jobId, "parsed_document", {
  useProxy: false
});

// Example 5: Test CORS configuration
const corsStatus = await testCorsConfiguration();
console.log("CORS configured:", corsStatus.cors_configured);

// Example 6: Generate and auto-download when complete
const status = await generateAndWaitForRFP(
  { user_id: "test@example.com", brief_name: "My Brief", space_id: "space-123" },
  {
    onProgress: (s) => console.log(`${s.progress_percentage}% - ${s.current_step}`)
  }
);

if (hasDownloadableDocuments(status)) {
  await downloadDocumentToFile(status.job_id, "parsed_document");
}
*/