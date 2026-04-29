import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
    Zap,
    TrendingUp,
    ShieldCheck,
    History,
    Play,
    Pause,
    Target,
    Loader2,
    CheckCircle2,
    Activity,
    Trash2,
    Sparkles,
    RefreshCw,
} from "lucide-react";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ConversationSidebar from "@/components/ConversationSidebar";
import { weezAPI } from "@/services/weezAPI";

type AutopilotDashboardData = any;

/* ---------- Animated Counter ---------- */
const AnimatedNumber = ({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) => {
    const mv = useMotionValue(0);
    const spring = useSpring(mv, { duration: 1400, bounce: 0 });
    const display = useTransform(spring, (v) => `${v.toFixed(decimals)}${suffix}`);
    useEffect(() => {
        mv.set(value);
    }, [value, mv]);
    return <motion.span>{display}</motion.span>;
};

/* ---------- Ambient Aurora Background ---------- */
const AuroraBG = () => (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <motion.div
            className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[120px] opacity-40"
            style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
            animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
            className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full blur-[120px] opacity-30"
            style={{ background: "radial-gradient(circle, hsl(230 80% 40%) 0%, transparent 70%)" }}
            animate={{ x: [0, -60, 0], y: [0, 60, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
            className="absolute bottom-0 left-1/3 h-[450px] w-[450px] rounded-full blur-[120px] opacity-25"
            style={{ background: "radial-gradient(circle, hsl(180 70% 50%) 0%, transparent 70%)" }}
            animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_80%)]" />
        <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
                backgroundImage:
                    "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
            }}
        />
    </div>
);

/* ---------- Glass Card wrapper ---------- */
const Glass = ({ className, children, ...rest }: any) => (
    <motion.div
        className={cn(
            "relative rounded-[2rem] border border-white/40 dark:border-white/10",
            "bg-white/55 dark:bg-white/5 backdrop-blur-2xl",
            "shadow-[0_8px_40px_-12px_rgba(15,23,42,0.18)]",
            "before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/60 before:to-transparent before:opacity-60 before:pointer-events-none",
            "overflow-hidden",
            className
        )}
        {...rest}
    >
        <div className="relative z-10">{children}</div>
    </motion.div>
);

const fadeUp: any = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as any },
    }),
};

