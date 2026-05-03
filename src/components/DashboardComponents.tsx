import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    TrendingUp,
    Users,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    BarChart3,
    Zap,
    LayoutDashboard,
    Activity,
    MessageSquare,
    Share2,
    Bookmark,
    MessageCircle,
    Eye,
    Calendar,
    Sparkles,
    PlusCircle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Bot,
    Trash2,
    X,
    ImageIcon,
    Coffee,
    Sun,
    PartyPopper,
    RefreshCw,
    Send,
    Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

// --- Live Internet-Synced Clock ---
const LiveClock = () => {
    const [time, setTime] = useState<Date>(new Date());
    const [synced, setSynced] = useState(false);
    const offsetRef = useRef<number>(0);

    useEffect(() => {
        const syncTime = async () => {
            try {
                const res = await fetch("https://worldtimeapi.org/api/ip");
                const data = await res.json();
                const serverTime = new Date(data.datetime);
                const localTime = new Date();
                offsetRef.current = serverTime.getTime() - localTime.getTime();
                setTime(new Date(localTime.getTime() + offsetRef.current));
                setSynced(true);
            } catch {
                setTime(new Date());
                setSynced(true);
            }
        };
        syncTime();
        const interval = setInterval(() => {
            setTime(new Date(Date.now() + offsetRef.current));
        }, 1000);
        const resyncInterval = setInterval(syncTime, 5 * 60 * 1000);
        return () => {
            clearInterval(interval);
            clearInterval(resyncInterval);
        };
    }, []);

    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    return (
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 shadow-sm transition-all hover:bg-white/70">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-foreground tracking-tight tabular-nums uppercase">
                            {synced ? timeStr : '--:--:--'}
                        </span>
                        <div className={cn("w-1 h-1 rounded-full", synced ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-muted")} />
                    </div>
                    <div className="flex items-center gap-1 opacity-40">
                        <span className="text-[8px] font-black text-foreground uppercase tracking-widest">{dateStr}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Header Component ---
export const DashboardHeader = ({
    campaignName,
    status,
    mode,
    currentDay,
    totalDays
}: {
    campaignName: string;
    status: string;
    mode: string;
    currentDay: number;
    totalDays: number;
}) => (
    <div className="flex flex-col gap-4 mb-10 animate-in fade-in slide-in-from-top-2 duration-700">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 transform -rotate-2 hover:rotate-0 transition-all duration-500">
                    <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2 uppercase">
                        {campaignName}
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md">
                            Live
                        </Badge>
                    </h1>
                    <div className="flex items-center gap-4 mt-1 opacity-60">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Status:</span>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                {status}
                            </span>
                        </div>
                        <div className="h-2 w-px bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Mode:</span>
                            <span className="text-[9px] font-black text-foreground uppercase tracking-widest">{mode}</span>
                        </div>
                        <div className="h-2 w-px bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Day {currentDay}/{totalDays}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <LiveClock />
                <Button variant="outline" className="h-9 px-3.5 rounded-lg border-border text-[9px] font-black uppercase tracking-widest gap-1.5 bg-white/40 backdrop-blur-md hover:bg-white/60 shadow-sm">
                    <Share2 className="w-3 h-3" /> Export
                </Button>
                <Button className="h-9 px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-[9px] font-black uppercase tracking-widest gap-1.5 shadow-xl shadow-indigo-500/15 transition-all active:scale-95">
                    <PlusCircle className="w-3.5 h-3.5" /> New Post
                </Button>
            </div>
        </div>
    </div>
);

// --- Stats Card Component ---
const StatMetric = ({ icon: Icon, label, value, colorClass }: any) => (
    <div className="flex flex-col gap-1.5 transition-all hover:translate-x-1">
        <div className="flex items-center gap-2">
            <div className={cn("w-5 h-5 rounded-md flex items-center justify-center bg-white/40 ring-1 ring-inset ring-white/20 shadow-sm", colorClass)}>
                <Icon className="w-3 h-3" />
            </div>
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.15em]">{label}</span>
        </div>
        <span className="text-lg font-black text-foreground tracking-tight">{value}</span>
    </div>
);

const chartData = [
    { name: 'D1', val1: 400, val2: 240 },
    { name: 'D2', val1: 300, val2: 139 },
    { name: 'D3', val1: 200, val2: 980 },
    { name: 'D4', val1: 278, val2: 390 },
    { name: 'D5', val1: 189, val2: 480 },
    { name: 'D6', val1: 239, val2: 380 },
    { name: 'D7', val1: 349, val2: 430 },
    { name: 'D8', val1: 549, val2: 530 },
    { name: 'D9', val1: 649, val2: 630 },
    { name: 'D10', val1: 749, val2: 730 },
    { name: 'D11', val1: 849, val2: 790 },
    { name: 'D12', val1: 949, val2: 850 },
];

export const CampaignPerformanceSection = ({
    targetEngagement,
    currentEngagement,
    progress,
    metrics,
    chartData: dynamicChartData
}: {
    targetEngagement: string;
    currentEngagement: string;
    progress: number;
    metrics?: any;
    chartData?: any[];
}) => (
    <Card className="border-white/20 bg-white/30 backdrop-blur-3xl shadow-sm rounded-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
        <CardHeader className="px-6 pt-6 pb-2 border-none flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Campaign Performance</CardTitle>
            </div>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground/30 cursor-pointer hover:text-foreground transition-colors" />
        </CardHeader>
        <CardContent className="p-6 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-6 border-b border-white/20 pb-6">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Target ER</span>
                            <span className="text-xl font-black text-foreground tracking-tight">{targetEngagement}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 border-l border-white/20 pl-6">
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Current ER</span>
                            <span className="text-xl font-black text-foreground tracking-tight">{currentEngagement}</span>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-foreground uppercase tracking-widest">Goal Progress</span>
                            <span className="text-[9px] font-black text-indigo-600 lowercase italic tracking-widest font-mono">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-indigo-500/10 rounded-full overflow-hidden [&>div]:bg-indigo-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 pt-2">
                        <StatMetric icon={Eye} label="Impressions" value={metrics?.impressions?.toLocaleString() || "0"} colorClass="text-blue-600" />
                        <StatMetric icon={Users} label="Reach" value={metrics?.reach?.toLocaleString() || "0"} colorClass="text-emerald-600" />
                        <StatMetric icon={MessageCircle} label="Comments" value={metrics?.comments?.toLocaleString() || "0"} colorClass="text-amber-600" />
                        <StatMetric icon={Bookmark} label="Saves" value={metrics?.saves?.toLocaleString() || "0"} colorClass="text-indigo-600" />
                    </div>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-white/40 rounded-lg border border-white/20 p-4 h-full flex flex-col shadow-inner">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-foreground">Growth Trend</h4>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Realized</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-200" />
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Projected</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dynamicChartData && dynamicChartData.length > 0 ? dynamicChartData : chartData}>
                                    <defs>
                                        <linearGradient id="colorVal1" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.2)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 8, fontWeight: 900, fill: 'hsl(var(--muted-foreground))' }}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 900, padding: '8px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="val1"
                                        stroke="#4f46e5"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#colorVal1)"
                                        dot={{ r: 2.5, fill: '#4f46e5', strokeWidth: 1.5, stroke: '#fff' }}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: '#4f46e5' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);

