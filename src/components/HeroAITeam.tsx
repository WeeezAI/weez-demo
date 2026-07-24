import { motion } from "framer-motion";
import { Sparkles, BarChart3, Rocket } from "lucide-react";
import ninna from "@/assets/team/ninna.jpg";
import eva from "@/assets/team/eva.jpg";
import max from "@/assets/team/max.jpg";

type Member = {
  name: string;
  role: string;
  desc: string;
  tags: string;
  img: string;
  Icon: React.ComponentType<{ className?: string }>;
  roleClass: string;
  nameClass: string;
  accent: string;
};

const team: Member[] = [
  {
    name: "Ninna",
    role: "GTM Strategist",
    desc: "Talks to the founder, makes decisions and drives the entire go-to-market strategy forward.",
    tags: "Strategy. Decisions. Revenue.",
    img: ninna,
    Icon: Sparkles,
    roleClass: "bg-violet-600/90 text-white",
    nameClass: "text-violet-300",
    accent: "text-violet-300",
  },
  {
    name: "Eva",
    role: "Market Intelligence",
    desc: "Tracks live buying signals across the market and surfaces high-intent, high-fit accounts.",
    tags: "Signals. Research. Intent.",
    img: eva,
    Icon: BarChart3,
    roleClass: "bg-emerald-600/90 text-white",
    nameClass: "text-emerald-300",
    accent: "text-emerald-300",
  },
  {
    name: "Max",
    role: "Sales Execution",
    desc: "Runs warm outreach, qualifies high-intent accounts and books meaningful meetings.",
    tags: "Outreach. Conversations. Pipeline.",
    img: max,
    Icon: Rocket,
    roleClass: "bg-amber-600/90 text-white",
    nameClass: "text-amber-300",
    accent: "text-amber-300",
  },
];

export default function HeroAITeam() {
  return (
    <div className="mt-14 relative">
      {/* soft glow */}
      <div className="absolute -inset-6 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent blur-2xl pointer-events-none" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 relative">
        {team.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 40, rotateX: -12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{
              delay: 0.25 + i * 0.18,
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group relative rounded-2xl overflow-hidden bg-[#0B1220] shadow-[0_20px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/10"
            style={{ perspective: 1000 }}
          >
            {/* Portrait */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <motion.img
                src={m.img}
                alt={m.name}
                className="w-full h-full object-cover"
                initial={{ scale: 1.15, filter: "blur(12px)" }}
                animate={{ scale: 1, filter: "blur(0px)" }}
                transition={{
                  delay: 0.35 + i * 0.18,
                  duration: 1.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />

              {/* Scanning line intro */}
              <motion.div
                initial={{ y: "-100%", opacity: 0.9 }}
                animate={{ y: "120%", opacity: 0 }}
                transition={{
                  delay: 0.5 + i * 0.18,
                  duration: 1.4,
                  ease: "easeInOut",
                }}
                className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-blue-400/40 to-transparent pointer-events-none"
              />

              {/* Live badge */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.18, duration: 0.5 }}
                className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/45 backdrop-blur-sm text-[10px] font-medium text-white"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                AI Agent · Online
              </motion.div>

              {/* Gradient overlay to blend into card */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B1220] to-transparent" />
            </div>

            {/* Info panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.18, duration: 0.6 }}
              className="p-4 md:p-5 -mt-6 relative"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3
                  className={`font-agrandir font-bold text-2xl md:text-3xl ${m.nameClass}`}
                >
                  {m.name}
                </h3>
                <span
                  className={`text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full ${m.roleClass}`}
                >
                  {m.role}
                </span>
              </div>
              <p className="mt-3 text-[13px] md:text-sm text-slate-300 leading-relaxed">
                {m.desc}
              </p>
              <div
                className={`mt-4 flex items-center gap-2 text-xs font-medium ${m.accent}`}
              >
                <m.Icon className="w-3.5 h-3.5" />
                <span>{m.tags}</span>
              </div>
            </motion.div>

            {/* Hover shine */}
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.08)_50%,transparent_70%)]" />
          </motion.div>
        ))}
      </div>

      {/* Connecting pulse line */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.6, duration: 1, ease: "easeOut" }}
        className="hidden md:block mt-8 h-px origin-left bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
      />
    </div>
  );
}
