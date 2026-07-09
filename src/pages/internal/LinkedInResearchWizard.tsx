// src/pages/internal/LinkedInResearchWizard.tsx
//
// Multi-step wizard for connecting/reconnecting the Dexraflow LinkedIn
// Research Account. INTERNAL ADMIN USE ONLY.

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Monitor,
  Download,
  Upload,
  Shield,
  Wifi,
  WifiOff,
  Cookie,
  HardDrive,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Fingerprint,
  Lock,
  Cloud,
  CloudUpload,
  CloudDownload,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import internalSessionAPI, {
  SessionStatus,
  BrowserLaunchResult,
  BrowserStatus,
  CaptureResult,
  ValidateResult,
  ProfileResult,
} from "@/services/internalSessionAPI";

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Session Status", icon: Wifi },
  { id: 2, label: "Launch Browser", icon: Monitor },
  { id: 3, label: "Capture Session", icon: Cookie },
  { id: 4, label: "Persist & Deploy", icon: Cloud },
] as const;

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtBytes = (b: number) => {
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const fmtTime = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Stepper ─────────────────────────────────────────────────────────────────
const Stepper = ({
  current,
  onStepClick,
}: {
  current: number;
  onStepClick: (s: number) => void;
}) => (
  <div className="flex items-center gap-1 mb-8 px-2">
    {STEPS.map((step, i) => {
      const Icon = step.icon;
      const isActive = step.id === current;
      const isDone = step.id < current;
      return (
        <div key={step.id} className="flex items-center flex-1 last:flex-initial">
          <button
            onClick={() => onStepClick(step.id)}
            className={`
              flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold
              transition-all duration-300 whitespace-nowrap
              ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
                  : isDone
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                  : "bg-slate-800/50 text-slate-500 hover:text-slate-400 hover:bg-slate-800"
              }
            `}
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : ""}`} />
            )}
            <span className="hidden md:inline">{step.label}</span>
          </button>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-slate-700 mx-1 flex-shrink-0" />
          )}
        </div>
      );
    })}
  </div>
);

// ─── Status Pill ─────────────────────────────────────────────────────────────
const StatusPill = ({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) => (
  <span
    className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider
      ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}
    `}
  >
    {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
    {label}
  </span>
);

// ─── Info Tile ───────────────────────────────────────────────────────────────
const InfoTile = ({
  icon: Icon,
  label,
  value,
  accent = "text-slate-300",
}: {
  icon: any;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${accent}`} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
    <p className={`text-sm font-bold ${accent}`}>{value}</p>
  </div>
);

// ─── STEP 1: Session Status ──────────────────────────────────────────────────
const Step1SessionStatus = ({
  onNext,
}: {
  onNext: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await internalSessionAPI.getStatus();
      setStatus(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          Checking Research Account Status…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <XCircle className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-sm text-red-400 font-medium">{error}</p>
        <Button
          onClick={fetchStatus}
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const s = status!;
  const hasSession = s.stored_session_exists;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">
                LinkedIn Research Account
              </h3>
              <p className="text-xs text-slate-500">
                Customer ID:{" "}
                <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {s.research_customer_id}
                </code>
              </p>
            </div>
            <StatusPill
              ok={hasSession}
              label={hasSession ? "Session Active" : "Not Configured"}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile
              icon={hasSession ? Wifi : WifiOff}
              label="Session"
              value={hasSession ? "Connected" : "Disconnected"}
              accent={hasSession ? "text-emerald-400" : "text-red-400"}
            />
            <InfoTile
              icon={Cookie}
              label="Cookies"
              value={String(s.stored_session_cookies)}
              accent={s.stored_session_cookies > 0 ? "text-amber-400" : "text-slate-500"}
            />
            <InfoTile
              icon={HardDrive}
              label="Profile"
              value={s.profile_exists ? fmtBytes(s.profile_size_bytes) : "None"}
              accent={s.profile_exists ? "text-cyan-400" : "text-slate-500"}
            />
            <InfoTile
              icon={Globe}
              label="Browser"
              value={s.browser_active ? "Active" : "Inactive"}
              accent={s.browser_active ? "text-green-400" : "text-slate-500"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guidance */}
      {!hasSession && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Research Account Not Connected
            </p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              The Auto Market Discovery Engine requires an authenticated LinkedIn session.
              Click below to set up the Research Account through a secure browser-based login.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={fetchStatus}
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Refresh
        </Button>
        <Button
          onClick={onNext}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
        >
          {hasSession ? "Reconnect Account" : "Set Up Account"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// ─── STEP 2: Launch Browser ──────────────────────────────────────────────────
const Step2LaunchBrowser = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const [launching, setLaunching] = useState(false);
  const [browserActive, setBrowserActive] = useState(false);
  const [result, setResult] = useState<BrowserLaunchResult | null>(null);
  const [pollStatus, setPollStatus] = useState<BrowserStatus | null>(null);
  const [error, setError] = useState("");

  // Poll browser status when active
  useEffect(() => {
    if (!browserActive) return;
    const interval = setInterval(async () => {
      try {
        const st = await internalSessionAPI.getBrowserStatus();
        setPollStatus(st);
        if (!st.active) setBrowserActive(false);
      } catch {
        // silent
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [browserActive]);

  const handleLaunch = async () => {
    setLaunching(true);
    setError("");
    try {
      const res = await internalSessionAPI.launchBrowser();
      setResult(res);
      if (res.status === "launched" || res.status === "already_active") {
        setBrowserActive(true);
      }
    } catch (e: any) {
      setError(e.message || "Failed to launch browser");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instruction Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Monitor,
            title: "Browser Opens",
            desc: "A Chromium window opens on the server showing LinkedIn's login page.",
            accent: "text-indigo-400",
            bg: "bg-indigo-500/10",
          },
          {
            icon: Fingerprint,
            title: "Log In Manually",
            desc: "Enter credentials and complete 2FA in the browser. We never store your password.",
            accent: "text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            icon: Shield,
            title: "Session Captured",
            desc: "Once logged in, we capture only the session cookies — never credentials.",
            accent: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
        ].map((card) => (
          <Card
            key={card.title}
            className="border-slate-700/60 bg-slate-900/80"
          >
            <CardContent className="p-5">
              <div
                className={`h-10 w-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}
              >
                <card.icon className={`h-5 w-5 ${card.accent}`} />
              </div>
              <h4 className="text-sm font-bold text-slate-200 mb-1">
                {card.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {card.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status */}
      {browserActive && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="relative">
            <Monitor className="h-5 w-5 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              Browser is Active
            </p>
            <p className="text-xs text-slate-400">
              {pollStatus?.current_url
                ? `Currently on: ${pollStatus.current_url}`
                : "Waiting for status…"}
            </p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
            LIVE
          </Badge>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result?.status === "already_active" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
          <p className="text-sm text-amber-300">{result.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          Back
        </Button>
        <div className="flex gap-3">
          {!browserActive ? (
            <Button
              onClick={handleLaunch}
              disabled={launching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
            >
              {launching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Launching…
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4 mr-2" />
                  Launch LinkedIn Browser
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onNext}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6"
            >
              Continue to Capture
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── STEP 3: Capture Session ─────────────────────────────────────────────────
const Step3CaptureSession = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  const handleCapture = async () => {
    setCapturing(true);
    setError("");
    try {
      const res = await internalSessionAPI.captureSession();
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Failed to capture session");
    } finally {
      setCapturing(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await internalSessionAPI.closeBrowser();
    } catch {
      // non-critical
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card className="border-slate-700/60 bg-slate-900/80">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <Cookie className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">
                Capture Authenticated Session
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Make sure you're fully logged in to LinkedIn in the browser window (feed page visible).
                Click "Capture" to extract the session cookies and storage state.
                The browser will then be closed automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && result.status === "captured" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h4 className="text-sm font-bold text-emerald-300">
                Session Captured Successfully
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoTile
                icon={Cookie}
                label="Cookies"
                value={String(result.cookies_count ?? 0)}
                accent="text-amber-400"
              />
              <InfoTile
                icon={HardDrive}
                label="State Size"
                value={fmtBytes(result.storage_state_size ?? 0)}
                accent="text-cyan-400"
              />
              <InfoTile
                icon={result.is_authenticated ? CheckCircle2 : XCircle}
                label="Authenticated"
                value={result.is_authenticated ? "Yes" : "No"}
                accent={result.is_authenticated ? "text-emerald-400" : "text-red-400"}
              />
              <InfoTile
                icon={Globe}
                label="Captured At"
                value={fmtTime(result.captured_at ?? null)}
                accent="text-slate-300"
              />
            </div>

            {!result.is_authenticated && (
              <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  The session does not appear to be fully authenticated. Make sure you completed login
                  and 2FA in the browser before capturing.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          Back
        </Button>
        <div className="flex gap-3">
          {!result ? (
            <Button
              onClick={handleCapture}
              disabled={capturing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
            >
              {capturing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Capturing…
                </>
              ) : (
                <>
                  <Cookie className="h-4 w-4 mr-2" />
                  Capture Session
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={async () => {
                  await handleClose();
                  onNext();
                }}
                disabled={closing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6"
              >
                {closing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Close Browser & Continue
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── STEP 4: Persist & Deploy ────────────────────────────────────────────────
const Step4PersistDeploy = ({ onBack }: { onBack: () => void }) => {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadResult, setUploadResult] = useState<ProfileResult | null>(null);
  const [downloadResult, setDownloadResult] = useState<ProfileResult | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    setUploading(true);
    setError("");
    try {
      const res = await internalSessionAPI.uploadProfile();
      setUploadResult(res);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await internalSessionAPI.downloadProfile();
      setDownloadResult(res);
    } catch (e: any) {
      setError(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setError("");
    try {
      const res = await internalSessionAPI.validateSession();
      setValidateResult(res);
    } catch (e: any) {
      setError(e.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cloud Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Upload */}
        <Card className="border-slate-700/60 bg-slate-900/80">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <CloudUpload className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Upload to Cloud
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Encrypt & upload browser profile to Azure Blob Storage for production workers.
                </p>
              </div>
            </div>
            {uploadResult?.status === "exported" && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">
                  Uploaded • {fmtBytes(uploadResult.size_bytes ?? 0)}
                  {uploadResult.encrypted && (
                    <Lock className="inline h-3 w-3 ml-1 text-emerald-400" />
                  )}
                </span>
              </div>
            )}
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? "Uploading…" : "Upload Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Download */}
        <Card className="border-slate-700/60 bg-slate-900/80">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <CloudDownload className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Download from Cloud
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Restore a previously saved browser profile from Azure Blob Storage.
                </p>
              </div>
            </div>
            {downloadResult?.status === "imported" && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">
                  Profile restored successfully
                </span>
              </div>
            )}
            <Button
              onClick={handleDownload}
              disabled={downloading}
              variant="outline"
              className="w-full bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {downloading ? "Downloading…" : "Download Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Validation */}
      <Card className="border-slate-700/60 bg-slate-900/80">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Validate Session
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Run a headless check against LinkedIn to confirm the captured session is still valid.
                </p>
              </div>
            </div>
            {validateResult && (
              <StatusPill
                ok={validateResult.status === "valid"}
                label={validateResult.status === "valid" ? "Valid" : "Expired"}
              />
            )}
          </div>

          {validateResult?.status === "valid" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Session is Valid ✓
                </p>
                <p className="text-[11px] text-slate-400">
                  The LinkedIn Research Account is fully operational. The Auto Market Discovery Engine
                  can proceed with scraping.
                </p>
              </div>
            </div>
          )}

          {validateResult?.status === "expired" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  Session Expired
                </p>
                <p className="text-[11px] text-slate-400">
                  The session needs to be re-authenticated. Go back to Step 2 to launch a new browser session.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleValidate}
            disabled={validating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Validation Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          onClick={onBack}
          variant="outline"
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          Back
        </Button>
      </div>
    </div>
  );
};

// ─── Main Wizard ─────────────────────────────────────────────────────────────
const LinkedInResearchWizard = () => {
  const [step, setStep] = useState(1);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              LinkedIn Research Account Wizard
            </h2>
            <p className="text-xs text-slate-500">
              Connect and maintain the shared LinkedIn session for Auto Market Discovery
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <Stepper current={step} onStepClick={setStep} />

      {/* Step Content */}
      {step === 1 && <Step1SessionStatus onNext={() => setStep(2)} />}
      {step === 2 && (
        <Step2LaunchBrowser
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3CaptureSession
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && <Step4PersistDeploy onBack={() => setStep(3)} />}
    </div>
  );
};

export default LinkedInResearchWizard;
