import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  Signal as SignalIcon,
  Building2,
  Users,
  Send,
  CalendarCheck,
  BarChart3,
  Settings,
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

  // Capability-based GTM navigation. The AI workforce (Nina, EVA, MAX) runs
  // behind the scenes — the founder navigates by outcome, not by agent. Nina
  // orchestrates strategy, EVA drives revenue intelligence, MAX executes sales.
  const navItems = [
    {
      label: "Dashboard",
      role: "GTM command center",
      path: `/ninna/${spaceId}`,
      icon: LayoutDashboard,
      color: "text-indigo-500",
      tint: "bg-indigo-500/10",
    },
    {
      label: "Revenue Intelligence",
      role: "Signals & scoring",
      path: `/eva/${spaceId}`,
      icon: SignalIcon,
      color: "text-emerald-500",
      tint: "bg-emerald-500/10",
    },
    {
      label: "Accounts",
      role: "Qualified companies",
      path: `/leads/${spaceId}`,
      icon: Building2,
      color: "text-sky-500",
      tint: "bg-sky-500/10",
    },
    {
      label: "Prospects",
      role: "Decision makers",
      path: `/sales-intelligence/${spaceId}`,
      icon: Users,
      color: "text-violet-500",
      tint: "bg-violet-500/10",
    },
    {
      label: "Outreach",
      role: "Sales execution",
      path: `/sales/${spaceId}`,
      icon: Send,
      color: "text-orange-500",
      tint: "bg-orange-500/10",
    },
    {
      label: "Meetings",
      role: "Booked pipeline",
      path: `/sales-workspace/${spaceId}`,
      icon: CalendarCheck,
      color: "text-amber-500",
      tint: "bg-amber-500/10",
    },
    {
      label: "Analytics",
      role: "GTM performance",
      path: `/analytics/${spaceId}`,
      icon: BarChart3,
      color: "text-blue-500",
      tint: "bg-blue-500/10",
    },
    {
      label: "Settings",
      role: "Connections & config",
      path: `/connections/${spaceId}`,
      icon: Settings,
      color: "text-slate-500",
      tint: "bg-slate-500/10",
    },
  ];

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

            {/* Go-to-Market navigation */}
            <div className="space-y-1.5">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Go-to-Market
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
                  </button>
                );
              })}
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
