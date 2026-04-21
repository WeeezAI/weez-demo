import { useState, useEffect } from "react";
import {
    Globe,
    Linkedin,
    Instagram,
    CheckCircle2,
    AlertCircle,
    Link2,
    RefreshCw,
    Zap,
    ExternalLink,
    Loader2,
    Check,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { weezAPI } from "@/services/weezAPI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ConnectorsViewProps {
    brandId: string;
}

interface ConnectorStatus {
    type: string;
    connected: boolean;
    identifier?: string;
}

export default function ConnectorsView({ brandId }: ConnectorsViewProps) {
    const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [isConnectingWebsite, setIsConnectingWebsite] = useState(false);
    const [isResyncing, setIsResyncing] = useState(false);

    const fetchStatus = async () => {
        try {
            setIsLoading(true);
            const data = await weezAPI.getConnectorsStatus(brandId);
            setConnectors(data.connectors || []);

            // Set website URL if already connected
            const web = data.connectors.find((c: any) => c.type === "website");
            if (web?.identifier) setWebsiteUrl(web.identifier);
        } catch (err) {
            console.error("Failed to fetch connectors status:", err);
            toast.error("Could not load connector status");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (brandId) fetchStatus();
    }, [brandId]);

    const handleConnectWebsite = async () => {
        if (!websiteUrl) return;
        try {
            setIsConnectingWebsite(true);
            await weezAPI.connectWebsite(brandId, websiteUrl);
            toast.success("Website connected! Brand memory recalibration started.");
            fetchStatus();
        } catch (err: any) {
            toast.error(err.message || "Failed to connect website");
        } finally {
            setIsConnectingWebsite(false);
        }
    };

    const handleConnectLinkedIn = () => {
        const authUrl = weezAPI.getLinkedInAuthUrl(brandId);
        window.location.href = authUrl;
    };

    const handleConnectInstagram = () => {
        const authUrl = weezAPI.getInstagramAuthUrl(brandId);
        window.location.href = authUrl;
    };

    const handleResyncAll = async () => {
        try {
            setIsResyncing(true);
            await weezAPI.triggerAnalysis(brandId);
            toast.success("Brand Memory re-sync triggered! Analyzing all sources...");
            fetchStatus();
        } catch (err) {
            toast.error("Failed to trigger re-sync");
        } finally {
            setIsResyncing(false);
        }
    };

    const isConnected = (type: string) => connectors.find(c => c.type === type)?.connected;
    const getIdentifier = (type: string) => connectors.find(c => c.type === type)?.identifier;

    const handleDisconnect = async (platformId: string) => {
        try {
            if (platformId === "linkedin") {
                await weezAPI.disconnectLinkedIn(brandId);
                toast.success("LinkedIn disconnected successfully.");
            }
            fetchStatus();
        } catch (err: any) {
            toast.error(err.message || `Failed to disconnect ${platformId}`);
        }
    };

    const CONNECTOR_METADATA = [
        {
            id: "instagram",
            name: "Instagram",
            description: "Direct connection to your professional Instagram profile. Tracks visuals, captions, and engagement patterns.",
            icon: Instagram,
            color: "text-pink-500",
            bg: "bg-pink-500/10",
            action: handleConnectInstagram,
            comingSoon: false
        },
        {
            id: "linkedin",
            name: "LinkedIn",
            description: "Connect your LinkedIn profile to analyze your professional voice, industry positioning, and B2B messaging.",
            icon: Linkedin,
            color: "text-blue-600",
            bg: "bg-blue-600/10",
            action: handleConnectLinkedIn,
            comingSoon: false
        },
        {
            id: "website",
            name: "Official Website",
            description: "Your primary source of truth. We crawl your site to extract core services, product details, and brand vision.",
            icon: Globe,
            color: "text-emerald-600",
            bg: "bg-emerald-600/10",
            action: null, // Handled by inline form
            comingSoon: false
        }
    ];

    return (
        <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#F9FAFB]/50">
            <div className="max-w-4xl mx-auto space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <Badge className="bg-black/5 text-black border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">Connectors Base</Badge>
                        <h2 className="text-4xl font-black text-zinc-900 tracking-tight leading-none uppercase">Source Intelligence</h2>
                        <p className="text-sm text-zinc-500 font-medium">Connect all your brand touchpoints to build a unified, authoritative Brand Memory.</p>
                    </div>
                    <Button
                        onClick={handleResyncAll}
                        disabled={isResyncing}
                        className="h-12 px-6 rounded-2xl bg-black text-white font-bold gap-3 shadow-xl transition-all hover:scale-105 active:scale-95"
                    >
                        {isResyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Recalibrate Brand Memory
                    </Button>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 gap-6">
                    {CONNECTOR_METADATA.map((platform) => {
                        const connected = isConnected(platform.id);
                        const identifier = getIdentifier(platform.id);
                        const Icon = platform.icon;

                        return (
                            <Card key={platform.id} className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500">
                                <CardContent className="p-8">
                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        {/* Left Side: Identity */}
                                        <div className="flex-1 space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500", platform.bg, platform.color, "group-hover:scale-110")}>
                                                    <Icon className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight">{platform.name}</h3>
                                                        {platform.comingSoon && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                                <Clock className="w-3 h-3" />
                                                                <span className="text-[9px] font-black uppercase tracking-wider">Coming Soon</span>
                                                            </div>
                                                        )}
                                                        {!platform.comingSoon && connected && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span className="text-[9px] font-black uppercase tracking-wider">Active</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                                                        {platform.comingSoon ? 'Verification Pending — Launching Soon' : connected ? `Connected as ${identifier || 'Verified Account'}` : 'Not Integrated'}
                                                    </p>
                                                </div>
                                            </div>

                                            <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                                                {platform.description}
                                            </p>

                                            {/* Specific behavior for Website */}
                                            {platform.id === "website" && (
                                                <div className="flex items-center gap-2 mt-4">
                                                    <div className="relative flex-1">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                                                            <Link2 className="w-4 h-4" />
                                                        </div>
                                                        <Input
                                                            placeholder="https://yourbrand.com"
                                                            value={websiteUrl}
                                                            onChange={(e) => setWebsiteUrl(e.target.value)}
                                                            className="h-12 pl-12 pr-4 rounded-xl border-zinc-100 bg-zinc-50 focus:ring-black focus:border-black font-medium"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={handleConnectWebsite}
                                                        disabled={isConnectingWebsite || !websiteUrl}
                                                        className="h-12 px-6 rounded-xl bg-black text-white font-bold gap-2"
                                                    >
                                                        {isConnectingWebsite ? <Loader2 className="w-4 h-4 animate-spin" /> : connected ? 'Update' : 'Verify'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Action/Status */}
                                        <div className="md:w-48 w-full flex flex-col gap-3">
                                            {platform.comingSoon ? (
                                                <div className="space-y-3">
                                                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
                                                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Status</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                            <span className="text-xs font-bold text-amber-700">Under Verification</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        disabled
                                                        className="h-12 w-full rounded-xl border border-zinc-100 bg-zinc-50 text-zinc-300 font-bold gap-2 cursor-not-allowed"
                                                    >
                                                        <Clock className="w-4 h-4" /> Coming Soon
                                                    </Button>
                                                </div>
                                            ) : !connected ? (
                                                platform.id !== "website" && (
                                                    <Button
                                                        onClick={platform.action!}
                                                        className="h-12 w-full rounded-xl border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 font-bold gap-2 transition-all hover:border-black"
                                                    >
                                                        <Zap className="w-4 h-4" /> Connect {platform.name}
                                                    </Button>
                                                )
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
                                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Health Check</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            <span className="text-xs font-bold text-zinc-900">Synchronized</span>
                                                        </div>
                                                    </div>
                                                    {platform.id !== "website" && (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleDisconnect(platform.id)}
                                                            className="h-10 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-zinc-100 text-zinc-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
                                                        >
                                                            Disconnect
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                                {connected && (
                                    <div className="px-8 py-3 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <RefreshCw className="w-3 h-3 text-zinc-400" />
                                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Live Sync Enabled</span>
                                            </div>
                                            <div className="w-px h-3 bg-zinc-200" />
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Last update: real-time</span>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>

                {/* Info Box */}
                <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-zinc-900 to-black text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                        <div className="w-20 h-20 rounded-[2rem] bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10 shrink-0">
                            <Zap className="w-10 h-10 text-white fill-white" />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Unified Brand Intelligence</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                                Weez AI doesn't just store data—it cross-references your Instagram visuals, LinkedIn professional voice, and website core-identity to build an authoritative <strong>Brand Memory Object</strong>. This results in 99% accuracy in autonomous content generation.
                            </p>
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-black animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Scanning Connectors...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
