import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HighlightCard } from "@/services/linkedinAnalyticsAPI";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
              <div className="flex items-center gap-2">
                <span className="text-xl">{card.icon}</span>
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
