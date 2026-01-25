import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Users, ArrowLeft, BarChart3, Zap, LayoutDashboard, Database, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ConversationSidebarProps {
  onNewChat: () => void;
  onSelectConversation?: (conversationId: string) => void;
  currentConversationId?: string | null;
  spaceId: string;
}

const ConversationSidebar = ({
  spaceId
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
  ];

  return (
    <div className="w-full md:w-72 lg:w-80 bg-background/40 backdrop-blur-3xl border-r border-border/50 flex flex-col h-screen flex-shrink-0 relative overflow-hidden">

      {/* Zen Branding Area */}
      <div className="p-8 pb-4">
        <Button
          variant="ghost"
          onClick={handleBackToSpaces}
          className="group h-10 px-4 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all font-bold text-xs uppercase tracking-widest gap-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          Spaces
        </Button>
      </div>

      <div className="flex-1 min-h-0 pt-6">
        <ScrollArea className="h-full px-6">
          <div className="space-y-8">

            {/* Core Navigation Cluster */}
            <div className="space-y-1.5">
              <p className="px-4 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">Menu</p>
              {navItems.map((item) => {
                const isActive = location.pathname.includes(item.path);
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center gap-4 w-full p-4 rounded-2xl transition-all duration-500 group relative",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/20 scale-[1.02]"
                        : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 transition-colors duration-500",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                    )} />
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>

                    {isActive && (
                      <div className="absolute right-4 w-1.5 h-1.5 bg-accent rounded-full border-2 border-primary-foreground shadow-glow" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* System Status Cluster */}
            <div className="space-y-4 pt-10 border-t border-border/40">
              <p className="px-4 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">Status</p>

              <div className="px-4 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                    <span className="text-xs font-bold text-foreground/70">Connected</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-40">100%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-foreground/70">Engine</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-40">Active</span>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

      {/* Footer Identity */}
      <div className="p-8 border-t border-border/40 bg-background/20">
        <div className="flex items-center gap-3 opacity-40 grayscale hover:grayscale-0 transition-all cursor-crosshair">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <Zap className="w-4 h-4 text-background fill-background/20" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-widest leading-none">WEEZ AI</span>
            <span className="text-[8px] font-bold mt-1">v2.4.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;
