import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  linkedinAnalyticsAPI,
  type LinkedInDashboardData,
  type Period,
} from "@/services/linkedinAnalyticsAPI";
import { toast } from "sonner";
import {
  BrainCircuit, Cpu, RefreshCw, Loader2, Linkedin,
  User, Building2, BarChart3, Lightbulb, Target, WifiOff, Trophy, Video, Clock, PenLine, type LucideIcon
} from "lucide-react";

import TimePeriodSelector from "./TimePeriodSelector";
import GrowthHighlightCards from "./GrowthHighlightCards";
import PostPerformanceTable from "./PostPerformanceTable";
import GrowthChart from "./GrowthChart";
import ContentTypeBreakdownChart from "./ContentTypeBreakdown";
import BestTimeHeatmap from "./BestTimeHeatmap";
import DemographicsBreakdown from "./DemographicsBreakdown";
import EngagementBenchmark from "./EngagementBenchmark";
import LeadIntelligencePanel from "./LeadIntelligencePanel";

const ICON_MAP: Record<string, LucideIcon> = {
  BrainCircuit,
  Trophy,
  Target,
  Video,
  Clock,
  PenLine,
  TrendingUp: BarChart3, // Map trending to barchart as fallback or similar
};

const LinkedInDashboard = () => {
  const { currentSpace } = useAuth();
  const [data, setData] = useState<LinkedInDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [customStart, setCustomStart] = useState<string>();
  const [customEnd, setCustomEnd] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const dashboardData = await linkedinAnalyticsAPI.getDashboard(
        currentSpace.id, period, customStart, customEnd
      );
      setData(dashboardData);
    } catch (e: any) {
      setError(e.message || "Failed to load LinkedIn analytics");
      console.error("Dashboard load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, period, customStart, customEnd]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSync = async () => {
    if (!currentSpace?.id) return;
    setIsSyncing(true);
    try {
      await linkedinAnalyticsAPI.triggerSync(currentSpace.id);
      toast.success("Cache cleared — refreshing data...");
      await loadDashboard();
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePeriodChange = (newPeriod: Period, start?: string, end?: string) => {
    setPeriod(newPeriod);
    setCustomStart(start);
    setCustomEnd(end);
  };

  // ── Loading State ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-20 gap-10">
        <div className="relative">
          <div className="w-40 h-40 border-2 border-blue-500/5 border-t-blue-500 rounded-[3rem] animate-spin duration-[3s]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Linkedin className="w-12 h-12 text-blue-500 animate-pulse" />
          </div>
          <div className="absolute -inset-4 border border-blue-500/10 rounded-[3.5rem] overflow-hidden">
            <div
              className="w-full h-1/2 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent animate-scan"
              style={{ animationDuration: "4s" }}
            />
          </div>
        </div>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/5 rounded-full">
            <Cpu className="w-3 h-3 text-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
              LinkedIn Intelligence
            </span>
          </div>
          <h3 className="text-3xl font-black tracking-tight text-foreground uppercase">
            Analyzing Your Network.
          </h3>
          <div className="flex justify-center gap-1.5 opacity-30">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-20 gap-6">
        <div className="p-6 rounded-[2.5rem] bg-muted/20">
          <WifiOff className="w-16 h-16 text-muted-foreground/30" />
        </div>
        <h3 className="text-2xl font-black tracking-tight text-center uppercase">
          {error.includes("not connected") ? "LinkedIn Not Connected." : "Analytics Unavailable."}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-md">
          {error.includes("not connected")
            ? "Connect your LinkedIn account from Settings → Connectors to unlock real-time intelligence."
            : error}
        </p>
        <Button
          onClick={loadDashboard}
          className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  // ── Prepare chart data from org share stats ─────────────────────────
  const orgDailyImpressions = data.organization?.share_stats?.daily?.map((d: any) => ({
    date: d.date,
    impressions: d.impressions,
    engagement: d.reactions + d.comments + d.shares,
  })) || [];

  const orgDailyVisitors = data.organization?.page_stats?.daily?.map((d: any) => ({
    date: d.date,
    page_views: d.page_views,
    unique_visitors: d.unique_visitors,
  })) || [];

  const avgEngRate = data.individual?.posts?.length
    ? +(
        data.individual.posts.reduce((a: number, p: any) => a + (p.engagement_rate || 0), 0) /
        data.individual.posts.length
      ).toFixed(2)
    : 0;

  return (
    <div className="space-y-10 pb-32 max-w-[1400px] mx-auto">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/10 text-blue-500 shadow-lg shadow-blue-500/5">
              <Linkedin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                LinkedIn Intelligence
              </p>
              <h2 className="text-2xl font-black tracking-tighter">
                {data.person_name && data.org_name
                  ? `${data.person_name} · ${data.org_name}`
                  : data.person_name || data.org_name || "LinkedIn Analytics"}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TimePeriodSelector value={period} onChange={handlePeriodChange} />
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            className="h-11 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2 border-border/30"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync
          </Button>
        </div>
      </div>

      {/* ── Section 1: Growth Highlights ──────────────────────── */}
      <GrowthHighlightCards highlights={data.highlights} />

      {/* ── Tabbed Content ────────────────────────────────────── */}
      <Tabs defaultValue="individual" className="space-y-8">
        <TabsList className="bg-white rounded-2xl p-1.5 shadow-sm border border-border/20 h-auto">
          <TabsTrigger
            value="individual"
            className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <User className="w-3.5 h-3.5 mr-2" />
            Individual
          </TabsTrigger>
          {data.org_urn && (
            <TabsTrigger
              value="organization"
              className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <Building2 className="w-3.5 h-3.5 mr-2" />
              Organization
            </TabsTrigger>
          )}
          <TabsTrigger
            value="content"
            className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <BarChart3 className="w-3.5 h-3.5 mr-2" />
            Content Mix
          </TabsTrigger>
          <TabsTrigger
            value="intelligence"
            className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <Target className="w-3.5 h-3.5 mr-2" />
            Intelligence
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Individual ──────────────────────────────────── */}
        <TabsContent value="individual" className="space-y-8">
          <PostPerformanceTable
            posts={data.individual?.posts || []}
            avgEngagementRate={avgEngRate}
          />

          {data.heatmap && data.heatmap.length > 0 && (
            <BestTimeHeatmap data={data.heatmap} bestDay={data.best_day} />
          )}
        </TabsContent>

        {/* ── Tab: Organization ─────────────────────────────────── */}
        {data.org_urn && (
          <TabsContent value="organization" className="space-y-8">
            {/* Org charts */}
            <div className="grid gap-8 lg:grid-cols-2">
              <GrowthChart
                data={orgDailyImpressions}
                title="Org Impressions"
                subtitle="Daily impression volume"
                dataKey="impressions"
                color="#3b82f6"
              />
              <GrowthChart
                data={orgDailyVisitors}
                title="Page Visitors"
                subtitle="Unique page visitors over time"
                dataKey="unique_visitors"
                color="#8b5cf6"
              />
            </div>

            {/* Benchmark */}
            {data.benchmark && <EngagementBenchmark data={data.benchmark} />}

            {/* Demographics */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <Badge className="bg-purple-500/10 text-purple-500 text-[8px] font-black uppercase tracking-widest border-none">
                  ICP Gold
                </Badge>
                <div className="h-px flex-1 bg-border/20" />
              </div>
              <DemographicsBreakdown
                demographics={data.organization?.demographics || {}}
                decisionMakerPct={data.decision_maker_pct}
              />
            </div>

            {/* Org posts table */}
            {data.organization?.posts && data.organization.posts.length > 0 && (
              <PostPerformanceTable
                posts={data.organization.posts}
                avgEngagementRate={
                  data.organization.posts.length > 0
                    ? +(
                        data.organization.posts.reduce(
                          (a: number, p: any) => a + (p.engagement_rate || 0),
                          0
                        ) / data.organization.posts.length
                      ).toFixed(2)
                    : 0
                }
              />
            )}
          </TabsContent>
        )}

        {/* ── Tab: Content Mix ──────────────────────────────────── */}
        <TabsContent value="content" className="space-y-8">
          <ContentTypeBreakdownChart data={data.content_breakdown} />

          {data.heatmap && data.heatmap.length > 0 && (
            <BestTimeHeatmap data={data.heatmap} bestDay={data.best_day} />
          )}

          {/* Top Post Highlight */}
          {data.top_post && (
            <Card className="border-none bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                  <Trophy className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/60 mb-1">
                    Top Performing Post
                  </p>
                  <p className="text-sm font-bold text-foreground/80 line-clamp-2 mb-3">
                    "{data.top_post.text_snippet}"
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="font-black">
                      {(data.top_post.impressions || 0).toLocaleString()} impressions
                    </span>
                    <span className="font-black text-emerald-500">
                      {data.top_post.engagement_rate}% engagement
                    </span>
                    <span className="font-bold text-muted-foreground/50">
                      {data.top_post.posted_at
                        ? new Date(data.top_post.posted_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Intelligence ─────────────────────────────────── */}
        <TabsContent value="intelligence" className="space-y-8">
          <LeadIntelligencePanel
            insights={data.lead_intelligence?.insights || []}
          />

          {/* Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-lg font-black tracking-tight uppercase">
                  AI Recommendations.
                </h3>
              </div>
              <div className="space-y-4">
                {data.recommendations.map((rec, idx) => {
                  const IconComp = ICON_MAP[rec.icon] || Lightbulb;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-4 p-5 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="p-2 rounded-xl bg-white text-primary shadow-sm">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-foreground/80">{rec.title}</h4>
                        <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LinkedInDashboard;
