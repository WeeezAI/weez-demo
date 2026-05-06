import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContentBreakdown } from "@/services/linkedinAnalyticsAPI";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  FileText, Image, Video, Newspaper, BarChart3, File, type LucideIcon,
} from "lucide-react";

interface ContentTypeBreakdownProps {
  data: ContentBreakdown[];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

const contentTypeIcons: Record<string, LucideIcon> = {
  text: FileText,
  image: Image,
  video: Video,
  article: Newspaper,
  poll: BarChart3,
  document: File,
};

const ContentTypeBreakdownChart = ({ data }: ContentTypeBreakdownProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
        <div className="text-center py-12 text-muted-foreground/30 text-sm font-bold">
          No content type data available
        </div>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.content_type,
    value: d.count,
    engagement: d.avg_engagement_rate,
  }));

  return (
    <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
      <div className="space-y-1 mb-6">
        <h3 className="text-lg font-black tracking-tight uppercase">Content Mix.</h3>
        <p className="text-xs font-bold text-muted-foreground/40">Performance by content type</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "none",
                  borderRadius: "16px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                }}
                itemStyle={{ fontSize: "12px", fontWeight: "800" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown list */}
        <div className="space-y-3">
          {data.map((item, idx) => {
            const IconComp = contentTypeIcons[item.content_type] || FileText;
            return (
              <div
                key={item.content_type}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <IconComp className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-sm font-bold capitalize">
                    {item.content_type}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground/40">
                    {item.count} posts
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "text-sm font-black",
                      item.avg_engagement_rate > 2 ? "text-emerald-500" : "text-foreground/70"
                    )}
                  >
                    {item.avg_engagement_rate}%
                  </span>
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/30">
                    Avg Eng
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default ContentTypeBreakdownChart;
