import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HeatmapEntry } from "@/services/linkedinAnalyticsAPI";
import { CalendarDays } from "lucide-react";

interface BestTimeHeatmapProps {
  data: HeatmapEntry[];
  bestDay: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getIntensity = (rate: number, maxRate: number): string => {
  if (maxRate === 0) return "bg-muted/20";
  const ratio = rate / maxRate;
  if (ratio > 0.8) return "bg-emerald-500";
  if (ratio > 0.6) return "bg-emerald-400";
  if (ratio > 0.4) return "bg-emerald-300";
  if (ratio > 0.2) return "bg-emerald-200";
  if (ratio > 0) return "bg-emerald-100";
  return "bg-muted/20";
};

const BestTimeHeatmap = ({ data, bestDay }: BestTimeHeatmapProps) => {
  // Build lookup map
  const lookup = new Map<string, HeatmapEntry>();
  let maxRate = 0;

  data.forEach((entry) => {
    const key = `${entry.day_index}-${entry.hour}`;
    lookup.set(key, entry);
    if (entry.avg_engagement_rate > maxRate) {
      maxRate = entry.avg_engagement_rate;
    }
  });

  return (
    <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight uppercase">Best Time to Post.</h3>
          <p className="text-xs font-bold text-muted-foreground/40">
            Engagement intensity by day & hour
          </p>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-emerald-500/10">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Best: {bestDay}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex items-center mb-1">
            <div className="w-10" />
            {HOURS.filter((h) => h % 3 === 0).map((hour) => (
              <div
                key={hour}
                className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-wider"
                style={{ width: `${(100 / 8)}%`, textAlign: "center" }}
              >
                {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <div className="w-10 text-[9px] font-black text-muted-foreground/50 uppercase tracking-wider">
                {day}
              </div>
              <div className="flex-1 flex gap-0.5">
                {HOURS.map((hour) => {
                  const key = `${dayIdx}-${hour}`;
                  const entry = lookup.get(key);
                  const rate = entry?.avg_engagement_rate || 0;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 h-7 rounded-md transition-all duration-300 cursor-default",
                        "hover:ring-2 hover:ring-foreground/20 hover:scale-110 hover:z-10",
                        getIntensity(rate, maxRate)
                      )}
                      title={`${day} ${hour}:00 — ${rate}% avg engagement${entry ? ` (${entry.post_count} posts)` : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest">Low</span>
            <div className="flex gap-0.5">
              {["bg-muted/30", "bg-emerald-100", "bg-emerald-200", "bg-emerald-300", "bg-emerald-400", "bg-emerald-500"].map((c, i) => (
                <div key={i} className={cn("w-5 h-3 rounded-sm", c)} />
              ))}
            </div>
            <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest">High</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BestTimeHeatmap;
