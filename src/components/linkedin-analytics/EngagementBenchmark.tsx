import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BenchmarkData } from "@/services/linkedinAnalyticsAPI";

interface EngagementBenchmarkProps {
  data: BenchmarkData;
}

const EngagementBenchmark = ({ data }: EngagementBenchmarkProps) => {
  // Calculate gauge angle (0-180 degrees)
  // Scale: 0% = 0°, 4% = 180° (2x industry avg)
  const maxRate = data.benchmark_rate * 2;
  const angle = Math.min((data.client_rate / maxRate) * 180, 180);
  const benchmarkAngle = (data.benchmark_rate / maxRate) * 180;

  return (
    <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
      <div className="space-y-1 mb-6">
        <h3 className="text-lg font-black tracking-tight uppercase">Engagement Benchmark.</h3>
        <p className="text-xs font-bold text-muted-foreground/40">
          Your engagement vs B2B LinkedIn average
        </p>
      </div>

      <div className="flex flex-col items-center py-4">
        {/* Gauge */}
        <div className="relative w-56 h-28 overflow-hidden">
          {/* Background arc */}
          <div
            className="absolute inset-0 rounded-t-full"
            style={{
              background: `conic-gradient(
                from 180deg,
                #e5e7eb 0deg,
                #e5e7eb 180deg
              )`,
            }}
          />
          {/* Colored arc */}
          <div
            className="absolute inset-0 rounded-t-full"
            style={{
              background: `conic-gradient(
                from 180deg,
                ${data.status === "above" ? "#10b981" : data.status === "below" ? "#ef4444" : "#f59e0b"} 0deg,
                ${data.status === "above" ? "#10b981" : data.status === "below" ? "#ef4444" : "#f59e0b"} ${angle}deg,
                transparent ${angle}deg
              )`,
            }}
          />
          {/* Inner circle (donut hole) */}
          <div className="absolute inset-3 bg-white rounded-t-full flex items-end justify-center pb-2">
            <div className="text-center">
              <div className="text-3xl font-black tracking-tighter">
                {data.client_rate.toFixed(1)}%
              </div>
            </div>
          </div>
          {/* Benchmark marker */}
          <div
            className="absolute bottom-0 left-1/2 w-0.5 h-full bg-foreground/30 origin-bottom"
            style={{
              transform: `rotate(${benchmarkAngle - 90}deg)`,
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-8 mt-6">
          <div className="text-center">
            <div className="text-lg font-black">{data.client_rate.toFixed(1)}%</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
              Your Rate
            </div>
          </div>
          <div className="h-8 w-px bg-border/30" />
          <div className="text-center">
            <div className="text-lg font-black text-muted-foreground/50">
              {data.benchmark_rate}%
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
              B2B Avg
            </div>
          </div>
          <div className="h-8 w-px bg-border/30" />
          <div className="text-center">
            <div
              className={cn(
                "text-lg font-black",
                data.status === "above" ? "text-emerald-500" : data.status === "below" ? "text-red-500" : "text-amber-500"
              )}
            >
              {data.multiplier}x
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
              Multiplier
            </div>
          </div>
        </div>

        {/* Status message */}
        <div
          className={cn(
            "mt-4 px-5 py-2.5 rounded-2xl text-xs font-bold text-center max-w-sm",
            data.status === "above" && "bg-emerald-50 text-emerald-600",
            data.status === "below" && "bg-red-50 text-red-600",
            data.status === "at" && "bg-amber-50 text-amber-600"
          )}
        >
          {data.label}
        </div>
      </div>
    </Card>
  );
};

export default EngagementBenchmark;
