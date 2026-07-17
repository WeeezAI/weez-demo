import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Users, ArrowLeft, BarChart3, Zap, LayoutDashboard, Database, Activity, Linkedin, Target, Link2, PenLine, Radar, Signal as SignalIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getHubSpotStatus, getHubSpotAuthorizeUrl } from "@/services/salesAPI";
import logo from "@/assets/weez-logo.png";

interface ConversationSidebarProps {
  onNewChat: () => void;
  onSelectConversation?: (conversationId: string) => void;
  currentConversationId?: string | null;
  spaceId: string;
}

const ConversationSidebar = ({
  spaceId,
  onNewChat,
  onSelectConversation
}: ConversationSidebarProps) => {
  const { exitSpace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // HubSpot connection status
  const [hubspotConnected, setHubspotConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    
    const checkStatus = () => {
      getHubSpotStatus(spaceId)
        .then((res) => setHubspotConnected(res.connected))
        .catch(() => setHubspotConnected(false));
    };

    checkStatus();

    // Refresh status when user returns to the tab (e.g. after OAuth)
    window.addEventListener("focus", checkStatus);
    return () => window.removeEventListener("focus", checkStatus);
  }, [spaceId, location.pathname]); 

  const handleBackToSpaces = () => {
    exitSpace();
    navigate("/spaces");
  };

  // The AI marketing workforce. Nina (the CMO) is the home/command center; the
  // three specialists report up to her. Planner / LinkedIn / Growth are
  // intentionally not surfaced here — the founder runs everything through Nina.
  const navItems = [
    {
      label: "Nina",
      role: "CMO",
      path: `/ninna/${spaceId}`,
      icon: LayoutDashboard,
      color: "text-indigo-500"
    },
    {
      label: "Robert",
      role: "Content",
      path: `/robert/${spaceId}`,
      icon: PenLine,
      color: "text-violet-500"
    },
    {
      label: "Eva",
      role: "Signals",
      path: `/eva/${spaceId}`,
      icon: SignalIcon,
      color: "text-emerald-500"
    },
    {
      label: "Max",
      role: "Outreach",
      path: `/sales/${spaceId}`,
      icon: Radar,
      color: "text-orange-500"
    },
  ];

  return (
    <div className="w-full md:w-64 lg:w-72 bg-background/20 backdrop-blur-3xl border-r border-border/30 flex flex-col h-screen flex-shrink-0 relative overflow-hidden transition-all duration-500">

      {/* Brand Navigation */}
      <div className="p-4 pb-2">
        <Button
          variant="ghost"
          onClick={handleBackToSpaces}
          className="group h-8 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all font-black text-[9px] uppercase tracking-[0.2em] gap-2"
        >
          <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
          Spaces
        </Button>
      </div>

      <div className="flex-1 min-h-0 pt-4">
        <ScrollArea className="h-full px-3">
          <div className="space-y-6">

            {/* Core Navigation */}
            <div className="space-y-1">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">Workforce</p>
              {navItems.map((item) => {
                const isActive = location.pathname.includes(item.path);
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-300 group relative",
                      isActive
                        ? "bg-primary/5 text-primary shadow-sm border border-primary/10"
                        : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 transition-all duration-300 shrink-0",
                      isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary"
                    )} />
                    <span className="flex flex-col items-start leading-tight min-w-0">
                      <span className="text-xs font-bold tracking-tight">{item.label}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">{item.role}</span>
                    </span>

                    {isActive && (
                      <div className="absolute right-3 w-1 h-1 bg-accent rounded-full shadow-glow" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* System Status */}
            <div className="space-y-3 pt-6 border-t border-border/20">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">Status</p>

              <div className="px-3 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                    <span className="text-[10px] font-bold text-foreground/50">Network</span>
                  </div>
                  <span className="text-[8px] font-mono opacity-30">Online</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-foreground/50">AI Core</span>
                  </div>
                  <span className="text-[8px] font-mono opacity-30">Ready</span>
                </div>
              </div>
            </div>

            {/* Integrations */}
            <div className="space-y-3 pt-4 border-t border-border/20">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">Integrations</p>

              <div className="px-3 space-y-3">
                {/* Connectors — direct entry to the connected-accounts manager
                    (the connectors tab in Autonomous Marketing). This is the
                    hub for connecting Gmail/Outlook, LinkedIn, Instagram, etc. */}
                <button
                  onClick={() => navigate(`/autonomous-marketing/${spaceId}?tab=connectors`)}
                  className="flex items-center justify-between w-full group rounded-2xl px-3 py-3 transition-all duration-300 hover:bg-secondary/40 border border-transparent hover:border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 group-hover:scale-110 transition-all shadow-sm">
                      <Link2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[11px] font-black text-foreground/80 tracking-tight">Connectors</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-foreground/60 transition-colors">
                        Manage accounts
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => {
                    if (hubspotConnected) {
                      navigate(`/leads/${spaceId}`);
                    } else {
                      // Navigate to the connectors tab in Autonomous Marketing
                      navigate(`/autonomous-marketing/${spaceId}?tab=connectors`);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between w-full group rounded-2xl px-3 py-3 transition-all duration-300",
                    hubspotConnected
                      ? "hover:bg-secondary/40"
                      : "bg-orange-500/[0.03] border border-orange-500/10 hover:bg-orange-500/[0.06] hover:border-orange-500/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm",
                      hubspotConnected
                        ? "bg-emerald-500/10"
                        : "bg-orange-500/10 group-hover:scale-110"
                    )}>
                      <Target className={cn(
                        "w-4 h-4 transition-colors",
                        hubspotConnected ? "text-emerald-500" : "text-orange-500"
                      )} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[11px] font-black text-foreground/80 tracking-tight">HubSpot CRM</span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest transition-all",
                        hubspotConnected
                          ? "text-emerald-500/80"
                          : "text-orange-500 group-hover:translate-x-0.5"
                      )}>
                        {hubspotConnected === null
                          ? "Syncing…"
                          : hubspotConnected
                            ? "Connected"
                            : "Click to Connect →"}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    hubspotConnected
                      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      : "bg-orange-400 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                  )} />
                </button>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

      {/* Footer Branding */}
      <div className="p-4 border-t border-border/20 bg-background/5">
        <div className="flex items-center gap-2 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer">
          <img src={logo} alt="Weez AI" className="h-4 w-auto" />
          <span className="text-[7px] font-black tracking-tighter mt-0.5">v2.4.0</span>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;