export default function AutopilotDashboard() {
    const { spaceId } = useParams<{ spaceId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<AutopilotDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (spaceId) loadDashboard();
    }, [spaceId]);

    const loadDashboard = async () => {
        try {
            setIsLoading(true);
            const res = await weezAPI.getAutopilotDashboard(spaceId!);
            setData(res);
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("No active campaign")) {
                navigate(`/workspace/${spaceId}`);
            } else {
                toast.error(err.message || "Failed to load dashboard");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCampaign = async () => {
        if (!data?.campaign || !window.confirm("Are you sure you want to delete this campaign? This will permanently remove all associated posters, metrics, and logs.")) return;
        try {
            setIsDeleting(true);
            await weezAPI.deleteCampaign(data.campaign.id);
            toast.success("Campaign deleted successfully");
            navigate(`/workspace/${spaceId}`);
        } catch (err: any) {
            toast.error(err.message || "Delete failed");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!data?.campaign) return;
        try {
            setIsToggling(true);
            const newStatus = data.campaign.status === "active" ? "paused" : "active";
            await (weezAPI as any).toggleAutopilotStatus?.(data.campaign.id, newStatus);
            toast.success(`Campaign ${newStatus === "active" ? "resumed" : "paused"}`);
            loadDashboard();
        } catch (err: any) {
            toast.error(err.message || "Action failed");
        } finally {
            setIsToggling(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background relative">
                <AuroraBG />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex flex-col items-center gap-4"
                >
                    <div className="relative">
                        <motion.div
                            className="absolute inset-0 rounded-full bg-accent/30 blur-2xl"
                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">
                        Calibrating Engine
                    </p>
                </motion.div>
            </div>
        );
    }

    if (!data && !isLoading) {
        return (
            <div className="flex h-screen overflow-hidden bg-background relative">
                <AuroraBG />
                <ConversationSidebar spaceId={spaceId!} onNewChat={() => { }} />
                <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
                    <Zap className="h-16 w-16 text-muted-foreground/20 mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Autopilot Mode Inactive</h2>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                        The Autonomous Engagement Engine is ready to scale your brand. Start your first campaign to begin optimization.
                    </p>
                    <Button onClick={() => toast.info("Campaign creation coming soon!")}>Setup Autopilot</Button>
                </main>
            </div>
        );
    }

    const chartData =
        data?.projections.map((p) => {
            const metric = data.metrics.find((m) => m.date === p.date);
            return {
                date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                projected: p.projected_engagement_rate * 100,
                actual: metric ? metric.engagement_rate * 100 : null,
            };
        }) || [];

    const velocity = (data?.metrics.length ? data.metrics[0].engagement_rate : 0) * 100;
    const confidence = (data?.confidence_score || 0) * 100;
    const target = (data?.campaign.target_value || 0) * 100;
    const isActive = data?.campaign.status === "active";

    return (
        <div className="flex h-screen overflow-hidden bg-background relative">
            <AuroraBG />
            <ConversationSidebar spaceId={spaceId!} onNewChat={() => { }} />

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 relative z-10">
                {/* ============ HEADER ============ */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200/60 backdrop-blur-xl shadow-sm"
                            >
                                <motion.div
                                    animate={{ rotate: [0, 15, -15, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                                </motion.div>
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                                    Autopilot Mode
                                </span>
                            </motion.div>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "capitalize backdrop-blur-xl border",
                                    isActive
                                        ? "bg-emerald-50/70 text-emerald-700 border-emerald-200/50"
                                        : "bg-zinc-100/70 text-zinc-600 border-zinc-200/50"
                                )}
                            >
                                <motion.span
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full mr-1.5",
                                        isActive ? "bg-emerald-500" : "bg-zinc-400"
                                    )}
                                    animate={isActive ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                                {data?.campaign.status}
                            </Badge>
                        </div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.8 }}
                            className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent"
                        >
                            Engagement Engine
                        </motion.h1>
                        <p className="text-muted-foreground mt-2 font-medium">
                            Autonomous growth loop for{" "}
                            <span className="text-foreground font-bold">{data?.campaign.brand_id}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="rounded-2xl backdrop-blur-xl bg-white/50 border-white/60 hover:bg-white/80 shadow-sm gap-2"
                            onClick={loadDashboard}
                        >
                            <RefreshCw className="w-4 h-4" /> Sync
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-2xl backdrop-blur-xl bg-white/50 border-red-200/60 text-red-600 hover:bg-red-50/80 hover:text-red-700"
                            onClick={handleDeleteCampaign}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                                onClick={handleToggleStatus}
                                disabled={isToggling}
                                className={cn(
                                    "rounded-2xl px-6 min-w-[150px] h-11 relative overflow-hidden border-0 shadow-xl",
                                    isActive
                                        ? "bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-zinc-900/30"
                                        : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/40"
                                )}
                            >
                                <motion.span
                                    className="absolute inset-0 bg-white/10"
                                    animate={{ x: ["-100%", "200%"] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                />
                                <span className="relative flex items-center">
                                    {isToggling ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : isActive ? (
                                        <>
                                            <Pause className="w-4 h-4 mr-2" /> Pause Engine
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2" /> Resume Engine
                                        </>
                                    )}
                                </span>
                            </Button>
                        </motion.div>
                    </div>
                </motion.div>

                {/* ============ DAILY SPOTLIGHT ============ */}
                <AnimatePresence>
                    {data?.spotlight_post && (
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            custom={1}
                        >
                            <Glass className="group">
                                <div className="flex flex-col lg:flex-row">
                                    {/* Visual */}
                                    <div className="lg:w-1/3 h-[300px] lg:h-auto relative overflow-hidden">
                                        {data.spotlight_post.blob_url ? (
                                            <>
                                                <motion.img
                                                    src={data.spotlight_post.blob_url}
                                                    alt="Scheduled Poster"
                                                    className="w-full h-full object-cover"
                                                    initial={{ scale: 1.1 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ duration: 1.2 }}
                                                    whileHover={{ scale: 1.08 }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent" />
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-4 bg-zinc-50/40">
                                                <div className="relative">
                                                    <motion.div
                                                        className="absolute inset-0 bg-accent/40 blur-2xl rounded-full"
                                                        animate={{ scale: [1, 1.4, 1] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                    />
                                                    <div className="relative w-12 h-12 rounded-full border-4 border-zinc-200 border-t-zinc-800 animate-spin" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 animate-pulse">
                                                    Scanning Visuals
                                                </p>
                                            </div>
                                        )}
                                        <div className="absolute top-6 left-6">
                                            <Badge className="bg-white/90 backdrop-blur-xl text-zinc-900 border-none shadow-xl px-4 py-1.5 font-bold tracking-tighter capitalize rounded-full">
                                                {data.spotlight_post.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 p-8 lg:p-12 space-y-8 flex flex-col justify-center">
                                        <div className="flex items-center justify-between flex-wrap gap-4">
                                            <div className="flex items-center gap-4">
                                                <motion.div
                                                    whileHover={{ rotate: 12, scale: 1.08 }}
                                                    className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center border border-emerald-200/40 shadow-lg shadow-emerald-500/10"
                                                >
                                                    <Sparkles className="w-7 h-7 text-emerald-600" />
                                                </motion.div>
                                                <div>
                                                    <h3 className="text-2xl font-black tracking-tight leading-none">Daily Spotlight</h3>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <motion.div
                                                            className="w-2 h-2 rounded-full bg-emerald-500"
                                                            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                        />
                                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                                            Optimized Priority Post
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-2 justify-end text-muted-foreground mb-1">
                                                    <History className="w-3 h-3" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Target Delivery</p>
                                                </div>
                                                <p className="text-lg font-black tracking-tight">
                                                    {data.spotlight_post.scheduled_time
                                                        ? new Date(data.spotlight_post.scheduled_time).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            weekday: "long",
                                                        })
                                                        : "Real-time Deployment"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="relative pl-5">
                                                <motion.div
                                                    initial={{ scaleY: 0 }}
                                                    animate={{ scaleY: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.6 }}
                                                    className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full origin-top"
                                                />
                                                <label className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-600 flex items-center gap-2 mb-3">
                                                    <Target className="w-3.5 h-3.5" /> Agent Strategic Reasoning
                                                </label>
                                                <p className="text-lg font-bold leading-relaxed tracking-tight">
                                                    "{data.spotlight_post.business_value ||
                                                        "Autonomous strategy: Scaling brand authority through high-frequency visual storytelling and niche trend alignment."}"
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/40">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                        <ShieldCheck className="w-3 h-3" /> Narrative Focus
                                                    </label>
                                                    <p className="text-sm font-medium text-foreground/70 leading-relaxed line-clamp-2 italic">
                                                        {data.spotlight_post.caption || "Crafting narrative..."}
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                        <TrendingUp className="w-3 h-3" /> Distribution Strategy
                                                    </label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {data.spotlight_post.hashtags?.split(",").slice(0, 4).map((tag, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, y: 8 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.4 + i * 0.06 }}
                                                            >
                                                                <Badge className="text-[9px] font-black bg-gradient-to-br from-zinc-900 to-zinc-700 text-white border-none py-1 px-3 rounded-lg uppercase tracking-wider">
                                                                    #{tag.trim()}
                                                                </Badge>
                                                            </motion.div>
                                                        ))}
                                                        {data.spotlight_post.hashtags?.split(",").length > 4 && (
                                                            <span className="text-[10px] font-black text-muted-foreground ml-1 self-center">
                                                                +{data.spotlight_post.hashtags.split(",").length - 4} More
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Glass>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ============ STAT CARDS ============ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            label: "Current Velocity",
                            icon: Target,
                            iconColor: "text-blue-500",
                            iconBg: "from-blue-100 to-blue-50",
                            value: <AnimatedNumber value={velocity} decimals={2} suffix="%" />,
                            footer: (
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+12.4% from start</span>
                                </div>
                            ),
                        },
                        {
                            label: "Confidence Score",
                            icon: ShieldCheck,
                            iconColor: "text-amber-500",
                            iconBg: "from-amber-100 to-amber-50",
                            value: <AnimatedNumber value={confidence} decimals={0} suffix="%" />,
                            footer: (
                                <>
                                    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${confidence}%` }}
                                            transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                                        Historical reliability: High
                                    </p>
                                </>
                            ),
                        },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} variants={fadeUp} initial="hidden" animate="show" custom={i + 2}>
                            <Glass className="group hover:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)] transition-shadow">
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <CardDescription className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                                            {stat.label}
                                        </CardDescription>
                                        <motion.div
                                            className={cn(
                                                "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center opacity-70 group-hover:opacity-100 transition",
                                                stat.iconBg
                                            )}
                                            whileHover={{ rotate: 12 }}
                                        >
                                            <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                                        </motion.div>
                                    </div>
                                    <div className="text-4xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                                        {stat.value}
                                    </div>
                                    <div>{stat.footer}</div>
                                </div>
                            </Glass>
                        </motion.div>
                    ))}

                    {/* Dark Premium Card */}
                    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}>
                        <motion.div
                            whileHover={{ y: -3 }}
                            className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white shadow-2xl shadow-zinc-900/30 border border-white/5"
                        >
                            <motion.div
                                className="absolute inset-0 opacity-30"
                                style={{
                                    background:
                                        "radial-gradient(circle at 30% 20%, hsl(var(--accent)) 0%, transparent 50%)",
                                }}
                                animate={{ opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            />
                            <div className="relative p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <CardDescription className="text-zinc-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <Activity className="w-4 h-4 text-emerald-400" /> Target Progress
                                    </CardDescription>
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                    </div>
                                </div>
                                <div className="text-4xl font-black tracking-tight">
                                    <AnimatedNumber value={target} decimals={1} suffix="%" />
                                    <span className="text-xs text-zinc-500 font-medium ml-2">Goal</span>
                                </div>
                                <div className="text-xs text-zinc-400 font-medium">
                                    Est. completion: {new Date(data?.campaign.end_date || "").toLocaleDateString()}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* ============ CHARTS + LOGS ============ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5} className="lg:col-span-2">
                        <Glass className="p-6">
                            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                                <div>
                                    <CardTitle className="text-xl font-black tracking-tight">Growth Projection</CardTitle>
                                    <CardDescription>Target vs. Actual Engagement Rate (%)</CardDescription>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-zinc-300" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                            Projected
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-accent to-primary shadow-lg shadow-accent/40" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Actual</span>
                                    </div>
                                </div>
                            </div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6, duration: 0.8 }}
                                className="h-[350px] w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="strokeActual" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="hsl(var(--primary))" />
                                                <stop offset="100%" stopColor="hsl(var(--accent))" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }}
                                            tickFormatter={(v) => `${v}%`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: "1rem",
                                                border: "1px solid hsl(var(--border))",
                                                background: "rgba(255,255,255,0.9)",
                                                backdropFilter: "blur(20px)",
                                                boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)",
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="projected"
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeWidth={3}
                                            fill="transparent"
                                            strokeDasharray="8 8"
                                            isAnimationActive
                                            animationDuration={1400}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="actual"
                                            stroke="url(#strokeActual)"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorActual)"
                                            isAnimationActive
                                            animationDuration={1800}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>
                        </Glass>
                    </motion.div>

                    {/* Decision Logs */}
                    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={6}>
                        <Glass className="flex flex-col h-full">
                            <CardHeader>
                                <CardTitle className="text-xl font-black flex items-center gap-2 tracking-tight">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    >
                                        <History className="w-5 h-5 text-accent" />
                                    </motion.div>
                                    Optimization Feed
                                </CardTitle>
                                <CardDescription>Autonomous pivots & triggers</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto px-6 pb-6 pt-0 max-h-[420px]">
                                <div className="space-y-6">
                                    <AnimatePresence>
                                        {data?.decisions.map((decision, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.7 + i * 0.08 }}
                                                className="flex gap-4 relative"
                                            >
                                                {i !== data.decisions.length - 1 && (
                                                    <div className="absolute left-2 top-8 bottom-0 w-px bg-gradient-to-b from-emerald-200 to-transparent" />
                                                )}
                                                <div className="mt-1">
                                                    <div className="relative">
                                                        <motion.div
                                                            className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md"
                                                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                                                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                                                        />
                                                        <div className="relative w-4 h-4 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center border border-emerald-300/40">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            {decision.decision_type.replace("_", " ")}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                                                            {new Date(decision.created_at).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-bold mt-1 leading-snug">{decision.reason}</p>
                                                    <div className="flex items-center gap-2 mt-2 bg-white/40 backdrop-blur-md p-2 rounded-lg border border-white/60">
                                                        <span className="text-[10px] font-mono text-muted-foreground">
                                                            {decision.previous_value}
                                                        </span>
                                                        <motion.div
                                                            className="w-2 h-px bg-emerald-400"
                                                            animate={{ scaleX: [1, 1.5, 1] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                        />
                                                        <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                                            {decision.new_value}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {data?.decisions.length === 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 0.5 }}
                                            className="flex flex-col items-center justify-center h-40 text-center"
                                        >
                                            <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                                            <p className="text-sm font-medium">
                                                System stable.
                                                <br />
                                                Scanning for opportunities...
                                            </p>
                                        </motion.div>
                                    )}
                                </div>
                            </CardContent>
                        </Glass>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
