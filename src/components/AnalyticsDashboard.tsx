import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { weezAPI } from "@/services/weezAPI";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";
import {
    TrendingUp,
    Users,
    Eye,
    MessageSquare,
    RefreshCw,
    ArrowUpRight,
    Heart,
    Instagram,
    Bookmark,
    BrainCircuit,
    Activity,
    Target,
    Zap,
    Cpu,
    Sparkles,
    ChevronRight,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const AnalyticsDashboard = () => {
    const { currentSpace } = useAuth();
    const [data, setData] = useState<any[]>([]);
    const [recentMedia, setRecentMedia] = useState<any[]>([]);
    const [account, setAccount] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (currentSpace?.id) {
            initDashboard();
        }
    }, [currentSpace?.id]);

    const initDashboard = async () => {
        setIsLoading(true);
        try {
            const [history, status, media] = await Promise.all([
                weezAPI.getAnalytics(currentSpace!.id),
                weezAPI.getInstagramStatus(currentSpace!.id),
                weezAPI.getRecentMedia(currentSpace!.id)
            ]);
            setData(history || []);
            setAccount(status);
            setRecentMedia(media || []);
        } catch (e) {
            console.error("Initialization error:", e);
            toast.error("Failed to load analytics");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await weezAPI.syncAnalytics(currentSpace!.id);
            const [history, status, media] = await Promise.all([
                weezAPI.getAnalytics(currentSpace!.id),
                weezAPI.getInstagramStatus(currentSpace!.id),
                weezAPI.getRecentMedia(currentSpace!.id)
            ]);
            setData(history);
            setAccount(status);
            setRecentMedia(media);
            toast.success("Intelligence engine synced");
        } catch (error: any) {
            toast.error("Sync handshake failed");
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-20 gap-10">
                <div className="relative">
                    <div className="w-40 h-40 border-2 border-primary/5 border-t-primary rounded-[3rem] animate-spin duration-[3s]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BrainCircuit className="w-12 h-12 text-primary animate-pulse" />
                    </div>
                    {/* Cinematic Scanning Line */}
                    <div className="absolute -inset-4 border border-primary/10 rounded-[3.5rem] overflow-hidden">
                        <div className="w-full h-1/2 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-scan" style={{ animationDuration: '4s' }} />
                    </div>
                </div>
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full">
                        <Cpu className="w-3 h-3 text-primary animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Data Weaver Active</span>
                    </div>
                    <h3 className="text-3xl font-black tracking-tight text-foreground uppercase">Aggregating Insights.</h3>
                    <div className="flex justify-center gap-1.5 opacity-30">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />)}
                    </div>
                </div>
            </div>
        );
    }

    const latest = data[data.length - 1] || {};
    const previous = data[data.length - 2] || {};

    const calculateChange = (current: number, prev: number) => {
        if (!prev) return "0.0";
        return (((current - prev) / prev) * 100).toFixed(1);
    };

    const stats = [
        {
            title: "Impressions",
            value: latest.impressions || 0,
            change: calculateChange(latest.impressions, previous.impressions),
            icon: TrendingUp,
            label: "Visibility",
            color: "text-blue-500",
        },
        {
            title: "Engagement",
            value: `${(latest.engagement_rate || 0).toFixed(2)}%`,
            change: calculateChange(latest.engagement_rate, previous.engagement_rate),
            icon: Target,
            label: "Velocity",
            color: "text-purple-500",
        },
        {
            title: "Fan Base",
            value: latest.follower_count || 0,
            change: calculateChange(latest.follower_count, previous.follower_count),
            icon: Users,
            label: "Audience",
            color: "text-emerald-500",
        },
        {
            title: "Signal Reach",
            value: latest.total_likes || 0,
            change: calculateChange(latest.total_likes, previous.total_likes),
            icon: Activity,
            label: "Traction",
            color: "text-orange-500",
        },
    ];

    return (
        <div className="space-y-12 pb-32 max-w-[1400px] mx-auto px-4 md:px-0">

            {/* Zen Stats Overview */}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 pt-10">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="group border-none bg-white hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] rounded-[2.5rem] transition-all duration-700 overflow-hidden text-left p-8">
                        <div className="flex flex-col h-full justify-between gap-10">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{stat.label}</span>
                                    <h4 className="text-sm font-bold text-foreground/80">{stat.title}</h4>
                                </div>
                                <div className={cn("p-2.5 rounded-2xl bg-secondary group-hover:bg-primary transition-colors duration-500", stat.color)}>
                                    <stat.icon className="w-5 h-5 group-hover:text-white transition-colors duration-500" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-4xl font-black tracking-tighter">{stat.value}</div>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1",
                                        Number(stat.change) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                    )}>
                                        {Number(stat.change) >= 0 ? "+" : ""}{stat.change}%
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Delta Trace</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Performance Visualizers */}
            <div className="grid gap-10 lg:grid-cols-2">
                <Card className="border-none bg-white rounded-[3rem] p-10 space-y-10 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black tracking-tight uppercase">Visibility Blueprint.</h3>
                            <p className="text-xs font-bold text-muted-foreground opacity-40">Aggregated Page Impressions</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="created_at"
                                    fontSize={10}
                                    fontWeight="bold"
                                    tickFormatter={(str) => new Date(str).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={15}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="impressions"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorImp)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="border-none bg-white rounded-[3rem] p-10 space-y-10 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black tracking-tight uppercase">Intelligence Flow.</h3>
                            <p className="text-xs font-bold text-muted-foreground opacity-40">Historical Engagement Rate</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                            <Zap className="w-5 h-5 text-purple-500" />
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <XAxis
                                    dataKey="created_at"
                                    fontSize={10}
                                    fontWeight="bold"
                                    tickFormatter={(str) => new Date(str).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={15}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                                />
                                <Line
                                    type="stepAfter"
                                    dataKey="engagement_rate"
                                    stroke="#8b5cf6"
                                    strokeWidth={4}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Post Feed Analysis */}
            <div className="space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest border-none">Active Feed</Badge>
                            <div className="h-px w-10 bg-border" />
                        </div>
                        <h3 className="text-4xl font-black tracking-tighter">Tactical Analysis.</h3>
                        <p className="text-sm font-medium text-muted-foreground opacity-50">Detailed performance metrics per creative artifact.</p>
                    </div>

                    <Button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="h-14 px-10 rounded-2xl bg-foreground text-background font-black uppercase tracking-widest text-[10px] gap-3 active:scale-95 transition-all shadow-xl shadow-black/5 hover:bg-primary"
                    >
                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Handshake Engine
                    </Button>
                </div>

                <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
                    {recentMedia.map((post, idx) => (
                        <Card key={post.id} className="group border-none bg-white hover:shadow-[0_60px_100px_rgba(0,0,0,0.08)] transition-all duration-700 rounded-[3rem] overflow-hidden flex flex-col relative">
                            <div className="aspect-square relative overflow-hidden bg-[#111]">
                                {post.media_type === "VIDEO" ? (
                                    <div className="w-full h-full bg-secondary flex flex-col items-center justify-center gap-4">
                                        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-xl">
                                            <Instagram className="w-8 h-8 text-white opacity-40" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Video Content</span>
                                    </div>
                                ) : (
                                    <img
                                        src={post.media_url || post.thumbnail_url}
                                        alt={post.caption}
                                        className="w-full h-full object-cover transition-all duration-[2s] group-hover:scale-110 group-hover:opacity-60"
                                    />
                                )}
                                <div className="absolute top-6 left-6 flex items-center gap-2">
                                    <Badge className="bg-black/60 backdrop-blur-xl border-white/10 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                                        {post.media_type}
                                    </Badge>
                                </div>
                                <div className="absolute bottom-6 right-6 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[8px] font-black text-white uppercase tracking-widest">
                                    0{idx + 1} // Artifact
                                </div>
                            </div>

                            <CardContent className="p-10 space-y-10 flex-1 flex flex-col justify-between">
                                <p className="text-base font-bold text-foreground/70 leading-relaxed line-clamp-3">
                                    "{post.caption || "No contextual data available."}"
                                </p>

                                <div className="space-y-6 pt-10 border-t border-border/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-8">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                                                    <span className="text-sm font-black">{post.like_count || 0}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-sm font-black">{post.comments_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black text-muted-foreground uppercase opacity-30 tracking-widest">
                                            {new Date(post.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <button className="w-full h-12 rounded-2xl bg-secondary flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 hover:opacity-100 hover:bg-primary hover:text-white transition-all">
                                        Exploration Intelligence
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
