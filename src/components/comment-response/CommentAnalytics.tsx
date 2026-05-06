import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  MessageSquare, Send, Clock, Target, AlertTriangle,
  BarChart3, Users, CheckCircle2, XCircle, type LucideIcon,
} from "lucide-react";
import {
  commentResponseAPI,
  type CommentAnalyticsDTO,
  type IntentClass,
} from "@/services/commentResponseAPI";

interface CommentAnalyticsProps {
  brandId: string;
}

const INTENT_COLORS: Record<string, string> = {
  HIGH_INTENT_LEAD: "#10b981",
  QUESTION: "#3b82f6",
  POSITIVE_SENTIMENT: "#8b5cf6",
  NEGATIVE_SENTIMENT: "#ef4444",
  SPAM: "#9ca3af",
  COMPETITOR_MENTION: "#f59e0b",
  REFERRAL: "#06b6d4",
  IGNORE: "#d1d5db",
};

const STAT_CARDS: { key: string; label: string; Icon: LucideIcon; color: string }[] = [
  { key: "total_comments", label: "Total Comments", Icon: MessageSquare, color: "text-blue-500 bg-blue-500/10" },
  { key: "auto_replies_sent", label: "Auto Replies", Icon: Send, color: "text-emerald-500 bg-emerald-500/10" },
  { key: "pending_review", label: "Pending Review", Icon: Clock, color: "text-amber-500 bg-amber-500/10" },
  { key: "leads_generated", label: "Leads Generated", Icon: Target, color: "text-purple-500 bg-purple-500/10" },
];

const CommentAnalytics = ({ brandId }: CommentAnalyticsProps) => {
  const [data, setData] = useState<CommentAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const analytics = await commentResponseAPI.getAnalytics(brandId);
      setData(analytics);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-8">
        <div className="text-center py-12 text-muted-foreground/30 text-sm font-bold">
          Loading analytics...
        </div>
      </Card>
    );
  }

  const pieData = data.intent_breakdown.map((item) => ({
    name: item.intent.replace(/_/g, " ").toLowerCase(),
    value: item.count,
    fill: INTENT_COLORS[item.intent] || "#9ca3af",
  }));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const value = (data as any)[stat.key] ?? 0;
          return (
            <Card key={stat.key} className="border-none bg-white rounded-[2rem] p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={cn("p-1.5 rounded-xl", stat.color)}>
                  <stat.Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                  {stat.label}
                </span>
              </div>
              <div className="text-2xl font-black tracking-tighter">{value.toLocaleString()}</div>
            </Card>
          );
        })}
      </div>

      {/* Second row: Reply Rate + Avg Response Time + Intent Pie */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Auto-Reply Rate */}
        <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">
            Auto-Reply Rate
          </p>
          <div className="text-4xl font-black tracking-tighter">
            {data.auto_reply_rate}
            <span className="text-lg font-bold text-muted-foreground ml-1">%</span>
          </div>
          <div className="mt-3 h-2 bg-muted/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(data.auto_reply_rate, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[9px] font-bold text-muted-foreground/40">
            <span>{data.auto_replies_sent} auto</span>
            <span>{data.skipped} skipped</span>
            <span>{data.failed} failed</span>
          </div>
        </Card>

        {/* Avg Response Time */}
        <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">
            Avg Response Time
          </p>
          <div className="text-4xl font-black tracking-tighter">
            {data.avg_response_time_minutes
              ? `${data.avg_response_time_minutes}`
              : "—"}
            <span className="text-lg font-bold text-muted-foreground ml-1">min</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-2 font-bold">
            {data.avg_response_time_minutes && data.avg_response_time_minutes < 15
              ? "🔥 Within LinkedIn's fast-reply boost window"
              : "Replies are being delivered on schedule"}
          </p>
        </Card>

        {/* Intent Breakdown Pie */}
        <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">
            Intent Breakdown
          </p>
          {pieData.length > 0 ? (
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground/20 text-sm font-bold">
              No data yet
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CommentAnalytics;
