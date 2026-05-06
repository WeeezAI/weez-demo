import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Users, ArrowLeft, BarChart3, Zap, LayoutDashboard, Database, Activity, Linkedin } from "lucide-react";
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
  onSelectConversation
}: ConversationSidebarProps) => {
  const { exitSpace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleBackToSpaces = () => {
    exitSpace();
    navigate("/spaces");
  };

  const navItems = [
    {
      label: "Dashboard",
      path: `/autonomous-marketing/${spaceId}`,
      icon: BarChart3,
      color: "text-violet-500"
    },
    {
      label: "Create",
      path: `/one-click-post/${spaceId}`,
      icon: LayoutDashboard,
      color: "text-blue-500"
    },
    {
      label: "Gallery",
      path: `/gallery/${spaceId}`,
      icon: Sparkles,
      color: "text-purple-500"
    },
    {
      label: "Stats",
      path: `/analytics/${spaceId}`,
      icon: Activity,
      color: "text-emerald-500"
    },
    {
      label: "LinkedIn",
      path: `/linkedin-analytics/${spaceId}`,
      icon: Linkedin,
      color: "text-blue-600"
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
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">Workspace</p>
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
                      "w-4 h-4 transition-all duration-300",
                      isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary"
                    )} />
                    <span className="text-xs font-bold tracking-tight">{item.label}</span>

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
