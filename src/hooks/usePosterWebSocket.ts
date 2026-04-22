// hooks/usePosterWebSocket.ts
// Custom React hook for real-time poster job updates via WebSocket

import { useState, useEffect, useRef, useCallback } from "react";

const WEEZ_BASE_URL = "https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net";

// Derive WebSocket URL from API base
function getWsUrl(campaignId: string): string {
    const base = WEEZ_BASE_URL.replace(/^http/, "ws");
    return `${base}/ws/campaign/${campaignId}`;
}

export interface PosterJobUpdate {
    type: string;
    campaign_id: string;
    job_id: string;
    content_day: number;
    status: string;
    progress: number;
    poster_url?: string;
    error?: string;
}

export interface PosterJob {
    id: string;
    campaign_id: string;
    content_day: number;
    poster_idea: string;
    model_used: string | null;
    status: string;
    progress: number;
    error_message: string | null;
    asset_url: string | null;
    generation_time_seconds: number | null;
    created_at: string | null;
    updated_at: string | null;
}

interface UsePosterWebSocketReturn {
    posterJobs: PosterJob[];
    isConnected: boolean;
    latestEvent: PosterJobUpdate | null;
    reconnect: () => void;
    refresh: () => void;
}

export function usePosterWebSocket(
    campaignId: string | null,
    enabled: boolean = true
): UsePosterWebSocketReturn {
    const [posterJobs, setPosterJobs] = useState<PosterJob[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [latestEvent, setLatestEvent] = useState<PosterJobUpdate | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);

    // Fetch initial poster jobs via REST
    const fetchPosterJobs = useCallback(async () => {
        if (!campaignId) return;
        try {
            const token = localStorage.getItem("token");
            const headers: Record<string, string> = {
                "ngrok-skip-browser-warning": "69420",
            };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(
                `${WEEZ_BASE_URL}/autopilot/campaign/${campaignId}/poster-jobs`,
                { headers }
            );
            if (res.ok) {
                const data = await res.json();
                setPosterJobs(data.poster_jobs || []);
            }
        } catch (err) {
            console.error("[usePosterWebSocket] Failed to fetch poster jobs:", err);
        }
    }, [campaignId]);

    // Connect WebSocket
    const connect = useCallback(() => {
        if (!campaignId || !enabled) return;

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const url = getWsUrl(campaignId);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log(`[WS] Connected to ${campaignId}`);
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Ignore ping/pong
                if (data.type === "ping" || data.type === "pong") return;

                // Handle poster update events
                if (data.type === "poster_update") {
                    const update = data as PosterJobUpdate;
                    setLatestEvent(update);

                    // Update the specific job in state
                    setPosterJobs((prev) => {
                        const existingIndex = prev.findIndex(
                            (j) => j.id === update.job_id
                        );
                        if (existingIndex >= 0) {
                            const updated = [...prev];
                            updated[existingIndex] = {
                                ...updated[existingIndex],
                                status: update.status,
                                progress: update.progress,
                                asset_url: update.poster_url || updated[existingIndex].asset_url,
                                error_message: update.error || updated[existingIndex].error_message,
                            };
                            return updated;
                        }
                        // If job not found, refetch all
                        fetchPosterJobs();
                        return prev;
                    });
                }
            } catch (err) {
                console.error("[WS] Failed to parse message:", err);
            }
        };

        ws.onclose = (event) => {
            console.log(`[WS] Disconnected (code: ${event.code})`);
            setIsConnected(false);
            wsRef.current = null;

            // Auto-reconnect with exponential backoff
            if (enabled && reconnectAttemptsRef.current < 10) {
                const delay = Math.min(
                    1000 * Math.pow(2, reconnectAttemptsRef.current),
                    30000
                );
                reconnectAttemptsRef.current++;
                console.log(
                    `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
                );
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = (error) => {
            console.error("[WS] Error:", error);
        };
    }, [campaignId, enabled, fetchPosterJobs]);

    // Manual reconnect
    const reconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0;
        connect();
    }, [connect]);

    // Effect: connect on mount, disconnect on unmount
    useEffect(() => {
        if (campaignId && enabled) {
            fetchPosterJobs();
            connect();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [campaignId, enabled, connect, fetchPosterJobs]);

    // Periodic refresh as fallback (every 10s)
    useEffect(() => {
        if (!campaignId || !enabled) return;
        const interval = setInterval(fetchPosterJobs, 10000);
        return () => clearInterval(interval);
    }, [campaignId, enabled, fetchPosterJobs]);

    return { posterJobs, isConnected, latestEvent, reconnect, refresh: fetchPosterJobs };
}
