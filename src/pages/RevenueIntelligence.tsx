import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Filter, RefreshCw, TrendingUp, DollarSign, Users,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, BarChart3, Target, Zap, MessageSquare, Calendar,
  Globe, Briefcase, Award, PieChart, LineChart, Settings
} from "lucide-react";

// Types for the revenue intelligence API
interface NarrativePerformance {
  id: number;
  customer_id: string;
  narrative_text: string;
  narrative_type: string | null;
  posts_generated: number;
  leads_generated: number;
  qualified_leads: number;
  replies: number;
  meetings: number;
  opportunities: number;
  customers: number;
  revenue: number;
  lead_yield: number | null;
  meeting_yield: number | null;
  opportunity_yield: number | null;
  customer_yield: number | null;
  revenue_yield: number | null;
  priority_score: number;
  is_saturated: boolean;
  saturation_detected_at: string | null;
  last_updated_at: string;
  created_at: string;
}

interface PostPerformance {
  id: number;
  customer_id: string;
  post_id: number;
  post_url: string;
  narrative: string | null;
  topic_cluster: string | null;
  post_format: string | null;
  lead_count: number;
  reply_count: number;
  meeting_count: number;
  opportunity_count: number;
  customer_count: number;
  revenue_generated: number;
  post_revenue_score: number | null;
  post_meeting_score: number | null;
  post_opportunity_score: number | null;
  last_updated_at: string;
  created_at: string;
}

interface LeadSourcePerformance {
  id: number;
  customer_id: string;
  source_type: string;
  leads: number;
  replies: number;
  meetings: number;
  opportunities: number;
  customers: number;
  revenue: number;
  lead_to_reply_rate: number | null;
  reply_to_meeting_rate: number | null;
  meeting_to_opportunity_rate: number | null;
  opportunity_to_customer_rate: number | null;
  lead_source_quality_score: number | null;
  last_updated_at: string;
  created_at: string;
}

interface FounderRecommendations {
  customer_id: string;
  narratives_that_create_customers: Array<{
    narrative: string;
    customers: number;
    revenue: number;
    customer_yield: number | null;
    revenue_yield: number | null;
    recommendation: string;
  }>;
  narratives_that_create_meetings: Array<{
    narrative: string;
    meetings: number;
    opportunities: number;
    recommendation: string;
  }>;
  narratives_engagement_only: Array<{
    narrative: string;
    leads: number;
    recommendation: string;
  }>;
  best_converting_sources: Array<{
    source: string;
    quality_score: number;
    lead_to_reply: number | null;
    reply_to_meeting: number | null;
    meeting_to_customer: number | null;
    revenue: number;
    recommendation: string;
  }>;
  saturated_conversations: Array<{
    narrative: string;
    saturation_detected_at: string | null;
    recommendation: string;
  }>;
  new_conversations_to_explore: Array<{
    narrative: string;
    priority_score: number;
    recommendation: string;
  }>;
  customer_acquisition_insights: {
    total_customers: number;
    total_revenue: number;
    top_industries: Array<[string, number]>;
    top_company_types: Array<[string, number]>;
    top_funding_stages: Array<[string, number]>;
    top_source_narratives: Array<[string, number]>;
    top_lead_sources: Array<[string, number]>;
    recommendation: string;
  };
}

interface PerformanceSummary {
  customer_id: string;
  total_narratives_tracked: number;
  total_leads: number;
  total_meetings: number;
  total_customers: number;
  total_revenue: number;
  lead_to_meeting_rate: number;
  meeting_to_customer_rate: number;
  best_performing_lead_source: string | null;
  best_source_quality_score: number | null;
}

