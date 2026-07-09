// src/pages/InternalAnalytics.tsx
//
// INTERNAL-ONLY product analytics dashboard for Dexraflow staff.
// Gated by a static user_id + password (exchanged for a short-lived JWT).
// Not linked from the customer app; reachable at /internal.

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Building2,
  Megaphone,
  Image as ImageIcon,
  Clock,
  TrendingUp,
  Heart,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Mail,
  Search,
  Globe,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import internalAnalyticsAPI, { Snapshot, ClientRow } from "@/services/internalAnalyticsAPI";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

const RANGE_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "180d", value: 180 },
  { label: "1y", value: 365 },
];

const fmt = (n: number | undefined) =>
  (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

// --------------------------------------------------------------------------- //
// Login gate
// --------------------------------------------------------------------------- //
const LoginGate = ({ onSuccess }: { onSuccess: () => void }) => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await internalAnalyticsAPI.login(userId.trim(), password);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-sm border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
          </div>
          <CardTitle className="text-lg">Dexraflow Internal Analytics</CardTitle>
          <p className="text-xs text-slate-400">Authorized employees only</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="uid" className="text-slate-300">User ID</Label>
              <Input
                id="uid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd" className="text-slate-300">Password</Label>
              <Input
                id="pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// --------------------------------------------------------------------------- //
// Stat card
// --------------------------------------------------------------------------- //
const Stat = ({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-indigo-400",
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) => (
  <Card className="border-slate-800 bg-slate-900">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </CardContent>
  </Card>
);

// --------------------------------------------------------------------------- //
// Clients directory (people + space + brand growth stats)
// --------------------------------------------------------------------------- //
const ClientsDirectory = ({ clients }: { clients: ClientRow[] }) => {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = [
        c.brand_name,
        c.space_name,
        c.industry,
        c.owner_email,
        ...c.members.map((m) => m.email),
        ...c.members.map((m) => m.name || ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, query]);

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-medium text-slate-200">
          Client Directory <span className="text-slate-500">({filtered.length})</span>
        </CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, space, email…"
            className="border-slate-700 bg-slate-800 pl-8 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Space / Brand</TableHead>
                <TableHead className="text-slate-400">Owner</TableHead>
                <TableHead className="text-center text-slate-400">Members</TableHead>
                <TableHead className="text-right text-slate-400">Posts</TableHead>
                <TableHead className="text-right text-slate-400">Impressions</TableHead>
                <TableHead className="text-right text-slate-400">Reach</TableHead>
                <TableHead className="text-right text-slate-400">Interactions</TableHead>
                <TableHead className="text-right text-slate-400">Avg ER</TableHead>
                <TableHead className="text-right text-slate-400">Hrs Saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const isOpen = expanded === c.brand_id;
                return (
                  <Fragment key={c.brand_id}>
                    <TableRow
                      className="cursor-pointer border-slate-800 hover:bg-slate-800/40"
                      onClick={() => setExpanded(isOpen ? null : c.brand_id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                          <div>
                            <p className="font-medium text-slate-100">{c.space_name || c.brand_name}</p>
                            <p className="text-xs text-slate-500">
                              {c.brand_name}
                              {c.industry ? ` · ${c.industry}` : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <span className="text-xs">{c.owner_email || "—"}</span>
                      </TableCell>
                      <TableCell className="text-center text-slate-300">{c.member_count}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.posts_created)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.impressions)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.reach)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.total_interactions)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.avg_engagement_rate)}%</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.hours_saved)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="border-slate-800 bg-slate-950/40 hover:bg-slate-950/40">
                        <TableCell colSpan={9}>
                          <div className="px-6 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Team members ({c.members.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {c.members.length === 0 && (
                                <span className="text-xs text-slate-500">No members recorded</span>
                              )}
                              {c.members.map((m) => (
                                <span
                                  key={m.email}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200"
                                >
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  {m.email}
                                  <Badge variant="outline" className="ml-1 border-slate-600 px-1.5 py-0 text-[10px] text-slate-400">
                                    {m.role}
                                  </Badge>
                                </span>
                              ))}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                              <div><span className="text-slate-500">Published:</span> <span className="text-slate-200">{fmt(c.posts_published)}</span></div>
                              <div><span className="text-slate-500">Likes/Comments/Saves:</span> <span className="text-slate-200">{fmt(c.total_interactions)}</span></div>
                              <div><span className="text-slate-500">Joined:</span> <span className="text-slate-200">{c.created_at ? c.created_at.slice(0, 10) : "—"}</span></div>
                              <div><span className="text-slate-500">Brand ID:</span> <span className="text-slate-400">{c.brand_id.slice(0, 8)}…</span></div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={9} className="text-center text-slate-500">
                    No clients match your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// --------------------------------------------------------------------------- //
