// src/components/AIJobStatus.tsx

import React, { useEffect, useRef } from "react";
import { Terminal, Clock, AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";

interface AIJobStatusProps {
  status: "IDLE" | "PENDING" | "CLAIMED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  message: string;
  error: string | null;
  logs: string[];
  elapsedSeconds: number;
  jobName: string;
  onRetry?: () => void;
}

export const AIJobStatus: React.FC<AIJobStatusProps> = ({
  status,
  progress,
  message,
  error,
  logs,
  elapsedSeconds,
  jobName,
  onRetry,
}) => {
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Format seconds to mm:ss
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Estimate remaining time
  const getEstimatedRemaining = () => {
    if (progress <= 0 || progress >= 100) return "--:--";
    const totalEstimatedSeconds = (elapsedSeconds / progress) * 100;
    const remainingSeconds = Math.max(0, Math.round(totalEstimatedSeconds - elapsedSeconds));
    return formatTime(remainingSeconds);
  };

  if (status === "IDLE") return null;

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-violet-500/20 rounded-2xl p-6 shadow-2xl animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Progress info */}
        <div className="flex-1 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400 font-mono">
                Running Execution Service
              </span>
              <h3 className="text-xl font-extrabold text-slate-100">{jobName}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                {progress}%
              </span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="relative w-full bg-slate-800/80 h-3 rounded-full overflow-hidden border border-slate-700/30">
            <div
              className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(139,92,246,0.5)]"
              style={{ width: `${progress}%` }}
            />
            {status !== "COMPLETED" && status !== "FAILED" && (
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.15)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 p-2 bg-slate-950/40 rounded-xl border border-slate-800/30">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>Elapsed: {formatTime(elapsedSeconds)}</span>
            </div>
            <div>
              <span>Est. Remaining: {getEstimatedRemaining()}</span>
            </div>
          </div>

          {/* Status Specific UI */}
          {status === "FAILED" && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Job Execution Failed</span>
              </div>
              <p className="text-xs text-rose-300 font-mono break-words bg-slate-950/60 p-2.5 rounded-lg border border-rose-500/15">
                {error || "An unknown execution error occurred."}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-[0_2px_10px_rgba(239,68,68,0.3)] hover:scale-[1.02]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Execution
                </button>
              )}
            </div>
          )}

          {status === "COMPLETED" && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm text-emerald-400">Execution Completed Successfully</span>
                <p className="text-xs text-slate-400">Transitioning to results view...</p>
              </div>
            </div>
          )}

          {status === "CANCELLED" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
              <XCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm text-amber-400">Job Execution Cancelled</span>
                <p className="text-xs text-slate-400">The execution run has been cancelled.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Log terminal */}
        <div className="lg:w-[45%] flex flex-col bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden font-mono shadow-2xl h-[280px]">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
              <span className="font-semibold text-slate-300">live-execution-stream.log</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">{logs.length} logs</span>
              <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
            </div>
          </div>
          <div
            ref={logContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-2 text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          >
            {logs.map((log, index) => {
              const isError = log.toLowerCase().includes("error") || log.toLowerCase().includes("fail");
              return (
                <div
                  key={index}
                  className={`leading-relaxed break-words font-mono ${
                    isError ? "text-rose-400 font-bold" : "text-slate-300"
                  }`}
                >
                  <span className="text-violet-500/60 mr-1.5">❯</span>
                  {log}
                </div>
              );
            })}
            {status !== "COMPLETED" && status !== "FAILED" && status !== "CANCELLED" && (
              <div className="flex items-center gap-2 text-violet-400/80 animate-pulse">
                <span className="text-violet-500/60">❯</span>
                <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce" />
                <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Shimmer CSS helper */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default AIJobStatus;
