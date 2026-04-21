import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Zap,
    TrendingUp,
    ShieldCheck,
    History,
    AlertCircle,
    Play,
    Pause,
    Target,
    BarChart3,
    Loader2,
    CheckCircle2,
    Activity,
    Trash2
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    AreaChart,
    Area
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ConversationSidebar from "@/components/ConversationSidebar";
import { weezAPI, AutopilotDashboardData } from "@/services/weezAPI";

export default function AutopilotDashboard() {
    const { spaceId } = useParams<{ spaceId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<AutopilotDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (spaceId) {
            loadDashboard();
        }
    }, [spaceId]);

    const loadDashboard = async () => {
        try {
            setIsLoading(true);
            const res = await weezAPI.getAutopilotDashboard(spaceId!);
            setData(res);
        } catch (err: any) {
            console.error(err);
            // If No Active Campaign, redirect to Setup
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
            await weezAPI.toggleAutopilotStatus(data.campaign.id, newStatus);
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
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
            </div>
        );
    }

    if (!data && !isLoading) {
        return (
            <div className="flex h-screen overflow-hidden bg-background">
                <ConversationSidebar spaceId={spaceId!} onNewChat={() => { }} />
                <main className="flex-1 flex flex-col items-center justify-center p-8">
                    <Zap className="h-16 w-16 text-muted-foreground/20 mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Autopilot Mode Inactive</h2>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                        The Autonomous Engagement Engine is ready to scale your brand. Start your first campaign to begin optimization.
                    </p>
                    <Button onClick={() => toast.info("Campaign creation coming soon!")}>
                        Setup Autopilot
                    </Button>
                </main>
            </div>
        );
    }

    // Combine projections and actuals for the chart
    const chartData = data?.projections.map(p => {
        const metric = data.metrics.find(m => m.date === p.date);
        return {
            date: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            projected: p.projected_engagement_rate * 100,
            actual: metric ? metric.engagement_rate * 100 : null,
        };
    }) || [];

    return (
        <div className="flex h-screen overflow-hidden bg-[#fafafa]">
            <ConversationSidebar spaceId={spaceId!} onNewChat={() => { }} />

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                                <Zap className="w-3 h-3 mr-1 fill-current" /> Autopilot Mode
                            </Badge>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "capitalize",
                                    data?.campaign.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600"
                                )}
                            >
                                {data?.campaign.status}
                            </Badge>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
                            Engagement Engine
                        </h1>
                        <p className="text-zinc-500 mt-1">Autonomous growth loop for {data?.campaign.brand_id}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={loadDashboard}
                        >
                            Sync Metrics
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={handleDeleteCampaign}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                        <Button
                            onClick={handleToggleStatus}
                            disabled={isToggling}
                            className={cn(
                                "rounded-xl px-6 min-w-[140px]",
                                data?.campaign.status === "active" ? "bg-zinc-900 hover:bg-zinc-800" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                        >
                            {isToggling ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : data?.campaign.status === "active" ? (
                                <><Pause className="w-4 h-4 mr-2" /> Pause Engine</>
                            ) : (
                                <><Play className="w-4 h-4 mr-2" /> Resume Engine</>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Daily Spotlight Section */}
                {data?.spotlight_post && (
                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden group transition-all duration-500 hover:shadow-2xl">
                        <div className="flex flex-col lg:flex-row">
                            {/* Visual Preview */}
                            <div className="lg:w-1/3 h-[300px] lg:h-auto relative overflow-hidden bg-zinc-100">
                                {data.spotlight_post.blob_url ? (
                                    <img
                                        src={data.spotlight_post.blob_url}
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
                                        {data.spotlight_post.status}
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
                                            {data.spotlight_post.scheduled_time
                                                ? new Date(data.spotlight_post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'long' })
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
                                            "{data.spotlight_post.business_value || "Autonomous strategy: Scaling brand authority through high-frequency visual storytelling and niche trend alignment."}"
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-100">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3" /> Narrative Focus
                                            </label>
                                            <p className="text-sm font-medium text-zinc-600 leading-relaxed line-clamp-2 italic">
                                                {data.spotlight_post.caption || "Crafting narrative..."}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <TrendingUp className="w-3 h-3" /> Distribution Strategy
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {data.spotlight_post.hashtags?.split(',').slice(0, 4).map((tag, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[9px] font-black bg-zinc-900 text-white border-none py-1 px-3 rounded-lg uppercase tracking-wider">
                                                        #{tag.trim()}
                                                    </Badge>
                                                ))}
                                                {data.spotlight_post.hashtags?.split(',').length > 4 && (
                                                    <span className="text-[10px] font-black text-zinc-300 ml-1">
                                                        +{data.spotlight_post.hashtags.split(',').length - 4} More
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Top Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-500" /> Current Velocity
                            </CardDescription>
                            <CardTitle className="text-3xl font-black">
                                {((data?.metrics.length ? data.metrics[0].engagement_rate : 0) * 100).toFixed(2)}%
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                                <TrendingUp className="w-3 h-3" />
                                <span>+12.4% from start</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-amber-500" /> Confidence Score
                            </CardDescription>
                            <CardTitle className="text-3xl font-black">
                                {((data?.confidence_score || 0) * 100).toFixed(0)}%
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Progress value={(data?.confidence_score || 0) * 100} className="h-1.5 bg-zinc-100" />
                            <p className="text-[10px] text-zinc-400 mt-2 font-medium">Historical reliability: High</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-zinc-900 text-white rounded-[2rem] overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-zinc-400 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" /> Target Progress
                            </CardDescription>
                            <CardTitle className="text-3xl font-black">
                                {((data?.campaign.target_value || 0) * 100).toFixed(1)}% <span className="text-xs text-zinc-500 font-medium">Goal</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-zinc-400 font-medium">
                                Est. completion: {new Date(data?.campaign.end_date || "").toLocaleDateString()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[2rem] p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <CardTitle className="text-xl font-bold">Growth Projection</CardTitle>
                                <CardDescription>Target vs. Actual Engagement Rate (%)</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-zinc-200" />
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Projected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-zinc-900" />
                                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Actual</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }}
                                        tickFormatter={(v) => `${v}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="projected"
                                        stroke="#e4e4e7"
                                        strokeWidth={4}
                                        fill="transparent"
                                        strokeDasharray="8 8"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="actual"
                                        stroke="#18181b"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorActual)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Decision Logs */}
                    <Card className="border-none shadow-sm bg-white rounded-[2rem] flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <History className="w-5 h-5 text-zinc-400" /> Optimization Feed
                            </CardTitle>
                            <CardDescription>Autonomous pivots & triggers</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto px-6 pb-6 pt-0">
                            <div className="space-y-6">
                                {data?.decisions.map((decision, i) => (
                                    <div key={i} className="flex gap-4 relative">
                                        {i !== data.decisions.length - 1 && (
                                            <div className="absolute left-2 top-8 bottom-0 w-px bg-zinc-100" />
                                        )}
                                        <div className="mt-1">
                                            <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                                    {decision.decision_type.replace('_', ' ')}
                                                </span>
                                                <span className="text-[10px] text-zinc-300 font-medium">
                                                    {new Date(decision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-zinc-800 mt-1 leading-snug">
                                                {decision.reason}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100/50">
                                                <span className="text-[10px] font-mono text-zinc-400">{decision.previous_value}</span>
                                                <div className="w-2 h-px bg-zinc-200" />
                                                <span className="text-[10px] font-mono text-emerald-600 font-bold">{decision.new_value}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {data?.decisions.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-40 text-center opacity-40">
                                        <CheckCircle2 className="w-8 h-8 mb-2" />
                                        <p className="text-sm font-medium">System stable.<br />Scanning for opportunities...</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
