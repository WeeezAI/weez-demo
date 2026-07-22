import { useState, useEffect, useCallback } from "react";
import {
    CheckCircle2,
    RefreshCw,
    Loader2,
    ShieldCheck,
    Plug,
    ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { weezAPI } from "@/services/weezAPI";
import {
    getIntegrationsStatus,
    getIntegrationAuthorizeUrl,
    disconnectIntegration,
} from "@/services/integrationsAPI";
import {
    LinkedInLogo,
    GmailLogo,
    OutlookLogo,
    GoogleCalendarLogo,
} from "@/components/brand-logos";
import { Button } from "@/components/ui/button";
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

// The four integrations that matter. Each renders its real brand logo and owns
// its own connect / disconnect wiring. `accent` drives the connected-state glow.
type ConnectorId = "linkedin" | "gmail" | "outlook" | "google_calendar";

interface ConnectorMeta {
    id: ConnectorId;
    name: string;
    tagline: string;
    description: string;
    Logo: (props: { className?: string }) => JSX.Element;
    accent: string;   // tailwind text color for the pulse/glow
    glow: string;     // tailwind shadow color for the connected ring
}

const CONNECTORS: ConnectorMeta[] = [
    {
        id: "linkedin",
        name: "LinkedIn",
        tagline: "B2B publishing & signals",
        description:
            "Publish directly to your LinkedIn profile or page and let Weez read your professional voice for sharper outbound.",
        Logo: LinkedInLogo,
        accent: "text-[#0A66C2]",
        glow: "shadow-[0_0_0_4px_rgba(10,102,194,0.12)]",
    },
    {
        id: "gmail",
        name: "Gmail",
        tagline: "Outbound email",
        description:
            "Send outbound email from your Gmail mailbox — Max composes, checks, and sends replies straight from your inbox.",
        Logo: GmailLogo,
        accent: "text-[#EA4335]",
        glow: "shadow-[0_0_0_4px_rgba(234,67,53,0.12)]",
    },
    {
        id: "outlook",
        name: "Outlook",
        tagline: "Outbound email",
        description:
            "Connect your Microsoft Outlook mailbox so Max can send and track outbound email across your Microsoft 365 account.",
        Logo: OutlookLogo,
        accent: "text-[#0F6CBD]",
        glow: "shadow-[0_0_0_4px_rgba(15,108,189,0.12)]",
    },
    {
        id: "google_calendar",
        name: "Google Calendar",
        tagline: "Meeting booking",
        description:
            "Let Max book meetings with your prospects automatically and keep every scheduled call in sync with your calendar.",
        Logo: GoogleCalendarLogo,
        accent: "text-[#34A853]",
        glow: "shadow-[0_0_0_4px_rgba(52,168,83,0.12)]",
    },
];

export default function ConnectorsView({ brandId }: ConnectorsViewProps) {
    const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // The connector whose "Connect" was just clicked (shows a spinner before the
    // browser navigates to the OAuth consent screen).
    const [connectingId, setConnectingId] = useState<ConnectorId | null>(null);
    const [disconnectingId, setDisconnectingId] = useState<ConnectorId | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const merged: ConnectorStatus[] = [];

            // LinkedIn status comes from the connectors API.
            try {
                const data = await weezAPI.getConnectorsStatus(brandId);
                const li = (data.connectors || []).find((c: any) => c.type === "linkedin");
                merged.push({
                    type: "linkedin",
                    connected: !!li?.connected,
                    identifier: li?.identifier,
                });
            } catch {
                merged.push({ type: "linkedin", connected: false });
            }

            // Gmail / Outlook / Google Calendar come from the mailbox+calendar
            // integrations API. One Google connection powers Gmail + Google
            // Calendar; one Microsoft connection powers Outlook.
            try {
                const status = await getIntegrationsStatus(brandId);
                const googleEmail = status.connections.find((c) => c.provider === "google")?.email;
                const microsoftEmail = status.connections.find((c) => c.provider === "microsoft")?.email;
                merged.push(
                    { type: "gmail", connected: status.connected.gmail, identifier: googleEmail },
                    { type: "outlook", connected: status.connected.outlook, identifier: microsoftEmail },
                    { type: "google_calendar", connected: status.connected.google_calendar, identifier: googleEmail },
                );
            } catch {
                merged.push(
                    { type: "gmail", connected: false },
                    { type: "outlook", connected: false },
                    { type: "google_calendar", connected: false },
                );
            }

            setConnectors(merged);
        } catch (err) {
            console.error("Failed to fetch connectors status:", err);
            toast.error("Could not load connector status");
        } finally {
            setIsLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        if (brandId) {
            setIsLoading(true);
            fetchStatus();
        }
    }, [brandId, fetchStatus]);

    // Re-check status whenever the user returns to the tab (e.g. after finishing
    // an OAuth consent flow in the same window), so the connected state appears
    // without a manual refresh.
    useEffect(() => {
        const onFocus = () => {
            if (brandId) fetchStatus();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [brandId, fetchStatus]);

    const isConnected = (id: string) => connectors.find((c) => c.type === id)?.connected;
    const getIdentifier = (id: string) => connectors.find((c) => c.type === id)?.identifier;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchStatus();
        setIsRefreshing(false);
    };

    const handleConnect = (id: ConnectorId) => {
        setConnectingId(id);
        try {
            if (id === "linkedin") {
                window.location.href = weezAPI.getLinkedInAuthUrl(brandId);
            } else {
                window.location.href = getIntegrationAuthorizeUrl(id, brandId);
            }
        } catch (err: any) {
            setConnectingId(null);
            toast.error(err?.message || `Failed to start ${id} connection`);
        }
    };

    const handleDisconnect = async (id: ConnectorId, name: string) => {
        setDisconnectingId(id);
        try {
            if (id === "linkedin") {
                await weezAPI.disconnectLinkedIn(brandId);
            } else {
                await disconnectIntegration(id, brandId);
            }
            toast.success(`${name} disconnected.`);
            await fetchStatus();
        } catch (err: any) {
            toast.error(err?.message || `Failed to disconnect ${name}`);
        } finally {
            setDisconnectingId(null);
        }
    };

    const connectedCount = CONNECTORS.filter((c) => isConnected(c.id)).length;

    return (
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-10 bg-[#F9FAFB]/60">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                    <div className="space-y-3">
                        <Badge className="bg-black/5 text-black border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest hover:bg-black/5">
                            Connectors
                        </Badge>
                        <h2 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight leading-none uppercase">
                            Connected accounts
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium max-w-lg">
                            Link your channels so Weez can publish, send outbound email, and book meetings on your behalf.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-2xl font-black text-zinc-900 leading-none">
                                {connectedCount}<span className="text-zinc-300">/{CONNECTORS.length}</span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                                Connected
                            </span>
                        </div>
                        <Button
                            onClick={handleRefresh}
                            disabled={isRefreshing || isLoading}
                            variant="outline"
                            className="h-11 px-4 rounded-2xl border-zinc-200 bg-white text-zinc-700 font-bold gap-2 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                        >
                            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Connector list */}
                {isLoading ? (
                    <div className="space-y-4">
                        {CONNECTORS.map((c) => (
                            <div
                                key={c.id}
                                className="h-28 rounded-[1.75rem] bg-white border border-zinc-100 animate-pulse"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {CONNECTORS.map((c) => {
                            const connected = !!isConnected(c.id);
                            const identifier = getIdentifier(c.id);
                            const isConnecting = connectingId === c.id;
                            const isDisconnecting = disconnectingId === c.id;
                            const Logo = c.Logo;

                            return (
                                <div
                                    key={c.id}
                                    className={cn(
                                        "group relative rounded-[1.75rem] bg-white border p-5 md:p-6 transition-all duration-500",
                                        connected
                                            ? "border-emerald-200/70 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.25)]"
                                            : "border-zinc-100 hover:border-zinc-200 hover:shadow-lg hover:shadow-black/[0.03]"
                                    )}
                                >
                                    <div className="flex items-center gap-4 md:gap-5">
                                        {/* Logo tile */}
                                        <div
                                            className={cn(
                                                "relative shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center transition-all duration-500 group-hover:scale-105",
                                                connected && c.glow
                                            )}
                                        >
                                            <Logo className="w-8 h-8 md:w-9 md:h-9" />
                                            {connected && (
                                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                                                    <span className="absolute inline-flex h-5 w-5 rounded-full bg-emerald-400/40 animate-ping" />
                                                    <CheckCircle2 className="relative w-5 h-5 text-emerald-500 fill-white animate-in zoom-in duration-500" />
                                                </span>
                                            )}
                                        </div>

                                        {/* Identity + status */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">
                                                    {c.name}
                                                </h3>
                                                {connected ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                                        </span>
                                                        <span className="text-[9px] font-black uppercase tracking-wider">Connected</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-200">
                                                        <span className="text-[9px] font-black uppercase tracking-wider">Not connected</span>
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1 truncate">
                                                {connected
                                                    ? identifier
                                                        ? identifier
                                                        : "Active"
                                                    : c.tagline}
                                            </p>
                                            <p className="hidden md:block text-sm text-zinc-500 font-medium leading-relaxed mt-2 pr-4">
                                                {c.description}
                                            </p>
                                        </div>

                                        {/* Action */}
                                        <div className="shrink-0">
                                            {connected ? (
                                                <Button
                                                    onClick={() => handleDisconnect(c.id, c.name)}
                                                    disabled={isDisconnecting}
                                                    variant="outline"
                                                    className="h-11 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-zinc-200 text-zinc-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                                                >
                                                    {isDisconnecting ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        "Disconnect"
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => handleConnect(c.id)}
                                                    disabled={isConnecting}
                                                    className="h-11 px-5 rounded-2xl bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-black transition-all hover:scale-[1.03] active:scale-95"
                                                >
                                                    {isConnecting ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Plug className="w-3.5 h-3.5" />
                                                            Connect
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Connected footer strip */}
                                    {connected && (
                                        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between animate-in fade-in duration-500">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className={cn("w-3.5 h-3.5", c.accent)} />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                    Live &amp; syncing in real time
                                                </span>
                                            </div>
                                            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Reassurance footer */}
                <div className="flex items-start gap-3 rounded-2xl bg-white border border-zinc-100 p-5">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-zinc-900">Your accounts stay yours</p>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                            Weez only uses the access you grant to publish, send outbound email, and book meetings. You can disconnect any account at any time.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
