import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

interface GrowthChartProps {
  data: Array<{ date: string; impressions?: number; followers?: number; reactions?: number }>;
  title?: string;
  subtitle?: string;
  dataKey?: string;
  color?: string;
}

const GrowthChart = ({
  data,
  title = "Impressions Over Time",
  subtitle = "Aggregated daily impressions",
  dataKey = "impressions",
  color = "#3b82f6",
}: GrowthChartProps) => {
  return (
    <Card className="border-none bg-white rounded-[2.5rem] p-8 space-y-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight uppercase">{title}</h3>
          <p className="text-xs font-bold text-muted-foreground/40">{subtitle}</p>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center">
          <TrendingUp className="w-4 h-4" style={{ color }} />
        </div>
      </div>

      <div className="h-[260px]">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                fontSize={10}
                fontWeight="bold"
                tickFormatter={(str) => {
                  const d = new Date(str);
                  return d.toLocaleDateString([], { day: "numeric", month: "short" });
                }}
                axisLine={false}
                tickLine={false}
                dy={12}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "none",
                  borderRadius: "20px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                  padding: "12px 16px",
                }}
                labelStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase" as const }}
                itemStyle={{ fontSize: "13px", fontWeight: "900" }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#grad-${dataKey})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground/30 text-sm font-bold">
            No data available for this period
          </div>
        )}
      </div>
    </Card>
  );
};

export default GrowthChart;
