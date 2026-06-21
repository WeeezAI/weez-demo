import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Filter, RefreshCw, Mail, Building2, Users, TrendingUp,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, Download, Star, Target, Zap, MessageSquare,
  Calendar, MapPin, Globe, Briefcase, Award, Clock, Send,
  Rocket, BarChart3, Play, Pause, MoreVertical, Bell
} from "lucide-react";

// Types for the sales workspace API
interface SalesLead {
  id: number;
  name: string;
  headline: string | null;
  profile_url: string;
  company_name: string | null;
  company_domain: string | null;
  current_title: string | null;
  current_company: string | null;
  industry: string | null;
  employee_count: string | null;
  email: string | null;
  email_verified: boolean | null;
  email_source: string | null;
  email_confidence: number | null;
  icp_score: number | null;
  lead_category: string | null;
  enrichment_status: string | null;
  conversation_angle: string | null;
  common_interest: string | null;
  reason_for_outreach: string | null;
  recommended_action: string | null;
  problem_match_score: number | null;
  distribution_intent_score: number | null;
  customer_similarity_score_new: number | null;
  engagement_affinity_score: number | null;
  outreach_status: string | null;
  last_activity_at: string | null;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  relationship_score: number | null;
  captured_at: string;
  enriched_at: string | null;
}

interface EnhancedSalesStats {
  total_leads: number;
  qualified_leads: number;
  high_quality_leads: number;
  enriched_leads: number;
  hot_leads: number;
  average_icp_score: number | null;
  average_conversation_probability: number | null;
  emails_sent: number;
  emails_replied: number;
  meetings_booked: number;
  reply_rate: number;
  conversation_rate: number;
  // Meeting pipeline stats
  leads_with_replies: number;
  conversation_started: number;
  relationship_building: number;
  trust_established: number;
  meeting_ready: number;
  meeting_scheduled: number;
  meeting_completed: number;
  opportunities: number;
  reply_to_meeting_ready_rate: number;
  meeting_ready_to_scheduled_rate: number;
  scheduled_to_completed_rate: number;
  completed_to_opportunity_rate: number;
}

interface SalesLeadDetail extends SalesLead {
  identified_problems: string[] | null;
  problem_confidence: number | null;
  distribution_intent: number | null;
  hiring_intent: number | null;
  customer_similarity_score: number | null;
  engagement_affinity: number | null;
  company_description: string | null;
  headquarters: string | null;
  recent_events: Array<{ date: string; title: string; url: string }> | null;
  recent_hiring_activity: Array<{ date: string; title: string; url: string }> | null;
  recent_funding_activity: Array<{ date: string; amount: number | null; stage: string | null; investors: string[] }> | null;
  recent_product_launches: Array<{ date: string; title: string; url: string }> | null;
  conversation_angles: string[] | null;
  recommended_openers: string[] | null;
  suggested_intro_theme: string | null;
  // Meeting readiness fields
  curiosity_score: number | null;
  trust_score: number | null;
  exploration_score: number | null;
  meeting_intent_score: number | null;
  meeting_readiness_score: number | null;
  recommended_next_action: string | null;
  recommended_action_reasoning: string | null;
  calendar_link_allowed: boolean | null;
  conversation_depth: number | null;
}

interface StageConfig {
  label: string;
  color: string;
  description: string;
}

// Lead stages
const LEAD_STAGES = [
  "DISCOVERED",
  "QUALIFIED",
  "HIGH_QUALITY",
  "ENRICHED",
  "READY_FOR_OUTREACH",
  "EMAIL_GENERATED",
  "EMAIL_SENT",
  "EMAIL_OPENED",
  "EMAIL_CLICKED",
  "EMAIL_REPLIED",
  "CONVERSATION_STARTED",
  "RELATIONSHIP_BUILDING",
  "TRUST_ESTABLISHED",
  "MEETING_READY",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "OPPORTUNITY",
  "CUSTOMER",
  "NOT_INTERESTED",
  "FOLLOW_UP_REQUIRED",
];

