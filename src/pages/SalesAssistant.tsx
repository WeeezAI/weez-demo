import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLeads, getLeadStats, getHubSpotStatus, confirmAttribution,
  updateLead, syncToHubSpot, scanForLeads, getHubSpotAuthorizeUrl,
  disconnectHubSpot, connectLeadWebSocket,
  type Lead, type LeadStats, type HubSpotStatus,
} from "@/services/salesAPI";
import { ArrowLeft, Search, Filter, RefreshCw, Plus, ExternalLink, Check, X, Zap, Target, Users, TrendingUp, AlertCircle, Link2, Unlink, ChevronDown, Star, MessageSquare, UserCheck, Archive, Mail, Linkedin } from "lucide-react";

/* ── Priority / Status helpers ─────────────────────────────────────── */
const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "P1 — High Intent", color: "#ff6b6b", bg: "rgba(255,107,107,.12)" },
  2: { label: "P2 — Referral",    color: "#ffd43b", bg: "rgba(255,212,59,.12)" },
  3: { label: "P3 — Question",    color: "#69db7c", bg: "rgba(105,219,124,.12)" },
};
const STATUS_OPTIONS = ["new","reviewed","contacted","qualified","converted","archived"] as const;
const STATUS_COLORS: Record<string,string> = { new:"#74c0fc", reviewed:"#ffd43b", contacted:"#da77f2", qualified:"#69db7c", converted:"#38d9a9", archived:"#868e96" };

