import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HighlightCard } from "@/services/linkedinAnalyticsAPI";
import {
  TrendingUp, TrendingDown, Minus,
  Link2, Users, Eye, MessageSquare, Heart, Repeat2,
  Target, BarChart3, Trophy, BrainCircuit, CalendarDays, type LucideIcon,
} from "lucide-react";

// Map backend icon name strings to lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Link2, Users, Eye, TrendingUp, MessageSquare, Heart,
  Repeat2, Target, BarChart3, Trophy, BrainCircuit, CalendarDays,
};

// Subtle color associations per metric
const ICON_COLORS: Record<string, string> = {
  Link2: "text-blue-500 bg-blue-500/10",
  Users: "text-violet-500 bg-violet-500/10",
  Eye: "text-cyan-500 bg-cyan-500/10",
  TrendingUp: "text-emerald-500 bg-emerald-500/10",
  MessageSquare: "text-sky-500 bg-sky-500/10",
  Heart: "text-rose-500 bg-rose-500/10",
  Repeat2: "text-green-500 bg-green-500/10",
  Target: "text-orange-500 bg-orange-500/10",
  BarChart3: "text-indigo-500 bg-indigo-500/10",
  Trophy: "text-amber-500 bg-amber-500/10",
  BrainCircuit: "text-purple-500 bg-purple-500/10",
  CalendarDays: "text-teal-500 bg-teal-500/10",
};

interface GrowthHighlightCardsProps {
  highlights: HighlightCard[];
}

const formatValue = (card: HighlightCard): string => {
  if (card.is_text) return String(card.current);
  if (typeof card.current === "number") {
    if (card.current >= 1000) return card.current.toLocaleString();
    return String(card.current);
  }
  return String(card.current);
};

const GrowthHighlightCards = ({ highlights }: GrowthHighlightCardsProps) => {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {highlights.map((card, idx) => {
        const isPositive = card.direction === "up";
        const isNegative = card.direction === "down";
        const IconComponent = ICON_MAP[card.icon] || BarChart3;
        const colorClass = ICON_COLORS[card.icon] || "text-muted-foreground bg-muted";

        return (
          <Card
            key={card.metric_key || idx}
            className={cn(
              "group border-none bg-white hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)]",
              "rounded-[2rem] transition-all duration-700 overflow-hidden p-6",
              "animate-in fade-in slide-in-from-bottom-4",
            )}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex flex-col h-full gap-4">
              {/* Icon + Label */}
              <div className="flex items-center gap-2.5">
                <div className={cn("p-1.5 rounded-xl", colorClass)}>
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-tight">
                  {card.label}
                </span>
              </div>

              {/* Value */}
              <div className="text-2xl font-black tracking-tighter">
                {!card.is_text && card.direction !== "flat" && typeof card.current === "number" && (
                  <span className={cn(
                    "text-sm mr-0.5",
                    isPositive ? "text-emerald-500" : "text-red-500"
                  )}>
                    {isPositive ? "+" : ""}
                  </span>
                )}
                {formatValue(card)}
                {card.suffix && (
                  <span className="text-sm font-bold text-muted-foreground ml-0.5">
                    {card.suffix}
                  </span>
                )}
              </div>

              {/* Delta */}
              {!card.is_text && (
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1",
                      isPositive && "bg-emerald-500/10 text-emerald-500",
                      isNegative && "bg-red-500/10 text-red-500",
                      !isPositive && !isNegative && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPositive && <TrendingUp className="w-2.5 h-2.5" />}
                    {isNegative && <TrendingDown className="w-2.5 h-2.5" />}
                    {!isPositive && !isNegative && <Minus className="w-2.5 h-2.5" />}
                    {card.delta_pct !== 0 ? `${card.delta_pct > 0 ? "+" : ""}${card.delta_pct}%` : "—"}
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default GrowthHighlightCards;