const STAGE_CONFIG: Record<string, StageConfig> = {
  DISCOVERED: { label: "Discovered", color: "#64748b", description: "Lead identified from LinkedIn engagement" },
  QUALIFIED: { label: "Qualified", color: "#f59e0b", description: "Lead meets basic ICP criteria" },
  HIGH_QUALITY: { label: "High Quality", color: "#10b981", description: "Lead scores highly on ICP fit" },
  ENRICHED: { label: "Enriched", color: "#3b82f6", description: "Lead enriched with company and email data" },
  READY_FOR_OUTREACH: { label: "Ready for Outreach", color: "#8b5cf6", description: "Lead ready for personalized outreach" },
  EMAIL_GENERATED: { label: "Email Generated", color: "#06b6d4", description: "Personalized email generated for review" },
  EMAIL_SENT: { label: "Email Sent", color: "#6366f1", description: "Email sent to lead" },
  EMAIL_OPENED: { label: "Email Opened", color: "#22c55e", description: "Lead opened the email" },
  EMAIL_CLICKED: { label: "Email Clicked", color: "#84cc16", description: "Lead clicked a link in the email" },
  EMAIL_REPLIED: { label: "Email Replied", color: "#14b8a6", description: "Lead replied to the email" },
  CONVERSATION_STARTED: { label: "Conversation Started", color: "#0ea5e9", description: "Two-way conversation has begun" },
  RELATIONSHIP_BUILDING: { label: "Relationship Building", color: "#06b6d4", description: "Rapport is being established" },
  TRUST_ESTABLISHED: { label: "Trust Established", color: "#22d3ee", description: "Trust and rapport have been built" },
  MEETING_READY: { label: "Meeting Ready", color: "#f59e0b", description: "Lead is ready for a meeting invitation" },
  MEETING_SCHEDULED: { label: "Meeting Scheduled", color: "#eab308", description: "Meeting has been scheduled" },
  MEETING_COMPLETED: { label: "Meeting Completed", color: "#84cc16", description: "Meeting has been completed" },
  OPPORTUNITY: { label: "Opportunity", color: "#10b981", description: "Qualified opportunity identified" },
  CUSTOMER: { label: "Customer", color: "#a855f7", description: "Lead converted to customer" },
  NOT_INTERESTED: { label: "Not Interested", color: "#ef4444", description: "Lead expressed no interest" },
  FOLLOW_UP_REQUIRED: { label: "Follow Up Required", color: "#f97316", description: "Follow-up action needed" },
};

// Helper functions
const getICPScoreColor = (score: number | null) => {
  if (!score) return "#888";
  if (score >= 90) return "#38d9a9";
  if (score >= 80) return "#69db7c";
  if (score >= 70) return "#ffd43b";
  if (score >= 60) return "#ff922b";
  return "#ff6b6b";
};

const getStageConfig = (stage: string | null) => {
  return STAGE_CONFIG[stage || "DISCOVERED"] || STAGE_CONFIG.DISCOVERED;
};

