import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DemographicsBreakdownProps {
  demographics: Record<string, Record<string, number>>;
  decisionMakerPct: number;
}

const dimensionLabels: Record<string, string> = {
  bySeniority: "By Seniority",
  byIndustry: "By Industry",
  byFunction: "By Department",
  byCompanySize: "By Company Size",
  byGeo: "By Geography",
};

const dimensionEmojis: Record<string, string> = {
  bySeniority: "👔",
  byIndustry: "🏢",
  byFunction: "⚙️",
  byCompanySize: "📏",
  byGeo: "🌍",
};

const DEMO_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

const DemographicsBreakdown = ({ demographics, decisionMakerPct }: DemographicsBreakdownProps) => {
  if (!demographics || Object.keys(demographics).length === 0) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-8 shadow-sm">
        <div className="text-center py-12 text-muted-foreground/30 text-sm font-bold">
          No demographic data available
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ICP Highlight */}
      {decisionMakerPct > 0 && (
        <Card className="border-none bg-gradient-to-br from-purple-50 to-blue-50 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🧠</div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-500/60">
                ICP Validation
              </p>
              <p className="text-2xl font-black tracking-tighter">
                {decisionMakerPct}% <span className="text-sm font-bold text-muted-foreground">Decision Makers</span>
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                C-Suite, Directors, VPs & Owners in your follower base
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Dimension breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(demographics).map(([dimension, data]) => {
          if (!data || Object.keys(data).length === 0) return null;

          const total = Object.values(data).reduce((a, b) => a + b, 0);
          const sorted = Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8); // Top 8

          return (
            <Card key={dimension} className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">{dimensionEmojis[dimension] || "📊"}</span>
                <h4 className="text-sm font-black uppercase tracking-wider">
                  {dimensionLabels[dimension] || dimension}
                </h4>
              </div>

              <div className="space-y-3">
                {sorted.map(([label, count], idx) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground/70 capitalize truncate max-w-[160px]">
                          {label}
                        </span>
                        <span className="text-xs font-black text-muted-foreground/50">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: DEMO_COLORS[idx % DEMO_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DemographicsBreakdown;
