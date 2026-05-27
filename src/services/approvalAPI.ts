// src/services/approvalAPI.ts
//
// Typed client for the Approval Workflow & AutoPilot HTTP surface.
//
// References:
//   - Design "HTTP API surface" table
//   - Requirements 1.3, 1.4, 7.1, 8.2, 9.1, 12.1, 13.1
//
// Type definitions mirror backend/schemas/approval.py. All datetime fields
// arrive from the backend as ISO-8601 UTC with millisecond precision and a
// trailing "Z" (Req 18.1, 18.2):
//   ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$
// They are exposed here as `string` so callers can format them with the
// user's time-zone helper before display (Req 18.3).

import { CONFIG } from "./config";

const APPROVAL_BASE_URL = CONFIG.WEEZ_BASE_URL;

// ---------------------------------------------------------------------------
// Enum-like literal types (mirror backend/schemas/approval.py)
// ---------------------------------------------------------------------------

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EDITED_APPROVED"
  | "AUTO_APPROVED"
  | "POSTED";

export type ModeUsed = "APPROVAL" | "AUTOPILOT";

export type ApproverScope = "USER" | "FOUNDER" | "ORG" | "HYBRID" | "ROLE";

export type ActorType = "USER" | "SYSTEM" | "SERVICE";

export type SourceChannel = "EMAIL" | "DASHBOARD" | "SYSTEM" | "API";

export type ApprovalTokenAction = "APPROVE" | "EDIT" | "REJECT";

export type PosterMime = "image/png" | "image/jpeg" | "image/webp";

export type AnalyticsScope = "USER" | "CAMPAIGN" | "GLOBAL";

// ---------------------------------------------------------------------------
// Response / payload shapes
// ---------------------------------------------------------------------------

/** ISO-8601 UTC string with millisecond precision, e.g. "2025-01-15T08:30:00.000Z". */
export type IsoUtcMillis = string;

export interface PublishingModeResponse {
  campaign_id: string;
  mode: ModeUsed;
}

export interface PublishingModeRequest {
  mode: ModeUsed;
}

export interface ApprovalRecord {
  id: string;
  campaign_id: string;
  user_id: string;
  day_number: number;

  subject: string;
  content_body: string;
  poster_url: string;
  scheduled_publish_time: IsoUtcMillis;

  // Immutable original snapshot (Req 14.2)
  original_subject: string;
  original_content_body: string;
  original_poster_url: string;
  original_scheduled_publish_time: IsoUtcMillis;

  generated_at: IsoUtcMillis;
  approved_at: IsoUtcMillis | null;
  posted_at: IsoUtcMillis | null;

  approval_status: ApprovalStatus;
  mode_used: ModeUsed;
  approver_scope: ApproverScope;

  requires_owner_action: boolean;
  /** Server-supplied label per Req 12.2 mapping. */
  status_label: string | null;
}

export interface AuditTrailEntry {
  id: string;
  approval_record_id: string;
  from_status: ApprovalStatus | null;
  to_status: ApprovalStatus;
  transition_at_utc: IsoUtcMillis;
  actor_id: string;
  actor_type: ActorType;
  approver_scope: ApproverScope;
  source_channel: SourceChannel;
  change_reason: string | null;
}

/**
 * POST body for `/campaign/{campaign_id}/edit/{content_id}`.
 * `confirm=true` transitions PENDING -> EDITED_APPROVED in a single call
 * (Req 8.2). `confirm=false` saves edits without changing status (Req 8.3).
 */
export interface EditPayload {
  subject: string;
  content_body: string;
  poster_url: string;
  /** ISO-8601 UTC; must be strictly in the future (Req 8.8). */
  scheduled_publish_time: IsoUtcMillis;
  confirm: boolean;
}

export interface AnalyticsQueryParams {
  scope: AnalyticsScope;
  user_id?: string;
  campaign_id?: string;
  window_start_utc: IsoUtcMillis;
  window_end_utc: IsoUtcMillis;
}

export interface AnalyticsResponse {
  scope: AnalyticsScope;
  user_id: string | null;
  campaign_id: string | null;
  window_start_utc: IsoUtcMillis;
  window_end_utc: IsoUtcMillis;

  approval_rate: number | null;
  average_approval_time_seconds: number | null;
  edited_before_approval_percentage: number | null;
  rejected_percentage: number | null;
  autopilot_adoption_rate: number | null;
  posts_generated: number;
  posts_published: number;
  approval_to_publish_conversion: number | null;
}

// ---------------------------------------------------------------------------
// Error envelope (matches design "HTTP error envelope")
// ---------------------------------------------------------------------------

/** Canonical error codes returned on the approval routes. */
export type ApprovalErrorCode =
  | "TOKEN_MALFORMED"
  | "TOKEN_EXPIRED"
  | "TOKEN_CONSUMED"
  | "RECORD_TERMINAL"
  | "VALIDATION_FAILED"
  | "SERVICE_UNAVAILABLE"
  | "premium_required"
  | string;

export interface ErrorBody {
  code: ApprovalErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

/**
 * Thrown by every client method on a non-2xx response. Preserves the
 * HTTP status code and, when present, the structured error envelope so UI
 * layers can dispatch on `error.code` (Req 21.1-21.6, 2.5).
 */
export class ApprovalAPIError extends Error {
  readonly status: number;
  readonly code: ApprovalErrorCode | null;
  readonly details: Record<string, unknown>;
  readonly raw: unknown;

