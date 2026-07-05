import { motion } from "framer-motion";
import ninna from "@/assets/team/ninna.jpg";
import robert from "@/assets/team/robert.jpg";
import eva from "@/assets/team/eva.jpg";
import max from "@/assets/team/max.jpg";

const members = [
  { name: "Ninna", role: "CMO", img: ninna, ring: "ring-violet-400" },
  { name: "Robert", role: "Content", img: robert, ring: "ring-blue-400" },
  { name: "Eva", role: "Analyst", img: eva, ring: "ring-emerald-400" },
  { name: "Max", role: "Outreach", img: max, ring: "ring-violet-400" },
];

export default function HeroTeamAvatars() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="mt-8 flex items-center justify-center gap-6 sm:gap-10 flex-wrap"
    >
      {members.map((m, i) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, y: 14, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 0.4 + i * 0.12,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center"
        >
          <div className="relative">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-white ${m.ring} shadow-lg`}
            >
              <img src={m.img} alt={m.name} className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-800">{m.name}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.role}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