export default function RevenueIntelligence() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "narratives" | "posts" | "sources" | "recommendations">("overview");
  
  const [narratives, setNarratives] = useState<NarrativePerformance[]>([]);
  const [posts, setPosts] = useState<PostPerformance[]>([]);
  const [sources, setSources] = useState<LeadSourcePerformance[]>([]);
  const [recommendations, setRecommendations] = useState<FounderRecommendations | null>(null);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    search?: string;
    is_saturated?: boolean;
  }>({});

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const fetchNarratives = useCallback(async () => {
    if (!spaceId) return;
    try {
      const params = new URLSearchParams();
      params.append("customer_id", spaceId);
      if (filters.search) params.append("search", filters.search);
      if (filters.is_saturated !== undefined) params.append("is_saturated", filters.is_saturated.toString());

      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/narratives?${params}`);
      if (response.ok) {
        const data = await response.json();
        setNarratives(data);
      }
    } catch (error) {
      console.error("Error fetching narratives:", error);
    }
  }, [spaceId, filters, API_BASE]);

  const fetchPosts = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/posts?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, [spaceId, API_BASE]);

  const fetchSources = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/sources?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
        setSources(data);
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
    }
  }, [spaceId, API_BASE]);

  const fetchRecommendations = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/recommendations?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  }, [spaceId, API_BASE]);

  const fetchSummary = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/summary?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }, [spaceId, API_BASE]);

  const calculateYields = async () => {
    if (!spaceId) return;
    setCalculating(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/calculate-yields?customer_id=${spaceId}`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchNarratives();
        await fetchPosts();
        await fetchSources();
      }
    } catch (error) {
      console.error("Error calculating yields:", error);
    } finally {
      setCalculating(false);
    }
  };

  const optimizeDiscovery = async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/optimize?customer_id=${spaceId}`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchNarratives();
      }
    } catch (error) {
      console.error("Error optimizing discovery:", error);
    }
  };

  const detectSaturation = async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/revenue-intelligence/saturation/detect?customer_id=${spaceId}`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchNarratives();
      }
    } catch (error) {
      console.error("Error detecting saturation:", error);
    }
  };

  useEffect(() => {
    fetchNarratives();
    fetchPosts();
    fetchSources();
    fetchRecommendations();
    fetchSummary();
    setLoading(false);
  }, [fetchNarratives, fetchPosts, fetchSources, fetchRecommendations, fetchSummary]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getYieldColor = (yieldValue: number | null) => {
    if (!yieldValue) return "#888";
    if (yieldValue >= 0.05) return "#38d9a9";
    if (yieldValue >= 0.02) return "#69db7c";
    if (yieldValue >= 0.01) return "#ffd43b";
    return "#ff6b6b";
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      "DIRECT_ENGAGEMENT": "#38d9a9",
      "REPEAT_ENGAGEMENT": "#69db7c",
      "SIMILAR_CONTENT": "#ffd43b",
      "LOOKALIKE": "#ff922b",
      "ICP_DISCOVERY": "#ff6b6b",
    };
    return colors[source] || "#888";
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Revenue Intelligence
                  </h1>
                  <p className="text-xs text-slate-400">Revenue Learning Layer</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={calculateYields}
                disabled={calculating}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <BarChart3 className="w-4 h-4" />
                {calculating ? "Calculating..." : "Calculate Yields"}
              </button>
              <button
                onClick={() => { fetchNarratives(); fetchPosts(); fetchSources(); fetchRecommendations(); fetchSummary(); }}
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
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "overview", label: "Overview", icon: <BarChart3 /> },
            { id: "narratives", label: "Narratives", icon: <MessageSquare /> },
            { id: "posts", label: "Posts", icon: <Briefcase /> },
            { id: "sources", label: "Lead Sources", icon: <Users /> },
            { id: "recommendations", label: "Recommendations", icon: <Target /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-700/50 hover:bg-slate-700 text-slate-400"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && summary && (
          <div>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <StatCard label="Narratives" value={summary.total_narratives_tracked} icon={<MessageSquare />} color="#a78bfa" />
              <StatCard label="Total Leads" value={summary.total_leads} icon={<Users />} color="#69db7c" />
              <StatCard label="Meetings" value={summary.total_meetings} icon={<Calendar />} color="#ffd43b" />
              <StatCard label="Customers" value={summary.total_customers} icon={<CheckCircle />} color="#ff922b" />
              <StatCard label="Revenue" value={`$${(summary.total_revenue / 1000).toFixed(0)}k`} icon={<DollarSign />} color="#ff6b6b" />
              <StatCard label="Best Source" value={summary.best_performing_lead_source || "N/A"} icon={<Target />} color="#38d9a9" />
            </div>

            {/* Conversion Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Conversion Rates
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Lead to Meeting</span>
                      <span className="font-medium">{(summary.lead_to_meeting_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${summary.lead_to_meeting_rate * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Meeting to Customer</span>
                      <span className="font-medium">{(summary.meeting_to_customer_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${summary.meeting_to_customer_rate * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={optimizeDiscovery}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Optimize Discovery
                  </button>
                  <button
                    onClick={detectSaturation}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Detect Saturation
                  </button>
                  <button
                    onClick={calculateYields}
                    disabled={calculating}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Recalculate Yields
                  </button>
                </div>
              </div>
            </div>

            {/* Customer Acquisition Insights */}
            {recommendations?.customer_acquisition_insights && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  Customer Acquisition Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InsightSection
                    title="Top Industries"
                    data={recommendations.customer_acquisition_insights.top_industries}
                  />
                  <InsightSection
                    title="Top Company Types"
                    data={recommendations.customer_acquisition_insights.top_company_types}
                  />
                  <InsightSection
                    title="Top Funding Stages"
                    data={recommendations.customer_acquisition_insights.top_funding_stages}
                  />
                </div>
                {recommendations.customer_acquisition_insights.recommendation && (
                  <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-sm text-emerald-400 font-medium">ICP Recommendation:</div>
                    <div className="text-sm text-slate-300 mt-1">
                      {recommendations.customer_acquisition_insights.recommendation}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Narratives Tab */}
        {activeTab === "narratives" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Narrative Performance</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 mb-6">
                <FilterInput
                  label="Search"
                  type="text"
                  placeholder="Search narratives..."
                  value={filters.search || ""}
                  onChange={(v) => handleFilterChange("search", v)}
                />
                <FilterSelect
                  label="Saturation Status"
                  value={filters.is_saturated?.toString() || ""}
                  onChange={(v) => handleFilterChange("is_saturated", v === "true" ? true : v === "false" ? false : undefined)}
                  options={[
                    { value: "", label: "All" },
                    { value: "true", label: "Saturated" },
                    { value: "false", label: "Not Saturated" },
                  ]}
                />
              </div>
            )}

            <div className="space-y-4">
              {narratives.map((narrative) => (
                <div key={narrative.id} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-semibold text-lg mb-1">{narrative.narrative_text}</div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{narrative.narrative_type || "—"}</span>
                        {narrative.is_saturated && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                            Saturated
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">${(narrative.revenue / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-slate-400">Revenue</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <MetricCard label="Leads" value={narrative.leads_generated} />
                    <MetricCard label="Meetings" value={narrative.meetings} />
                    <MetricCard label="Customers" value={narrative.customers} />
                    <MetricCard label="Customer Yield" value={narrative.customer_yield?.toFixed(2) || "—"} color={getYieldColor(narrative.customer_yield)} />
                    <MetricCard label="Priority" value={narrative.priority_score.toFixed(2)} />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/revenue-intelligence/${spaceId}/narratives/${narrative.id}`)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Post Performance</h2>
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{post.narrative || "—"}</div>
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-slate-400 hover:text-violet-400"
                      >
                        {post.post_url}
                      </a>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">${(post.revenue_generated / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-slate-400">Revenue</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <MetricCard label="Leads" value={post.lead_count} />
                    <MetricCard label="Meetings" value={post.meeting_count} />
                    <MetricCard label="Customers" value={post.customer_count} />
                    <MetricCard label="Revenue Score" value={post.post_revenue_score?.toFixed(2) || "—"} />
                    <MetricCard label="Meeting Score" value={post.post_meeting_score?.toFixed(2) || "—"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Lead Source Performance</h2>
            <div className="space-y-4">
              {sources.map((source) => (
                <div key={source.id} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${getSourceColor(source.source_type)}20` }}
                      >
                        <Users className="w-5 h-5" style={{ color: getSourceColor(source.source_type) }} />
                      </div>
                      <div>
                        <div className="font-semibold">{source.source_type}</div>
                        <div className="text-sm text-slate-400">Quality Score: {source.lead_source_quality_score?.toFixed(2) || "—"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">${(source.revenue / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-slate-400">Revenue</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <MetricCard label="Leads" value={source.leads} />
                    <MetricCard label="Meetings" value={source.meetings} />
                    <MetricCard label="Customers" value={source.customers} />
                    <MetricCard label="Lead→Reply" value={`${(source.lead_to_reply_rate * 100).toFixed(0)}%`} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Reply→Meeting</div>
                      <div className="text-sm font-medium">{(source.reply_to_meeting_rate * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Meeting→Opp</div>
                      <div className="text-sm font-medium">{(source.meeting_to_opportunity_rate * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Opp→Customer</div>
                      <div className="text-sm font-medium">{(source.opportunity_to_customer_rate * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === "recommendations" && recommendations && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Founder Recommendations</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Narratives that create customers */}
              <RecommendationCard
                title="Narratives That Create Customers"
                icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
                items={recommendations.narratives_that_create_customers}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.narrative}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      {item.customers} customers • ${(item.revenue / 1000).toFixed(0)}k revenue
                    </div>
                    <div className="text-xs text-emerald-400">{item.recommendation}</div>
                  </div>
                )}
              />

              {/* Narratives that create meetings */}
              <RecommendationCard
                title="Narratives That Create Meetings"
                icon={<Calendar className="w-5 h-5 text-yellow-400" />}
                items={recommendations.narratives_that_create_meetings}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.narrative}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      {item.meetings} meetings • {item.opportunities} opportunities
                    </div>
                    <div className="text-xs text-yellow-400">{item.recommendation}</div>
                  </div>
                )}
              />

              {/* Best converting sources */}
              <RecommendationCard
                title="Best Converting Lead Sources"
                icon={<Target className="w-5 h-5 text-violet-400" />}
                items={recommendations.best_converting_sources}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.source}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      Quality: {item.quality_score.toFixed(2)} • ${(item.revenue / 1000).toFixed(0)}k revenue
                    </div>
                    <div className="text-xs text-violet-400">{item.recommendation}</div>
                  </div>
                )}
              />

              {/* Saturated conversations */}
              <RecommendationCard
                title="Saturated Conversations"
                icon={<AlertCircle className="w-5 h-5 text-orange-400" />}
                items={recommendations.saturated_conversations}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.narrative}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      {item.saturation_detected_at ? new Date(item.saturation_detected_at).toLocaleDateString() : "—"}
                    </div>
                    <div className="text-xs text-orange-400">{item.recommendation}</div>
                  </div>
                )}
              />

              {/* New conversations to explore */}
              <RecommendationCard
                title="New Conversations to Explore"
                icon={<Zap className="w-5 h-5 text-blue-400" />}
                items={recommendations.new_conversations_to_explore}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.narrative}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      Priority: {item.priority_score.toFixed(2)}
                    </div>
                    <div className="text-xs text-blue-400">{item.recommendation}</div>
                  </div>
                )}
              />

              {/* Engagement only narratives */}
              <RecommendationCard
                title="Engagement Only Narratives"
                icon={<MessageSquare className="w-5 h-5 text-slate-400" />}
                items={recommendations.narratives_engagement_only}
                renderItem={(item) => (
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">{item.narrative}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      {item.leads} leads
                    </div>
                    <div className="text-xs text-slate-400">{item.recommendation}</div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </div>
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

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="font-medium" style={color ? { color } : undefined}>{value}</div>
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
        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function InsightSection({ title, data }: { title: string; data: Array<[string, number]> }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-2">
        {data.slice(0, 5).map(([item, count], i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{item}</span>
            <span className="text-slate-400">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard<T>({ title, icon, items, renderItem }: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item, i) => <div key={i}>{renderItem(item)}</div>)
        ) : (
          <div className="text-sm text-slate-400">No data available</div>
        )}
      </div>
    </div>
  );
}
