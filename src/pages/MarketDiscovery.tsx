// src/pages/MarketDiscovery.tsx

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Filter, RefreshCw, Play, Clock, Users, Target,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, TrendingUp, Zap, MessageSquare, Calendar,
  BarChart3, Rocket, Globe, Briefcase, Award, Loader2, Terminal,
  Shield, ShieldAlert, ShieldCheck, ShieldX, Activity, Wifi, WifiOff, Link2, Sparkles, UserCheck
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import aiJobAPI, { JobResultsResponse } from "@/services/aiJobAPI";
import useJobPolling from "@/hooks/useJobPolling";
import AIJobStatus from "@/components/AIJobStatus";

// Types
interface FounderPost {
  id: number;
  customer_id: string;
  post_url: string;
  post_content: string | null;
  post_author: string | null;
  published_at: string | null;
  captured_at: string | null;
  primary_narrative: string | null;
  secondary_narratives: string[] | null;
  topic_clusters: string[] | null;
  discovery_status: string;
  discovery_started_at: string | null;
  discovery_completed_at: string | null;
  founder_stage: string | null;
  total_discovered_posts: number;
  total_discovered_engagers: number;
  total_qualified_leads: number;
}

interface DiscoveredPost {
  id: number;
  founder_post_id: number;
  post_url: string;
  post_content: string | null;
  post_author: string | null;
  author_profile_url: string | null;
  author_headline: string | null;
  published_at: string | null;
  discovered_at: string | null;
  reaction_count: number;
  comment_count: number;
  repost_count: number;
  total_engagement: number;
  post_type: string | null;
  narrative_similarity_score: number | null;
  icp_similarity_score: number | null;
  conversation_relevance_score: number | null;
  intent_density_score: number | null;
  engagement_quality_score: number | null;
  overall_score: number | null;
  selected_for_discovery: boolean;
  selection_reason: string | null;
  engager_discovery_status: string;
  engagers_discovered: number;
  engagement_band?: string | null;
}

interface MarketDiscoveryStats {
  total_founder_posts: number;
  completed_discoveries: number;
  total_discovered_posts: number;
  total_discovered_engagers: number;
  total_qualified_leads: number;
}

interface MarketDiscoveryProps {
  hideHeader?: boolean;
}

