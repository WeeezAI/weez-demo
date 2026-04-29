import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowUp,
    BrainCircuit,
    BarChart3,
    ShieldCheck,
    Layers,
    Clock,
    CheckCircle2,
    Sparkles,
    Bot,
    TrendingUp,
    Calendar,
    Zap,
    Loader2,
    Check,
    CheckCheck,
    Mic,
    Copy,
    Target,
    Settings,
    RotateCcw,
    ExternalLink,
    Hash,
    Lightbulb,
    Image as ImageIcon,
    Activity,
    Users,
    Award,
    AlertTriangle,
    AlertCircle,
    Info,
    MessageSquare,
    Mail,
    History,
    Trash2,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Plan from "@/components/ui/agent-plan";

// ─── Aurora Background (cinematic glassmorphism) ──────────────────────────────
function AuroraBG() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
                aria-hidden
                className="absolute -top-[20%] -left-[15%] w-[55%] h-[55%] rounded-full bg-indigo-500/25 blur-[140px]"
                animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.15, 0.95, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                aria-hidden
                className="absolute top-[10%] -right-[10%] w-[45%] h-[45%] rounded-full bg-fuchsia-400/20 blur-[160px]"
                animate={{ x: [0, -50, 30, 0], y: [0, 30, -20, 0], scale: [1, 1.1, 1.05, 1] }}
                transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                aria-hidden
                className="absolute -bottom-[15%] left-[15%] w-[60%] h-[55%] rounded-full bg-cyan-400/20 blur-[170px]"
                animate={{ x: [0, 40, -40, 0], y: [0, -30, 20, 0], scale: [1, 1.08, 0.92, 1] }}
                transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,255,255,0.4)_100%)]" />
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />
        </div>
    );
}
import { weezAPI } from "@/services/weezAPI";
import ConversationSidebar from "@/components/ConversationSidebar";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DashboardHeader,
    CampaignPerformanceSection,
    AiActivityFeedSection,
    GeneratedContentSection,
    UpcomingContentSection,
    LiveAIWorkerSection,
    PosterJobsGrid,
    LiveWorkerPanel
} from "@/components/DashboardComponents";
import ConnectorsView from "@/components/ConnectorsView";
import { usePosterWebSocket } from "@/hooks/usePosterWebSocket";
import PosterEditorModal from "@/components/PosterEditorModal";
import { StrategicHub } from "@/components/StrategicHub"; // This can be removed later if not used elsewhere, keeping for now to avoid breaking other things
import { DexraflowCampaignChat } from "@/components/ui/DexraflowCampaignChat";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
    role: Role;
    content: string;
    time: string;
    metadata?: any;
}

const AGENT_SEQUENCE = [
    { id: 1, name: "KPI Extraction", layer: "L1", icon: BrainCircuit, description: "Extracting measurable business KPIs from your goal...", color: "text-blue-500" },
    { id: 2, name: "Goal Alignment", layer: "L2", icon: Target, description: "Aligning campaign metrics with revenue targets...", color: "text-violet-500" },
    { id: 3, name: "Deep Analysis", layer: "L3", icon: BarChart3, description: "Analyzing your audience engagement patterns...", color: "text-emerald-500" },
    { id: 4, name: "Approach Formulation", layer: "L4", icon: Layers, description: "Structuring your strategic content approach...", color: "text-amber-500" },
    { id: 5, name: "Strategy Briefing", layer: "L5", icon: Sparkles, description: "Formulating your growth-optimized strategy plan...", color: "text-primary" },
] as const;

const PLANNER_SEQUENCE = [
    { id: 1, name: "Template Selection", icon: Layers, description: "Loading conversion-optimized industry templates...", color: "text-violet-500" },
    { id: 2, name: "Brand Analysis", icon: BrainCircuit, description: "Analyzing your brand identity for authentic messaging...", color: "text-blue-500" },
    { id: 3, name: "Content Mix", icon: BarChart3, description: "Calculating awareness vs engagement vs conversion ratios...", color: "text-emerald-500" },
    { id: 4, name: "Timeline Architecture", icon: Clock, description: "Structuring campaign timeline for consistent growth...", color: "text-amber-500" },
    { id: 5, name: "Post Ideation", icon: Lightbulb, description: "Generating revenue-aligned content concepts...", color: "text-pink-500" },
    { id: 6, name: "Schedule Optimization", icon: Calendar, description: "Optimizing posting times for maximum audience reach...", color: "text-cyan-500" },
    { id: 7, name: "Calendar Build", icon: Sparkles, description: "Assembling your strategic content calendar...", color: "text-primary" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const renderContent = (text: string) =>
    text.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
        const isDouble = part.startsWith("**") && part.endsWith("**");
        const isSingle = part.startsWith("*") && part.endsWith("*");
        if (isDouble || isSingle) {
            const clean = isDouble ? part.slice(2, -2) : part.slice(1, -1);
            return (
                <strong key={i} className="font-semibold text-[#5C5CF6]">
                    {clean}
                </strong>
            );
        }
        return part;
    });

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-black/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
                />
            ))}
        </span>
    );
}

function AgentBar({ phase }: { phase: number }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            {AGENT_SEQUENCE.map((a, idx) => {
                const done = phase > a.id;
                const active = phase === a.id;
                const Icon = a.icon;
                return (
                    <div key={a.id} className="flex items-center gap-1.5">
                        <div
                            className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-500",
                                done && "bg-black/5",
                                active && "bg-black/10 ring-2 ring-black/10 scale-110",
                                !done && !active && "bg-muted"
                            )}
                        >
                            {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                                <Icon className={cn("w-3.5 h-3.5", active ? a.color : "text-muted-foreground/40")} />
                            )}
                        </div>
                        {idx < AGENT_SEQUENCE.length - 1 && (
                            <div
                                className={cn(
                                    "h-px w-5 transition-all duration-700",
                                    done ? "bg-black/20" : "bg-border"
                                )}
                            />
                        )}
                    </div>
                );
            })}
            {phase > 0 && phase <= 5 && (
                <span className="ml-2 text-[10px] font-medium text-muted-foreground tracking-wide uppercase">
                    {AGENT_SEQUENCE[phase - 1].description}
                </span>
            )}
        </div>
    );
}

function UserBubble({ msg, userName }: { msg: Message, userName: string }) {
    const initial = userName?.charAt(0).toUpperCase() || "U";
    return (
        <div className="flex justify-end items-start gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[75%] px-5 py-3.5 rounded-3xl rounded-tr-sm bg-black text-white shadow-sm relative group">
                <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[10px] text-white/50 tracking-wide">{msg.time}</span>
                    <CheckCheck className="w-3 h-3 text-white/40" />
                </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-black/5 border border-black/10 flex items-center justify-center text-black font-bold text-sm shadow-sm flex-shrink-0 uppercase">
                {initial}
            </div>
        </div>
    );
}