export default function SalesWorkspace() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPremium = user?.plan_type !== "free";

  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [stats, setStats] = useState<EnhancedSalesStats | null>(null);
  const [selectedLead, setSelectedLead] = useState<SalesLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "campaigns">("leads");
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [newLeadNotification, setNewLeadNotification] = useState(false);

  // Filters
  const [filters, setFilters] = useState<{
    stage?: string;
    lead_category?: string;
    min_icp_score?: number;
    industry?: string;
    email_verified?: boolean;
    enrichment_status?: string;
    search?: string;
  }>({});
  
  const [showFilters, setShowFilters] = useState(false);

  // API URL
  const API_BASE = process.env.VITE_API_BASE_URL || "http://localhost:8000";

  const fetchLeads = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.stage) params.append("stage", filters.stage);
      if (filters.lead_category) params.append("lead_category", filters.lead_category);
      if (filters.min_icp_score) params.append("min_icp_score", filters.min_icp_score.toString());
      if (filters.industry) params.append("industry", filters.industry);
      if (filters.email_verified !== undefined) params.append("email_verified", filters.email_verified.toString());
      if (filters.enrichment_status) params.append("enrichment_status", filters.enrichment_status);
      if (filters.search) params.append("search", filters.search);
      params.append("customer_id", spaceId);

      const response = await fetch(`${API_BASE}/api/v1/sales/workspace/leads?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  }, [spaceId, filters, API_BASE]);

  const fetchStats = useCallback(async () => {
    if (!spaceId) return;
    try {
      const [salesStatsResponse, meetingStatsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/v1/sales/workspace/stats?customer_id=${spaceId}`),
        fetch(`${API_BASE}/api/v1/meeting-readiness/stats?customer_id=${spaceId}`)
      ]);

      if (salesStatsResponse.ok && meetingStatsResponse.ok) {
        const salesData = await salesStatsResponse.json();
        const meetingData = await meetingStatsResponse.json();
        setStats({ ...salesData, ...meetingData });
      } else if (salesStatsResponse.ok) {
        const data = await salesStatsResponse.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [spaceId, API_BASE]);

  const fetchLeadDetail = async (leadId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sales/leads/${leadId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedLead(data);
      }
    } catch (error) {
      console.error("Error fetching lead detail:", error);
    }
  };

  const handleEmailReveal = () => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  const handleOutreachAction = () => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [fetchLeads, fetchStats]);

  // Simulate real-time lead discovery (in production, use SSE/WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      // Check for new leads periodically
      fetchStats();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const inferStage = (lead: SalesLead): string => {
    if (lead.outreach_status === "CUSTOMER") return "CUSTOMER";
    if (lead.outreach_status === "NOT_INTERESTED") return "NOT_INTERESTED";
    if (lead.outreach_status === "MEETING_BOOKED") return "MEETING_BOOKED";
    if (lead.emails_replied > 0) return "EMAIL_REPLIED";
    if (lead.emails_clicked > 0) return "EMAIL_CLICKED";
    if (lead.emails_opened > 0) return "EMAIL_OPENED";
    if (lead.emails_sent > 0) return "EMAIL_SENT";
    if (lead.outreach_status === "EMAIL_GENERATED") return "EMAIL_GENERATED";
    if (lead.enrichment_status === "enriched" && lead.email) return "READY_FOR_OUTREACH";
    if (lead.enrichment_status === "enriched") return "ENRICHED";
    if (lead.icp_score && lead.icp_score >= 80) return "HIGH_QUALITY";
    if (lead.icp_score && lead.icp_score >= 60) return "QUALIFIED";
    return "DISCOVERED";
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
                    Sales Workspace
                  </h1>
                  <p className="text-xs text-slate-400">AI-Powered Lead & Pipeline Management</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {newLeadNotification && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm">
                  <Bell className="w-4 h-4" />
                  New Lead Discovered
                </div>
              )}
              <button
                onClick={() => { fetchLeads(); fetchStats(); }}
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
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab("leads")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === "leads"
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Users className="w-5 h-5" />
            Leads
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === "campaigns"
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Send className="w-5 h-5" />
            Campaigns
          </button>
        </div>

        {activeTab === "leads" ? (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                <StatCard label="Total Leads" value={stats.total_leads} icon={<Users />} color="#a78bfa" />
                <StatCard label="Qualified" value={stats.qualified_leads} icon={<CheckCircle />} color="#69db7c" />
                <StatCard label="High Quality" value={stats.high_quality_leads} icon={<Star />} color="#ffd43b" />
                <StatCard label="Enriched" value={stats.enriched_leads} icon={<Zap />} color="#ff922b" />
                <StatCard label="Emails Sent" value={stats.emails_sent} icon={<Send />} color="#6366f1" />
                <StatCard label="Emails Replied" value={stats.emails_replied} icon={<MessageSquare />} color="#14b8a6" />
                <StatCard label="Conversation Started" value={stats.conversation_started} icon={<MessageSquare />} color="#0ea5e9" />
                <StatCard label="Relationship Building" value={stats.relationship_building} icon={<Users />} color="#06b6d4" />
                <StatCard label="Trust Established" value={stats.trust_established} icon={<CheckCircle />} color="#22d3ee" />
                <StatCard label="Meeting Ready" value={stats.meeting_ready} icon={<Calendar />} color="#f59e0b" />
                <StatCard label="Meeting Scheduled" value={stats.meeting_scheduled} icon={<Calendar />} color="#eab308" />
                <StatCard label="Meeting Completed" value={stats.meeting_completed} icon={<CheckCircle />} color="#84cc16" />
                <StatCard label="Opportunities" value={stats.opportunities} icon={<Target />} color="#10b981" />
                <StatCard label="Reply→Ready Rate" value={`${stats.reply_to_meeting_ready_rate.toFixed(1)}%`} icon={<TrendingUp />} color="#38d9a9" />
                <StatCard label="Ready→Scheduled" value={`${stats.meeting_ready_to_scheduled_rate.toFixed(1)}%`} icon={<TrendingUp />} color="#22c55e" />
                <StatCard label="Scheduled→Completed" value={`${stats.scheduled_to_completed_rate.toFixed(1)}%`} icon={<TrendingUp />} color="#84cc16" />
                <StatCard label="Completed→Opp" value={`${stats.completed_to_opportunity_rate.toFixed(1)}%`} icon={<TrendingUp />} color="#10b981" />
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
                <div className="flex-1" />
                {selectedLeads.size > 0 && (
                  <button
                    onClick={handleOutreachAction}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Send Outbound ({selectedLeads.size})
                  </button>
                )}
                <span className="text-sm text-slate-400">{leads.length} leads</span>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <FilterInput
                    label="Search"
                    type="text"
                    placeholder="Name, company, email..."
                    value={filters.search || ""}
                    onChange={(v) => handleFilterChange("search", v)}
                  />
                  <FilterSelect
                    label="Stage"
                    value={filters.stage || ""}
                    onChange={(v) => handleFilterChange("stage", v || undefined)}
                    options={[
                      { value: "", label: "All Stages" },
                      ...LEAD_STAGES.map(s => ({ value: s, label: STAGE_CONFIG[s].label }))
                    ]}
                  />
                  <FilterSelect
                    label="Lead Category"
                    value={filters.lead_category || ""}
                    onChange={(v) => handleFilterChange("lead_category", v || undefined)}
                    options={[
                      { value: "", label: "All" },
                      { value: "hot", label: "Hot" },
                      { value: "high_quality", label: "High Quality" },
                      { value: "qualified", label: "Qualified" },
                      { value: "potential", label: "Potential" },
                    ]}
                  />
                  <FilterSelect
                    label="Min ICP Score"
                    value={filters.min_icp_score?.toString() || ""}
                    onChange={(v) => handleFilterChange("min_icp_score", v ? parseFloat(v) : undefined)}
                    options={[
                      { value: "", label: "All" },
                      { value: "90", label: "90+" },
                      { value: "80", label: "80+" },
                      { value: "70", label: "70+" },
                      { value: "60", label: "60+" },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Leads Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-semibold mb-2">No leads found</h3>
                <p className="text-slate-400">Adjust your filters or scrape LinkedIn posts to generate leads</p>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/30">
                        <th className="px-4 py-4 text-left">
                          <input
                            type="checkbox"
                            checked={selectedLeads.size === leads.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(new Set(leads.map(l => l.id)));
                              } else {
                                setSelectedLeads(new Set());
                              }
                            }}
                            className="rounded bg-slate-700 border-slate-600"
                          />
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Industry</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">ICP Score</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Conv Prob</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rel Score</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Stage</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => {
                        const stage = inferStage(lead);
                        const stageConfig = getStageConfig(stage);
                        return (
                          <tr
                            key={lead.id}
                            className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer"
                            onClick={() => fetchLeadDetail(lead.id)}
                          >
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedLeads.has(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                                className="rounded bg-slate-700 border-slate-600"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center font-semibold text-sm">
                                  {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-semibold">{lead.name}</div>
                                  <div className="text-sm text-slate-400">{lead.current_title || lead.headline}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium">{lead.company_name || lead.current_company}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-300">{lead.current_title || lead.headline}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-300">{lead.industry}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold"
                                style={{
                                  backgroundColor: `${getICPScoreColor(lead.icp_score)}20`,
                                  color: getICPScoreColor(lead.icp_score),
                                }}
                              >
                                {lead.icp_score?.toFixed(0) || "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-300">
                                {lead.engagement_affinity_score ? `${(lead.engagement_affinity_score * 100).toFixed(0)}%` : "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-300">
                                {lead.relationship_score ? `${(lead.relationship_score * 100).toFixed(0)}%` : "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${stageConfig.color}20`,
                                  color: stageConfig.color,
                                }}
                              >
                                {stageConfig.label}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {isPremium && lead.email ? (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm">{lead.email}</span>
                                  {lead.email_verified && <CheckCircle className="w-4 h-4 text-green-400" />}
                                </div>
                              ) : lead.email ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEmailReveal(); }}
                                  className="text-sm text-violet-400 hover:text-violet-300"
                                >
                                  Reveal Email
                                </button>
                              ) : (
                                <span className="text-slate-500 text-sm">Not enriched</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-300 line-clamp-1 max-w-xs">
                                {lead.recommended_action || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-400">
                                {lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleDateString() : "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <CampaignsTab
            spaceId={spaceId}
            isPremium={isPremium}
            onUpgradeRequired={() => setShowUpgradeModal(true)}
            API_BASE={API_BASE}
          />
        )}
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          isPremium={isPremium}
          onClose={() => setSelectedLead(null)}
          onEmailReveal={handleEmailReveal}
          onOutreachAction={handleOutreachAction}
        />
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
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

function CampaignsTab({ spaceId, isPremium, onUpgradeRequired, API_BASE }: {
  spaceId?: string;
  isPremium: boolean;
  onUpgradeRequired: () => void;
  API_BASE: string;
}) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeadsForCampaign, setSelectedLeadsForCampaign] = useState<number[]>([]);
  const [campaignStep, setCampaignStep] = useState<"select" | "generate" | "review" | "approve">("select");
  const [generatedEmails, setGeneratedEmails] = useState<any[]>([]);

  const handleCreateCampaign = () => {
    if (!isPremium) {
      onUpgradeRequired();
      return;
    }
    setShowCreateModal(true);
    setCampaignStep("select");
  };

  const handleSelectLeads = (leadIds: number[]) => {
    setSelectedLeadsForCampaign(leadIds);
    setCampaignStep("generate");
  };

  const handleGenerateEmails = async () => {
    // Simulate email generation
    setGeneratedEmails(
      selectedLeadsForCampaign.map(id => ({
        lead_id: id,
        subject: "Personalized outreach",
        body: "Generated email content...",
        status: "DRAFT"
      }))
    );
    setCampaignStep("review");
  };

  const handleApproveCampaign = async () => {
    // Simulate campaign approval and sending
    setCampaignStep("approve");
    // In production, call API to send emails
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Outbound Campaigns</h2>
        <button
          onClick={handleCreateCampaign}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all"
        >
          <Rocket className="w-5 h-5" />
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <Send className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-slate-400">Active Campaigns</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-slate-400">Completed</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-slate-400">Avg Reply Rate</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
        <Send className="w-16 h-16 mx-auto mb-4 text-slate-600" />
        <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
        <p className="text-slate-400">Create your first outbound campaign to start reaching out to leads</p>
      </div>

      {/* Campaign Creation Modal */}
      {showCreateModal && (
        <CampaignCreationModal
          onClose={() => setShowCreateModal(false)}
          step={campaignStep}
          setStep={setCampaignStep}
          selectedLeads={selectedLeadsForCampaign}
          onSelectLeads={handleSelectLeads}
          onGenerateEmails={handleGenerateEmails}
          onApproveCampaign={handleApproveCampaign}
          generatedEmails={generatedEmails}
          spaceId={spaceId}
          API_BASE={API_BASE}
        />
      )}
    </div>
  );
}

function LeadDetailDrawer({ lead, isPremium, onClose, onEmailReveal, onOutreachAction }: {
  lead: any;
  isPremium: boolean;
  onClose: () => void;
  onEmailReveal: () => boolean;
  onOutreachAction: () => boolean;
}) {
  const stage = lead.outreach_status || "DISCOVERED";
  const stageConfig = STAGE_CONFIG[stage] || STAGE_CONFIG.DISCOVERED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full bg-slate-900 border-l border-slate-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Lead Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Lead Profile */}
          <Section title="Lead Profile" icon={<Briefcase />}>
            <InfoRow label="Name" value={lead.name} />
            <InfoRow label="Title" value={lead.current_title || lead.headline} />
            <InfoRow label="Company" value={lead.company_name || lead.current_company} />
            <InfoRow label="Industry" value={lead.industry} />
            <InfoRow label="Company Size" value={lead.employee_count} />
            <InfoRow label="LinkedIn" value={lead.profile_url} isLink />
            {isPremium && lead.email ? (
              <InfoRow
                label="Email"
                value={
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {lead.email}
                    {lead.email_verified && <CheckCircle className="w-4 h-4 text-green-400" />}
                  </div>
                }
              />
            ) : lead.email ? (
              <div className="flex items-start gap-3">
                <div className="text-sm text-slate-400 w-32 flex-shrink-0">Email</div>
                <button
                  onClick={onEmailReveal}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  Upgrade to Premium to reveal verified contact information
                </button>
              </div>
            ) : null}
          </Section>

          {/* Lead Intelligence */}
          <Section title="Lead Intelligence" icon={<Target />}>
            <InfoRow label="ICP Score" value={lead.icp_score?.toFixed(1)} />
            <InfoRow label="Lead Category" value={lead.lead_category} />
            <InfoRow label="Problem Match" value={lead.problem_match_score?.toFixed(2)} />
            <InfoRow label="Distribution Intent" value={lead.distribution_intent_score?.toFixed(2)} />
            <InfoRow label="Customer Similarity" value={lead.customer_similarity_score_new?.toFixed(2)} />
            <InfoRow label="Engagement Affinity" value={lead.engagement_affinity_score?.toFixed(2)} />
            <InfoRow label="Conversation Probability" value={lead.engagement_affinity_score ? `${(lead.engagement_affinity_score * 100).toFixed(0)}%` : "N/A"} />
            <InfoRow label="Relationship Score" value={lead.relationship_score ? `${(lead.relationship_score * 100).toFixed(0)}%` : "N/A"} />
            <InfoRow label="Current Stage" value={stageConfig.label} />
            {lead.identified_problems && lead.identified_problems.length > 0 && (
              <div>
                <div className="text-sm text-slate-400 mb-2">Identified Problems</div>
                <ul className="space-y-1">
                  {lead.identified_problems.map((problem: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      {problem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Company Intelligence */}
          <Section title="Company Intelligence" icon={<Building2 />}>
            <InfoRow label="Company Name" value={lead.company_name} />
            <InfoRow label="Domain" value={lead.company_domain} />
            <InfoRow label="Industry" value={lead.industry} />
            <InfoRow label="Employee Count" value={lead.employee_count} />
            <InfoRow label="Headquarters" value={lead.headquarters} />
            {lead.company_description && (
              <div>
                <div className="text-sm text-slate-400 mb-2">Description</div>
                <p className="text-sm text-slate-300">{lead.company_description}</p>
              </div>
            )}
          </Section>

          {/* Company Events */}
          {(lead.recent_events?.length || lead.recent_funding_activity?.length || lead.recent_hiring_activity?.length || lead.recent_product_launches?.length) && (
            <Section title="Recent Events" icon={<Calendar />}>
              {lead.recent_funding_activity && lead.recent_funding_activity.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-slate-400 mb-2">Funding Activity</div>
                  <ul className="space-y-2">
                    {lead.recent_funding_activity.map((funding: any, i: number) => (
                      <li key={i} className="text-sm bg-slate-800/50 p-3 rounded-lg">
                        <div className="font-medium">{funding.stage}</div>
                        <div className="text-slate-400">{funding.amount}</div>
                        <div className="text-xs text-slate-500">{funding.date}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.recent_hiring_activity && lead.recent_hiring_activity.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-slate-400 mb-2">Hiring Activity</div>
                  <ul className="space-y-2">
                    {lead.recent_hiring_activity.map((hiring: any, i: number) => (
                      <li key={i} className="text-sm bg-slate-800/50 p-3 rounded-lg">
                        <div className="font-medium">{hiring.title}</div>
                        <div className="text-xs text-slate-500">{hiring.date}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.recent_product_launches && lead.recent_product_launches.length > 0 && (
                <div>
                  <div className="text-sm text-slate-400 mb-2">Product Launches</div>
                  <ul className="space-y-2">
                    {lead.recent_product_launches.map((launch: any, i: number) => (
                      <li key={i} className="text-sm bg-slate-800/50 p-3 rounded-lg">
                        <div className="font-medium">{launch.title}</div>
                        <div className="text-xs text-slate-500">{launch.date}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Outreach Intelligence */}
          <Section title="Outreach Intelligence" icon={<MessageSquare />}>
            <InfoRow label="Common Interest" value={lead.common_interest} />
            <InfoRow label="Reason for Outreach" value={lead.reason_for_outreach} />
            <InfoRow label="Recommended Action" value={lead.recommended_action} />
            {lead.conversation_angles && lead.conversation_angles.length > 0 && (
              <div className="mb-4">
                <div className="text-sm text-slate-400 mb-2">Conversation Angles</div>
                <ul className="space-y-1">
                  {lead.conversation_angles.map((angle: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      {angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.recommended_openers && lead.recommended_openers.length > 0 && (
              <div>
                <div className="text-sm text-slate-400 mb-2">Recommended Openers</div>
                <ul className="space-y-2">
                  {lead.recommended_openers.map((opener: string, i: number) => (
                    <li key={i} className="text-sm bg-violet-500/10 p-3 rounded-lg border border-violet-500/20">
                      {opener}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Meeting Readiness Intelligence */}
          {lead.meeting_readiness_score !== null && (
            <Section title="Meeting Readiness" icon={<Calendar />}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Meeting Readiness</div>
                  <div className="text-2xl font-bold">{lead.meeting_readiness_score.toFixed(0)}</div>
                  <div className="text-xs text-slate-500">out of 100</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Conversation Depth</div>
                  <div className="text-2xl font-bold">{lead.conversation_depth || 0}</div>
                  <div className="text-xs text-slate-500">exchanges</div>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Curiosity</span>
                    <span className="font-semibold">{lead.curiosity_score?.toFixed(0) || 0}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-violet-500 h-2 rounded-full transition-all"
                      style={{ width: `${lead.curiosity_score || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Trust</span>
                    <span className="font-semibold">{lead.trust_score?.toFixed(0) || 0}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${lead.trust_score || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Exploration</span>
                    <span className="font-semibold">{lead.exploration_score?.toFixed(0) || 0}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all"
                      style={{ width: `${lead.exploration_score || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Meeting Intent</span>
                    <span className="font-semibold">{lead.meeting_intent_score?.toFixed(0) || 0}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${lead.meeting_intent_score || 0}%` }}
                    />
                  </div>
                </div>
              </div>
              {lead.recommended_next_action && (
                <div className="bg-violet-500/10 rounded-lg p-4 border border-violet-500/20">
                  <div className="text-xs text-slate-400 mb-1">Recommended Next Action</div>
                  <div className="font-semibold text-violet-300 mb-2">
                    {lead.recommended_next_action.replace(/_/g, ' ')}
                  </div>
                  {lead.recommended_action_reasoning && (
                    <div className="text-sm text-slate-300">{lead.recommended_action_reasoning}</div>
                  )}
                  {lead.calendar_link_allowed && (
                    <div className="mt-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">Calendar link allowed</span>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-slate-700/50">
            {!isPremium ? (
              <button
                onClick={onOutreachAction}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all"
              >
                <Send className="w-5 h-5" />
                Launch Outreach
              </button>
            ) : (
              <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all">
                <Send className="w-5 h-5" />
                Launch Outreach
              </button>
            )}
            <a
              href={lead.profile_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, isLink }: { label: string; value: React.ReactNode; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="text-sm text-slate-400 w-32 flex-shrink-0">{label}</div>
      <div className="text-sm text-slate-200 flex-1">
        {isLink && typeof value === "string" ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700/50 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Upgrade to Premium</h2>
          <p className="text-slate-400">Unlock powerful sales features to close more deals</p>
        </div>

        <div className="space-y-4 mb-8">
          <FeatureItem icon={<Mail />} title="Reveal Verified Emails" description="Get verified email addresses for all your leads" />
          <FeatureItem icon={<Send />} title="Launch Outbound Campaigns" description="Send personalized email campaigns at scale" />
          <FeatureItem icon={<BarChart3 />} title="Track Conversations" description="Monitor opens, clicks, replies, and meetings" />
          <FeatureItem icon={<Target />} title="Relationship Intelligence" description="AI-powered insights for better outreach" />
          <FeatureItem icon={<Calendar />} title="Meeting Tracking" description="Track and manage your sales pipeline" />
          <FeatureItem icon={<Zap />} title="Bulk Outreach" description="Reach hundreds of leads with one click" />
        </div>

        <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all">
          Upgrade Now
        </button>

        <button onClick={onClose} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-300">
          Maybe later
        </button>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-slate-400">{description}</div>
      </div>
    </div>
  );
}

function CampaignCreationModal({
  onClose,
  step,
  setStep,
  selectedLeads,
  onSelectLeads,
  onGenerateEmails,
  onApproveCampaign,
  generatedEmails,
  spaceId,
  API_BASE,
}: {
  onClose: () => void;
  step: "select" | "generate" | "review" | "approve";
  setStep: (step: "select" | "generate" | "review" | "approve") => void;
  selectedLeads: number[];
  onSelectLeads: (leadIds: number[]) => void;
  onGenerateEmails: () => void;
  onApproveCampaign: () => void;
  generatedEmails: any[];
  spaceId?: string;
  API_BASE: string;
}) {
  const [availableLeads, setAvailableLeads] = useState<SalesLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === "select" && spaceId) {
      fetchAvailableLeads();
    }
  }, [step, spaceId]);

  const fetchAvailableLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/sales/workspace/leads?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableLeads(data.filter((lead: SalesLead) => lead.icp_score && lead.icp_score >= 80));
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    if (step === "select") {
      onSelectLeads(Array.from(selectedLeadIds));
    } else if (step === "generate") {
      onGenerateEmails();
    } else if (step === "review") {
      onApproveCampaign();
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "select": return "Select Leads";
      case "generate": return "Generate Outreach";
      case "review": return "Review & Approve";
      case "approve": return "Campaign Launched";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "select": return "Select qualified leads for your outbound campaign";
      case "generate": return "AI will generate personalized emails for each lead";
      case "review": return "Review and approve personalized emails before sending";
      case "approve": return "Your campaign has been launched successfully";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-700/50 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{getStepTitle()}</h2>
            <p className="text-sm text-slate-400">{getStepDescription()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            {["select", "generate", "review", "approve"].map((s, index) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === s
                      ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                      : ["select", "generate", "review", "approve"].indexOf(step) > index
                      ? "bg-green-500 text-white"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {["select", "generate", "review", "approve"].indexOf(step) > index ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      ["select", "generate", "review", "approve"].indexOf(step) > index ? "bg-green-500" : "bg-slate-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "select" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-slate-400">
                  {selectedLeadIds.size} leads selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedLeadIds(new Set(availableLeads.map(l => l.id)))}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedLeadIds(new Set())}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : availableLeads.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-semibold mb-2">No qualified leads</h3>
                  <p className="text-slate-400">Generate leads with ICP score &gt;= 80 to create a campaign</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                        selectedLeadIds.has(lead.id)
                          ? "bg-violet-500/10 border-violet-500/50"
                          : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50"
                      }`}
                      onClick={() => toggleLeadSelection(lead.id)}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center font-semibold text-sm">
                          {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{lead.name}</div>
                          <div className="text-sm text-slate-400">{lead.current_title || lead.headline}</div>
                        </div>
                        <div className="text-sm text-slate-400">{lead.company_name || lead.current_company}</div>
                        <div
                          className="px-3 py-1 rounded-full text-sm font-semibold"
                          style={{
                            backgroundColor: `${getICPScoreColor(lead.icp_score)}20`,
                            color: getICPScoreColor(lead.icp_score),
                          }}
                        >
                          {lead.icp_score?.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "generate" && (
            <div className="text-center py-20">
              <RefreshCw className="w-16 h-16 mx-auto mb-4 animate-spin text-violet-400" />
              <h3 className="text-xl font-semibold mb-2">Generating Personalized Emails</h3>
              <p className="text-slate-400">AI is crafting unique outreach for {selectedLeads.length} leads...</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {generatedEmails.map((email, index) => (
                <div key={index} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">Lead #{email.lead_id}</div>
                    <div className="text-xs px-2 py-1 bg-violet-500/20 text-violet-400 rounded-full">
                      {email.status}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-xs text-slate-400 mb-1">Subject</div>
                    <div className="text-sm font-medium">{email.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Body</div>
                    <div className="text-sm text-slate-300 line-clamp-3">{email.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "approve" && (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Campaign Launched!</h3>
              <p className="text-slate-400 mb-6">
                {generatedEmails.length} emails have been sent successfully
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-violet-400">{generatedEmails.length}</div>
                  <div className="text-xs text-slate-400">Emails Sent</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-400">0</div>
                  <div className="text-xs text-slate-400">Opened</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-400">0</div>
                  <div className="text-xs text-slate-400">Replied</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "approve" && (
          <div className="sticky bottom-0 backdrop-blur-xl bg-slate-900/80 border-t border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => {
                if (step === "select") {
                  onClose();
                } else {
                  const steps = ["select", "generate", "review", "approve"];
                  const currentIndex = steps.indexOf(step);
                  setStep(steps[currentIndex - 1] as any);
                }
              }}
              className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl font-semibold transition-colors"
            >
              {step === "select" ? "Cancel" : "Back"}
            </button>
            <button
              onClick={handleContinue}
              disabled={(step === "select" && selectedLeadIds.size === 0)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === "review" ? "Launch Campaign" : "Continue"}
              {step !== "review" && <ChevronDown className="w-4 h-4 rotate-270" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
