import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Period } from "@/services/linkedinAnalyticsAPI";

interface TimePeriodSelectorProps {
  value: Period;
  onChange: (period: Period, customStart?: string, customEnd?: string) => void;
}

const periods: { label: string; value: Period }[] = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

const TimePeriodSelector = ({ value, onChange }: TimePeriodSelectorProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-border/30">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setShowCustom(false);
              onChange(p.value);
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
              value === p.value
                ? "bg-foreground text-background shadow-lg"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
            value === "custom"
              ? "bg-foreground text-background shadow-lg"
              : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          <Calendar className="w-3 h-3" />
          Custom
          <ChevronDown className={cn("w-3 h-3 transition-transform", showCustom && "rotate-180")} />
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border/40 text-xs font-bold bg-white focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <span className="text-xs font-bold text-muted-foreground">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border/40 text-xs font-bold bg-white focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <Button
            size="sm"
            onClick={() => {
              if (customStart && customEnd) {
                onChange("custom", customStart, customEnd);
              }
            }}
            disabled={!customStart || !customEnd}
            className="h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
};

export default TimePeriodSelector;
