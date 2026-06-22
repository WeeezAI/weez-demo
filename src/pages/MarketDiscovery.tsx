import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Filter, RefreshCw, Play, Clock, Users, Target,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, TrendingUp, Zap, MessageSquare, Calendar,
  BarChart3, Rocket, Globe, Briefcase, Award
} from "lucide-react";

// Types for the market discovery API
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
}

interface MarketDiscoveryStats {
  total_founder_posts: number;
  completed_discoveries: number;
  total_discovered_posts: number;
  total_discovered_engagers: number;
  total_qualified_leads: number;
}

export default function MarketDiscovery() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [founderPosts, setFounderPosts] = useState<FounderPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FounderPost | null>(null);
  const [discoveredPosts, setDiscoveredPosts] = useState<DiscoveredPost[]>([]);
  const [stats, setStats] = useState<MarketDiscoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringDiscovery, setTriggeringDiscovery] = useState(false);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: string;
    founder_stage?: string;
    search?: string;
  }>({});

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const fetchFounderPosts = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
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
      setLoading(false);
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

  const triggerDiscovery = async () => {
    if (!spaceId) return;
    setTriggeringDiscovery(true);
    try {
      // This would typically open a modal to input post details
      // For now, we'll just show an alert
      alert("To trigger discovery, please provide post details (URL, content, author)");
    } catch (error) {
      console.error("Error triggering discovery:", error);
    } finally {
      setTriggeringDiscovery(false);
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
  }, [fetchFounderPosts, fetchStats]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
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
                onClick={triggerDiscovery}
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Founder Posts" value={stats.total_founder_posts} icon={<Briefcase />} color="#a78bfa" />
            <StatCard label="Completed" value={stats.completed_discoveries} icon={<CheckCircle />} color="#69db7c" />
            <StatCard label="Discovered Posts" value={stats.total_discovered_posts} icon={<MessageSquare />} color="#ffd43b" />
            <StatCard label="Discovered Engagers" value={stats.total_discovered_engagers} icon={<Users />} color="#ff922b" />
            <StatCard label="Qualified Leads" value={stats.total_qualified_leads} icon={<Target />} color="#ff6b6b" />
          </div>
        )}

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
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); collectEngagement(post.id, 2); }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors text-sm"
                        >
                          <Clock className="w-4 h-4" />
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full bg-slate-900 border-l border-slate-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Discovered Posts</h2>
            <p className="text-sm text-slate-400">{founderPost.primary_narrative}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {discoveredPosts.length === 0 ? (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-semibold mb-2">No discovered posts</h3>
              <p className="text-slate-400">Discovery is still in progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {discoveredPosts.map((post) => (
                <div key={post.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-medium">{post.post_author || "Unknown"}</div>
                      <div className="text-sm text-slate-400">{post.author_headline || "—"}</div>
                    </div>
                    {post.selected_for_discovery && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Selected
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Engagement</div>
                      <div className="font-medium">{post.total_engagement}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Overall Score</div>
                      <div className="font-medium">{post.overall_score?.toFixed(3) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Engagers</div>
                      <div className="font-medium">{post.engagers_discovered}</div>
                    </div>
                  </div>

                  {post.selection_reason && (
                    <div className="text-sm text-slate-300 bg-slate-700/30 p-2 rounded-lg">
                      {post.selection_reason}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Post
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