function AiBubble({ msg, children }: { msg: Message, children?: React.ReactNode }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(msg.content);
        toast.info("Message copied to clipboard");
    };

    return (
        <div className="flex items-start mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-2 max-w-[85%]">
                <div className="px-6 py-5 rounded-3xl rounded-tl-sm bg-white border border-gray-100 shadow-sm relative">
                    <div className="text-sm leading-[1.8] text-gray-800 whitespace-pre-wrap">
                        {renderContent(msg.content)}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2 border-t border-gray-50 pt-2">
                        <span className="text-[10px] text-gray-400">· {msg.time}</span>
                        <CheckCheck className="w-3 h-3 text-blue-400" />
                    </div>
                </div>
                <div className="flex items-center gap-3 px-2">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors group"
                        title="Copy to clipboard"
                    >
                        <Copy className="w-4 h-4 text-gray-400 group-hover:text-black" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ThinkingBubble({ phase }: { phase: number }) {
    return (
        <div className="flex items-start mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-6 py-5 rounded-3xl rounded-tl-sm bg-white border border-gray-100 shadow-sm min-w-[240px]">
                <AgentBar phase={phase} />
                <TypingDots />
            </div>
        </div>
    );
}

function PlannerThinkingBubble({ phase }: { phase: number }) {
    return (
        <div className="flex items-start mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="min-w-[420px] max-w-[500px]">
                <Plan />
            </div>
        </div>
    );
}

// ─── Chat Section Helpers ─────────────────────────────────────────────────────

const CONTENT_EVENTS = new Set(["post_generating", "post_generated", "post_published"]);
const PERFORMANCE_EVENTS = new Set(["feedback_report", "optimization_update"]);

const isContentEvent = (msg: Message) => CONTENT_EVENTS.has(msg.metadata?.event ?? "");
const isPerformanceEvent = (msg: Message) => PERFORMANCE_EVENTS.has(msg.metadata?.event ?? "");

type SectionType = "content" | "performance" | "none";
const getSectionType = (msg: Message): SectionType => {
    if (isContentEvent(msg)) return "content";
    if (isPerformanceEvent(msg)) return "performance";
    return "none";
};

function ChatSectionDivider({ type }: { type: "content" | "performance" }) {
    if (type === "content") return (
        <div className="flex items-center gap-3 my-4 animate-in fade-in duration-300">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">Content Updates</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
        </div>
    );
    return (
        <div className="flex items-center gap-3 my-4 animate-in fade-in duration-300">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Performance Reports · 48H</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        </div>
    );
}

function PerformanceReportCard({ report }: { report: any }) {
    const delta = report.engagement_delta ?? 0;
    const confidence = report.confidence_score ?? 0;
    const isPositive = delta >= 0;
    return (
        <div className="mb-8 max-w-lg ml-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-[1.5rem] border border-gray-800 bg-gray-950 overflow-hidden shadow-xl shadow-black/20">
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Activity className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-white uppercase tracking-widest">48H Performance Report</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{report.created_at ? new Date(report.created_at).toLocaleString() : ""}</p>
                        </div>
                    </div>
                    {/* Engagement delta */}
                    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black", isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                        <TrendingUp className={cn("w-3.5 h-3.5", !isPositive && "rotate-180")} />
                        {isPositive ? "+" : ""}{delta.toFixed(2)}%
                    </div>
                </div>
                {/* Stats grid */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Award className="w-3 h-3 text-amber-400" />
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Best Post</p>
                            </div>
                            <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{report.best_content || "N/A"}</p>
                            {report.best_content_er > 0 && <p className="text-[10px] text-amber-400 mt-1 font-bold">ER: {(report.best_content_er * 100).toFixed(2)}%</p>}
                        </div>
                        <div className="bg-gray-900 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Needs Work</p>
                            </div>
                            <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{report.worst_content || "N/A"}</p>
                            {report.worst_content_er > 0 && <p className="text-[10px] text-red-400 mt-1 font-bold">ER: {(report.worst_content_er * 100).toFixed(2)}%</p>}
                        </div>
                    </div>
                    {/* Confidence score */}
                    <div className="bg-gray-900 rounded-xl p-3.5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Confidence Score</p>
                            <p className="text-sm font-black text-white">{confidence}/100</p>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-1000", confidence >= 70 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : confidence >= 45 ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-red-500 to-orange-400")} style={{ width: `${confidence}%` }} />
                        </div>
                    </div>
                    {/* Expected vs Actual */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-900 rounded-xl p-3">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Expected ER</p>
                            <p className="text-sm font-black text-white">{((report.expected_target ?? 0) * 100).toFixed(2)}%</p>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-3">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Actual ER</p>
                            <p className={cn("text-sm font-black", (report.actual_achieved ?? 0) >= (report.expected_target ?? 0) ? "text-emerald-400" : "text-red-400")}>{((report.actual_achieved ?? 0) * 100).toFixed(2)}%</p>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-3">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Best Time</p>
                            <p className="text-sm font-black text-white">{report.best_posting_time || "—"}</p>
                        </div>
                    </div>
                    {/* AI Summary */}
                    {report.summary && (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5">
                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">AI Analysis</p>
                            <p className="text-xs text-gray-300 leading-relaxed">{report.summary}</p>
                        </div>
                    )}
                    <p className="text-[9px] text-gray-600 font-medium text-center">{report.total_posts_analyzed ?? 0} posts analyzed in this cycle</p>
                </div>
            </div>
        </div>
    );
}

// --- Active Dashboard Sub-component ---
function ActiveDashboard({
    messages,
    activeStatus,
    plannerData,
    performanceReports,
    dashboardData,
    posterJobs,
    isWsConnected,
    latestEvent,
    onEditPoster
}: {
    messages: Message[],
    activeStatus: any,
    plannerData: any[] | null,
    performanceReports: any[],
    dashboardData: any,
    posterJobs: any[],
    isWsConnected: boolean,
    latestEvent: any,
    onEditPoster?: (jobId: string) => void
}) {
    const lastReport = performanceReports?.[0];
    // Mock/Extract data for the dashboard
    const campaignName = activeStatus?.campaign_name || "Growth Campaign";
    const status = activeStatus?.status_tag || "Active";
    const mode = activeStatus?.mode || "Balanced";
    const currentDay = activeStatus?.current_day || 1;
    const totalDays = activeStatus?.total_days || 30;

    const targetEngagement = activeStatus?.target_engagement ? `${(activeStatus.target_engagement * 100).toFixed(2)}%` : "4.08%";
    const currentEngagement = activeStatus?.current_engagement ? `${(activeStatus.current_engagement * 100).toFixed(2)}%` : "3.72%";
    const progress = activeStatus?.progress || 68;

    const metrics = dashboardData?.metrics || undefined;
    const chartData = dashboardData?.chartData || undefined;

    const activeGen = (messages || []).slice().reverse().find(m => m.metadata?.event === 'post_generating');
    const isStillGenerating = !!activeGen;

    const generatedPosts = (messages || [])
        .filter(m => m.metadata?.event === "post_published" || m.metadata?.event === "post_generated")
        .map((m, i) => ({
            image_url: m.metadata.image_url,
            title: m.metadata.poster_idea || "Marketing Post",
            status: m.metadata.event === "post_published" ? "Published" : "Scheduled",
            day: m.metadata.day_number || (i + 1)
        }));

    // Activities from messages
    const activities = (messages || [])
        .filter(m => CONTENT_EVENTS.has(m.metadata?.event) || PERFORMANCE_EVENTS.has(m.metadata?.event))
        .map(m => ({
            type: m.metadata?.event === 'post_published' ? 'success' : m.metadata?.event === 'post_generating' ? 'warning' : 'plus',
            content: m.metadata?.event === 'post_published' ? `Published: "${m.metadata.poster_idea}"` :
                m.metadata?.event === 'post_generated' ? `Generated: "${m.metadata.poster_idea}"` :
                    m.metadata?.event === 'post_generating' ? `Generating poster for "${m.metadata.subject}"` :
                        m.metadata?.event === 'feedback_report' ? `Performance Report: ${m.metadata.report?.summary}` :
                            m.content,
            time: m.time
        }));

    // Mock grouping by day for activities
    const groupedActivities = [
        {
            title: "Live Feed",
            items: activities.slice(-5).reverse()
        }
    ];

    const schedule = (plannerData || []).map(p => {
        const hour = p.scheduled_hour ?? 18;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const timeStr = `${displayHour}:00 ${period}`;

        // Cross-reference with posterJobs for real-time status
        const matchedJob = posterJobs.find(j =>
            j.content_post_id === p.id ||
            (j.content_day === p.day_number && j.poster_idea === p.poster_idea)
        );

        const actualStatus = (p.status === 'published' || p.status === 'posted') ? 'Published' : 'Scheduled';

        return {
            date: p.date || p.scheduled_date || "Upcoming",
            time: p.posting_time || p.scheduled_time || timeStr,
            topic: p.poster_idea || p.subject || "Marketing Strategy",
            status: actualStatus as 'Published' | 'Scheduled',
            platform: p.platform || 'instagram'
        };
    });

    const upcomingSchedule = schedule.filter(s => s.status === 'Scheduled').slice(0, 5);
    const displaySchedule = upcomingSchedule.length > 0 ? upcomingSchedule : schedule.slice(0, 5);

    // Determine if user is "all done" for today
    const activeJobs = posterJobs.filter(j => ["prompt_generating", "image_generating", "rendering", "queued"].includes(j.status));
    const allDoneForToday = posterJobs.length > 0 && activeJobs.length === 0;

    // Find next scheduled date from planner
    const nextScheduledDate = schedule.find(s => s.status === 'Scheduled')?.date || schedule[0]?.date || "Tomorrow";

    // Delete handler
    const handleDeletePost = async (postId: string) => {
        try {
            const brandId = activeStatus?.brand_id;
            const campaignId = activeStatus?.campaign_id;
            if (!brandId) return;
            const API_URL = "https://dexraflow-poster-pipeline-e7behqgjfqfresgf.canadacentral-01.azurewebsites.net";
            const res = await fetch(`${API_URL}/autopilot/content-posts/${postId}?brand_id=${brandId}`, { method: "DELETE" });
            if (res.ok) {
                // Refresh dashboard to pick up deletion
                refreshPosterJobs();
                if (campaignId) fetchConversation(campaignId);
                console.log("Post deleted successfully");
                toast.success("Post deleted successfully");
            }
        } catch (err) {
            console.error("Failed to delete post:", err);
        }
    };

    // Regenerate handler
    const handleRegeneratePost = async (jobId: string) => {
        try {
            const campaignId = activeStatus?.campaign_id;
            if (!campaignId) {
                console.error("No campaign ID available for regeneration");
                return;
            }
            await weezAPI.regeneratePosterJob(campaignId, jobId);
            console.log(`✅ Poster job ${jobId} queued for regeneration`);
            toast.success("Poster queued for regeneration");
            refreshPosterJobs();
            if (campaignId) fetchConversation(campaignId);
        } catch (err: any) {
            console.error("Failed to regenerate poster:", err?.message || err);
            toast.error(err?.message || "Failed to regenerate poster");
        }
    };

    // Post Now handler — immediately publish a completed poster
    const handlePostNow = async (jobId: string) => {
        try {
            const campaignId = activeStatus?.campaign_id;
            if (!campaignId) {
                toast.error("No campaign ID available");
                return;
            }
            const result = await weezAPI.postNow(campaignId, jobId);
            toast.success(result.message || "Published successfully!");
            console.log(`📤 Poster job ${jobId} published:`, result);
            refreshPosterJobs();
            if (campaignId) fetchConversation(campaignId);
        } catch (err: any) {
            console.error("Failed to post now:", err?.message || err);
            toast.error(err?.message || "Failed to publish poster");
        }
    };

    return (
        <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#F9FAFB]/50">
            <div className="max-w-6xl mx-auto">
                <DashboardHeader
                    campaignName={campaignName}
                    status={status}
                    mode={mode}
                    currentDay={currentDay}
                    totalDays={totalDays}
                />

                {/* Daily Spotlight Section */}
                {dashboardData?.spotlight_post && (
                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden group transition-all duration-500 hover:shadow-2xl mb-8">
                        <div className="flex flex-col lg:flex-row">
                            {/* Visual Preview */}
                            <div className="lg:w-1/3 h-[300px] lg:h-auto relative overflow-hidden bg-zinc-100">
                                {dashboardData.spotlight_post.blob_url ? (
                                    <img
                                        src={dashboardData.spotlight_post.blob_url}
                                        alt="Scheduled Poster"
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 bg-zinc-50">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full border-4 border-zinc-200 border-t-zinc-800 animate-spin" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 animate-pulse">Scanning Visuals</p>
                                    </div>
                                )}
                                <div className="absolute top-6 left-6">
                                    <Badge className="bg-white/95 backdrop-blur-xl text-zinc-900 border-none shadow-xl px-4 py-1.5 font-bold tracking-tighter capitalize rounded-full">
                                        {dashboardData.spotlight_post.status === 'posted' ? 'Published' : 'Spotlight State'}
                                    </Badge>
                                </div>
                            </div>

                            {/* Impact & Analysis */}
                            <div className="flex-1 p-8 lg:p-12 space-y-8 flex flex-col justify-center">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-50 flex items-center justify-center border border-emerald-100/50 shadow-inner">
                                            <Zap className="w-7 h-7 text-emerald-600 fill-emerald-600/20" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-zinc-900 tracking-tight leading-none">Daily Spotlight</h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Optimized Priority Post</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 justify-end text-zinc-400 mb-1">
                                            <History className="w-3 h-3" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Target Delivery</p>
                                        </div>
                                        <p className="text-lg font-black text-zinc-900 tracking-tight">
                                            {dashboardData.spotlight_post.scheduled_time
                                                ? new Date(dashboardData.spotlight_post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'long' })
                                                : 'Real-time Deployment'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full opacity-20" />
                                        <label className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-600 flex items-center gap-2 mb-3">
                                            <Target className="w-3.5 h-3.5" /> Agent Strategic Reasoning
                                        </label>
                                        <p className="text-lg font-bold text-zinc-800 leading-relaxed tracking-tight underline decoration-emerald-100 decoration-4 underline-offset-4">
                                            "{dashboardData.spotlight_post.business_value || "Autonomous strategy: Scaling brand authority through high-frequency visual storytelling and niche trend alignment."}"
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-100">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3" /> Narrative Focus
                                            </label>
                                            <p className="text-sm font-medium text-zinc-600 leading-relaxed line-clamp-2 italic">
                                                {dashboardData.spotlight_post.caption || "Crafting narrative..."}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <TrendingUp className="w-3 h-3" /> Distribution Strategy
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(dashboardData.spotlight_post.hashtags || "").split(',').slice(0, 4).map((tag: string, i: number) => (
                                                    <Badge key={i} variant="secondary" className="text-[9px] font-black bg-zinc-900 text-white border-none py-1 px-3 rounded-lg uppercase tracking-wider">
                                                        #{tag.trim()}
                                                    </Badge>
                                                ))}
                                                {(dashboardData.spotlight_post.hashtags || "").split(',').length > 4 && (
                                                    <Badge variant="secondary" className="text-[9px] font-black bg-zinc-100 text-zinc-400 border-none py-1 px-3 rounded-lg uppercase tracking-wider">
                                                        +{(dashboardData.spotlight_post.hashtags || "").split(',').length - 4} More
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}


                {posterJobs.length > 0 ? (
                    <>
                        <LiveWorkerPanel
                            posterJobs={posterJobs}
                            isConnected={isWsConnected}
                            latestEvent={latestEvent}
                        />
                        <PosterJobsGrid
                            posterJobs={posterJobs}
                            onDeletePost={handleDeletePost}
                            onRegeneratePost={handleRegeneratePost}
                            onPostNowPost={handlePostNow}
                            onEditPoster={onEditPoster}
                        />
                    </>
                ) : (
                    <>
                        {isStillGenerating && <LiveAIWorkerSection activeGen={activeGen} />}
                    </>
                )}

                <CampaignPerformanceSection
                    targetEngagement={targetEngagement}
                    currentEngagement={currentEngagement}
                    progress={progress}
                    metrics={metrics}
                    chartData={chartData}
                />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="space-y-8">
                        <AiActivityFeedSection activities={groupedActivities} />
                    </div>
                    <div className="space-y-8">
                        <UpcomingContentSection schedule={displaySchedule} />

                        {/* Latest Performance Update Snippet */}
                        {lastReport && (
                            <Card className="border-gray-100 shadow-sm rounded-[2rem] overflow-hidden bg-white">
                                <div className="p-6 flex items-center justify-between border-b border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-900">Performance Update</span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase border-gray-100 px-2 py-0.5">
                                        {lastReport.event_type === 'feedback_report' ? 'Feedback Analysis' : 'Optimization Result'}
                                    </Badge>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Engagement Rate</span>
                                            <span className="text-sm font-black text-emerald-500">
                                                {lastReport.summary?.engagement_growth ? `+${(lastReport.summary.engagement_growth * 100).toFixed(2)}%` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                                            <span className="text-sm font-black text-gray-900 leading-none">
                                                {lastReport.summary?.sentiment || "Analyzing..."}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                        {lastReport.summary?.executive_summary || "Processing audience interaction data..."}
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// --- Premium Loading Screen ---
function VisionLoadingScreen() {
    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none opacity-40">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-200/50 rounded-full blur-[100px] animate-bounce-slow" />
            </div>

            <div className="relative flex flex-col items-center text-center space-y-10 animate-in fade-in zoom-in-95 duration-1000">
                {/* Central Icon Block */}
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative w-24 h-24 rounded-[2rem] bg-white shadow-2xl border border-primary/5 flex items-center justify-center overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                        <BrainCircuit className="w-12 h-12 text-primary animate-float" />
                    </div>
                    {/* Orbiting Elements */}
                    <div className="absolute -top-4 -right-4 w-10 h-10 rounded-xl bg-white shadow-lg border border-black/5 flex items-center justify-center animate-bounce">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                </div>

                {/* Text Labels */}
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-primary border border-primary/10">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Strategy Engine Initializing</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground leading-none">
                            Connecting <br />
                            <span className="text-muted-foreground/30">Workforce</span>
                        </h2>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground/60 max-w-[280px] leading-relaxed italic">
                        "Architecting autonomous marketing systems for sustainable revenue growth."
                    </p>
                </div>

                {/* Progress Bar (Visual Only) */}
                <div className="w-64 space-y-3">
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-shimmer-loading" />
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
                        <span>L1 Layer Scan</span>
                        <span>v1.0.4</span>
                    </div>
                </div>
            </div>

            {/* Bottom Status Feed (Ghost text) */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[9px] font-bold text-muted-foreground/20 uppercase tracking-[0.3em] flex flex-col items-center gap-2">
                <span>KPI Extractions</span>
                <span>Market Benchmarking</span>
                <span>Visual Identity Mapping</span>
            </div>
        </div>
    );
}

export default function AutonomousMarketing() {
    // ... (rest of the component state)
    const { spaceId } = useParams<{ spaceId: string }>();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Welcome to Weez AI — your Autonomous Marketing Workforce. Share your marketing goal (e.g., 'Increase engagement by 20% in 30 days') and I'll analyze your brand, audience, and competitive landscape to architect a full revenue-aligned strategy for you.",
            time: nowTime(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const [agentPhase, setAgentPhase] = useState(0);
    const [plannerPhase, setPlannerPhase] = useState(0);
    const [isPlannerGenerating, setIsPlannerGenerating] = useState(false);
    const [briefingData, setBriefingData] = useState<any>(null);
    const [plannerData, setPlannerData] = useState<any[] | null>(null);
    const [plannerExplanation, setPlannerExplanation] = useState<any | null>(null);
    const [campaignSummary, setCampaignSummary] = useState<any | null>(null);
    const [confidenceScore, setConfidenceScore] = useState<number>(0);
    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [workspaceMode, setWorkspaceMode] = useState<"initial" | "briefing" | "planning" | "active" | "results">("initial");
    const [isStarting, setIsStarting] = useState(false);
    const [activeStatus, setActiveStatus] = useState<any>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "planner" | "connectors">("chat");
    const [performanceReports, setPerformanceReports] = useState<any[]>([]);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [isPollingConversation, setIsPollingConversation] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    // Campaign Configuration State
    const [campaignDuration, setCampaignDuration] = useState("30");
    const [campaignType, setCampaignType] = useState("engagement");
    const [marketingMode, setMarketingMode] = useState("medium");

    // HTML Poster Editor State
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    // WebSocket hook for real-time poster job updates
    const { posterJobs, isConnected: isWsConnected, latestEvent: latestWsEvent, refresh: refreshPosterJobs } = usePosterWebSocket(
        campaignId,
        workspaceMode === "results"
    );

    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const userName = spaceId || "User";

    const handleDeleteCampaign = async () => {
        if (!campaignId) return;
        const confirmed = window.confirm(
            "Are you sure you want to delete this campaign? This will permanently remove all content, posters, and analytics data. This action cannot be undone."
        );
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await weezAPI.deleteCampaign(campaignId);
            toast.success("Campaign deleted successfully");
            // Reset all state
            setCampaignId(null);
            setBriefingData(null);
            setPlannerData(null);
            setPlannerExplanation(null);
            setCampaignSummary(null);
            setConfidenceScore(0);
            setActiveStatus(null);
            setDashboardData(null);
            setPerformanceReports([]);
            setWorkspaceMode("initial");
            setMessages([{
                role: "assistant",
                content: "Campaign deleted. Share a new marketing goal to start fresh.",
                time: nowTime(),
            }]);
        } catch (err: any) {
            console.error("Failed to delete campaign", err);
            toast.error(err.message || "Failed to delete campaign");
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking, plannerData]);

    useEffect(() => {
        const checkStatus = async () => {
            if (!spaceId) {
                setIsPageLoading(false);
                return;
            }
            try {
                const status = await weezAPI.getActiveCampaignStatus(spaceId);
                if (status.active) {
                    setActiveStatus(status);
                    setCampaignId(status.campaign_id);
                    setWorkspaceMode("results");
                    await fetchConversation(status.campaign_id);
                } else if (status.status === 'briefing' || status.status === 'planning') {
                    setCampaignId(status.campaign_id);
                    setWorkspaceMode(status.status === 'planning' ? "planning" : "briefing");
                    await fetchConversation(status.campaign_id);
                }
            } catch (err) {
                console.error("Status check failed", err);
            } finally {
                // Ensure a minimum loading time for better UX perception
                setTimeout(() => {
                    setIsPageLoading(false);
                }, 1000);
            }
        };
        checkStatus();
    }, [spaceId]);

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!spaceId || workspaceMode !== "results") return;
            try {
                const data = await weezAPI.getAutopilotDashboard(spaceId);
                setDashboardData(data);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            }
        };

        const fetchReports = async () => {
            if (!spaceId || !campaignId || workspaceMode !== "results") return;
            try {
                const res = await weezAPI.getPerformanceReports(campaignId, spaceId);
                setPerformanceReports(res.reports || []);
            } catch (err) {
                console.error("Failed to fetch performance reports", err);
            }
        };

        if (workspaceMode === "results") {
            fetchDashboard();
            fetchReports();
            const interval = setInterval(() => {
                fetchDashboard();
                fetchReports();
            }, 30000); // Poll every 30s
            return () => clearInterval(interval);
        }
    }, [spaceId, campaignId, workspaceMode]);

    const fetchConversation = async (id: string) => {
        try {
            const res = await weezAPI.getCampaignConversation(spaceId!, id);
            if (res.messages && res.messages.length > 0) {
                const formatted = res.messages.map((m: any) => ({
                    role: m.role,
                    content: m.content,
                    time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    metadata: m.metadata
                }));
                setMessages(formatted);
                const lastBriefing = res.messages.findLast((m: any) => m.metadata?.briefing);
                if (lastBriefing) setBriefingData(lastBriefing.metadata.briefing);

                const lastPlanner = res.messages.findLast((m: any) => m.metadata?.planner);
                if (lastPlanner) {
                    setPlannerData(lastPlanner.metadata.planner);
                    setPlannerExplanation(lastPlanner.metadata.explanation);
                    // Only set to planning if we are not already in result/active mode
                    setWorkspaceMode(prev => (prev === "results" || prev === "active") ? prev : "planning");
                }
            }
        } catch (err) {
            console.error("Failed to fetch conversation", err);
        }
    };

    const handleSend = async (text?: string) => {
        const prompt = (text ?? input).trim();
        if (!prompt || isThinking) return;

        setMessages((prev) => [
            ...prev,
            { role: "user", content: prompt, time: nowTime() },
            {
                role: "assistant",
                content: "Great. I'm now analyzing your brand positioning, audience, and goals to create a strategic campaign plan. This helps ensure that every piece of content aligns with revenue growth and customer acquisition.",
                time: nowTime()
            }
        ]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        setIsThinking(true);
        setAgentPhase(1);

        let phase = 1;
        const interval = setInterval(() => {
            phase++;
            setAgentPhase(phase);
            if (phase >= 5) clearInterval(interval);
        }, 1500);

        try {
            const res = await weezAPI.getCampaignBrief(
                spaceId!,
                prompt,
                campaignDuration,
                campaignType,
                marketingMode
            );
            clearInterval(interval);
            setAgentPhase(6);
            setCampaignId(res.campaign_id);
            setBriefingData(res.briefing);

            const currentPct = (res.current_engagement * 100).toFixed(2);
            const targetPct = (res.target_engagement * 100).toFixed(2);
            const deltaPct = ((res.target_engagement - res.current_engagement) * 100).toFixed(2);
            const reasoning = res.briefing?.business_reasoning;

            let briefingContent = `**Strategic Plan Architecture Complete**\n\n📊 Current Engagement: **${currentPct}%** → Target: **${targetPct}%** (+${deltaPct}%) over **${res.days} days**.\n\n${res.briefing.summary}\n\n**Strategy:** ${res.briefing.content_strategy}`;

            if (reasoning) {
                briefingContent += `\n\n**Why This Strategy Works:** ${reasoning.why_this_strategy || ''}`;
                briefingContent += `\n\n**Expected Business Impact:** ${reasoning.expected_impact || ''}`;

                if (reasoning.platform_focus) {
                    briefingContent += `\n\n📱 **Instagram Focus:** ${reasoning.platform_focus.instagram}`;
                    if (reasoning.platform_focus.linkedin) {
                        briefingContent += `\n💼 **LinkedIn Focus:** ${reasoning.platform_focus.linkedin}`;
                    }
                }

                briefingContent += `\n\n**Strategic Validation:** ${reasoning.strategic_validation || ''}`;
            }

            // Multi-Platform: Platform Readiness Info
            const platformReadiness = res.briefing?.platform_readiness;
            const businessType = res.briefing?.business_type || res.business_type;
            const distribution = res.briefing?.platform_distribution || res.platform_distribution;

            if (platformReadiness && distribution) {
                const primary = platformReadiness.primary;
                const secondary = platformReadiness.secondary;
                const btLabel = businessType === "b2b" ? "B2B" : "B2C/D2C";

                const igPct = Math.round((distribution.instagram || 0) * 100);
                const liPct = Math.round((distribution.linkedin || 0) * 100);

                briefingContent += `\n\n---\n\n🏢 **Business Type Detected: ${btLabel}**`;
                briefingContent += `\n\n📱 **Platform Distribution:**`;
                briefingContent += `\n- Instagram: ${igPct}% ${primary.platform === "instagram" ? "(Primary)" : "(Secondary)"}`;
                // LinkedIn Distribution Display
                if (liPct > 0) {
                    briefingContent += `\n- LinkedIn: ${liPct}% ${primary.platform === "linkedin" ? "(Primary)" : "(Secondary)"}`;
                }

                if (!primary.connected) {
                    briefingContent += `\n\n⚠️ **Action Required:** Your primary platform (**${primary.platform === "linkedin" ? "LinkedIn" : "Instagram"}**) is not connected. Please connect it before starting the campaign.`;
                }

                if (!secondary.connected) {
                    briefingContent += `\n\n⚠️ **Warning:** Your secondary platform (**${secondary.platform === "linkedin" ? "LinkedIn" : "Instagram"}**) is not connected. The system will skip distribution to this platform until you connect it in the Connectors tab.`;
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: briefingContent, time: nowTime() },
            ]);
            setWorkspaceMode("briefing");
        } catch (err: any) {
            clearInterval(interval);
            toast.error(err.message || "Failed to generate strategy");
            setMessages((prev) => [...prev, { role: "assistant", content: "I encountered an error while formulating the strategy. Please try again.", time: nowTime() }]);
        } finally {
            setIsThinking(false);
            setAgentPhase(0);
        }
    };

    const handleGeneratePlanner = async () => {
        if (!campaignId) return;
        try {
            // Pre-processing acknowledgement
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "I'm now building your content plan based on the approved strategy. This includes post types, messaging angles, and distribution logic designed for maximum ROI.",
                time: nowTime()
            }]);

            setIsStarting(true);
            setIsPlannerGenerating(true);
            setPlannerPhase(1);

            // Animate through phases dynamically
            const phaseInterval = setInterval(() => {
                setPlannerPhase(prev => {
                    if (prev >= PLANNER_SEQUENCE.length) {
                        clearInterval(phaseInterval);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 2500);

            const now = new Date().toISOString();
            const res = await weezAPI.generateCampaignPlanner(campaignId, now);

            // Complete all phases
            clearInterval(phaseInterval);
            setPlannerPhase(PLANNER_SEQUENCE.length + 1);

            // Small delay to show completion before transitioning
            await new Promise(r => setTimeout(r, 600));

            setPlannerData(res.planner);
            setPlannerExplanation(res.explanation);
            setCampaignSummary(res.campaign_summary || null);
            setConfidenceScore(res.confidence_score || 0);
            setWorkspaceMode("planning");
            toast.success("Content Calendar Generated");

            // Count content focus types
            const focusCounts = (res.planner || []).reduce((acc: any, p: any) => {
                const focus = p.content_focus || 'engagement';
                acc[focus] = (acc[focus] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const focusSummary = Object.entries(focusCounts).map(([k, v]) => `${v} ${k}`).join(', ');

            setMessages(prev => [...prev, {
                role: "assistant",
                content: `**Content Calendar Complete** — Here's what I've built for you:\n\n📅 **${res.planner?.length || 0} strategic posts** planned across your campaign timeline.\n\n📊 **Content Mix:** ${focusSummary || 'Balanced mix of awareness, engagement & conversion posts'}.\n\n🎯 Each post is designed to move your audience through the funnel — from discovering your brand, to engaging with your content, to taking action.\n\nPlease review the calendar and strategic roadmap below.`,
                time: nowTime()
            }]);
        } catch (err: any) {
            toast.error(err.message || "Failed to generate planner");
        } finally {
            setIsStarting(false);
            setIsPlannerGenerating(false);
            setPlannerPhase(0);
        }
    };

    const handleDeployCampaign = async () => {
        if (!campaignId) return;
        try {
            setIsStarting(true);
            const result = await weezAPI.approveAndStartCampaign(campaignId);
            setWorkspaceMode("results");
            setActiveTab("chat");
            toast.success(`🚀 Campaign is now LIVE! ${result.poster_jobs_created || 0} poster jobs queued.`);
            fetchConversation(campaignId);
            // WebSocket will handle real-time updates automatically — no polling needed
        } catch (err: any) {
            toast.error(err.message || "Failed to deploy campaign");
        } finally {
            setIsStarting(false);
        }
    };

    const handleRejectBriefing = async () => {
        if (!campaignId) return;
        try {
            setIsStarting(true);
            await weezAPI.rejectBriefing(campaignId);
            setBriefingData(null);
            setPlannerData(null);
            setPlannerExplanation(null);
            setCampaignSummary(null);
            setConfidenceScore(0);
            setWorkspaceMode("initial");
            setCampaignId(null);
            setMessages([{
                role: "assistant",
                content: "Got it — I've reset the plan. Describe your marketing goal again and I'll analyze your brand, audience, and goals to architect a fresh revenue-aligned strategy.",
                time: nowTime()
            }]);
            toast.info("Briefing rejected. Ready for a new prompt.");
        } catch (err: any) {
            toast.error(err.message || "Failed to reject briefing");
        } finally {
            setIsStarting(false);
        }
    };

    const handleRejectPlanner = async () => {
        if (!campaignId) return;
        try {
            setIsStarting(true);
            setPlannerData(null);
            setPlannerExplanation(null);
            setWorkspaceMode("briefing");
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Understood — I've cleared the content calendar. Click 'Generate Planner' when you're ready and I'll create a fresh one.",
                time: nowTime()
            }]);
            toast.info("Planner rejected. Ready to regenerate.");
        } catch (err: any) {
            toast.error(err.message || "Failed to reject planner");
        } finally {
            setIsStarting(false);
        }
    };

    const handleMicClick = () => {
        setIsRecording(!isRecording);
        if (!isRecording) {
            toast.info("Listening... (Voice-to-Text Mockup)");
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
    };

    const isInitial = workspaceMode === "initial" && messages.length === 1;

    if (isPageLoading) {
        return <VisionLoadingScreen />;
    }

    const SUGGESTIONS = [
        "📈 Grow engagement +20% in 30 days",
        "🚀 14-day aggressive brand awareness blitz",
        "💡 Steady growth through product-focused content",
        "🏆 90-day brand authority building campaign",
    ];

    return (
        <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 overflow-hidden font-inter w-full">
            <ConversationSidebar
                spaceId={spaceId!}
                onNewChat={() => navigate("/spaces")}
                onSelectConversation={() => { }}
            />

            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
                <AuroraBG />

                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-6 right-6 z-[100] flex items-center bg-white/55 backdrop-blur-2xl rounded-2xl p-1 gap-1 border border-white/40 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.35)]"
                >
                    {[
                        { id: "chat", label: "Chat", icon: MessageSquare, disabled: false },
                        { id: "planner", label: "Content Planner", icon: Calendar, disabled: !plannerData },
                        { id: "connectors", label: "Connectors", icon: Zap, disabled: false },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
                                disabled={tab.disabled}
                                className={cn(
                                    "relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors",
                                    isActive ? "text-white" : "text-indigo-900/50 hover:text-indigo-700",
                                    tab.disabled && "opacity-30 cursor-not-allowed"
                                )}
                            >
                                {isActive && (
                                    <motion.span
                                        layoutId="am-tab-pill"
                                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 shadow-lg shadow-indigo-500/40"
                                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                                    />
                                )}
                                <Icon className="relative w-4 h-4" />
                                <span className="relative">{tab.label}</span>
                            </button>
                        );
                    })}

                    {campaignId && <div className="h-4 w-px bg-indigo-100 mx-1" />}

                    {campaignId && (
                        <button
                            onClick={handleDeleteCampaign}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all text-red-500/40 hover:text-red-600 hover:bg-red-50"
                        >
                            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete
                        </button>
                    )}
                </motion.div>

                {/* Messages Area — Chat Tab */}
                {activeTab === "chat" && (
                    workspaceMode === "results" ? (
                        <div className="flex-1 overflow-y-auto pt-32 px-8 pb-10 relative z-10">
                            <ActiveDashboard
                                messages={messages}
                                activeStatus={activeStatus}
                                plannerData={plannerData}
                                performanceReports={performanceReports}
                                dashboardData={dashboardData}
                                posterJobs={posterJobs}
                                isWsConnected={isWsConnected}
                                latestEvent={latestWsEvent}
                                onEditPoster={(jobId) => setEditingJobId(jobId)}
                            />
                        </div>
                    ) : isInitial ? (
                        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                            {/* Ambient Background Glows for Glassmorphism depth */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
                                <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px] animate-bounce-slow" />
                                <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[40%] bg-cyan-500/5 rounded-full blur-[150px]" />
                            </div>

                            <DexraflowCampaignChat
                                value={input}
                                setValue={setInput}
                                onGenerate={() => handleSend(input)}
                                onAutonomousCampaign={() => handleSend(input)}
                                campaignDuration={campaignDuration}
                                setCampaignDuration={setCampaignDuration}
                                campaignType={campaignType}
                                setCampaignType={setCampaignType}
                                marketingMode={marketingMode}
                                setMarketingMode={setMarketingMode}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto relative z-10 px-8 pt-32 pb-10">
                            <div className="max-w-4xl mx-auto">
                                {(() => {
                                    const displayMessages = workspaceMode === "active"
                                        ? messages.filter(msg =>
                                            isContentEvent(msg) ||
                                            isPerformanceEvent(msg) ||
                                            msg.metadata?.execution === true ||
                                            (msg.metadata && msg.metadata.image_url && !msg.metadata.event)
                                        )
                                        : messages;

                                    return displayMessages.map((msg, i) => {
                                        const currentSection = getSectionType(msg);
                                        const prevSection = i > 0 ? getSectionType(displayMessages[i - 1]) : "none";
                                        const showDivider = currentSection !== "none" && currentSection !== prevSection;
                                        const dayNum = msg.metadata?.day_number;
                                        return (
                                            <div key={i}>
                                                {showDivider && <ChatSectionDivider type={currentSection as "content" | "performance"} />}

                                                {/* Day N label above generating/generated events */}
                                                {dayNum && (msg.metadata?.event === "post_generating" || msg.metadata?.event === "post_generated") && (
                                                    <div className="flex items-center gap-2 mb-2 ml-1">
                                                        <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
                                                            <span className="text-[9px] font-black text-white">D{dayNum}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Day {dayNum} — Poster Generation Process</span>
                                                    </div>
                                                )}

                                                {msg.role === "user" ? (
                                                    <UserBubble msg={msg} userName={userName} />
                                                ) : (
                                                    <AiBubble msg={msg}>
                                                        {i === messages.length - 1 && workspaceMode === "briefing" && briefingData && !isStarting && (
                                                            <div className="mt-6 pt-6 border-t border-gray-50 flex flex-col items-start gap-4">
                                                                <p className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Review below — does this strategy align with your business goals?</p>
                                                                <div className="flex flex-col gap-4 w-full">
                                                                    {briefingData && briefingData.platform_readiness && !briefingData.platform_readiness.primary.connected && (
                                                                        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                                                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                                                            <div>
                                                                                <p className="text-sm font-bold text-red-900">Connection Required</p>
                                                                                <p className="text-xs text-red-700 leading-relaxed">
                                                                                    Your primary platform (**{briefingData.platform_readiness.primary.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}**) is not connected.
                                                                                    Please connect it in the <strong>Connectors</strong> tab to proceed.
                                                                                </p>
                                                                                <Button
                                                                                    variant="link"
                                                                                    className="p-0 h-auto text-red-600 font-bold text-xs mt-2 underline"
                                                                                    onClick={() => setActiveTab("connectors")}
                                                                                >
                                                                                    Go to Connectors →
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {briefingData && briefingData.platform_readiness && briefingData.platform_readiness.primary.connected && !briefingData.platform_readiness.secondary.connected && (
                                                                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                                                                            <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                                                                            <div>
                                                                                <p className="text-sm font-bold text-amber-900">Incomplete Content Distribution</p>
                                                                                <p className="text-xs text-amber-700 leading-relaxed">
                                                                                    Secondary platform (**{briefingData.platform_readiness.secondary.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}**) is not connected.
                                                                                    Content for this platform will be skipped. You can still proceed with your primary platform only.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center gap-3">
                                                                        <Button
                                                                            onClick={handleGeneratePlanner}
                                                                            disabled={briefingData && briefingData.platform_readiness && !briefingData.platform_readiness.primary.connected}
                                                                            className="h-12 px-8 rounded-2xl bg-black text-white font-bold gap-3 shadow-lg shadow-black/10 transition-all hover:bg-black/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            <Check className="w-4 h-4" /> Accept → Generate Planner
                                                                        </Button>
                                                                        <Button onClick={handleRejectBriefing} variant="outline" className="h-12 px-6 rounded-2xl border-red-200 text-red-600 font-bold gap-2 hover:bg-red-50 hover:border-red-300 transition-all active:scale-95">
                                                                            <RotateCcw className="w-4 h-4" /> Reject & Restart
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </AiBubble>
                                                )}

                                                {/* Poster Generating Animation */}
                                                {msg.metadata?.event === "post_generating" && (
                                                    <div className="mb-8 max-w-md ml-0 animate-in fade-in duration-500">
                                                        <div className="rounded-[1.5rem] border border-violet-100 shadow-sm bg-white p-6">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse">
                                                                    <ImageIcon className="w-5 h-5 text-white" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900">Generating Poster</p>
                                                                    <p className="text-xs text-gray-400">{msg.metadata.subject}</p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style={{ width: '70%', animation: 'pulse 2s ease-in-out infinite' }} />
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 font-medium">Creating visual concept → Optimizing CTA → Aligning with brand guidelines...</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rich Poster Card (Generated) */}
                                                {msg.metadata?.event === "post_generated" && msg.metadata?.image_url && (
                                                    <div className="mb-8 max-w-md ml-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                        <div className="rounded-[1.5rem] border border-gray-100 shadow-sm bg-white overflow-hidden">
                                                            <img src={msg.metadata.image_url} alt={msg.metadata.poster_idea} className="w-full h-auto" />
                                                            <div className="p-5 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider">✨ Content Ready</Badge>
                                                                    <span className="text-[10px] text-gray-400 font-bold">🕐 {msg.metadata.scheduled_time}</span>
                                                                </div>
                                                                <h4 className="text-sm font-bold text-gray-900">{msg.metadata.poster_idea}</h4>
                                                                {msg.metadata.caption && (
                                                                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{msg.metadata.caption}</p>
                                                                )}
                                                                {msg.metadata.hashtags && msg.metadata.hashtags.length > 0 && (
                                                                    <div className="flex items-center gap-1 flex-wrap">
                                                                        <Hash className="w-3 h-3 text-indigo-400" />
                                                                        <p className="text-[10px] text-indigo-500 font-medium">{Array.isArray(msg.metadata.hashtags) ? msg.metadata.hashtags.join(' ') : msg.metadata.hashtags}</p>
                                                                    </div>
                                                                )}
                                                                {msg.metadata.business_value && (
                                                                    <div className="bg-emerald-50/50 rounded-xl p-3 flex items-start gap-2">
                                                                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                                                        <div>
                                                                            <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-0.5">Business Value</p>
                                                                            <p className="text-[11px] text-emerald-800 leading-relaxed">{msg.metadata.business_value}</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {msg.metadata.audience_value && (
                                                                    <div className="bg-blue-50/50 rounded-xl p-3 flex items-start gap-2">
                                                                        <Users className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                                                        <div>
                                                                            <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest mb-0.5">Audience Value</p>
                                                                            <p className="text-[11px] text-blue-800 leading-relaxed">{msg.metadata.audience_value}</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2 pt-1">
                                                                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                                                        <Mail className="w-3 h-3 text-gray-400" />
                                                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Email alert sent</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Published Poster Card */}
                                                {msg.metadata?.event === "post_published" && msg.metadata?.image_url && (
                                                    <div className="mb-8 max-w-md ml-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                        <div className="rounded-[1.5rem] border border-emerald-100 shadow-sm bg-white overflow-hidden">
                                                            <img src={msg.metadata.image_url} alt={msg.metadata.poster_idea} className="w-full h-auto" />
                                                            <div className="p-4 bg-emerald-50 flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Published to Instagram</span>
                                                                </div>
                                                                {msg.metadata.instagram_link && (
                                                                    <a href={msg.metadata.instagram_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline">
                                                                        View <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Performance Report Card (48H) */}
                                                {(msg.metadata?.event === "feedback_report" || msg.metadata?.event === "optimization_update") && msg.metadata?.report && (
                                                    <PerformanceReportCard report={msg.metadata.report} />
                                                )}

                                                {/* Legacy image embed fallback */}
                                                {msg.metadata?.image_url && !msg.metadata?.event && (
                                                    <div className="mb-8 max-sm rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm ml-0 animate-in fade-in duration-500">
                                                        <img src={msg.metadata.image_url} alt="Live Content" className="w-full h-auto" />
                                                        <div className="p-4 bg-white flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-black">
                                                            <span>Live Execution</span>
                                                            {msg.metadata.instagram_link && <a href={msg.metadata.instagram_link} target="_blank" className="hover:underline">Instagram</a>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}

                                {isThinking && <ThinkingBubble phase={agentPhase} />}
                                {isPlannerGenerating && <PlannerThinkingBubble phase={plannerPhase} />}

                                {/* Planning View (Calendar + Explanation) — only shown in Chat tab while in planning mode */}
                                {plannerData && workspaceMode === "planning" && (
                                    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                                        {/* Campaign Overview Panel */}
                                        {(campaignSummary || confidenceScore > 0) && (
                                            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                                                <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4" /> Campaign Overview
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                                    {/* Confidence Score */}
                                                    <div className="bg-gray-50 rounded-2xl p-5 text-center">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Confidence Score</p>
                                                        <p className="text-3xl font-black text-gray-900">{Math.round(confidenceScore * 100)}%</p>
                                                        <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-1000",
                                                                    confidenceScore >= 0.9 ? "bg-emerald-500" : confidenceScore >= 0.7 ? "bg-amber-500" : "bg-red-500"
                                                                )}
                                                                style={{ width: `${confidenceScore * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* Total Posts */}
                                                    <div className="bg-gray-50 rounded-2xl p-5 text-center">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Posts</p>
                                                        <p className="text-3xl font-black text-gray-900">{campaignSummary?.total_posts || plannerData.length}</p>
                                                        <p className="text-xs text-gray-500 mt-1">Over {campaignSummary?.campaign_days || 30} days</p>
                                                    </div>
                                                    {/* Target */}
                                                    <div className="bg-gray-50 rounded-2xl p-5 text-center">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Engagement Target</p>
                                                        <p className="text-3xl font-black text-gray-900">
                                                            {campaignSummary?.target_engagement ? `${(campaignSummary.target_engagement * 100).toFixed(1)}%` : "—"}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            from {campaignSummary?.start_baseline ? `${(campaignSummary.start_baseline * 100).toFixed(1)}%` : "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* Expected Outcomes */}
                                                {campaignSummary?.expected_outcomes && (
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Expected Outcomes</p>
                                                        {campaignSummary.expected_outcomes.map((outcome: string, i: number) => (
                                                            <div key={i} className="flex items-center gap-3 py-1.5">
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                                <p className="text-sm text-gray-700">{outcome}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {plannerExplanation && (
                                            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
                                                <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4" /> Strategic Roadmap
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Why This Works</p>
                                                        <p className="text-sm text-gray-700 leading-relaxed">{plannerExplanation.why_this_works}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Content Pillars</p>
                                                        <p className="text-sm text-gray-700 leading-relaxed">{plannerExplanation.content_pillar_breakdown}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Template Strategy</p>
                                                        <p className="text-sm text-gray-700 leading-relaxed">{plannerExplanation.template_strategy}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Optimization Focus</p>
                                                        <p className="text-sm text-gray-700 leading-relaxed">{plannerExplanation.optimization_focus}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Link to Content Planner Tab */}
                                        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-violet-900">Your Full Content Calendar is Ready</h4>
                                                    <p className="text-xs text-violet-700 mt-1">Switch to the <span className="font-bold">Content Planner</span> tab above to review the day-by-day execution schedule.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {workspaceMode === "planning" && (
                                            <div className="flex flex-col items-center py-12 gap-4">
                                                <p className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Your strategic content calendar is ready — approve to begin autonomous execution</p>
                                                <div className="flex items-center gap-4">
                                                    <Button
                                                        onClick={handleDeployCampaign}
                                                        disabled={isStarting}
                                                        size="lg"
                                                        className="h-16 px-14 rounded-2xl bg-black text-white font-black text-lg gap-4 shadow-xl shadow-black/10 hover:bg-black/95 active:scale-95 transition-all outline-none"
                                                    >
                                                        {isStarting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Check className="w-6 h-6" /> Accept & Deploy</>}
                                                    </Button>
                                                    <Button
                                                        onClick={handleRejectPlanner}
                                                        disabled={isStarting}
                                                        variant="outline"
                                                        size="lg"
                                                        className="h-16 px-10 rounded-2xl border-red-200 text-red-600 font-bold text-base gap-3 hover:bg-red-50 hover:border-red-300 transition-all active:scale-95"
                                                    >
                                                        <RotateCcw className="w-5 h-5" /> Reject & Regenerate
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em]">Autonomous Strategy Deployment</p>
                                            </div>
                                        )}
                                        <div ref={bottomRef} className="h-32" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}
                {/* Content Planner Tab */}
                {activeTab === "planner" && plannerData && (
                    <div className="flex-1 overflow-y-auto relative z-10 px-8 py-10">
                        <div className="max-w-4xl mx-auto">
                            {/* Banner */}
                            <div className="mb-6 rounded-[1.5rem] bg-gradient-to-r from-violet-600 to-indigo-600 p-6 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-black text-base uppercase tracking-wide">Campaign Execution Plan</p>
                                    <p className="text-white/70 text-xs mt-0.5">Your full content calendar — Day by Day</p>
                                </div>
                            </div>
                            {/* Day-by-Day grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(Array.isArray(plannerData) ? plannerData : (plannerData as any).calendar || []).map((post: any, idx: number) => {
                                    const dayNum = post.day_number || post.day || (idx + 1);
                                    return (
                                        <div key={idx} className="rounded-[1.5rem] border border-gray-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                            {/* Day header */}
                                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                                                        <span className="text-[11px] font-black text-white">D{dayNum}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Day {dayNum}</p>
                                                        <p className="text-xs font-bold text-gray-700">{post.date || post.scheduled_date || ""}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {post.platform && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border-none",
                                                                post.platform === "linkedin" ? "bg-[#0A66C2]/10 text-[#0A66C2]" : "bg-pink-50 text-pink-600"
                                                            )}
                                                        >
                                                            {post.platform}
                                                        </Badge>
                                                    )}
                                                    {post.content_focus && (
                                                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider">{post.content_focus}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Post detail */}
                                            <div className="p-5 space-y-3">
                                                <h4 className="text-sm font-bold text-gray-900 leading-snug">{post.poster_idea || post.subject || post.headline || "—"}</h4>
                                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{post.idea_summary || post.hook || post.visual_prompt || ""}</p>
                                                {/* Scheduled time */}
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50/50 border border-violet-100/50 w-fit">
                                                    <Clock className="w-3.5 h-3.5 text-violet-600" />
                                                    <span className="text-[10px] text-violet-900 font-bold uppercase tracking-wider">
                                                        {(() => {
                                                            if (post.posting_time || post.scheduled_time) return post.posting_time || post.scheduled_time;
                                                            const hour = post.scheduled_hour ?? 18;
                                                            const period = hour >= 12 ? 'PM' : 'AM';
                                                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                                            return `${displayHour}:00 ${period}`;
                                                        })()}
                                                    </span>
                                                </div>
                                                {/* Business value */}
                                                {post.business_value && (
                                                    <div className="bg-emerald-50/60 rounded-xl p-3 flex items-start gap-2">
                                                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-0.5">Business Value</p>
                                                            <p className="text-[10px] text-emerald-800 leading-relaxed">{post.business_value}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Audience value */}
                                                {(post.audience_value || post.audience_impact) && (
                                                    <div className="bg-blue-50/60 rounded-xl p-3 flex items-start gap-2">
                                                        <Users className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest mb-0.5">Audience Value</p>
                                                            <p className="text-[10px] text-blue-800 leading-relaxed">{post.audience_value || post.audience_impact}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Hashtags */}
                                                {(post.hashtags || post.caption_hashtags) && (
                                                    <div className="flex items-center gap-1">
                                                        <Hash className="w-3 h-3 text-indigo-400" />
                                                        <p className="text-[9px] text-indigo-500 font-medium truncate">{typeof post.hashtags === "string" ? post.hashtags : (post.hashtags || []).join(" ")}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "connectors" && (
                    <ConnectorsView brandId={spaceId!} />
                )}
            </div>

            {/* HTML Poster Editor Modal */}
            <PosterEditorModal
                isOpen={!!editingJobId}
                onClose={() => setEditingJobId(null)}
                jobId={editingJobId || ""}
                onFinalized={() => {
                    setEditingJobId(null);
                    refreshPosterJobs();
                }}
            />
        </div>
    );
}
