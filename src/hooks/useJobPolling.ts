// src/hooks/useJobPolling.ts

import { useState, useEffect, useRef } from "react";
import { JobStatusResponse } from "@/services/aiJobAPI";

interface UseJobPollingProps {
  jobId: string | null;
  fetchStatus: (jobId: string) => Promise<JobStatusResponse>;
  onComplete?: () => void;
  onFail?: (error: string) => void;
  intervalMs?: number;
}

export function useJobPolling({
  jobId,
  fetchStatus,
  onComplete,
  onFail,
  intervalMs = 3000,
}: UseJobPollingProps) {
  const [status, setStatus] = useState<JobStatusResponse["status"] | "IDLE">("IDLE");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setStatus("IDLE");
      setProgress(0);
      setMessage("");
      setError(null);
      setLogs([]);
      setElapsedSeconds(0);
      isPollingRef.current = false;
      return;
    }

    setStatus("PENDING");
    setProgress(0);
    setMessage("Queued");
    setError(null);
    setLogs(["Job Queued"]);
    setElapsedSeconds(0);
    isPollingRef.current = true;

    // Start elapsed timer
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        const data = await fetchStatus(jobId);
        
        setStatus(data.status);
        setProgress(data.progress);
        setMessage(data.message || "");
        
        if (data.message) {
          setLogs((prev) => {
            // Avoid adding identical logs consecutively
            if (prev[prev.length - 1] === data.message) return prev;
            return [...prev, data.message];
          });
        }

        if (data.status === "COMPLETED") {
          cleanup();
          if (onComplete) onComplete();
        } else if (data.status === "FAILED") {
          const errMsg = data.error || "Job failed on execution worker";
          setError(errMsg);
          setLogs((prev) => [...prev, `Error: ${errMsg}`]);
          cleanup();
          if (onFail) onFail(errMsg);
        } else if (data.status === "CANCELLED") {
          setError("Job was cancelled");
          cleanup();
        }
      } catch (err: any) {
        console.error("Error polling job status:", err);
        // We don't immediately fail, we retry, but report network issues
      }
    };

    // Initial check
    poll();

    // Start polling interval
    timerRef.current = setInterval(poll, intervalMs);

    const cleanup = () => {
      isPollingRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };

    return cleanup;
  }, [jobId, intervalMs]);

  return {
    status,
    progress,
    message,
    error,
    logs,
    elapsedSeconds,
  };
}

export default useJobPolling;
