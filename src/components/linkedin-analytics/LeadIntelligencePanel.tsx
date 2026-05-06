import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Sparkles,
  Target,
  Star,
  Phone,
  Tent,
  Trophy,
  BrainCircuit,
  BarChart3,
  type LucideIcon
} from "lucide-react";
import type { ValueInsight } from "@/services/linkedinAnalyticsAPI";
import { cn } from "@/lib/utils";

interface LeadIntelligencePanelProps {
  insights: ValueInsight[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  Target,
  Star,
  Phone,
  Tent,
  Trophy,
  BrainCircuit,
  BarChart3,
};

const LeadIntelligencePanel = ({ insights }: LeadIntelligencePanelProps) => {
  return (
    <div className="space-y-6">
      {/* Coming Soon Header */}
      <Card className="border-none bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight uppercase text-white">
                Lead Intelligence
              </h3>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px] font-black uppercase tracking-widest">
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs font-bold text-white/40">
              CRM integration will unlock lead attribution & pipeline tracking
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur">
            <Lock className="w-5 h-5 text-white/30" />
          </div>
        </div>

        {/* Preview metrics (grayed out) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-40">
          {[
            { label: "Total Leads", value: "—", Icon: Target },
            { label: "Lead Quality", value: "—", Icon: Star },
            { label: "Avg Days to Call", value: "—", Icon: Phone },
            { label: "ICP Match Rate", value: "—", Icon: Tent },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-2xl bg-white/5 backdrop-blur">
              <div className="p-1.5 rounded-lg bg-white/10 w-fit">
                <item.Icon className="w-4 h-4 text-white/60" />
              </div>
              <div className="text-xl font-black text-white mt-2">{item.value}</div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Value Addition Insights (always available) */}
      {insights && insights.length > 0 && (
        <Card className="border-none bg-gradient-to-br from-blue-50 to-purple-50 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <h4 className="text-sm font-black uppercase tracking-wider text-purple-700">
              Value Highlights
            </h4>
          </div>

          <div className="space-y-4">
            {insights.map((insight, idx) => {
              const IconComp = ICON_MAP[insight.icon] || Sparkles;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-4 bg-white/60 rounded-2xl backdrop-blur"
                >
                  <div className="p-2 rounded-xl bg-white text-purple-500 shadow-sm">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground/80">{insight.text}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default LeadIntelligencePanel;
