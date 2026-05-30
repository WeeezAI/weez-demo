import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  HeatmapEntry,
  linkedinAnalyticsAPI,
  PostMetric,
  type LinkedInDashboardData,
  type Period,
} from "@/services/linkedinAnalyticsAPI";
import { toast } from "sonner";
import {
  BrainCircuit, Cpu, RefreshCw, Loader2, Linkedin,
  User, Building2, BarChart3, Lightbulb, Target, WifiOff, Trophy,
  Video, Clock, PenLine, MessageSquareReply, type LucideIcon
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
import ReviewQueue from "@/components/comment-response/ReviewQueue";
import CommentAnalytics from "@/components/comment-response/CommentAnalytics";
import AutoReplySettings from "@/components/comment-response/AutoReplySettings";

const ICON_MAP: Record<string, LucideIcon> = {
  BrainCircuit,
  Trophy,
  Target,
  Video,
  Clock,
  PenLine,
  TrendingUp: BarChart3, // Map trending to barchart as fallback or similar
};

// Auto-refresh interval: 5 minutes
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const formatTimeAgo = (isoString?: string): string => {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
  const [commentSubTab, setCommentSubTab] = useState<"queue" | "analytics" | "settings">("queue");
  const [lastUpdated, setLastUpdated] = useState<string | undefined>();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Switcher context state: combined, personal, or organization
  const [viewContext, setViewContext] = useState<"combined" | "personal" | "org">("combined");
  const [activeTab, setActiveTab] = useState<string>("individual");

  const loadDashboard = useCallback(async () => {
    if (!currentSpace?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const dashboardData = await linkedinAnalyticsAPI.getDashboard(
        currentSpace.id, period, customStart, customEnd
      );
      setData(dashboardData);
      setLastUpdated(dashboardData.last_synced_at || new Date().toISOString());
    } catch (e: any) {
      setError(e.message || "Failed to load LinkedIn analytics");
      console.error("Dashboard load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentSpace?.id, period, customStart, customEnd]);

  // Silent background polling — updates highlights + key metrics without loading state
  const pollSummary = useCallback(async () => {
    if (!currentSpace?.id || isLoading || isSyncing) return;
    try {
      const summary = await linkedinAnalyticsAPI.getDashboardSummary(
        currentSpace.id, period, customStart, customEnd
      );
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          highlights: summary.highlights,
          individual: {
            ...prev.individual,
            total_impressions: summary.individual.total_impressions,
            total_reactions: summary.individual.total_reactions,
            total_comments: summary.individual.total_comments,
            total_shares: summary.individual.total_shares,
            post_count: summary.individual.post_count,
          },
          top_post: summary.top_post || prev.top_post,
          benchmark: summary.benchmark || prev.benchmark,
          last_synced_at: summary.last_synced_at,
        };
      });
      setLastUpdated(summary.last_synced_at);
    } catch {
      // Silent fail on polling — don't disrupt the user
      console.warn("Background poll failed, will retry next interval");
    }
  }, [currentSpace?.id, period, customStart, customEnd, isLoading, isSyncing]);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-refresh polling (every 5 minutes)
  useEffect(() => {
    pollIntervalRef.current = setInterval(pollSummary, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pollSummary]);

  // Smart Tab Redirection
  useEffect(() => {
    if (!data) return;
    if (viewContext === "personal" && activeTab === "organization") {
      setActiveTab("individual");
    } else if (viewContext === "org" && activeTab === "individual") {
      setActiveTab("organization");
    }
  }, [viewContext, activeTab, data]);

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

  // ── Client-Side Re-Aggregation hook based on selected viewContext ──
  const computedData = useMemo(() => {
    if (!data) return null;

    const computePeriodDelta = (current: number, previous: number) => {
      const delta = current - previous;
      const delta_pct = previous > 0 ? +((delta / previous) * 100).toFixed(1) : (current > 0 ? 100 : 0);
      const direction = delta > 0 ? ("up" as const) : (delta < 0 ? ("down" as const) : ("flat" as const));
      return { current, previous, delta, delta_pct, direction };
    };

    const getBestDayFromHeatmap = (heatmap: HeatmapEntry[]) => {
      if (!heatmap || heatmap.length === 0) return "Tuesday";
      const dayRates: Record<string, { totalRate: number; count: number }> = {};
      heatmap.forEach(h => {
        if (!dayRates[h.day]) {
          dayRates[h.day] = { totalRate: 0, count: 0 };
        }
        dayRates[h.day].totalRate += h.avg_engagement_rate;
        dayRates[h.day].count += 1;
      });
      let bestDay = "Tuesday";
      let bestAvg = -1;
      Object.entries(dayRates).forEach(([day, val]) => {
        const avg = val.count > 0 ? val.totalRate / val.count : 0;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestDay = day;
        }
      });
      return bestDay;
    };

    const buildContentBreakdown = (posts: PostMetric[]) => {
      const byType: Record<string, {
        count: number;
        total_impressions: number;
        total_reactions: number;
        total_comments: number;
        total_shares: number;
        engagementRates: number[];
      }> = {};
      posts.forEach(p => {
        const ct = p.content_type || "text";
        if (!byType[ct]) {
          byType[ct] = { count: 0, total_impressions: 0, total_reactions: 0, total_comments: 0, total_shares: 0, engagementRates: [] };
        }
        byType[ct].count++;
        byType[ct].total_impressions += p.impressions || 0;
        byType[ct].total_reactions += p.reactions || 0;
        byType[ct].total_comments += p.comments || 0;
        byType[ct].total_shares += p.shares || 0;
        if (p.engagement_rate) byType[ct].engagementRates.push(p.engagement_rate);
      });
      return Object.entries(byType).map(([content_type, b]) => {
        const avg_engagement_rate = b.engagementRates.length > 0
          ? +(b.engagementRates.reduce((x, y) => x + y, 0) / b.engagementRates.length).toFixed(2)
          : 0;
        return {
          content_type,
          count: b.count,
          total_impressions: b.total_impressions,
          total_reactions: b.total_reactions,
          total_comments: b.total_comments,
          total_shares: b.total_shares,
          avg_engagement_rate,
        };
      });
    };

    const buildHeatmap = (posts: PostMetric[]) => {
      const grid: Record<string, { totalRate: number; count: number }> = {};
      posts.forEach(p => {
        if (!p.posted_at) return;
        const dt = new Date(p.posted_at);
        const dayIndex = dt.getDay();
        const hour = dt.getHours();
        const shiftedDay = dayIndex === 0 ? 6 : dayIndex - 1;
        const key = `${shiftedDay}-${hour}`;
        if (!grid[key]) {
          grid[key] = { totalRate: 0, count: 0 };
        }
        grid[key].totalRate += p.engagement_rate || 0;
        grid[key].count++;
      });

      const heatmapData: HeatmapEntry[] = [];
      const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const key = `${d}-${h}`;
          const cell = grid[key];
          heatmapData.push({
            day: dayNames[d],
            day_index: d,
            hour: h,
            avg_engagement_rate: cell ? +(cell.totalRate / cell.count).toFixed(2) : 0,
            post_count: cell ? cell.count : 0,
          });
        }
      }
      return heatmapData;
    };

    const leadsCard = data.highlights?.find(h => h.metric_key === "leads") || {
      icon: "Target",
      label: "Leads Generated",
      metric_key: "leads",
      current: 0,
      previous: 0,
      delta: 0,
      delta_pct: 0,
      direction: "flat" as const,
    };

    if (viewContext === "personal") {
      const ci = data.individual;
      const pi = data.individual?.previous || {
        connections_count: 0,
        profile_views: 0,
        search_appearances: 0,
        total_impressions: 0,
        total_reactions: 0,
        total_comments: 0,
        total_shares: 0,
      };

      const personalImpressions = ci.total_impressions;
      const personalEngagements = ci.total_reactions + ci.total_comments + ci.total_shares;
      const personalEngRate = personalImpressions > 0 ? +((personalEngagements / personalImpressions) * 100).toFixed(2) : 0;
      const personalMultiplier = +(personalEngRate / 2.0).toFixed(1);

      const personalPosts = ci.posts || [];
      const personalHeatmap = buildHeatmap(personalPosts);
      const personalBestDay = getBestDayFromHeatmap(personalHeatmap);

      const personalTopPost = personalPosts.length > 0
        ? personalPosts.reduce((max, p) => (p.impressions || 0) > (max.impressions || 0) ? p : max, personalPosts[0])
        : null;
      const personalTopPostReach = personalTopPost ? personalTopPost.impressions : 0;

      const highlightsList = [
        {
          icon: "Link2",
          label: "New Connections",
          metric_key: "connections",
          ...computePeriodDelta(ci.connections_count || 0, pi.connections_count || 0),
        },
        {
          icon: "Eye",
          label: "Profile Views",
          metric_key: "profile_views",
          ...computePeriodDelta(ci.profile_views || 0, pi.profile_views || 0),
        },
        {
          icon: "Eye",
          label: "Search Appearances",
          metric_key: "search_appearances",
          ...computePeriodDelta(ci.search_appearances || 0, pi.search_appearances || 0),
        },
        {
          icon: "TrendingUp",
          label: "Impressions",
          metric_key: "impressions",
          ...computePeriodDelta(ci.total_impressions || 0, pi.total_impressions || 0),
        },
        {
          icon: "MessageSquare",
          label: "Comments Received",
          metric_key: "comments",
          ...computePeriodDelta(ci.total_comments || 0, pi.total_comments || 0),
        },
        {
          icon: "Heart",
          label: "Reactions Received",
          metric_key: "reactions",
          ...computePeriodDelta(ci.total_reactions || 0, pi.total_reactions || 0),
        },
        {
          icon: "Repeat2",
          label: "Shares",
          metric_key: "shares",
          ...computePeriodDelta(ci.total_shares || 0, pi.total_shares || 0),
        },
        leadsCard,
        {
          icon: "BarChart3",
          label: "Industry Avg Engagement",
          metric_key: "benchmark",
          current: personalMultiplier,
          previous: 0,
          delta: 0,
          delta_pct: 0,
          direction: personalMultiplier > 1 ? ("up" as const) : ("down" as const),
          suffix: "x",
        },
        {
          icon: "Trophy",
          label: "Top Post Reach",
          metric_key: "top_post",
          current: personalTopPostReach,
          previous: 0,
          delta: 0,
          delta_pct: 0,
          direction: personalTopPostReach > 0 ? ("up" as const) : ("flat" as const),
        },
        {
          icon: "CalendarDays",
          label: "Best Day to Post",
          metric_key: "best_day",
          current: personalBestDay,
          previous: "",
          delta: 0,
          delta_pct: 0,
          direction: "flat" as const,
          is_text: true,
        },
      ];

      const personalBenchmark = {
        client_rate: personalEngRate,
        benchmark_rate: 2.0,
        multiplier: personalMultiplier,
        status: personalEngRate > 2.2 ? ("above" as const) : (personalEngRate < 1.8 ? ("below" as const) : ("at" as const)),
        label: personalEngRate > 2.2
          ? `Your profile engagement is ${personalMultiplier}x the industry average!`
          : personalEngRate < 1.8
            ? `Room to grow — your profile is at ${personalEngRate}% vs 2.0% industry avg.`
            : `Your profile is right at the industry average of 2.0%.`,
      };

      return {
        highlights: highlightsList,
        contentBreakdown: buildContentBreakdown(personalPosts),
        heatmap: personalHeatmap,
        bestDay: personalBestDay,
        topPost: personalTopPost,
        benchmark: personalBenchmark,
      };
    }

    if (viewContext === "org") {
      const co = data.organization;
      const po = data.organization?.previous || {
        total_followers: 0,
        total_impressions: 0,
        total_reactions: 0,
        total_comments: 0,
        total_shares: 0,
        page_views: 0,
        unique_visitors: 0,
      };

      const orgImpressions = co.share_stats?.totals?.impressions || 0;
      const orgEngagements = (co.share_stats?.totals?.reactions || 0) + (co.share_stats?.totals?.comments || 0) + (co.share_stats?.totals?.shares || 0);
      const orgEngRate = orgImpressions > 0 ? +((orgEngagements / orgImpressions) * 100).toFixed(2) : 0;
      const orgMultiplier = +(orgEngRate / 2.0).toFixed(1);

      const orgPosts = co.posts || [];
      const orgHeatmap = buildHeatmap(orgPosts);
      const orgBestDay = getBestDayFromHeatmap(orgHeatmap);

      const orgTopPost = orgPosts.length > 0
        ? orgPosts.reduce((max, p) => (p.impressions || 0) > (max.impressions || 0) ? p : max, orgPosts[0])
        : null;
      const orgTopPostReach = orgTopPost ? orgTopPost.impressions : 0;

      const highlightsList = [
        {
          icon: "Users",
          label: "New Followers (Org)",
          metric_key: "org_followers",
          ...computePeriodDelta(co.followers?.total_followers || 0, po.total_followers || 0),
        },
        {
          icon: "Eye",
          label: "Page Views",
          metric_key: "page_views",
          ...computePeriodDelta(co.page_stats?.total_page_views || 0, po.page_views || 0),
        },
        {
          icon: "Users",
          label: "Unique Visitors",
          metric_key: "unique_visitors",
          ...computePeriodDelta(co.page_stats?.total_unique_visitors || 0, po.unique_visitors || 0),
        },
        {
          icon: "TrendingUp",
          label: "Impressions",
          metric_key: "impressions",
          ...computePeriodDelta(co.share_stats?.totals?.impressions || 0, po.total_impressions || 0),
        },
        {
          icon: "MessageSquare",
          label: "Comments Received",
          metric_key: "comments",
          ...computePeriodDelta(co.share_stats?.totals?.comments || 0, po.total_comments || 0),
        },
        {
          icon: "Heart",
          label: "Reactions Received",
          metric_key: "reactions",
          ...computePeriodDelta(co.share_stats?.totals?.reactions || 0, po.total_reactions || 0),
        },
        {
          icon: "Repeat2",
          label: "Shares",
          metric_key: "shares",
          ...computePeriodDelta(co.share_stats?.totals?.shares || 0, po.total_shares || 0),
        },
        leadsCard,
        {
          icon: "BarChart3",
          label: "Industry Avg Engagement",
          metric_key: "benchmark",
          current: orgMultiplier,
          previous: 0,
          delta: 0,
          delta_pct: 0,
          direction: orgMultiplier > 1 ? ("up" as const) : ("down" as const),
          suffix: "x",
        },
        {
          icon: "Trophy",
          label: "Top Post Reach",
          metric_key: "top_post",
          current: orgTopPostReach,
          previous: 0,
          delta: 0,
          delta_pct: 0,
          direction: orgTopPostReach > 0 ? ("up" as const) : ("flat" as const),
        },
        {
          icon: "BrainCircuit",
          label: "Decision Makers",
          metric_key: "decision_makers",
          current: data.decision_maker_pct || 0,
          previous: 0,
          delta: 0,
          delta_pct: 0,
          direction: (data.decision_maker_pct || 0) > 30 ? ("up" as const) : ("flat" as const),
          suffix: "%",
        },
        {
          icon: "CalendarDays",
          label: "Best Day to Post",
          metric_key: "best_day",
          current: orgBestDay,
          previous: "",
          delta: 0,
          delta_pct: 0,
          direction: "flat" as const,
          is_text: true,
        },
      ];

      const orgBenchmark = {
        client_rate: orgEngRate,
        benchmark_rate: 2.0,
        multiplier: orgMultiplier,
        status: orgEngRate > 2.2 ? ("above" as const) : (orgEngRate < 1.8 ? ("below" as const) : ("at" as const)),
        label: orgEngRate > 2.2
          ? `Your company page engagement is ${orgMultiplier}x the industry average!`
          : orgEngRate < 1.8
            ? `Room to grow — your company page is at ${orgEngRate}% vs 2.0% industry avg.`
            : `Your company page is right at the industry average of 2.0%.`,
      };

      return {
        highlights: highlightsList,
        contentBreakdown: buildContentBreakdown(orgPosts),
        heatmap: orgHeatmap,
        bestDay: orgBestDay,
        topPost: orgTopPost,
        benchmark: orgBenchmark,
      };
    }

    // Combined default
    return {
      highlights: data.highlights,
      contentBreakdown: data.content_breakdown,
      heatmap: data.heatmap,
      bestDay: data.best_day,
      topPost: data.top_post,
      benchmark: data.benchmark,
    };
  }, [data, viewContext]);

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

        <div className="flex flex-wrap items-center gap-3">
          {/* View Context Switcher */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-border/30 shadow-sm">
            {(
              [
                { id: "combined", label: "Overview", Icon: Cpu },
                { id: "personal", label: "Profile", Icon: User },
                ...(data.org_urn ? [{ id: "org", label: "Page", Icon: Building2 }] : []),
              ] as { id: "combined" | "personal" | "org"; label: string; Icon: any }[]
            ).map((ctx) => {
              const isActive = viewContext === ctx.id;
              return (
                <button
                  key={ctx.id}
                  onClick={() => setViewContext(ctx.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                    isActive
                      ? "bg-foreground text-background shadow-md transform scale-[1.02]"
                      : "text-muted-foreground/60 hover:bg-muted/50"
                  )}
                >
                  <ctx.Icon className="w-3.5 h-3.5" />
                  <span>{ctx.label}</span>
                </button>
              );
            })}
          </div>

          <TimePeriodSelector value={period} onChange={handlePeriodChange} />

          {/* Last Updated Indicator */}
          {lastUpdated && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/10">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                Updated {formatTimeAgo(lastUpdated)}
              </span>
            </div>
          )}

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

      {/* ── Data status / scope diagnostics ───────────────────── */}
      {data.data_status?.notes && data.data_status.notes.length > 0 && (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">
              Analytics partially unavailable
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {data.data_status.notes.map((note, i) => (
                <li key={i} className="text-xs text-amber-700/80 leading-relaxed">{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Section 1: Growth Highlights ──────────────────────── */}
      <GrowthHighlightCards highlights={computedData?.highlights || []} />

      {/* ── Tabbed Content ────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-white rounded-2xl p-1.5 shadow-sm border border-border/20 h-auto">
          {(viewContext === "combined" || viewContext === "personal") && (
            <TabsTrigger
              value="individual"
              className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              <User className="w-3.5 h-3.5 mr-2" />
              Individual
            </TabsTrigger>
          )}
          {data.org_urn && (viewContext === "combined" || viewContext === "org") && (
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
          <TabsTrigger
            value="comments"
            className="rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <MessageSquareReply className="w-3.5 h-3.5 mr-2" />
            Comments
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Individual ──────────────────────────────────── */}
        {(viewContext === "combined" || viewContext === "personal") && (
          <TabsContent value="individual" className="space-y-8">
            <PostPerformanceTable
              posts={data.individual?.posts || []}
              avgEngagementRate={avgEngRate}
            />

            {computedData?.heatmap && computedData.heatmap.length > 0 && (
              <BestTimeHeatmap data={computedData.heatmap} bestDay={computedData.bestDay} />
            )}
          </TabsContent>
        )}

        {/* ── Tab: Organization ─────────────────────────────────── */}
        {data.org_urn && (viewContext === "combined" || viewContext === "org") && (
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
            {computedData?.benchmark && <EngagementBenchmark data={computedData.benchmark} />}

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
          <ContentTypeBreakdownChart data={computedData?.contentBreakdown || []} />

          {computedData?.heatmap && computedData.heatmap.length > 0 && (
            <BestTimeHeatmap data={computedData.heatmap} bestDay={computedData.bestDay} />
          )}

          {/* Top Post Highlight */}
          {computedData?.topPost && (
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
                    "{computedData.topPost.text_snippet}"
                  </p>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="font-black">
                      {(computedData.topPost.impressions || 0).toLocaleString()} impressions
                    </span>
                    <span className="font-black text-emerald-500">
                      {computedData.topPost.engagement_rate}% engagement
                    </span>
                    <span className="font-bold text-muted-foreground/50">
                      {computedData.topPost.posted_at
                        ? new Date(computedData.topPost.posted_at).toLocaleDateString()
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

        {/* ── Tab: Comments (Auto-Reply System) ───────────────── */}
        <TabsContent value="comments" className="space-y-8">
          {/* Sub-navigation for Comments */}
          <div className="flex items-center gap-2 p-1 bg-muted/20 rounded-2xl w-fit">
            {(
              [
                { key: "queue" as const, label: "Review Queue", Icon: MessageSquareReply },
                { key: "analytics" as const, label: "Analytics", Icon: BarChart3 },
                { key: "settings" as const, label: "Settings", Icon: Cpu },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCommentSubTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  commentSubTab === tab.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground/50 hover:text-foreground/70"
                )}
              >
                <tab.Icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {commentSubTab === "queue" && (
            <ReviewQueue brandId={data.brand_id} />
          )}
          {commentSubTab === "analytics" && (
            <CommentAnalytics brandId={data.brand_id} />
          )}
          {commentSubTab === "settings" && (
            <AutoReplySettings brandId={data.brand_id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LinkedInDashboard;