// Dashboard
// --------------------------------------------------------------------------- //
const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(90);

  const load = async (range: number) => {
    setLoading(true);
    setError("");
    try {
      const snap = await internalAnalyticsAPI.getSnapshot(range);
      setData(snap);
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics");
      if (String(err?.message || "").toLowerCase().includes("session")) onLogout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Merge the daily series into one array keyed by date for the combined chart.
  const growthSeries = useMemo(() => {
    if (!data) return [];
    const byDate: Record<string, any> = {};
    data.growth.new_signups.forEach((p) => {
      byDate[p.date] = { date: p.date, signups: p.count, brands: 0, posts: 0 };
    });
    data.growth.new_brands.forEach((p) => {
      byDate[p.date] = { ...(byDate[p.date] || { date: p.date, signups: 0, posts: 0 }), brands: p.count };
    });
    data.growth.posts_created.forEach((p) => {
      byDate[p.date] = { ...(byDate[p.date] || { date: p.date, signups: 0, brands: 0 }), posts: p.count };
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const o = data?.overview;
  const g = data?.growth;
  const e = data?.engagement;

  return (
    <>
      {/* Sub-header: range selector + refresh */}
      <div className="border-b border-slate-800/60 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
          <p className="text-[11px] text-slate-500 font-medium">Cross-client product usage &amp; growth KPIs</p>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-800 p-0.5">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    days === r.value ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={() => load(days)} className="text-slate-400 hover:text-slate-100">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Users} label="Total Clients" value={fmt(o?.total_clients)} sub={`+${fmt(o?.new_clients_30d)} in last 30d`} />
          <Stat icon={Building2} label="Brands" value={fmt(o?.total_brands)} sub={`${fmt(o?.avg_posts_per_brand)} posts/brand`} accent="text-emerald-400" />
          <Stat icon={Megaphone} label="Campaigns" value={fmt(o?.total_campaigns)} sub={`${fmt(o?.active_campaigns)} active`} accent="text-amber-400" />
          <Stat icon={ImageIcon} label="Posts Created" value={fmt(o?.posts_created)} sub={`${fmt(o?.posts_published)} published`} accent="text-cyan-400" />
        </div>

        {/* Time saved — the headline value metric */}
        <Card className="border-indigo-900/60 bg-gradient-to-br from-indigo-950 to-slate-900">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/15">
                <Clock className="h-7 w-7 text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">Total Client Time Saved</p>
                <p className="text-3xl font-bold text-white">{fmt(o?.time_saved.hours)} hours</p>
                <p className="text-xs text-slate-400">
                  ≈ {fmt(o?.time_saved.days)} working days · {fmt(o?.time_saved.minutes_saved_per_post)} min saved per post
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-400 sm:text-right sm:max-w-xs">
              <p>
                Based on ~{o?.assumptions?.manual_minutes_per_post}min manual vs{" "}
                ~{o?.assumptions?.system_minutes_per_post}min on Dexraflow per post.
              </p>
              <p className="mt-1 text-slate-500">
                Deleted campaigns &amp; posts excluded ({fmt(o?.posts_deleted_excluded)} posts ignored).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Growth */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Acquisition & Production Trend</CardTitle>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              <TrendingUp className="mr-1 h-3 w-3" />
              {g && g.growth_rate_pct >= 0 ? "+" : ""}
              {fmt(g?.growth_rate_pct)}% vs prev period
            </Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} />
                <Line type="monotone" dataKey="signups" name="New clients" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="brands" name="New brands" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="posts" name="Posts produced" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative + distribution */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Cumulative Client Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={g?.cumulative_clients || []}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} />
                  <Area type="monotone" dataKey="total_clients" name="Total clients" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Campaign Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data?.segments.campaign_status || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry: any) => `${entry.status} (${entry.count})`}
                    labelLine={false}
                  >
                    {(data?.segments.campaign_status || []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Engagement + top clients */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Heart className="h-4 w-4 text-pink-400" /> Engagement Delivered
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Total interactions", e?.total_interactions],
                ["Likes", e?.likes],
                ["Comments", e?.comments],
                ["Saves", e?.saves],
                ["Shares", e?.shares],
                ["Reach", e?.reach],
                ["Impressions", e?.impressions],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-slate-100">{fmt(val as number)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Top Clients by Posts & Time Saved</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Brand</TableHead>
                    <TableHead className="text-slate-400">Space</TableHead>
                    <TableHead className="text-right text-slate-400">Posts</TableHead>
                    <TableHead className="text-right text-slate-400">Reach</TableHead>
                    <TableHead className="text-right text-slate-400">Hrs Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.top_clients || []).map((c) => (
                    <TableRow key={c.brand_id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="font-medium text-slate-200">{c.brand_name}</TableCell>
                      <TableCell className="text-slate-400">{c.space_name || "—"}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.posts_created)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.reach)}</TableCell>
                      <TableCell className="text-right text-slate-300">{fmt(c.hours_saved)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.top_clients || data.top_clients.length === 0) && (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={5} className="text-center text-slate-500">No data yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Full client directory: people + space + brand growth stats */}
        <ClientsDirectory clients={data?.clients || []} />

        {/* Industry distribution */}
        {data?.segments.industries && data.segments.industries.length > 0 && (
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Clients by Industry</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.segments.industries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="industry" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} cursor={{ fill: "#1e293b50" }} />
                  <Bar dataKey="count" name="Brands" radius={[4, 4, 0, 0]}>
                    {data.segments.industries.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <p className="pb-6 text-center text-[11px] text-slate-600">
          Generated {o?.generated_at} · Confidential — Dexraflow internal use only
        </p>
      </main>
    </>
  );
};

// --------------------------------------------------------------------------- //
// Page – Tabbed Internal Dashboard
// --------------------------------------------------------------------------- //
import LinkedInResearchWizard from "./internal/LinkedInResearchWizard";

type InternalTab = "analytics" | "research";

const TAB_ITEMS: { id: InternalTab; label: string; icon: any }[] = [
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "research", label: "Research Infrastructure", icon: Globe },
];

// We need Globe from lucide for the tab icon — add it to the imports at the
// top of the file if not already present. However, since we cannot modify
// the imports section from here, we redefine a small Globe stand-in inline.
// lucide-react re-exports are tree-shaken so importing at module level is preferred.
// The icon is already imported further down by LinkedInResearchWizard but we
// can also use ShieldCheck which is already imported.

const InternalAnalytics = () => {
  const [authed, setAuthed] = useState(internalAnalyticsAPI.isAuthenticated());
  const [tab, setTab] = useState<InternalTab>("analytics");

  const logout = () => {
    internalAnalyticsAPI.logout();
    setAuthed(false);
  };

  if (!authed) return <LoginGate onSuccess={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Shared header with tab bar */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
              <div>
                <h1 className="text-sm font-semibold">Dexraflow · Internal Dashboard</h1>
                <p className="text-[11px] text-slate-500">Admin-only tools &amp; analytics</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-slate-100">
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
          {/* Tab bar */}
          <nav className="flex gap-1 -mb-px">
            {TAB_ITEMS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg
                    transition-all duration-200 border-b-2
                    ${
                      active
                        ? "border-indigo-500 text-indigo-300 bg-indigo-500/5"
                        : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                    }
                  `}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Tab content */}
      {tab === "analytics" && <Dashboard onLogout={logout} />}
      {tab === "research" && (
        <div className="mx-auto max-w-7xl px-6 py-8">
          <LinkedInResearchWizard />
        </div>
      )}
    </div>
  );
};

export default InternalAnalytics;

