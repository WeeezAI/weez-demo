import { motion } from "framer-motion";
import {
  PenSquare,
  BarChart3,
  Rocket,
  Sparkles,
  Mail,
  Calendar,
  Target,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
} from "lucide-react";

type Task = {
  agent: "Ninna" | "Robert" | "Eva" | "Max";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  ring: string;
  dot: string;
};

const tasks: Task[] = [
  { agent: "Robert", icon: PenSquare, title: "Drafted LinkedIn post · 248 reactions", color: "text-blue-600", ring: "ring-blue-100", dot: "bg-blue-500" },
  { agent: "Max", icon: Mail, title: "Sent 42 hyperpersonalized emails", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
  { agent: "Eva", icon: BarChart3, title: "Reply rate up 3.2× this week", color: "text-emerald-600", ring: "ring-emerald-100", dot: "bg-emerald-500" },
  { agent: "Ninna", icon: Sparkles, title: "Approved Q3 growth strategy", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
  { agent: "Max", icon: Calendar, title: "Booked 6 qualified meetings", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
  { agent: "Eva", icon: Target, title: "Identified 128 ICP-fit leads", color: "text-emerald-600", ring: "ring-emerald-100", dot: "bg-emerald-500" },
  { agent: "Robert", icon: MessageSquare, title: "Replied to 34 comments", color: "text-blue-600", ring: "ring-blue-100", dot: "bg-blue-500" },
  { agent: "Ninna", icon: TrendingUp, title: "Weekly pipeline review complete", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
  { agent: "Max", icon: Users, title: "Enriched leads via Apollo + Clay", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
  { agent: "Robert", icon: Zap, title: "Generated 12 ad creatives", color: "text-blue-600", ring: "ring-blue-100", dot: "bg-blue-500" },
  { agent: "Eva", icon: CheckCircle2, title: "CTR benchmark: top 5% in SaaS", color: "text-emerald-600", ring: "ring-emerald-100", dot: "bg-emerald-500" },
  { agent: "Ninna", icon: Sparkles, title: "Voice interview synced to context", color: "text-violet-600", ring: "ring-violet-100", dot: "bg-violet-500" },
];

// Fixed positions so the cards float around, not behind text
const positions = [
  { top: "6%", left: "3%" },
  { top: "14%", right: "4%" },
  { top: "32%", left: "1%" },
  { top: "40%", right: "2%" },
  { top: "58%", left: "4%" },
  { top: "62%", right: "5%" },
  { top: "78%", left: "8%" },
  { top: "82%", right: "9%" },
  { top: "22%", left: "10%" },
  { top: "48%", right: "12%" },
  { top: "70%", left: "14%" },
  { top: "30%", right: "14%" },
];

export function HeroTaskStream() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {tasks.map((t, i) => {
        const pos = positions[i % positions.length];
        const Icon = t.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{
              opacity: [0, 0.85, 0.85, 0],
              y: [20, 0, -10, -30],
              scale: [0.9, 1, 1, 0.95],
            }}
            transition={{
              duration: 7,
              delay: (i * 0.9) % 8,
              repeat: Infinity,
              repeatDelay: 4,
              ease: "easeInOut",
            }}
            style={pos}
            className="absolute hidden md:block"
          >
            <div
              className={`flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-xl bg-white/85 backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)] ring-1 ${t.ring} max-w-[260px]`}
              style={{ filter: "blur(0.3px)" }}
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg bg-white ring-1 ${t.ring} grid place-items-center`}>
                <Icon className={`w-3.5 h-3.5 ${t.color}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase">
                    {t.agent}
                  </span>
                </div>
                <div className="text-[12px] font-medium text-slate-800 truncate">
                  {t.title}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default HeroTaskStream;