export default function SalesAssistant() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const brandId = spaceId || "";
  const navigate = useNavigate();
  const { user } = useAuth();

  /* state */
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [hubspot, setHubspot] = useState<HubSpotStatus | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filters, setFilters] = useState<{ status?: string; priority?: number }>({});
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAttribution, setShowAttribution] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  /* fetch helpers */
  const refresh = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const [leadRes, statsRes, hsRes] = await Promise.all([
        getLeads(brandId, { ...filters, page, page_size: 20 }),
        getLeadStats(brandId),
        getHubSpotStatus(brandId).catch(() => ({ connected: false, brand_id: brandId })),
      ]);
      setLeads(leadRes.items); setTotal(leadRes.total);
      setStats(statsRes); setHubspot(hsRes as HubSpotStatus);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [brandId, filters, page]);

  useEffect(() => { refresh(); }, [refresh]);

  /* WebSocket for P1 real-time */
  useEffect(() => {
    if (!brandId) return;
    const ws = connectLeadWebSocket(brandId, (data) => {
      if (data.type === "new_lead") {
        setRealtimeAlerts((prev) => [data, ...prev].slice(0, 5));
        refresh();
      }
    });
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [brandId]);

  /* actions */
  const handleScan = async () => {
    setScanning(true);
    try { await scanForLeads(brandId); await refresh(); } catch (e) { console.error(e); }
    setScanning(false);
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    await updateLead(brandId, lead.id, { status: newStatus });
    if (!lead.attribution_confirmed && newStatus !== "new") {
      setSelectedLead({ ...lead, status: newStatus }); setShowAttribution(true);
    }
    await refresh();
  };

  const handleAttribution = async (data: { already_known: boolean; was_in_pipeline: boolean; attribution: string }) => {
    if (!selectedLead) return;
    await confirmAttribution(brandId, selectedLead.id, data);
    setShowAttribution(false); setSelectedLead(null); await refresh();
  };

  const handleHubspotSync = async (lead: Lead) => {
    try {
      const res = await syncToHubSpot(brandId, lead.id);
      if (res.hubspot_contact_url) window.open(res.hubspot_contact_url, "_blank");
      await refresh();
    } catch (e: any) { alert(e.message); }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0a0a1a 0%,#12122a 50%,#1a0a2e 100%)", color: "#e0e0e0", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <header style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(255,255,255,.06)", backdropFilter: "blur(12px)", background: "rgba(10,10,26,.7)", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" }}><ArrowLeft size={20} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={22} color="#a78bfa" />
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#a78bfa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Sales Assistant</h1>
        </div>
        <div style={{ flex: 1 }} />
        {/* HubSpot status */}
        <HubSpotBadge hubspot={hubspot} brandId={brandId} onRefresh={refresh} />
        <button onClick={handleScan} disabled={scanning} style={{ ...btnStyle, opacity: scanning ? .5 : 1 }}>
          <RefreshCw size={14} className={scanning ? "spin" : ""} /> {scanning ? "Scanning…" : "Scan Leads"}
        </button>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        {/* Real-time alerts */}
        {realtimeAlerts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {realtimeAlerts.map((a, i) => (
              <div key={i} style={{ padding: "12px 16px", background: "rgba(255,107,107,.08)", border: "1px solid rgba(255,107,107,.2)", borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, animation: "fadeIn .3s" }}>
                <Zap size={16} color="#ff6b6b" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>🔥 New P1 Lead: {a.name}</span>
                <span style={{ fontSize: 12, color: "#999" }}>{a.company} · {a.role}</span>
                <span style={{ fontSize: 12, color: "#ff6b6b", marginLeft: "auto" }}>Score {a.lead_score}</span>
              </div>
            ))}
          </div>
        )}
        {/* HubSpot Connection Banner — shown when not connected */}
        {hubspot && !hubspot.connected && !loading && (
          <div style={{
            marginBottom: 20, padding: "24px 28px",
            background: "linear-gradient(135deg, rgba(255,146,43,.06), rgba(255,146,43,.02))",
            border: "1px solid rgba(255,146,43,.2)",
            borderRadius: 16,
            display: "flex", alignItems: "center", gap: 20,
            animation: "fadeIn .4s",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, rgba(255,146,43,.15), rgba(255,146,43,.05))",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Link2 size={24} color="#ff922b" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                Connect HubSpot CRM
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.5 }}>
                Link your HubSpot account to automatically sync discovered leads as contacts,
                log LinkedIn interactions as notes, and track deal conversions — all without leaving Dexraflow.
              </p>
            </div>
            <a
              href={getHubSpotAuthorizeUrl(brandId)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px", fontSize: 13, fontWeight: 600,
                background: "linear-gradient(135deg, #ff922b, #f76707)",
                color: "#fff", border: "none", borderRadius: 10,
                textDecoration: "none", cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(255,146,43,.25)",
                transition: "all .2s",
              }}
            >
              <Link2 size={16} /> Connect HubSpot
            </a>
          </div>
        )}

        {/* Stats cards */}
        {stats && <StatsCards stats={stats} />}

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <button onClick={() => setShowFilters(!showFilters)} style={btnStyle}><Filter size={14} /> Filters {showFilters ? "▲" : "▼"}</button>
          {Object.keys(filters).length > 0 && <button onClick={() => { setFilters({}); setPage(1); }} style={{ ...btnStyle, color: "#ff6b6b" }}><X size={14} /> Clear</button>}
          <span style={{ fontSize: 13, color: "#888", marginLeft: "auto" }}>{total} leads total</span>
        </div>

        {showFilters && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => { setFilters(f => ({ ...f, status: f.status === s ? undefined : s })); setPage(1); }} style={{ ...chipStyle, background: filters.status === s ? STATUS_COLORS[s] + "33" : "rgba(255,255,255,.04)", borderColor: filters.status === s ? STATUS_COLORS[s] : "rgba(255,255,255,.08)", color: filters.status === s ? STATUS_COLORS[s] : "#aaa" }}>{s}</button>
            ))}
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,.08)" }} />
            {[1, 2, 3].map(p => (
              <button key={p} onClick={() => { setFilters(f => ({ ...f, priority: f.priority === p ? undefined : p })); setPage(1); }} style={{ ...chipStyle, background: filters.priority === p ? PRIORITY_CONFIG[p].bg : "rgba(255,255,255,.04)", borderColor: filters.priority === p ? PRIORITY_CONFIG[p].color : "rgba(255,255,255,.08)", color: filters.priority === p ? PRIORITY_CONFIG[p].color : "#aaa" }}>{PRIORITY_CONFIG[p].label}</button>
            ))}
          </div>
        )}

        {/* Lead list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Loading leads…</div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Users size={48} color="#333" style={{ marginBottom: 12 }} />
            <p style={{ color: "#666", fontSize: 14 }}>No leads yet. Click "Scan Leads" to discover leads from your LinkedIn engagement.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} hubspotConnected={hubspot?.connected || false}
                onStatusChange={(s) => handleStatusChange(lead, s)}
                onHubspotSync={() => handleHubspotSync(lead)}
                onAttributionClick={() => { setSelectedLead(lead); setShowAttribution(true); }} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnStyle}>← Prev</button>
            <span style={{ fontSize: 13, color: "#888", padding: "8px 12px" }}>Page {page} of {Math.ceil(total / 20)}</span>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} style={btnStyle}>Next →</button>
          </div>
        )}
      </div>

      {/* Attribution Modal */}
      {showAttribution && selectedLead && (
        <AttributionModal lead={selectedLead} onConfirm={handleAttribution} onClose={() => { setShowAttribution(false); setSelectedLead(null); }} />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        .spin { animation: spin 1s linear infinite }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function StatsCards({ stats }: { stats: LeadStats }) {
  const cards = [
    { label: "Total Leads", value: stats.total_leads, icon: <Users size={18} />, color: "#a78bfa" },
    { label: "P1 High Intent", value: stats.by_priority.p1_high_intent, icon: <Zap size={18} />, color: "#ff6b6b" },
    { label: "Converted", value: stats.by_status.converted, icon: <TrendingUp size={18} />, color: "#38d9a9" },
    { label: "Avg Score", value: stats.avg_lead_score, icon: <Star size={18} />, color: "#ffd43b" },
    { label: "In HubSpot", value: stats.synced_to_hubspot, icon: <Link2 size={18} />, color: "#ff922b" },
    { label: "Unconfirmed", value: stats.unconfirmed_attributions, icon: <AlertCircle size={18} />, color: stats.unconfirmed_attributions > 0 ? "#ff6b6b" : "#69db7c" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ padding: "16px 18px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: c.color }}>{c.icon}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5 }}>{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadCard({ lead, hubspotConnected, onStatusChange, onHubspotSync, onAttributionClick }: {
  lead: Lead; hubspotConnected: boolean;
  onStatusChange: (s: string) => void; onHubspotSync: () => void; onAttributionClick: () => void;
}) {
  const pri = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG[3];
  const initials = (lead.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: "16px 20px", background: "rgba(255,255,255,.025)", border: `1px solid ${!lead.attribution_confirmed ? "rgba(255,107,107,.2)" : "rgba(255,255,255,.06)"}`, borderRadius: 14, display: "flex", gap: 14, alignItems: "flex-start", transition: "border-color .2s" }}>
      {/* Avatar */}
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${pri.color}44,${pri.color}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: pri.color, flexShrink: 0 }}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>{lead.name}</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: pri.bg, color: pri.color, fontWeight: 600 }}>{pri.label}</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: STATUS_COLORS[lead.status] + "22", color: STATUS_COLORS[lead.status], fontWeight: 500 }}>{lead.status}</span>
          {!lead.attribution_confirmed && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,107,107,.15)", color: "#ff6b6b" }}>⚠ Unconfirmed</span>}
          {lead.hubspot_contact_id && <span style={{ fontSize: 10, color: "#ff922b" }}>● HubSpot</span>}
        </div>
        <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>
          {lead.role && <span>{lead.role}</span>}
          {lead.company && <span> · {lead.company}</span>}
        </div>
        {lead.signal_reasoning && (
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-line", maxHeight: 60, overflow: "hidden" }}>
            {lead.signal_reasoning.split("\n").slice(0, 2).join("\n")}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#666", padding: "3px 8px", background: "rgba(255,255,255,.04)", borderRadius: 6 }}>Score: {lead.lead_score}</span>
          {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0a66c2", padding: "3px 8px", background: "rgba(10,102,194,.08)", borderRadius: 6, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}><Linkedin size={12} /> LinkedIn</a>}
          {lead.email && <span style={{ fontSize: 12, color: "#888", padding: "3px 8px", background: "rgba(255,255,255,.04)", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {lead.email}</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <select value={lead.status} onChange={(e) => onStatusChange(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, color: "#ccc", cursor: "pointer" }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {hubspotConnected && !lead.hubspot_contact_id && (
          <button onClick={onHubspotSync} style={{ ...smallBtnStyle, color: "#ff922b", borderColor: "rgba(255,146,43,.2)" }} title="Create in HubSpot"><Plus size={12} /> HubSpot</button>
        )}
        {lead.hubspot_contact_url && (
          <a href={lead.hubspot_contact_url} target="_blank" rel="noreferrer" style={{ ...smallBtnStyle, color: "#ff922b", borderColor: "rgba(255,146,43,.2)", textDecoration: "none", textAlign: "center" }}><ExternalLink size={12} /> Open</a>
        )}
        {!lead.attribution_confirmed && (
          <button onClick={onAttributionClick} style={{ ...smallBtnStyle, color: "#a78bfa", borderColor: "rgba(167,139,250,.2)" }}><UserCheck size={12} /> Confirm</button>
        )}
      </div>
    </div>
  );
}

function HubSpotBadge({ hubspot, brandId, onRefresh }: { hubspot: HubSpotStatus | null; brandId: string; onRefresh: () => void }) {
  if (!hubspot) return null;
  if (hubspot.connected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#38d9a9", display: "flex", alignItems: "center", gap: 4 }}><Link2 size={13} /> HubSpot Connected</span>
        <button onClick={async () => { await disconnectHubSpot(brandId); onRefresh(); }} style={{ ...smallBtnStyle, color: "#ff6b6b", borderColor: "rgba(255,107,107,.15)" }}><Unlink size={12} /></button>
      </div>
    );
  }
  return (
    <a href={getHubSpotAuthorizeUrl(brandId)} style={{ ...btnStyle, textDecoration: "none", color: "#ff922b", borderColor: "rgba(255,146,43,.2)" }}><Link2 size={14} /> Connect HubSpot</a>
  );
}

function AttributionModal({ lead, onConfirm, onClose }: {
  lead: Lead; onConfirm: (d: { already_known: boolean; was_in_pipeline: boolean; attribution: string }) => void; onClose: () => void;
}) {
  const [known, setKnown] = useState(false);
  const [inPipeline, setInPipeline] = useState(false);

  const deriveAttribution = () => {
    if (known && inPipeline) return "user";
    if (known && !inPipeline) return "both";
    return "platform";
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 28, animation: "fadeIn .25s" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Lead Attribution — {lead.name}</h3>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>Let's keep your pipeline data clean. Quick 3 questions:</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={questionStyle}>
            <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} style={{ accentColor: "#a78bfa" }} />
            <span>Did you already know this person personally or professionally?</span>
          </label>
          <label style={questionStyle}>
            <input type="checkbox" checked={inPipeline} onChange={(e) => setInPipeline(e.target.checked)} style={{ accentColor: "#a78bfa" }} />
            <span>Were they already in your pipeline before the platform flagged them?</span>
          </label>
          <div style={{ padding: "12px 14px", background: "rgba(167,139,250,.06)", borderRadius: 10, border: "1px solid rgba(167,139,250,.15)" }}>
            <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>Attribution: </span>
            <span style={{ fontSize: 13, color: "#e0e0e0" }}>
              {deriveAttribution() === "platform" && "🎯 Platform Discovery — Dexraflow surfaced this lead"}
              {deriveAttribution() === "user" && "👤 Manually Sourced — you already had this lead"}
              {deriveAttribution() === "both" && "🤝 Joint — you knew them, but platform flagged the signal"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnStyle, color: "#888" }}>Cancel</button>
          <button onClick={() => onConfirm({ already_known: known, was_in_pipeline: inPipeline, attribution: deriveAttribution() })} style={{ ...btnStyle, background: "linear-gradient(135deg,#a78bfa,#818cf8)", color: "#fff", border: "none" }}>
            <Check size={14} /> Confirm Attribution
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────────── */
const btnStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#ccc", cursor: "pointer", transition: "all .15s" };
const smallBtnStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, fontWeight: 500, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, cursor: "pointer", transition: "all .15s" };
const chipStyle: React.CSSProperties = { padding: "5px 12px", fontSize: 12, fontWeight: 500, border: "1px solid", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.04)", transition: "all .15s" };
const questionStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ddd", cursor: "pointer", lineHeight: 1.4 };
