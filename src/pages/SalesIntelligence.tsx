import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Filter, RefreshCw, Mail, Building2, Users, TrendingUp,
  CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, Download, Star, Target, Zap, MessageSquare,
  Calendar, MapPin, Globe, Briefcase, Award, Clock
} from "lucide-react";

// Types for the sales intelligence API
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
  captured_at: string;
  enriched_at: string | null;
}

interface SalesStats {
  total_leads: number;
  qualified_leads: number;
  high_quality_leads: number;
  enriched_leads: number;
  hot_leads: number;
  average_icp_score: number | null;
  average_conversation_probability: number | null;
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
}

export default function SalesIntelligence() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [selectedLead, setSelectedLead] = useState<SalesLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState<{
    lead_category?: string;
    min_icp_score?: number;
    industry?: string;
    email_verified?: boolean;
    enrichment_status?: string;
    search?: string;
  }>({});
  
  const [showFilters, setShowFilters] = useState(false);

  // API URL - adjust based on your backend configuration
  const API_BASE = process.env.VITE_API_BASE_URL || "http://localhost:8000";

  const fetchLeads = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.lead_category) params.append("lead_category", filters.lead_category);
      if (filters.min_icp_score) params.append("min_icp_score", filters.min_icp_score.toString());
      if (filters.industry) params.append("industry", filters.industry);
      if (filters.email_verified !== undefined) params.append("email_verified", filters.email_verified.toString());
      if (filters.enrichment_status) params.append("enrichment_status", filters.enrichment_status);
      if (filters.search) params.append("search", filters.search);
      params.append("page", page.toString());
      params.append("limit", "50");
      params.append("customer_id", spaceId);

      const response = await fetch(`${API_BASE}/api/v1/sales/leads?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  }, [spaceId, filters, page, API_BASE]);

  const fetchStats = useCallback(async () => {
    if (!spaceId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/sales/stats?customer_id=${spaceId}`);
      if (response.ok) {
        const data = await response.json();
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

  const enrichLead = async (leadId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sales/enrich/${leadId}`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchLeads();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error enriching lead:", error);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [fetchLeads, fetchStats]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const getICPScoreColor = (score: number | null) => {
    if (!score) return "#888";
    if (score >= 90) return "#38d9a9";
    if (score >= 80) return "#69db7c";
    if (score >= 70) return "#ffd43b";
    if (score >= 60) return "#ff922b";
    return "#ff6b6b";
  };

  const getLeadCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      "hot": "#ff6b6b",
      "high_quality": "#69db7c",
      "qualified": "#ffd43b",
      "potential": "#74c0fc",
    };
    return colors[category || ""] || "#888";
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
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                    Sales Intelligence
                  </h1>
                  <p className="text-xs text-slate-400">Qualified & Enriched Leads</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { fetchLeads(); fetchStats(); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Total Leads" value={stats.total_leads} icon={<Users />} color="#a78bfa" />
            <StatCard label="Qualified" value={stats.qualified_leads} icon={<CheckCircle />} color="#69db7c" />
            <StatCard label="High Quality" value={stats.high_quality_leads} icon={<Star />} color="#ffd43b" />
            <StatCard label="Enriched" value={stats.enriched_leads} icon={<Zap />} color="#ff922b" />
            <StatCard label="Hot Leads" value={stats.hot_leads} icon={<Target />} color="#ff6b6b" />
            <StatCard label="Avg ICP Score" value={stats.average_icp_score?.toFixed(1) || "N/A"} icon={<TrendingUp />} color="#38d9a9" />
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
            <span className="text-sm text-slate-400">{total} leads</span>
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
              <FilterSelect
                label="Email Verified"
                value={filters.email_verified?.toString() || ""}
                onChange={(v) => handleFilterChange("email_verified", v === "true" ? true : v === "false" ? false : undefined)}
                options={[
                  { value: "", label: "All" },
                  { value: "true", label: "Verified" },
                  { value: "false", label: "Not Verified" },
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">ICP Score</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversation</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => fetchLeadDetail(lead.id)}
                    >
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <div className="font-medium">{lead.company_name || lead.current_company}</div>
                        <div className="text-sm text-slate-400">{lead.industry}</div>
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <div
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: `${getLeadCategoryColor(lead.lead_category)}20`,
                            color: getLeadCategoryColor(lead.lead_category),
                          }}
                        >
                          {lead.lead_category || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">{lead.email}</span>
                            {lead.email_verified && <CheckCircle className="w-4 h-4 text-green-400" />}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">Not enriched</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300 line-clamp-2 max-w-xs">
                          {lead.conversation_angle || lead.reason_for_outreach || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); enrichLead(lead.id); }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors text-sm"
                        >
                          <Zap className="w-4 h-4" />
                          Enrich
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 50 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {Math.ceil(total / 50)}
                </span>
                <button
                  disabled={page >= Math.ceil(total / 50)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onEnrich={() => { enrichLead(selectedLead.id); setSelectedLead(null); }}
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

function LeadDetailDrawer({ lead, onClose, onEnrich }: {
  lead: SalesLeadDetail;
  onClose: () => void;
  onEnrich: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-slate-900 border-l border-slate-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Lead Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Basic Information */}
          <Section title="Basic Information" icon={<Briefcase />}>
            <InfoRow label="Name" value={lead.name} />
            <InfoRow label="Title" value={lead.current_title || lead.headline} />
            <InfoRow label="Company" value={lead.company_name || lead.current_company} />
            <InfoRow label="Industry" value={lead.industry} />
            <InfoRow label="Company Size" value={lead.employee_count} />
            <InfoRow label="LinkedIn" value={lead.profile_url} isLink />
            {lead.email && (
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
            )}
          </Section>

          {/* Lead Intelligence */}
          <Section title="Lead Intelligence" icon={<Target />}>
            <InfoRow label="ICP Score" value={lead.icp_score?.toFixed(1)} />
            <InfoRow label="Lead Category" value={lead.lead_category} />
            <InfoRow label="Problem Match" value={lead.problem_match_score?.toFixed(2)} />
            <InfoRow label="Distribution Intent" value={lead.distribution_intent_score?.toFixed(2)} />
            <InfoRow label="Customer Similarity" value={lead.customer_similarity_score_new?.toFixed(2)} />
            <InfoRow label="Engagement Affinity" value={lead.engagement_affinity_score?.toFixed(2)} />
            {lead.identified_problems && lead.identified_problems.length > 0 && (
              <div>
                <div className="text-sm text-slate-400 mb-2">Identified Problems</div>
                <ul className="space-y-1">
                  {lead.identified_problems.map((problem, i) => (
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
                    {lead.recent_funding_activity.map((funding, i) => (
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
                    {lead.recent_hiring_activity.map((hiring, i) => (
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
                    {lead.recent_product_launches.map((launch, i) => (
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
                  {lead.conversation_angles.map((angle, i) => (
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
                  {lead.recommended_openers.map((opener, i) => (
                    <li key={i} className="text-sm bg-violet-500/10 p-3 rounded-lg border border-violet-500/20">
                      {opener}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-slate-700/50">
            <button
              onClick={onEnrich}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-xl font-semibold transition-all"
            >
              <Zap className="w-5 h-5" />
              Enrich Lead
            </button>
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