  constructor(
    status: number,
    code: ApprovalErrorCode | null,
    message: string,
    details: Record<string, unknown> = {},
    raw: unknown = null,
  ) {
    super(message);
    this.name = "ApprovalAPIError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.raw = raw;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = sessionStorage.getItem("token");
  return {
    ...extra,
    "ngrok-skip-browser-warning": "69420",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    const data = (await parseJsonSafe(res)) as T;
    return data;
  }

  const body = await parseJsonSafe(res);
  // Structured envelope: { "error": { code, message, details } }
  if (
    body &&
    typeof body === "object" &&
    "error" in (body as Record<string, unknown>) &&
    typeof (body as { error: unknown }).error === "object" &&
    (body as { error: unknown }).error !== null
  ) {
    const err = (body as { error: ErrorBody }).error;
    throw new ApprovalAPIError(
      res.status,
      err.code ?? null,
      err.message || res.statusText,
      err.details ?? {},
      body,
    );
  }

  // FastAPI's default error shape: { "detail": "..." } or 422 list
  const detail =
    body && typeof body === "object" && "detail" in (body as Record<string, unknown>)
      ? (body as { detail: unknown }).detail
      : null;
  const message =
    typeof detail === "string"
      ? detail
      : detail
        ? JSON.stringify(detail)
        : res.statusText || "Request failed";

  throw new ApprovalAPIError(res.status, null, message, {}, body);
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const approvalAPI = {
  // ── Publishing mode (Req 1.3, 1.4, 2.5) ───────────────────────────────────

  /** GET /campaigns/{campaign_id}/publishing-mode */
  async getPublishingMode(campaignId: string): Promise<PublishingModeResponse> {
    const res = await fetch(
      `${APPROVAL_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/publishing-mode`,
      { headers: authHeaders() },
    );
    return handle<PublishingModeResponse>(res);
  },

  /**
   * PATCH /campaigns/{campaign_id}/publishing-mode
   *
   * Throws `ApprovalAPIError` with `status=403, code="premium_required"` when
   * a non-Premium user requests AUTOPILOT (Req 2.5).
   */
  async setPublishingMode(
    campaignId: string,
    mode: ModeUsed,
  ): Promise<PublishingModeResponse> {
    const res = await fetch(
      `${APPROVAL_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/publishing-mode`,
      {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mode } satisfies PublishingModeRequest),
      },
    );
    return handle<PublishingModeResponse>(res);
  },

  // ── History (Req 12.1) ────────────────────────────────────────────────────

  /** GET /campaigns/{campaign_id}/approval-records */
  async listApprovalRecords(campaignId: string): Promise<ApprovalRecord[]> {
    const res = await fetch(
      `${APPROVAL_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/approval-records`,
      { headers: authHeaders() },
    );
    return handle<ApprovalRecord[]>(res);
  },

  // ── Approve / Edit / Reject (Req 7.1, 8.2, 9.1) ───────────────────────────
  //
  // The token query parameter is optional: when present it authorizes the
  // request via an emailed ApprovalToken; when absent the session cookie/Bearer
  // token must belong to the record's owner (Req 7.2, 7.3, 16.5, 16.8).

  /** GET /campaign/{campaign_id}/approve/{content_id} */
  async approve(
    campaignId: string,
    contentId: string,
    token?: string,
  ): Promise<ApprovalRecord> {
    const url =
      `${APPROVAL_BASE_URL}/campaign/${encodeURIComponent(campaignId)}` +
      `/approve/${encodeURIComponent(contentId)}` +
      buildQuery({ token });
    const res = await fetch(url, { headers: authHeaders() });
    return handle<ApprovalRecord>(res);
  },

  /** GET /campaign/{campaign_id}/edit/{content_id} - load editable fields */
  async getEdit(
    campaignId: string,
    contentId: string,
    token?: string,
  ): Promise<ApprovalRecord> {
    const url =
      `${APPROVAL_BASE_URL}/campaign/${encodeURIComponent(campaignId)}` +
      `/edit/${encodeURIComponent(contentId)}` +
      buildQuery({ token });
    const res = await fetch(url, { headers: authHeaders() });
    return handle<ApprovalRecord>(res);
  },

  /**
   * POST /campaign/{campaign_id}/edit/{content_id}
   *
   * `payload.confirm=true` → transitions PENDING → EDITED_APPROVED in one call
   * (Req 8.2). `payload.confirm=false` → save-only (Req 8.3).
   */
  async submitEdit(
    campaignId: string,
    contentId: string,
    payload: EditPayload,
    token?: string,
  ): Promise<ApprovalRecord> {
    const url =
      `${APPROVAL_BASE_URL}/campaign/${encodeURIComponent(campaignId)}` +
      `/edit/${encodeURIComponent(contentId)}` +
      buildQuery({ token });
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    return handle<ApprovalRecord>(res);
  },

  /** GET /campaign/{campaign_id}/reject/{content_id} */
  async reject(
    campaignId: string,
    contentId: string,
    token?: string,
  ): Promise<ApprovalRecord> {
    const url =
      `${APPROVAL_BASE_URL}/campaign/${encodeURIComponent(campaignId)}` +
      `/reject/${encodeURIComponent(contentId)}` +
      buildQuery({ token });
    const res = await fetch(url, { headers: authHeaders() });
    return handle<ApprovalRecord>(res);
  },

  // ── Analytics (Req 13.1) ──────────────────────────────────────────────────

  /** GET /analytics/approval */
  async getAnalytics(params: AnalyticsQueryParams): Promise<AnalyticsResponse> {
    const url =
      `${APPROVAL_BASE_URL}/analytics/approval` +
      buildQuery({
        scope: params.scope,
        user_id: params.user_id,
        campaign_id: params.campaign_id,
        window_start_utc: params.window_start_utc,
        window_end_utc: params.window_end_utc,
      });
    const res = await fetch(url, { headers: authHeaders() });
    return handle<AnalyticsResponse>(res);
  },
};

export default approvalAPI;