// --- AI Activity Feed ---
export const AiActivityFeedSection = ({ activities }: { activities: any[] }) => (
    <Card className="border-white/20 bg-white/30 backdrop-blur-3xl shadow-sm rounded-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
        <CardHeader className="px-6 pt-6 pb-2 border-none flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                    <Zap className="w-4 h-4 text-indigo-600" />
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">AI Activity Feed</CardTitle>
            </div>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground/30 cursor-pointer" />
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
            <div className="space-y-5">
                {activities.map((day, dIdx) => (
                    <div key={dIdx} className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">{day.title}</span>
                            <div className="h-px flex-1 bg-white/20" />
                        </div>
                        <div className="space-y-3.5 ml-1">
                            {day.items.map((item: any, iIdx: number) => (
                                <div key={iIdx} className="flex items-start gap-3.5 group">
                                    <div className={cn("mt-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] bg-white ring-1 ring-inset ring-white/40 shadow-sm",
                                        item.type === 'success' ? 'text-emerald-500' : item.type === 'warning' ? 'text-amber-500' : 'text-indigo-500')}>
                                        {item.type === 'success' ? <CheckCircle2 className="w-2.5 h-2.5" /> : item.type === 'warning' ? <AlertCircle className="w-2.5 h-2.5" /> : <PlusCircle className="w-2.5 h-2.5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-foreground/80 tracking-tight leading-tight group-hover:text-foreground transition-colors">{item.content}</span>
                                        <span className="text-[8px] text-muted-foreground font-black mt-0.5 uppercase tracking-widest">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

// --- Generated Content ---
export const GeneratedContentSection = ({ posts }: { posts: any[] }) => (
    <Card className="border-white/20 bg-white/30 backdrop-blur-3xl shadow-sm rounded-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
        <CardHeader className="px-6 pt-6 pb-2 border-none flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Generated Content</CardTitle>
            </div>
            <MoreHorizontal className="w-4 h-4 text-muted-foreground/30 cursor-pointer" />
        </CardHeader>
        <CardContent className="p-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map((post, idx) => (
                    <div key={idx} className="group rounded-xl border border-white/20 bg-white/40 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500 flex flex-col">
                        <div className="aspect-[4/3] relative overflow-hidden">
                            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4">
                                <div className="flex gap-2 w-full">
                                    <Button variant="secondary" className="flex-1 h-8 rounded-lg bg-white/20 backdrop-blur-md border-white/20 text-white text-[9px] font-black uppercase hover:bg-white/30">View</Button>
                                    <Button variant="secondary" className="flex-1 h-8 rounded-lg bg-white/20 backdrop-blur-md border-white/20 text-white text-[9px] font-black uppercase hover:bg-white/30">Edit</Button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", post.status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                    {post.status}
                                </span>
                                <div className="flex items-center gap-2">
                                    {post.distribution_label && (
                                        <Badge className={cn(
                                            "text-[7px] font-black uppercase tracking-widest px-1.5 py-0 rounded",
                                            post.distribution_label === "Founder Led" 
                                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                                : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                        )}>
                                            {post.distribution_label}
                                        </Badge>
                                    )}
                                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Day {post.day}</span>
                                </div>
                            </div>
                            <h4 className="text-[11px] font-black text-foreground tracking-tight leading-tight line-clamp-2">{post.title}</h4>
                        </div>
                    </div>
                ))}

                <div className="flex flex-col">
                    <div className="flex-1 rounded-xl bg-white/20 border border-dashed border-white/30 p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-300/50 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-white/50 shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-all">
                            <Calendar className="w-5 h-5 text-indigo-600/40 group-hover:text-indigo-600" />
                        </div>
                        <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">Planner</h4>
                        <p className="text-[8px] text-muted-foreground font-black mt-1 uppercase tracking-widest">Next slot availability</p>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);

// --- Upcoming Content ---
export const UpcomingContentSection = ({ schedule }: { schedule: any[] }) => {
    const nextPost = schedule.length > 0 ? schedule[0] : null;

    return (
        <Card className="border-white/20 bg-white/30 backdrop-blur-3xl shadow-sm rounded-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-400">
            <CardHeader className="px-6 pt-6 pb-2 border-none flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
                        <Clock className="w-4 h-4 text-indigo-600" />
                    </div>
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Upcoming Content</CardTitle>
                </div>
                <MoreHorizontal className="w-4 h-4 text-muted-foreground/30 cursor-pointer" />
            </CardHeader>
            <CardContent className="p-6 pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="rounded-xl bg-white/40 border border-white/20 p-5 flex flex-col gap-4 shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-foreground">
                                    {nextPost?.date || "No Post"}, <span className="opacity-40">{nextPost?.time || "--:--"}</span>
                                </h4>
                                <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Next Deployment</p>
                            </div>
                        </div>

                        <div className="space-y-1.5 opacity-60">
                            {schedule.slice(1, 4).map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/30 border border-white/10">
                                    <span className="text-[9px] font-black text-foreground uppercase tracking-widest">
                                        {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                    </span>
                                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Post</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-2.5">
                        {schedule.map((item, i) => (
                            <div key={i} className="group flex items-center justify-between p-3.5 px-5 rounded-lg bg-white/40 border border-white/20 hover:bg-white/60 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300">
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    <div className="flex items-center gap-3 shrink-0">
                                        {item.platform === 'linkedin' ? (
                                            <Share2 className="w-3.5 h-3.5 text-[#0A66C2]" />
                                        ) : (
                                            <Activity className="w-3.5 h-3.5 text-pink-500" />
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-foreground uppercase tracking-tight">{item.date}</span>
                                            <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest">{item.time}</span>
                                        </div>
                                    </div>
                                    <div className="h-6 w-px bg-white/20 shrink-0" />
                                     <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-foreground/80 tracking-tight truncate">{item.topic}</span>
                                            {item.distribution_label && (
                                                <Badge className={cn(
                                                    "text-[7px] font-black uppercase tracking-widest px-1.5 py-0 rounded",
                                                    item.distribution_label === "Founder Led" 
                                                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                                        : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                                )}>
                                                    {item.distribution_label}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 ml-4">
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase px-2 py-0.5 rounded">
                                        {item.status}
                                    </Badge>
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Live AI Worker Section ---
export const LiveAIWorkerSection = ({ activeGen }: { activeGen: any }) => (
    <Card className="border-indigo-500/30 bg-white/40 backdrop-blur-3xl shadow-xl shadow-indigo-500/5 rounded-xl overflow-hidden mb-8 relative animate-in fade-in slide-in-from-bottom-2 duration-700">
        <div className="absolute top-4 right-4">
            <Badge className="bg-indigo-600 text-white border-none text-[8px] font-black uppercase tracking-widest animate-pulse px-2 py-0.5 rounded">Worker Active</Badge>
        </div>
        <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Sparkles className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Creative Engine</CardTitle>
                    <p className="text-[8px] text-indigo-600 font-black mt-1 uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                        Synthesizing high-fidelity visual assets
                    </p>
                </div>
            </div>

            <div className="bg-white/30 rounded-lg border border-white/20 p-4 space-y-4">
                <p className="text-[11px] font-black text-foreground/80 leading-snug">
                    {activeGen?.metadata?.subject || "Formulating visual strategy..."}
                </p>
                <div className="space-y-2.5">
                    <div className="h-1.5 bg-indigo-500/10 rounded-full overflow-hidden border border-white/20">
                        <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 bg-[length:200%_100%] animate-progress-flow" style={{ width: '65%' }} />
                    </div>
                    <div className="flex justify-between items-center text-[7px] text-muted-foreground/60 font-black uppercase tracking-[0.2em] font-mono">
                        <span>Sentiment</span>
                        <span>Style Alignment</span>
                        <span>Rendering</span>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);


// --- Poster Job Status Helpers ---
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    queued: { label: "Queued", color: "text-gray-500", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
    prompt_generating: { label: "Generating Prompt", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
    image_generating: { label: "Generating Image", color: "text-violet-600", bgColor: "bg-violet-50", borderColor: "border-violet-200" },
    jsx_generating: { label: "Designing Layout", color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200" },
    jsx_rendering: { label: "Rendering PNG", color: "text-cyan-600", bgColor: "bg-cyan-50", borderColor: "border-cyan-200" },
    rendering: { label: "Rendering", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
    html_ready: { label: "Generated", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
    completed: { label: "Completed", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
    failed: { label: "Failed", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
    publishing: { label: "Publishing", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
    posted: { label: "Published", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
};

// --- Rich Text Renderer ---
export const RichText = ({ text, className, boldClassName }: { text: string; className?: string, boldClassName?: string }) => {
    if (!text) return null;
    return (
        <span className={className}>
            {text.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                const isDouble = part.startsWith("**") && part.endsWith("**");
                const isSingle = part.startsWith("*") && part.endsWith("*");
                if (isDouble || isSingle) {
                    const clean = isDouble ? part.slice(2, -2) : part.slice(1, -1);
                    return <strong key={i} className={cn("font-black", boldClassName)}>{clean}</strong>;
                }
                return part;
            })}
        </span>
    );
};

// --- Image Modal for full-screen viewing (supports single image AND carousel) ---
const ImageModal = ({
    isOpen,
    onClose,
    imageUrl,
    title,
    businessValue,
    caption,
    hashtags,
    linkedinArticle,
    platform,
    format,
    slides,
    zipUrl,
}: {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    title: string;
    businessValue?: string;
    caption?: string;
    hashtags?: string;
    linkedinArticle?: string;
    platform?: string;
    format?: string;
    slides?: Array<{ slide_number?: number; image_url: string; status?: string }>;
    zipUrl?: string;
}) => {
    const [modalSlide, setModalSlide] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const isCarouselFormat = format === 'carousel' || (slides && slides.length > 0);
    const hasSlides = slides && slides.length > 1;
    const isFirstSlide = modalSlide === 0;
    const isLastSlide = hasSlides ? modalSlide === slides!.length - 1 : true;

    useEffect(() => {
        if (isOpen) {
            setModalSlide(0);
            setIsTransitioning(false);
        }
    }, [isOpen, imageUrl]);

    const goToSlide = useCallback((newIndex: number) => {
        if (!hasSlides) return;
        if (newIndex < 0 || newIndex >= slides!.length) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setModalSlide(newIndex);
            setTimeout(() => setIsTransitioning(false), 50);
        }, 150);
    }, [hasSlides, slides]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (!hasSlides) return;
            if (e.key === 'ArrowRight' && !isLastSlide) goToSlide(modalSlide + 1);
            if (e.key === 'ArrowLeft' && !isFirstSlide) goToSlide(modalSlide - 1);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, hasSlides, modalSlide, isFirstSlide, isLastSlide, onClose, goToSlide]);

    useEffect(() => {
        if (!isOpen || !hasSlides || isLastSlide) return;
        const t = setInterval(() => {
            setModalSlide(p => {
                const next = p + 1;
                return next < slides!.length ? next : p;
            });
        }, 5000);
        return () => clearInterval(t);
    }, [isOpen, hasSlides, isLastSlide, slides]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || !hasSlides) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0 && !isLastSlide) goToSlide(modalSlide + 1);
            if (dx > 0 && !isFirstSlide) goToSlide(modalSlide - 1);
        }
        touchStartRef.current = null;
    }, [hasSlides, modalSlide, isFirstSlide, isLastSlide, goToSlide]);

    const handleDownloadSlide = useCallback(() => {
        const url = hasSlides ? slides![modalSlide]?.image_url : imageUrl;
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = `slide_${String(modalSlide + 1).padStart(2, '0')}.png`;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, [hasSlides, slides, modalSlide, imageUrl]);

    if (!isOpen) return null;

    const activeSlide = hasSlides ? slides![modalSlide] : null;
    const isPending = activeSlide?.status === 'pending';
    const activeUrl = isPending ? null : (hasSlides ? (activeSlide?.image_url || imageUrl) : imageUrl);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-2xl transition-all duration-300" onClick={onClose}>
            <div
                className="relative max-w-6xl w-full mx-4 flex flex-col md:flex-row gap-6 items-center"
                onClick={e => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <button onClick={onClose} className="absolute -top-14 right-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all hover:rotate-90 backdrop-blur-md border border-white/10">
                    <X className="w-4 h-4" />
                </button>

                <div className="flex-1 w-full flex flex-col items-center gap-6">
                    <div className="relative w-full flex items-center justify-center group/nav">
                        {hasSlides && (
                            <button
                                onClick={(e) => { e.stopPropagation(); goToSlide(modalSlide - 1); }}
                                disabled={isFirstSlide}
                                className={cn(
                                    "absolute left-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-xl border opacity-0 group-hover/nav:opacity-100",
                                    isFirstSlide ? "bg-white/5 border-white/5 text-white/20 cursor-not-allowed" : "bg-white/20 hover:bg-white/30 border-white/20"
                                )}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}

                        <div className={cn("transition-all duration-300 ease-out", isTransitioning ? "opacity-0 scale-98 blur-sm" : "opacity-100 scale-100 blur-0")}>
                            {isPending ? (
                                <div className="max-h-[70vh] aspect-square w-[500px] rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-6 relative overflow-hidden backdrop-blur-3xl shadow-2xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 animate-pulse" />
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/20 relative">
                                        <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                                    </div>
                                    <div className="text-center z-10">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Slide {modalSlide + 1}</p>
                                        <p className="text-[14px] font-black text-white uppercase tracking-widest mt-1">Synthesizing...</p>
                                    </div>
                                    <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 animate-progress-flow" style={{ width: '60%' }} />
                                    </div>
                                </div>
                            ) : (
                                <img key={activeUrl} src={activeUrl!} alt={title} className="max-h-[70vh] w-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/20" />
                            )}
                        </div>

                        {hasSlides && (
                            <button
                                onClick={(e) => { e.stopPropagation(); goToSlide(modalSlide + 1); }}
                                disabled={isLastSlide}
                                className={cn(
                                    "absolute right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-xl border opacity-0 group-hover/nav:opacity-100",
                                    isLastSlide ? "bg-white/5 border-white/5 text-white/20 cursor-not-allowed" : "bg-white/20 hover:bg-white/30 border-white/20"
                                )}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {hasSlides && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                                {slides!.map((_, i) => (
                                    <div key={i} className={cn("h-1 transition-all duration-300 rounded-full", i === modalSlide ? "w-6 bg-indigo-500" : "w-1 bg-white/20")} />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <Button onClick={(e) => { e.stopPropagation(); handleDownloadSlide(); }} variant="secondary" className="h-8 rounded-lg bg-white/10 hover:bg-white/20 border-white/10 text-white text-[9px] font-black uppercase tracking-widest">
                                    <ArrowUpRight className="w-3 h-3 mr-1.5" /> Download Slide
                                </Button>
                                {zipUrl && (
                                    <Button onClick={(e) => { e.stopPropagation(); window.open(zipUrl, '_blank'); }} variant="secondary" className="h-8 rounded-lg bg-indigo-600/50 hover:bg-indigo-600/70 border-indigo-400/20 text-white text-[9px] font-black uppercase tracking-widest">
                                        <ArrowUpRight className="w-3 h-3 mr-1.5" /> Download All
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-80 lg:w-96 space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-white text-lg font-black tracking-tight uppercase">{title}</h3>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-indigo-600 text-white border-none text-[8px] font-black uppercase px-2 py-0.5 rounded">AI Generated</Badge>
                            <span className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-none">
                                {isCarouselFormat ? `Carousel · ${slides?.length || 1} Slides` : 'Single Post'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3 opacity-60">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Strategy</span>
                            </div>
                            <p className="text-white/80 text-[11px] font-medium leading-relaxed italic">
                                &ldquo;{businessValue || "Optimized for maximum conversion and brand resonance."}&rdquo;
                            </p>
                        </div>
                        {caption && platform !== 'linkedin' && (
                            <div className="space-y-2">
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Caption</span>
                                <div className="p-5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
                                    <p className="text-white/90 text-[11px] font-medium leading-relaxed whitespace-pre-wrap">
                                        <RichText text={caption} boldClassName="text-indigo-400" />
                                    </p>
                                    {hashtags && <p className="text-indigo-400 text-[10px] font-black mt-3">{hashtags}</p>}
                                </div>
                            </div>
                        )}
                        {linkedinArticle && platform === 'linkedin' && (
                            <div className="space-y-2">
                                <span className="text-[9px] font-black text-[#0A66C2]/50 uppercase tracking-widest ml-1">LinkedIn Article</span>
                                <div className="p-5 rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/10 backdrop-blur-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <p className="text-white/90 text-[11px] font-medium leading-relaxed whitespace-pre-wrap">
                                        <RichText text={linkedinArticle} boldClassName="text-[#0A66C2]" />
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Poster Job Card Component ---
export const PosterJobCard = ({ job, onDelete, onView, onRegenerate, onPostNow, onEditPoster }: { job: any; onDelete?: (id: string) => void; onView?: (url: string, title: string, businessValue?: string, caption?: string, hashtags?: string, linkedinArticle?: string, platform?: string, slides?: any[], zipUrl?: string, format?: string) => void; onRegenerate?: (jobId: string) => void; onPostNow?: (jobId: string) => void; onEditPoster?: (jobId: string) => void }) => {
    const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
    const isActive = ["queued", "prompt_generating", "image_generating", "jsx_generating", "jsx_rendering", "rendering"].includes(job.status);
    const isPublishing = job.status === "publishing";
    const isCompleted = job.status === "completed" || job.status === "html_ready" || job.status === "posted";
    const isHtmlReady = job.status === "html_ready";
    const isFailed = job.status === "failed";
    const isDeleted = job.status === "deleted";
    const isPublished = job.status === "posted" || job.publish_status === "posted";
    const canShowVisual = (isCompleted || isPublished || isPublishing);
    const [imgError, setImgError] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const isLinkedIn = job.platform === 'linkedin';
    const isCarousel = (job.format === 'carousel' || (job.template_type && job.template_type.toLowerCase().includes('carousel'))) && job.slides && job.slides.length > 0;

    // Auto-play logic for carousels
    useEffect(() => {
        if (!isCarousel || isPaused || isActive || !isCompleted) return;

        const interval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % job.slides.length);
        }, 5000); // 5 second interval

        return () => clearInterval(interval);
    }, [isCarousel, isPaused, isActive, isCompleted, job.slides?.length]);

    const handleNextSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPaused(true);
        setCurrentSlide(prev => (prev + 1) % job.slides.length);
    };

    const handlePrevSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPaused(true);
        setCurrentSlide(prev => (prev - 1 + job.slides.length) % job.slides.length);
    };

    const handleRegenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRegenerating) return;
        setIsRegenerating(true);
        try {
            await onRegenerate?.(job.id);
        } finally {
            setTimeout(() => setIsRegenerating(false), 2000);
        }
    };

    const handlePostNow = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPosting || isPublished) return;
        setIsPosting(true);
        try {
            await onPostNow?.(job.id);
        } finally {
            setTimeout(() => setIsPosting(false), 3000);
        }
    };

    // ── LINKEDIN CARD ──────────────────────────────────────────────────
    if (isLinkedIn) {
        return (
            <div className={cn(
                "group rounded-2xl border bg-white overflow-hidden transition-all duration-500 flex flex-col",
                isActive ? "border-[#0A66C2]/30 shadow-lg shadow-[#0A66C2]/5 ring-1 ring-[#0A66C2]/10" : "border-[#0A66C2]/15 hover:shadow-xl hover:shadow-[#0A66C2]/10 hover:-translate-y-1",
                isFailed && "border-red-200 opacity-70",
                isDeleted && "border-red-100 opacity-50"
            )}>
                {/* 16:9 Image Header for LinkedIn */}
                <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-[#0A66C2]/8 to-slate-50 flex-shrink-0">
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A66C2]/90 backdrop-blur-sm shadow-sm border border-white/20">
                        <Share2 className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">LinkedIn</span>
                    </div>
                    {canShowVisual && job.asset_url && !imgError ? (
                        <>
                            <img src={job.asset_url} alt={job.poster_idea} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onError={() => setImgError(true)} />
                            {isPublishing && (
                                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A66C2]/90 backdrop-blur-sm shadow-sm border border-white/20 animate-pulse">
                                    <Sparkles className="w-3 h-3 text-white" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Publishing...</span>
                                </div>
                            )}
                        </>
                    ) : imgError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <ImageIcon className="w-6 h-6 text-[#0A66C2]/30" />
                            <p className="text-[10px] font-bold text-[#0A66C2]/40 uppercase tracking-widest">Image Expired</p>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            {isActive ? (
                                <>
                                    <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center animate-pulse shadow-lg shadow-[#0A66C2]/30">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-[10px] font-black text-[#0A66C2] uppercase tracking-widest">{config.label}...</p>
                                </>
                            ) : isFailed ? (
                                <>
                                    <AlertCircle className="w-8 h-8 text-red-400" />
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Failed</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 flex items-center justify-center">
                                        <Share2 className="w-5 h-5 text-[#0A66C2]/50" />
                                    </div>
                                    <p className="text-[10px] font-black text-[#0A66C2]/50 uppercase tracking-widest">Scheduled</p>
                                </>
                            )}
                        </div>
                    )}
                    {isDeleted && (
                        <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center">
                            <Badge className="bg-red-500 text-white border-none text-xs font-black uppercase tracking-widest">Deleted</Badge>
                        </div>
                    )}
                    {isCompleted && !isDeleted && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-3">
                            <div className="flex gap-2 w-full">
                                <Button variant="secondary" className="flex-1 h-8 rounded-xl bg-white/20 backdrop-blur-md border-white/10 text-white text-[10px] font-black uppercase hover:bg-white/30" onClick={() => onView?.(job.asset_url, job.poster_idea || 'LinkedIn Post', job.business_value, job.caption, job.hashtags, job.linkedin_post_text, job.platform, undefined, job.zip_url, job.format)}>
                                    <Eye className="w-3 h-3 mr-1" /> Read
                                </Button>
                                {onRegenerate && (<Button variant="secondary" className="h-8 w-8 rounded-xl bg-[#0A66C2]/40 backdrop-blur-md border-[#0A66C2]/20 text-white hover:bg-[#0A66C2]/60 p-0 disabled:opacity-50" onClick={handleRegenerate} disabled={isRegenerating}>{isRegenerating ? <Sparkles className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}</Button>)}
                                {onDelete && (<Button variant="secondary" className="h-8 w-8 rounded-xl bg-red-500/30 backdrop-blur-md border-red-400/20 text-white hover:bg-red-500/50 p-0" onClick={(e) => { e.stopPropagation(); onDelete(job.content_post_id || job.id); }}><Trash2 className="w-3 h-3" /></Button>)}
                            </div>
                        </div>
                    )}
                </div>
                {/* Article Body */}
                <div className="flex flex-col flex-1 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border px-2 py-0.5", isPublished ? "text-emerald-600 bg-emerald-50 border-emerald-200" : config.color + " " + config.bgColor + " " + config.borderColor)}>{isPublished ? "Published" : config.label}</Badge>
                        <div className="flex items-center gap-2">
                            {job.distribution_label && (
                                <Badge className={cn(
                                    "text-[7px] font-black uppercase tracking-widest px-1.5 py-0 rounded",
                                    job.distribution_label === "Founder Led" 
                                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                        : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                )}>
                                    {job.distribution_label}
                                </Badge>
                            )}
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Day {job.content_day}</span>
                        </div>
                    </div>
                    <h4 className="text-xs font-bold text-gray-900 tracking-tight leading-snug line-clamp-2">{job.poster_idea || "Generating..."}</h4>
                    {job.linkedin_post_text ? (
                        <div className="flex-1 p-2.5 rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/10 group-hover:bg-[#0A66C2]/8 transition-colors">
                            <p className="text-[10px] font-medium text-gray-600 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                                <RichText text={job.linkedin_post_text} boldClassName="text-[#0A66C2]" />
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 p-2.5 rounded-xl border border-[#0A66C2]/10 flex items-center gap-2 bg-[#0A66C2]/3">
                            <div className="w-1.5 h-4 rounded-full bg-[#0A66C2]/25 flex-shrink-0" />
                            <p className="text-[10px] font-medium text-[#0A66C2]/50 italic">Article generated by Claude Opus 4...</p>
                        </div>
                    )}
                    {isActive && (<div className="space-y-1"><div className="h-1.5 bg-[#0A66C2]/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#0A66C2] to-blue-400 rounded-full transition-all duration-1000" style={{ width: `${job.progress}%` }} /></div><span className="text-[9px] font-bold text-[#0A66C2]/60">{job.progress}%</span></div>)}
                    <div className="flex items-center justify-between pt-0.5">
                        {job.scheduled_time && !isPublished && (<div className="flex items-center gap-1 text-[9px] font-bold text-[#0A66C2] uppercase tracking-widest"><Clock className="w-2.5 h-2.5" />{new Date(job.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>)}
                        {isCompleted && job.generation_time_seconds && (<div className="flex items-center gap-1 text-[9px] text-gray-400 font-medium ml-auto"><Zap className="w-2.5 h-2.5" />{Math.round(job.generation_time_seconds)}s</div>)}
                    </div>
                    {/* Optional edit button for completed LinkedIn posts with HTML content */}
                    {isCompleted && !isDeleted && !isPublished && job.has_html && (
                        <div className="pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8 rounded-xl border-violet-200 text-violet-600 text-[10px] font-black uppercase tracking-wider hover:bg-violet-50 transition-all"
                                onClick={(e) => { e.stopPropagation(); onEditPoster?.(job.id); }}
                            >
                                <Palette className="w-3 h-3 mr-1.5" /> Edit Poster
                            </Button>
                        </div>
                    )}
                    {/* Action buttons for completed LinkedIn posts */}
                    {isCompleted && !isDeleted && !isPublished && (
                        <div className="flex gap-2 pt-1">
                            {onPostNow && (
                                <Button
                                    size="sm"
                                    className="flex-1 h-8 rounded-xl bg-[#0A66C2] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#0A66C2]/90 shadow-sm disabled:opacity-60 transition-all"
                                    onClick={handlePostNow}
                                    disabled={isPosting}
                                >
                                    {isPosting ? (
                                        <><Sparkles className="w-3 h-3 mr-1.5 animate-spin" /> Publishing...</>
                                    ) : (
                                        <><Send className="w-3 h-3 mr-1.5" /> Post Now</>
                                    )}
                                </Button>
                            )}
                            {onRegenerate && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-xl border-[#0A66C2]/20 text-[#0A66C2] text-[10px] font-black uppercase tracking-wider hover:bg-[#0A66C2]/5 disabled:opacity-50"
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating}
                                >
                                    {isRegenerating ? (
                                        <Sparkles className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <><RefreshCw className="w-3 h-3 mr-1" /> Regenerate</>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                    {isPublished && (
                        <div className="flex items-center gap-2 pt-1 px-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Published</span>
                        </div>
                    )}
                    {isFailed && (<div className="space-y-1.5">{job.error_message && <p className="text-[10px] text-red-500 font-medium line-clamp-2">{job.error_message}</p>}{onRegenerate && (<Button size="sm" className="w-full h-7 rounded-xl bg-[#0A66C2] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#0A66C2]/90 shadow-sm disabled:opacity-60" onClick={handleRegenerate} disabled={isRegenerating}>{isRegenerating ? <><Sparkles className="w-3 h-3 mr-1 animate-spin" /> Queuing...</> : <><RefreshCw className="w-3 h-3 mr-1" /> Retry</>}</Button>)}</div>)}
                </div>
            </div>
        );
    }

    // ── INSTAGRAM CARD ──────────────────────────────────────────────────

    return (
        <div className={cn(
            "group rounded-2xl border bg-white overflow-hidden transition-all duration-500",
            isActive ? "border-violet-200 shadow-lg shadow-violet-500/5 ring-1 ring-violet-100" : "border-gray-100 hover:shadow-xl hover:-translate-y-1",
            isFailed && "border-red-200 opacity-70",
            isDeleted && "border-red-100 opacity-50"
        )}>
            {/* 1:1 Square Image for Instagram */}
            <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-pink-50 to-rose-50">

                {/* Instagram Badge — always show */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-sm border border-white/20">
                    <Activity className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Instagram</span>
                </div>

                {canShowVisual && (isCarousel ? job.slides[currentSlide]?.image_url || job.asset_url : job.asset_url) && !imgError ? (
                    <>
                        <img
                            src={isCarousel ? job.slides[currentSlide]?.image_url || job.asset_url : job.asset_url}
                            alt={job.poster_idea}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={() => setImgError(true)}
                        />

                        {isPublishing && (
                            <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm shadow-sm border border-white/20 animate-pulse">
                                <Sparkles className="w-3 h-3 text-white" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Publishing...</span>
                            </div>
                        )}
                        
                        {isCarousel && (
                            <>
                                {/* Slide Navigation Controls */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 z-20 pointer-events-none">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/10 text-white pointer-events-auto transition-opacity opacity-0 group-hover:opacity-100"
                                        onClick={handlePrevSlide}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/10 text-white pointer-events-auto transition-opacity opacity-0 group-hover:opacity-100"
                                        onClick={handleNextSlide}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Slide Indicator */}
                                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm border border-white/10">
                                    <span className="text-[10px] font-black text-white uppercase">Slide {currentSlide + 1}/{job.slides.length}</span>
                                </div>

                                {/* Progress Dots Overlay */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                                    {job.slides.map((_: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "h-1 rounded-full transition-all duration-300",
                                                currentSlide === idx ? "w-4 bg-white" : "w-1.5 bg-white/40"
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                ) : imgError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Image Expired</p>
                    </div>
                                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
                        {isActive ? (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center animate-pulse shadow-lg shadow-pink-200">
                                    <Sparkles className="w-7 h-7 text-white" />
                                </div>
                                <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest text-center">
                                    {config.label}...
                                </p>
                            </>
                        ) : isFailed ? (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                                    <AlertCircle className="w-7 h-7 text-red-400" />
                                </div>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Generation Failed</p>
                            </>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
                                    <Activity className="w-7 h-7 text-pink-300" />
                                </div>
                                <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Scheduled</p>
                            </>
                        )}
                    </div>
                )}

                {/* Deleted overlay */}
                {isDeleted && (
                    <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center">
                        <Badge className="bg-red-500 text-white border-none text-xs font-black uppercase tracking-widest">Deleted</Badge>
                    </div>
                )}

                {/* Completed overlay with actions */}
                {isCompleted && !isDeleted && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
                        <div className="flex gap-2 w-full">
                            <Button
                                variant="secondary"
                                className="flex-1 h-9 rounded-xl bg-white/20 backdrop-blur-md border-white/10 text-white text-[10px] font-black uppercase hover:bg-white/30"
                                onClick={() => onView?.(
                                    isCarousel ? (job.slides[0]?.image_url || job.asset_url) : job.asset_url,
                                    job.poster_idea || 'Poster',
                                    job.business_value,
                                    job.caption,
                                    job.hashtags,
                                    job.linkedin_post_text,
                                    job.platform,
                                    isCarousel ? job.slides : undefined,
                                    isCarousel ? job.zip_url : undefined,
                                    job.format
                                )}
                            >
                                <Eye className="w-3 h-3 mr-1" /> {job.platform === 'linkedin' ? 'Read' : isCarousel ? `View (${job.slides.length} slides)` : 'View'}
                            </Button>
                            {onRegenerate && (
                                <Button
                                    variant="secondary"
                                    className="h-9 w-9 rounded-xl bg-violet-500/40 backdrop-blur-md border-violet-400/20 text-white hover:bg-violet-500/60 p-0 disabled:opacity-50"
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating}
                                    title="Regenerate this poster"
                                >
                                    {isRegenerating ? (
                                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                </Button>
                            )}
                            {onDelete && (
                                <Button
                                    variant="secondary"
                                    className="h-9 w-9 rounded-xl bg-red-500/30 backdrop-blur-md border-red-400/20 text-white hover:bg-red-500/50 p-0"
                                    onClick={(e) => { e.stopPropagation(); onDelete(job.content_post_id || job.id); }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5",
                            isPublished ? "text-emerald-600 bg-emerald-50 border-emerald-200" : config.color + " " + config.bgColor + " " + config.borderColor
                        )}
                    >
                        {isPublished ? "Published" : config.label}
                    </Badge>
                    <div className="flex items-center gap-2">
                        {job.distribution_label && (
                            <Badge className={cn(
                                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0 rounded",
                                job.distribution_label === "Founder Led" 
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                    : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                            )}>
                                {job.distribution_label}
                            </Badge>
                        )}
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Day {job.content_day}</span>
                    </div>
                </div>

                <h4 className="text-xs font-bold text-gray-900 tracking-tight leading-snug line-clamp-2">
                    {job.poster_idea || "Generating..."}
                </h4>

                {/* LinkedIn Article Preview - only for non-linkedin (fallback) */}
                {!isLinkedIn && job.linkedin_post_text && (
                    <div className="mt-2 p-2.5 rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/10 leading-relaxed max-h-[80px] overflow-hidden relative group-hover:bg-[#0A66C2]/10 transition-colors">
                        <p className="text-[10px] font-medium text-gray-600 line-clamp-3 whitespace-pre-wrap">
                            {job.linkedin_post_text}
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
                    </div>
                )}

                {/* Progress bar for active jobs */}
                {isActive && (
                    <div className="space-y-1.5">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-1000"
                                style={{ width: `${job.progress}%` }}
                            />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400">{job.progress}%</span>
                    </div>
                )}

                {/* Generation time for completed */}
                {isCompleted && job.generation_time_seconds && (
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-medium">
                        <Zap className="w-3 h-3" />
                        {Math.round(job.generation_time_seconds)}s
                        {job.model_used && <span className="ml-1">· {job.model_used}</span>}
                    </div>
                )}

                {/* Scheduled time */}
                {job.scheduled_time && !isPublished && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-violet-500 uppercase tracking-widest">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(job.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                )}

                {/* Optional edit button for completed posters with HTML content */}
                {isCompleted && !isDeleted && !isPublished && job.has_html && (
                    <div className="pt-1">
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 rounded-xl border-violet-200 text-violet-600 text-[10px] font-black uppercase tracking-wider hover:bg-violet-50 transition-all"
                            onClick={(e) => { e.stopPropagation(); onEditPoster?.(job.id); }}
                        >
                            <Palette className="w-3 h-3 mr-1.5" /> Edit Poster
                        </Button>
                    </div>
                )}

                {/* Action buttons for completed Instagram posts */}
                {isCompleted && !isDeleted && !isPublished && (
                    <div className="flex gap-2 pt-1">
                        {onPostNow && (
                            <Button
                                size="sm"
                                className="flex-1 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black uppercase tracking-wider hover:from-pink-600 hover:to-rose-600 shadow-sm disabled:opacity-60 transition-all"
                                onClick={handlePostNow}
                                disabled={isPosting}
                            >
                                {isPosting ? (
                                    <><Sparkles className="w-3 h-3 mr-1.5 animate-spin" /> Publishing...</>
                                ) : (
                                    <><Send className="w-3 h-3 mr-1.5" /> Post Now</>
                                )}
                            </Button>
                        )}
                        {onRegenerate && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-violet-200 text-violet-600 text-[10px] font-black uppercase tracking-wider hover:bg-violet-50 disabled:opacity-50"
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                            >
                                {isRegenerating ? (
                                    <Sparkles className="w-3 h-3 animate-spin" />
                                ) : (
                                    <><RefreshCw className="w-3 h-3 mr-1" /> Regenerate</>
                                )}
                            </Button>
                        )}
                    </div>
                )}
                {isPublished && (
                    <div className="flex items-center gap-2 pt-1 px-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Published</span>
                    </div>
                )}

                {/* Error message + Regenerate button for failed posters */}
                {isFailed && (
                    <div className="space-y-2">
                        {job.error_message && (
                            <p className="text-[10px] text-red-500 font-medium line-clamp-2">{job.error_message}</p>
                        )}
                        {onRegenerate && (
                            <Button
                                size="sm"
                                className="w-full h-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider hover:from-violet-700 hover:to-indigo-700 shadow-sm disabled:opacity-60"
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                            >
                                {isRegenerating ? (
                                    <><Sparkles className="w-3 h-3 mr-1.5 animate-spin" /> Queuing...</>
                                ) : (
                                    <><RefreshCw className="w-3 h-3 mr-1.5" /> Regenerate</>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Poster Jobs Grid (shows ALL poster jobs: completed with images, active with progress) ---
export const PosterJobsGrid = ({ posterJobs, onDeletePost, onRegeneratePost, onPostNowPost, onEditPoster }: { posterJobs: any[]; onDeletePost?: (id: string) => void; onRegeneratePost?: (jobId: string) => void; onPostNowPost?: (jobId: string) => void; onEditPoster?: (jobId: string) => void }) => {
    const [viewImage, setViewImage] = useState<{
        url: string;
        title: string;
        businessValue?: string;
        caption?: string;
        hashtags?: string;
        linkedinArticle?: string;
        platform?: string;
        format?: string;
        slides?: Array<{ slide_number?: number; image_url: string; status?: string }>;
        zipUrl?: string;
    } | null>(null);

    // Show completed/published first, then in-progress, then queued
    const sortedJobs = [...posterJobs].sort((a, b) => {
        const order: Record<string, number> = {
            "completed": 0, "html_ready": 0, "prompt_generating": 1, "image_generating": 2,
            "rendering": 3, "queued": 4, "failed": 5, "deleted": 6
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

    const activeJobs = posterJobs.filter(j => ["prompt_generating", "image_generating", "rendering"].includes(j.status));
    const completedCount = posterJobs.filter(j => j.status === "completed" || j.status === "html_ready").length;

    return (
        <>
            <ImageModal
                isOpen={!!viewImage}
                onClose={() => setViewImage(null)}
                imageUrl={viewImage?.url || ""}
                title={viewImage?.title || ""}
                businessValue={viewImage?.businessValue}
                caption={viewImage?.caption}
                hashtags={viewImage?.hashtags}
                linkedinArticle={viewImage?.linkedinArticle}
                platform={viewImage?.platform}
                format={viewImage?.format}
                slides={viewImage?.slides}
                zipUrl={viewImage?.zipUrl}
            />
            <Card className="border-gray-100 shadow-sm rounded-[2rem] overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <CardHeader className="px-8 pt-8 pb-4 border-none flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-gray-900">Content Gallery</CardTitle>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-widest">
                                {completedCount}/{posterJobs.length} Complete
                                {activeJobs.length > 0 && <span className="text-violet-500 ml-2">· {activeJobs.length} Active</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">

                        {activeJobs.length > 0 && (
                            <Badge className="bg-violet-600 text-white border-none text-[9px] font-black uppercase tracking-widest animate-pulse">
                                {activeJobs.length} Generating
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sortedJobs.map((job) => (
                            <PosterJobCard
                                key={job.id}
                                job={job}
                                onDelete={onDeletePost}
                                onRegenerate={onRegeneratePost}
                                onPostNow={onPostNowPost}
                                onEditPoster={onEditPoster}
                                onView={(url, title, businessValue, caption, hashtags, linkedinArticle, platform, slides, zipUrl, format) => setViewImage({
                                    url,
                                    title,
                                    businessValue,
                                    caption,
                                    hashtags,
                                    linkedinArticle,
                                    platform,
                                    slides,
                                    zipUrl,
                                    format,
                                })}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </>
    );
};


// --- Live Worker Panel (shows real-time WebSocket activity) ---
export const LiveWorkerPanel = ({
    posterJobs,
    isConnected,
    latestEvent
}: {
    posterJobs: any[];
    isConnected: boolean;
    latestEvent: any;
}) => {
    const activeJobs = posterJobs.filter(j => ["prompt_generating", "image_generating", "rendering"].includes(j.status));
    const currentJob = activeJobs[0];

    if (!currentJob && !latestEvent) return null;

    const statusLabels: Record<string, string> = {
        prompt_generating: "🧠 Crafting high-context prompt with brand intelligence...",
        image_generating: "🎨 Generating poster using AI model...",
        rendering: "✨ Applying logo overlay and uploading to cloud...",
    };

    return (
        <Card className="border-violet-100 shadow-lg shadow-violet-500/5 rounded-[2rem] overflow-hidden mb-8 bg-white relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute top-0 right-0 p-6 flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} />
                <span className={cn("text-[9px] font-black uppercase tracking-widest", isConnected ? "text-emerald-600" : "text-gray-400")}>
                    {isConnected ? "Live" : "Reconnecting..."}
                </span>
            </div>
            <CardHeader className="px-8 pt-8 pb-4 border-none">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Sparkles className="w-6 h-6 text-white animate-spin-slow" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-gray-900">Autonomous Creative Engine</CardTitle>
                        <p className="text-[10px] text-violet-600 font-bold mt-1 uppercase tracking-widest leading-none flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                            {activeJobs.length > 0
                                ? `Processing ${activeJobs.length} poster${activeJobs.length > 1 ? 's' : ''}`
                                : "Monitoring pipeline..."
                            }
                        </p>
                    </div>
                </div>
            </CardHeader>
            {currentJob && (
                <CardContent className="p-8 pt-2">
                    <div className="bg-violet-50/50 rounded-2xl border border-violet-100/50 p-6 space-y-4">
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                Day {currentJob.content_day} — {currentJob.poster_idea}
                            </span>
                            <p className="text-sm font-bold text-gray-800 leading-relaxed">
                                {statusLabels[currentJob.status] || "Processing..."}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Progress</span>
                                <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">{currentJob.progress}%</span>
                            </div>
                            <div className="h-3 bg-white rounded-full overflow-hidden border border-violet-100">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${currentJob.progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                <span className={currentJob.progress >= 10 ? "text-violet-500" : ""}>Prompt</span>
                                <span className={currentJob.progress >= 40 ? "text-violet-500" : ""}>Image Gen</span>
                                <span className={currentJob.progress >= 70 ? "text-violet-500" : ""}>Render</span>
                                <span className={currentJob.progress >= 100 ? "text-emerald-500" : ""}>Done</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};