export default function MarketDiscovery({ hideHeader = false }: MarketDiscoveryProps) {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [founderPosts, setFounderPosts] = useState<FounderPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FounderPost | null>(null);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoveredPost[]>([]);
  const [stats, setStats] = useState<MarketDiscoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringDiscovery, setTriggeringDiscovery] = useState(false);
  
  // Job Queue / Polling States
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<JobResultsResponse | null>(null);

  // Trigger Modal States
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [triggerUrl, setTriggerUrl] = useState("");
  const [triggerContent, setTriggerContent] = useState("");
  const [triggerAuthor, setTriggerAuthor] = useState("Founder");
  const [triggerStage, setTriggerStage] = useState("early_stage");

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: string;
    founder_stage?: string;
    search?: string;
  }>({});

  // LinkedIn Session States
  const [sessions, setSessions] = useState<any[]>([]);
  const [validatingSession, setValidatingSession] = useState(false);
  const [renewingSession, setRenewingSession] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Recover active job on page refresh/mount
  useEffect(() => {
    const savedJobId = localStorage.getItem("active_discovery_job_id");
    if (savedJobId) {
      setActiveJobId(savedJobId);
      // Try fetching existing results if it completed while away
      aiJobAPI.getJobStatus(savedJobId).then(res => {
        if (res.status === "COMPLETED") {
          aiJobAPI.getResults(savedJobId).then(setJobResults).catch(console.error);
        }
      }).catch(console.error);
    }
  }, []);

  // Sync active job with localStorage
  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem("active_discovery_job_id", activeJobId);
    } else {
      localStorage.removeItem("active_discovery_job_id");
    }
  }, [activeJobId]);

  // Hook into job status polling
  const { status, progress, message, error, logs, elapsedSeconds } = useJobPolling({
    jobId: activeJobId,
    fetchStatus: aiJobAPI.getJobStatus,
    onComplete: async () => {
      if (activeJobId) {
        try {
          const results = await aiJobAPI.getResults(activeJobId);
          setJobResults(results);
          fetchFounderPosts(true);
          fetchStats();
        } catch (err) {
          console.error("Failed to load results:", err);
        }
      }
    },
    onFail: (err) => {
      console.error("Discovery run failed:", err);
    }
  });

  const fetchSessions = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/customer/${spaceId}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  }, [spaceId, API_BASE]);

  const validateSession = async () => {
    if (!spaceId) return;
    setValidatingSession(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/customer/${spaceId}/sessions/validate`, {
        method: "POST"
      });
      if (response.ok) {
        await fetchSessions();
      }
    } catch (error) {
      console.error("Error validating session:", error);
    } finally {
      setValidatingSession(false);
    }
  };

  const renewSession = async () => {
    if (!spaceId) return;
    setRenewingSession(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/customer/${spaceId}/sessions/renew`, {
        method: "POST"
      });
      if (response.ok) {
        await fetchSessions();
      }
    } catch (error) {
      console.error("Error renewing session:", error);
    } finally {
      setRenewingSession(false);
    }
  };

  const fetchFounderPosts = useCallback(async (silent = false) => {
    if (!spaceId) return;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.founder_stage) params.append("founder_stage", filters.founder_stage);
      if (filters.search) params.append("search", filters.search);
      params.append("customer_id", spaceId);

      const response = await fetch(`${API_BASE}/api/v1/market-discovery/founder-posts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFounderPosts(data);
      }
    } catch (error) {
      console.error("Error fetching founder posts:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [spaceId, filters, API_BASE]);

  const fetchStats = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/customer/${spaceId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [spaceId, API_BASE]);

  const fetchDiscoveredPosts = async (founderPostId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/founder-posts/${founderPostId}/discovered-posts`);
      if (response.ok) {
        const data = await response.json();
        setDiscoveredPosts(data);
      }
    } catch (error) {
      console.error("Error fetching discovered posts:", error);
    }
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceId || !triggerUrl) return;
    setTriggeringDiscovery(true);
    try {
      // Step A: Register the Founder Post first on the backend
      const response = await fetch(`${API_BASE}/api/v1/market-discovery/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_url: triggerUrl,
          post_content: triggerContent,
          post_author: triggerAuthor,
          customer_id: spaceId,
          founder_stage: triggerStage,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsTriggerModalOpen(false);
        setTriggerUrl("");
        setTriggerContent("");
        
        // Step B: Dispatch the play execution job using startDiscovery API
        if (result.founder_post_id) {
          setJobResults(null);
          const startRes = await aiJobAPI.startDiscovery(
            result.founder_post_id.toString(),
            triggerUrl,
            triggerContent
          );
          setActiveJobId(startRes.job_id);
        }
      } else {
        const err = await response.json().catch(() => ({ detail: "Trigger failed" }));
        alert(`Failed to trigger discovery: ${err.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error triggering discovery:", error);
      alert("Failed to connect to discovery service");
    } finally {
      setTriggeringDiscovery(false);
    }
  };

  const handleStartExistingPost = async (post: FounderPost) => {
    try {
      setJobResults(null);
      const startRes = await aiJobAPI.startDiscovery(
        post.id.toString(),
        post.post_url,
        post.post_content || ""
      );
      setActiveJobId(startRes.job_id);
    } catch (err: any) {
      alert(`Failed to start discovery job: ${err.message}`);
    }
  };

  const collectEngagement = async (founderPostId: number, intervalHours: number) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/market-discovery/founder-posts/${founderPostId}/engagement-collect/${intervalHours}`,
        { method: "POST" }
      );
      if (response.ok) {
        await fetchFounderPosts();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error collecting engagement:", error);
    }
  };

  useEffect(() => {
    fetchFounderPosts();
    fetchStats();
    fetchSessions();
  }, [fetchFounderPosts, fetchStats, fetchSessions]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "in_progress": "#ffd43b",
      "completed": "#69db7c",
      "failed": "#ff6b6b",
      "pending": "#74c0fc",
    };
    return colors[status] || "#888";
  };

  return (
    <div className={hideHeader ? "text-white" : "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"}>
      {/* Header */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                      Market Discovery
                    </h1>
                    <p className="text-xs text-slate-400">Auto Discovery Engine</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsTriggerModalOpen(true)}
                  disabled={triggeringDiscovery}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {triggeringDiscovery ? "Triggering..." : "Trigger Discovery"}
                </button>
                <button
                  onClick={() => { fetchFounderPosts(); fetchStats(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className={hideHeader ? "max-w-7xl mx-auto py-8" : "max-w-7xl mx-auto px-6 py-8"}>
        {/* Controls (Trigger & Refresh) for when header is hidden */}
        {hideHeader && (
          <div className="flex items-center justify-between mb-8 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                <Rocket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">Discovery Engine</h3>
                <p className="text-[10px] text-slate-400">Control active campaign discovery runs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsTriggerModalOpen(true)}
                disabled={triggeringDiscovery}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl transition-colors disabled:opacity-50 text-xs font-bold"
              >
                <Play className="w-3.5 h-3.5" />
                {triggeringDiscovery ? "Triggering..." : "Trigger Discovery"}
              </button>
              <button
                onClick={() => { fetchFounderPosts(); fetchStats(); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors text-xs font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && !jobResults && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Founder Posts" value={stats.total_founder_posts} icon={<Briefcase />} color="#a78bfa" />
            <StatCard label="Completed" value={stats.completed_discoveries} icon={<CheckCircle />} color="#69db7c" />
            <StatCard label="Discovered Posts" value={stats.total_discovered_posts} icon={<MessageSquare />} color="#ffd43b" />
            <StatCard label="Discovered Engagers" value={stats.total_discovered_engagers} icon={<Users />} color="#ff922b" />
            <StatCard label="Qualified Leads" value={stats.total_qualified_leads} icon={<Target />} color="#ff6b6b" />
          </div>
        )}

        {/* Active AI Job framework component */}
        {activeJobId && !jobResults && (
          <div className="mb-8">
            <AIJobStatus
              status={status}
              progress={progress}
              message={message}
              error={error}
              logs={logs}
              elapsedSeconds={elapsedSeconds}
              jobName="LinkedIn Lead Discovery Pipeline"
              onRetry={() => {
                if (activeJobId) {
                  setActiveJobId(null);
                  setIsTriggerModalOpen(true);
                }
              }}
            />
          </div>
        )}

        {/* Completed Job Results View */}
        {jobResults && (
          <div className="mb-8 space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="p-6 bg-slate-900/80 border border-emerald-500/30 rounded-2xl shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                      Market Discovery Results
                    </h2>
                    <p className="text-xs text-slate-400">Job ID: {jobResults.job_id} | Completed successfully</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setJobResults(null);
                    setActiveJobId(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Return to Dashboard
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Engagers Scanned" value={jobResults.metrics.engagers_found} icon={<Users />} color="#60a5fa" />
                <StatCard label="Qualified Leads" value={jobResults.metrics.qualified_leads} icon={<Target />} color="#34d399" />
                <StatCard label="Discovered Posts" value={jobResults.discovered_posts.length} icon={<MessageSquare />} color="#a78bfa" />
                <StatCard label="Overall Intent Score" value="84%" icon={<TrendingUp />} color="#f472b6" />
              </div>

              {/* Founder Post Summary */}
              {jobResults.founder_post && (
                <div className="p-5 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">Target Narrative Context</span>
                  <h4 className="font-semibold text-slate-200 text-sm">{jobResults.founder_post.primary_narrative || "No narrative extracted."}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-h-20 overflow-y-auto">{jobResults.founder_post.post_content}</p>
                  
                  {jobResults.founder_post.topic_clusters && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {jobResults.founder_post.topic_clusters.map((topic: string, i: number) => (
                        <span key={i} className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700/30">
                          #{topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs for Results details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Discovered Qualified Leads ({jobResults.engagers.length})
                </h3>

                {jobResults.engagers.length === 0 ? (
                  <div className="text-center py-10 bg-slate-800/20 rounded-xl border border-dashed border-slate-800">
                    <p className="text-xs text-slate-500">No leads qualified above ICP threshold (60+).</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobResults.engagers.map((engager: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-800/30 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="font-bold text-sm text-slate-200">{engager.name}</span>
                            <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-1">{engager.headline}</p>
                            <p className="text-[11px] text-violet-400 mt-1">{engager.role} at {engager.company}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[9px] text-slate-500 uppercase">ICP Score</span>
                            <span className="text-sm font-black text-emerald-400 font-mono">{engager.icp_score || 0}</span>
                          </div>
                        </div>

                        {engager.buying_signals && engager.buying_signals.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {engager.buying_signals.map((sig: string, idx: number) => (
                              <span key={idx} className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                                ⚡ {sig}
                              </span>
                            ))}
                          </div>
                        )}

                        {engager.recommended_action && (
                          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] text-slate-300">
                            <span className="font-bold text-violet-400 block mb-0.5">Recommended Outreach:</span>
                            {engager.recommended_action}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[10px] text-slate-500">Source: {engager.engagement_type}</span>
                          <a
                            href={engager.profile_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1"
                          >
                            LinkedIn Profile
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LinkedIn Session Health Monitor */}
        <SessionHealthPanel
          sessions={sessions}
          validatingSession={validatingSession}
          renewingSession={renewingSession}
          onValidate={validateSession}
          onRenew={renewSession}
          onRefresh={fetchSessions}
        />

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {Object.keys(filters).length > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <FilterInput
                label="Search"
                type="text"
                placeholder="Search posts..."
                value={filters.search || ""}
                onChange={(v) => handleFilterChange("search", v)}
              />
              <FilterSelect
                label="Status"
                value={filters.status || ""}
                onChange={(v) => handleFilterChange("status", v || undefined)}
                options={[
                  { value: "", label: "All" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "completed", label: "Completed" },
                  { value: "failed", label: "Failed" },
                ]}
              />
              <FilterSelect
                label="Founder Stage"
                value={filters.founder_stage || ""}
                onChange={(v) => handleFilterChange("founder_stage", v || undefined)}
                options={[
                  { value: "", label: "All" },
                  { value: "early_stage", label: "Early Stage" },
                  { value: "growing", label: "Growing" },
                  { value: "mature", label: "Mature" },
                ]}
              />
            </div>
          )}
        </div>

        {/* Founder Posts Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : founderPosts.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
            <Rocket className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold mb-2">No founder posts found</h3>
            <p className="text-slate-400">Trigger discovery to start finding similar content</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/30">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Post</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Narrative</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Discovered</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Engagers</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Qualified</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {founderPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedPost(post); fetchDiscoveredPosts(post.id); }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">{post.post_author || "Unknown"}</div>
                        <div className="text-sm text-slate-400 truncate max-w-xs">{post.post_content || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300 line-clamp-2 max-w-xs">
                          {post.primary_narrative || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: `${getStatusColor(post.discovery_status)}20`,
                            color: getStatusColor(post.discovery_status),
                          }}
                        >
                          {post.discovery_status}
                          {post.discovery_status === "in_progress" && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{post.total_discovered_posts}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{post.total_discovered_engagers}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{post.total_qualified_leads}</div>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartExistingPost(post); }}
                          disabled={post.discovery_status === "in_progress"}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-xs font-bold disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Discover
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); collectEngagement(post.id, 2); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors text-xs font-bold"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          T+2h
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Discovered Posts Drawer */}
      {selectedPost && (
        <DiscoveredPostsDrawer
          founderPost={selectedPost}
          discoveredPosts={discoveredPosts}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Trigger Discovery Dialog */}
      <Dialog open={isTriggerModalOpen} onOpenChange={setIsTriggerModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border border-slate-700 text-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-violet-400" />
              Trigger Market Discovery
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Provide post details to start the auto discovery process.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerSubmit} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Post URL</label>
              <input
                type="url"
                required
                placeholder="e.g. https://www.linkedin.com/feed/update/urn:li:activity:..."
                value={triggerUrl}
                onChange={(e) => setTriggerUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Post Author</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe (Founder)"
                value={triggerAuthor}
                onChange={(e) => setTriggerAuthor(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Founder Stage</label>
              <select
                value={triggerStage}
                onChange={(e) => setTriggerStage(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white"
              >
                <option value="early_stage">Early Stage</option>
                <option value="growing">Growing</option>
                <option value="mature">Mature</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Post Content</label>
              <textarea
                rows={4}
                placeholder="Paste the caption or post content here..."
                value={triggerContent}
                onChange={(e) => setTriggerContent(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTriggerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={triggeringDiscovery}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {triggeringDiscovery ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Triggering...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Discovery
                  </>
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-2" style={{ color }}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function FilterInput({ label, type, placeholder, value, onChange }: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
      />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function DiscoveredPostsDrawer({ founderPost, discoveredPosts, onClose }: {
  founderPost: FounderPost;
  discoveredPosts: DiscoveredPost[];
  onClose: () => void;
}) {
  const selectedCount = discoveredPosts.filter(p => p.selected_for_discovery).length;
  const discardedCount = discoveredPosts.length - selectedCount;

  const renderBandBadge = (band: string | null, reaction_count: number, comment_count: number, repost_count: number) => {
    const total = reaction_count + comment_count + repost_count;
    const resolvedBand = band || (total >= 1000 ? "high" : total >= 50 ? "medium" : total >= 10 ? "low" : "very_low");
    switch (resolvedBand) {
      case "high":
        return <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">🔴 High ({total})</span>;
      case "medium":
        return <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">🟢 Medium ({total})</span>;
      case "low":
        return <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">🟡 Low ({total})</span>;
      default:
        return <span className="text-[10px] font-bold bg-slate-700/30 text-slate-500 border border-slate-700/50 px-2 py-0.5 rounded">⚪ Very Low ({total})</span>;
    }
  };

  const getScoreColorClass = (score: number | null) => {
    if (score === null || score === undefined) return "text-slate-400";
    if (score >= 0.85) return "text-emerald-400 font-extrabold";
    if (score >= 0.65) return "text-emerald-500 font-semibold";
    if (score >= 0.50) return "text-amber-400 font-semibold";
    return "text-rose-400";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full bg-slate-900 border-l border-slate-700/50 overflow-y-auto">
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              Discovered Posts Intelligence
            </h2>
            <p className="text-xs text-slate-400 line-clamp-1 max-w-[500px]">Narrative: {founderPost.primary_narrative}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {discoveredPosts.length === 0 ? (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-semibold mb-2">No discovered posts</h3>
              <p className="text-slate-400">Discovery is still in progress or no posts found.</p>
            </div>
          ) : (
            <>
              {/* Selection Summary Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                <div className="text-center md:text-left">
                  <div className="text-xs text-slate-400">Total Scanned</div>
                  <div className="text-2xl font-bold mt-1 text-slate-100">{discoveredPosts.length} posts</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">from LinkedIn search</div>
                </div>
                <div className="text-center md:text-left border-y md:border-y-0 md:border-x border-slate-700/50 py-3 md:py-0 md:px-4">
                  <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center md:justify-start gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Selected for Discovery
                  </div>
                  <div className="text-2xl font-bold mt-1 text-emerald-400">{selectedCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Threshold overall_score &ge; 0.45</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-xs text-rose-400 font-semibold flex items-center justify-center md:justify-start gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Discarded
                  </div>
                  <div className="text-2xl font-bold mt-1 text-rose-400">{discardedCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Below selection criteria</div>
                </div>
              </div>

              {/* Scoring Formula Legend */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700/40 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Narrative-Aware Scoring Formula Weights
                </h4>
                <div className="w-full h-3 rounded-full overflow-hidden flex text-[10px] font-bold text-slate-900">
                  <div className="bg-violet-400 h-full flex items-center justify-center" style={{ width: "35%" }} title="Narrative Sim (35%)">35%</div>
                  <div className="bg-cyan-400 h-full flex items-center justify-center" style={{ width: "25%" }} title="ICP Fit (25%)">25%</div>
                  <div className="bg-amber-400 h-full flex items-center justify-center" style={{ width: "15%" }} title="Intent Density (15%)">15%</div>
                  <div className="bg-emerald-400 h-full flex items-center justify-center" style={{ width: "15%" }} title="Engagement Q. (15%)">15%</div>
                  <div className="bg-pink-400 h-full flex items-center justify-center" style={{ width: "10%" }} title="Rev Learning (10%)">10%</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-400 inline-block" /> Narrative Similarity (35%)</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-400 inline-block" /> ICP Fit (25%)</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400 inline-block" /> Intent Density (15%)</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400 inline-block" /> Engagement Q. (15%)</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-pink-400 inline-block" /> Rev Learning (10%)</div>
                </div>
              </div>

              {/* Scored Posts List */}
              <div className="space-y-4">
                {discoveredPosts.map((post) => (
                  <div 
                    key={post.id} 
                    className={`bg-slate-800/40 rounded-xl p-5 border transition-all duration-300 ${
                      post.selected_for_discovery 
                        ? "border-violet-500/20 hover:border-violet-500/40 shadow-lg shadow-violet-500/5" 
                        : "border-slate-800 opacity-75 hover:opacity-100"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3.5 gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-200">{post.post_author || "Unknown"}</span>
                          {renderBandBadge(post.engagement_band || null, post.reaction_count, post.comment_count, post.repost_count)}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{post.author_headline || "—"}</div>
                      </div>
                      
                      {/* Overall Score display */}
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Overall Score</span>
                        <span className={`text-xl font-mono leading-none mt-1 ${getScoreColorClass(post.overall_score)}`}>
                          {(post.overall_score || 0).toFixed(2)}
                        </span>
                        {post.selected_for_discovery ? (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full mt-1.5 flex items-center gap-0.5">
                            ✓ Selected
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded-full mt-1.5">
                            — Discarded
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Content snippet */}
                    <div className="text-xs text-slate-300 bg-slate-900/30 p-3 rounded-lg border border-slate-800 mb-4 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {post.post_content || "—"}
                    </div>
                    
                    {/* Score Breakdown (5 Mini Bars) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-slate-900/10 p-3.5 rounded-lg border border-slate-800/50">
                      <div className="space-y-2">
                        {/* Narrative similarity */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                            <span>Narrative Sim (35%)</span>
                            <span className="font-mono font-bold text-violet-400">
                              {post.narrative_similarity_score !== null ? `${(post.narrative_similarity_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-violet-400 h-full rounded-full" style={{ width: `${(post.narrative_similarity_score || 0) * 100}%` }} />
                          </div>
                        </div>

                        {/* ICP Similarity */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                            <span>ICP Fit (25%)</span>
                            <span className="font-mono font-bold text-cyan-400">
                              {post.icp_similarity_score !== null ? `${(post.icp_similarity_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${(post.icp_similarity_score || 0) * 100}%` }} />
                          </div>
                        </div>

                        {/* Intent Density */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                            <span>Intent Density (15%)</span>
                            <span className="font-mono font-bold text-amber-400">
                              {post.intent_density_score !== null ? `${(post.intent_density_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(post.intent_density_score || 0) * 100}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Engagement Quality */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                            <span>Engagement Quality (15%)</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {post.engagement_quality_score !== null ? `${(post.engagement_quality_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${(post.engagement_quality_score || 0) * 100}%` }} />
                          </div>
                        </div>

                        {/* Revenue Learning */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                            <span>Revenue Learning Weight (10%)</span>
                            <span className="font-mono font-bold text-pink-400">
                              {post.overall_score !== null ? `${(post.overall_score * 100).toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-pink-400 h-full rounded-full" style={{ width: `${(post.overall_score || 0) * 100}%` }} />
                          </div>
                        </div>
                        
                        <div className="pt-1.5 text-[9px] text-slate-500 italic">
                          Formula: 35% Narrative + 25% ICP + 15% Intent + 15% Eng Q + 10% Rev
                        </div>
                      </div>
                    </div>

                    {/* Selection Reason */}
                    {post.selection_reason && (
                      <div className="text-xs text-slate-300 bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex items-start gap-2 mb-3.5">
                        <AlertCircle className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-400">Selection Intelligence: </span>
                          {post.selection_reason}
                        </div>
                      </div>
                    )}

                    {/* Action Panel */}
                    <div className="flex gap-2">
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors text-xs text-slate-300 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on LinkedIn
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LinkedIn Session Health Monitor ─────────────────────────────────────

interface SessionData {
  id: number;
  session_id: string;
  customer_id: string;
  status: string;
  created_at: string | null;
  last_validated_at: string | null;
  last_successful_scrape: string | null;
  last_failed_scrape: string | null;
  last_auto_renewed_at: string | null;
  session_age: number;
  failure_count: number;
  health_score: number;
  blob_storage_path: string | null;
  auto_renewal_count: number;
  successful_searches: number;
  successful_scrapes: number;
  failed_searches: number;
  failed_scrapes: number;
}

function SessionHealthPanel({
  sessions,
  validatingSession,
  renewingSession,
  onValidate,
  onRenew,
  onRefresh,
}: {
  sessions: any[];
  validatingSession: boolean;
  renewingSession: boolean;
  onValidate: () => void;
  onRenew: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) {
    return (
      <div className="mb-8 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-300">LinkedIn Session</div>
            <div className="text-[11px] text-slate-500">No active session detected. Validate to initialize.</div>
          </div>
        </div>
        <button
          onClick={onValidate}
          disabled={validatingSession}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          {validatingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
          {validatingSession ? "Validating..." : "Initialize Session"}
        </button>
      </div>
    );
  }

  const session: SessionData = sessions[0];
  const isHealthy = session.status === "healthy";
  const isWarning = session.status === "warning";
  const isExpired = session.status === "expired";

  const statusConfig = isHealthy
    ? {
        icon: <ShieldCheck className="w-5 h-5" />,
        label: "Healthy",
        color: "#34d399",
        bgColor: "rgba(52, 211, 153, 0.08)",
        borderColor: "rgba(52, 211, 153, 0.2)",
        ringColor: "stroke-emerald-400",
        textColor: "text-emerald-400",
        pulseClass: "",
      }
    : isWarning
    ? {
        icon: <ShieldAlert className="w-5 h-5" />,
        label: "Degraded",
        color: "#fbbf24",
        bgColor: "rgba(251, 191, 36, 0.08)",
        borderColor: "rgba(251, 191, 36, 0.25)",
        ringColor: "stroke-amber-400",
        textColor: "text-amber-400",
        pulseClass: "animate-pulse",
      }
    : {
        icon: <ShieldX className="w-5 h-5" />,
        label: "Expired",
        color: "#f87171",
        bgColor: "rgba(248, 113, 113, 0.08)",
        borderColor: "rgba(248, 113, 113, 0.3)",
        ringColor: "stroke-rose-400",
        textColor: "text-rose-400",
        pulseClass: "animate-pulse",
      };

  const totalOps = session.successful_searches + session.successful_scrapes + session.failed_searches + session.failed_scrapes;
  const successOps = session.successful_searches + session.successful_scrapes;
  const successRate = totalOps > 0 ? Math.round((successOps / totalOps) * 100) : 100;

  const formatTimeAgo = (isoStr: string | null) => {
    if (!isoStr) return "Never";
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (session.health_score / 100) * circumference;

  return (
    <div className="mb-8 space-y-3">
      {!isHealthy && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 ${statusConfig.pulseClass}`}
          style={{
            backgroundColor: statusConfig.bgColor,
            borderColor: statusConfig.borderColor,
          }}
        >
          <div style={{ color: statusConfig.color }}>{statusConfig.icon}</div>
          <div className="flex-1">
            <span className="text-sm font-bold" style={{ color: statusConfig.color }}>
              {isExpired ? "⚠ LinkedIn Session Expired" : "⚡ Session Health Degraded"}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isExpired
                ? "All scraping operations will fail. Re-validate or reconnect the session immediately to resume discovery."
                : `Session has ${session.failure_count} failure(s). Health score at ${session.health_score}%. Consider re-validating.`}
            </p>
          </div>
          <button
            onClick={onValidate}
            disabled={validatingSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${statusConfig.color}20`,
              color: statusConfig.color,
            }}
          >
            {validatingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {validatingSession ? "Checking..." : "Re-Validate Now"}
          </button>
        </div>
      )}

      <div
        className="rounded-2xl border overflow-hidden transition-all duration-300"
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.5)",
          borderColor: isHealthy ? "rgba(100, 116, 139, 0.2)" : statusConfig.borderColor,
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4" className="stroke-slate-700/50" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  strokeWidth="4"
                  className={statusConfig.ringColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xs font-bold ${statusConfig.textColor}`}>{session.health_score}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200">LinkedIn Session</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.pulseClass}`}
                  style={{
                    backgroundColor: `${statusConfig.color}15`,
                    color: statusConfig.color,
                    borderColor: `${statusConfig.color}30`,
                  }}
                >
                  {isHealthy ? <Wifi className="w-2.5 h-2.5 inline mr-0.5" /> : <WifiOff className="w-2.5 h-2.5 inline mr-0.5" />}
                  {statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                <span>Validated: {formatTimeAgo(session.last_validated_at)}</span>
                <span className="text-slate-700">•</span>
                <span>Last scrape: {formatTimeAgo(session.last_successful_scrape)}</span>
                <span className="text-slate-700">•</span>
                <span>Age: {session.session_age}h</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-mono bg-slate-800/60 text-slate-400 px-2.5 py-1 rounded-lg border border-slate-700/40">
                {session.successful_searches + session.successful_scrapes} ops
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {successRate}% success
              </span>
              {session.failure_count > 0 && (
                <span className="text-[10px] font-mono bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  {session.failure_count} failures
                </span>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onValidate();
              }}
              disabled={validatingSession || renewingSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
            >
              {validatingSession ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              {validatingSession ? "Checking" : "Validate"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenew();
              }}
              disabled={validatingSession || renewingSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
            >
              {renewingSession ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {renewingSession ? "Renewing" : "Force Renew"}
            </button>

            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {expanded && (
          <div className="px-5 pb-5 border-t border-slate-700/30 pt-4 space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricTile
                label="Successful Searches"
                value={session.successful_searches}
                icon={<Search className="w-3.5 h-3.5" />}
                color="#34d399"
              />
              <MetricTile
                label="Successful Scrapes"
                value={session.successful_scrapes}
                icon={<Link2 className="w-3.5 h-3.5" />}
                color="#60a5fa"
              />
              <MetricTile
                label="Failed Searches"
                value={session.failed_searches}
                icon={<XCircle className="w-3.5 h-3.5" />}
                color="#f87171"
              />
              <MetricTile
                label="Failed Scrapes"
                value={session.failed_scrapes}
                icon={<AlertCircle className="w-3.5 h-3.5" />}
                color="#fb923c"
              />
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 bg-slate-900/30 p-3 rounded-xl border border-slate-800/50">
              <div>
                <span className="text-slate-500 block">Created</span>
                <span className="font-mono text-slate-300">
                  {session.created_at ? new Date(session.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Validated</span>
                <span className="font-mono text-slate-300">
                  {session.last_validated_at ? new Date(session.last_validated_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Successful Scrape</span>
                <span className="font-mono text-emerald-400">
                  {session.last_successful_scrape ? new Date(session.last_successful_scrape).toLocaleString() : "Never"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Failed Scrape</span>
                <span className="font-mono text-rose-400">
                  {session.last_failed_scrape ? new Date(session.last_failed_scrape).toLocaleString() : "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Auto-Renewed</span>
                <span className="font-mono text-cyan-400">
                  {session.last_auto_renewed_at ? new Date(session.last_auto_renewed_at).toLocaleString() : "Never"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Renewal Count</span>
                <span className="font-mono text-cyan-400 text-center block">
                  {session.auto_renewal_count ?? 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono">
              <span>Session ID: {session.session_id}</span>
              {session.blob_storage_path && (
                <>
                  <span className="text-slate-700">|</span>
                  <span>Storage: {session.blob_storage_path}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="p-3 rounded-xl border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}18`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-200">{value}</div>
    </div>
  );
}
