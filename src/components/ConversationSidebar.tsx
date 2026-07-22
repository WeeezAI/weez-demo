import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  PenLine,
  Radar,
  Signal as SignalIcon,
  Link2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
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
  onSelectConversation,
}: ConversationSidebarProps) => {
  const { exitSpace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      color: "text-indigo-500",
      tint: "bg-indigo-500/10",
    },
    {
      label: "Robert",
      role: "Content",
      path: `/robert/${spaceId}`,
      icon: PenLine,
      color: "text-violet-500",
      tint: "bg-violet-500/10",
    },
    {
      label: "Eva",
      role: "Signals",
      path: `/eva/${spaceId}`,
      icon: SignalIcon,
      color: "text-emerald-500",
      tint: "bg-emerald-500/10",
    },
    {
      label: "Max",
      role: "Outreach",
      path: `/sales/${spaceId}`,
      icon: Radar,
      color: "text-orange-500",
      tint: "bg-orange-500/10",
    },
  ];

  const isConnectorsActive = location.pathname.includes("/autonomous-marketing");

  return (
    <div className="w-full md:w-64 lg:w-72 bg-background/20 backdrop-blur-3xl border-r border-border/30 flex flex-col h-screen flex-shrink-0 relative overflow-hidden transition-all duration-500">

      {/* Back to Spaces */}
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
          <div className="space-y-7">

            {/* Workforce */}
            <div className="space-y-1.5">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Workforce
              </p>
              {navItems.map((item) => {
                const isActive = location.pathname.includes(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center gap-3 w-full px-2.5 py-2.5 rounded-2xl transition-all duration-300 group relative",
                      isActive
                        ? "bg-primary/5 shadow-sm border border-primary/10"
                        : "hover:bg-secondary/50 border border-transparent"
                    )}
                  >
                    {/* Active accent bar */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary transition-all duration-300",
                        isActive ? "h-6 opacity-100" : "h-0 opacity-0"
                      )}
                    />
                    {/* Icon tile */}
                    <span
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
                        isActive ? item.tint : "bg-secondary/40 group-hover:bg-secondary/70",
                        "group-hover:scale-105"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-colors duration-300",
                          isActive ? item.color : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                    </span>
                    <span className="flex flex-col items-start leading-tight min-w-0">
                      <span
                        className={cn(
                          "text-[13px] font-bold tracking-tight transition-colors",
                          isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                        {item.role}
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "ml-auto w-3.5 h-3.5 shrink-0 transition-all duration-300",
                        isActive
                          ? "text-primary/60 opacity-100"
                          : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* System Status */}
            <div className="space-y-3 pt-5 border-t border-border/20">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Status
              </p>
              <div className="px-3">
                <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] font-bold text-foreground/60">AI Core</span>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70">Ready</span>
                </div>
              </div>
            </div>

            {/* Integrations */}
            <div className="space-y-3 pt-4 border-t border-border/20">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Integrations
              </p>

              <div className="px-3">
                {/* Connectors — the hub for connecting LinkedIn, Gmail, Outlook
                    and Google Calendar (the connectors tab in Autonomous Marketing). */}
                <button
                  onClick={() => navigate(`/autonomous-marketing/${spaceId}?tab=connectors`)}
                  className={cn(
                    "flex items-center justify-between w-full group rounded-2xl px-3 py-3 transition-all duration-300 border",
                    isConnectorsActive
                      ? "bg-primary/5 border-primary/10 shadow-sm"
                      : "border-transparent hover:bg-secondary/40 hover:border-border/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 group-hover:scale-105 transition-all shadow-sm">
                      <Link2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[12px] font-black text-foreground/80 tracking-tight">Connectors</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-foreground/60 transition-colors">
                        Manage accounts
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all" />
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
