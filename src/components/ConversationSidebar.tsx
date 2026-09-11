import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  Signal as SignalIcon,
  Users,
  ListChecks,
  Send,
  CalendarCheck,
  GraduationCap,
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
  //
  // Action Queue sits under Prospect Intelligence because it is the same population
  // ranked by what to do next, and Learning sits under Meetings because it is what
  // the booked-or-not outcomes taught the ranking. Ninna stays the landing page.
  //
  // The order is the lifecycle, and the `role` subtitles say which stage each surface
  // owns:
  //
  //   Dashboard             where to start
  //   Market Intelligence   discovery and qualification — accounts, the leads on them, and
  //                         the Enrich Now that promotes one into the GTM flow
  //   Prospect Intelligence the enriched prospects only: the decision-maker, their contact,
  //                         and the decision to activate
  //   Action Queue          what the state engine ranked, across prospects
  //   Outreach              performing it
  //   Meetings              what it booked
  //   Learning              what the outcomes taught the ranking, and what it all cost
  //
  // Two corrections here, both about pointing at the right surface.
  //
  // The Eva item used to read "Revenue Intelligence / Signals & scoring". Both halves were
  // wrong. Signals, the evolving state and the scoring live on Prospect Intelligence and the
  // Action Queue, not here — an operator following that subtitle went looking for scores and
  // found a lead list. And "Revenue Intelligence" contradicted the product's own naming:
  // `pages/Landing.tsx` and `components/HeroAITeam.tsx` both give Eva the role "Market
  // Intelligence", which is also what it is — discovery, qualification, and the Enrich Now
  // that promotes a lead into the GTM flow.
  //
  // The distinction matters more now than it did, because the two pages hold different
  // populations: this one lists everything discovery qualified, and Prospect Intelligence
  // lists only what has been enriched. A label that made them sound like the same view of
  // the same list would make the second one look broken.
  // ── Two groups, and the split is the product's own shape ──
  //
  // The first four are the journey, in the order a prospect travels it:
  //
  //   Market Intelligence   discover and qualify, and press Enrich Now
  //   Prospect Intelligence decide — contact them now, or activate intelligence
  //   Action Queue          what the evolving state decided to recommend, across prospects
  //   Learning              what the outcomes taught the ranking
  //
  // Reading the group top to bottom is reading the product: discover → understand →
  // act → learn. That is the whole reason for the split. The four surfaces below are
  // real and useful, but they are not steps in that loop — Outreach and Meetings are
  // where work lands after it leaves the loop, Dashboard is a summary *of* the loop,
  // and Settings is configuration. Mixing all eight into one list made the journey
  // unreadable: an operator could not tell which items were sequential and which were
  // just places.
  //
  // `role` is the subtitle, and each says which stage its surface owns rather than
  // describing its contents.
  const journeyItems = [
    {
      label: "Market Intelligence",
      role: "Discover, qualify & enrich",
      path: `/eva/${spaceId}`,
      icon: SignalIcon,
      color: "text-emerald-500",
      tint: "bg-emerald-500/10",
    },
    {
      label: "Prospect Intelligence",
      role: "Decide & activate",
      path: `/prospect-intelligence/${spaceId}`,
      icon: Users,
      color: "text-violet-500",
      tint: "bg-violet-500/10",
      // The per-prospect execution surface is the same destination as far as an
      // operator is concerned — it is entered from a prospect on this page and its own
      // back button returns here — so it lights this item rather than none. Phase 2
      // folds it in entirely; until then the highlight already tells the truth about
      // where you are.
      alsoActiveFor: [`/relationship-intelligence/${spaceId}`],
    },
    {
      label: "Action Queue",
      role: "Ranked next moves",
      path: `/action-queue/${spaceId}`,
      icon: ListChecks,
      color: "text-sky-500",
      tint: "bg-sky-500/10",
    },
    {
      label: "Learning",
      role: "Outcomes, accuracy & credits",
      path: `/gtm-dashboard/${spaceId}`,
      icon: GraduationCap,
      color: "text-cyan-500",
      tint: "bg-cyan-500/10",
    },
  ];

  const workspaceItems = [
    {
      label: "Dashboard",
      role: "GTM command center",
      path: `/ninna/${spaceId}`,
      icon: LayoutDashboard,
      color: "text-indigo-500",
      tint: "bg-indigo-500/10",
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
      label: "Settings",
      role: "Connections & config",
      path: `/connections/${spaceId}`,
      icon: Settings,
      color: "text-slate-500",
      tint: "bg-slate-500/10",
    },
  ];

  /**
   * Whether `item` is the surface currently on screen.
   *
   * This used to be `location.pathname.includes(item.path)`, which is wrong by
   * substring: `/sales/<id>` is a substring of `/sales-workspace/<id>`, so Outreach lit
   * up while the operator was on Meetings — two items highlighted, one of them a lie.
   * `/sales-intelligence` had the same collision.
   *
   * Matching the whole path, or a path plus a `/` boundary, cannot collide that way:
   * a sibling route is never a path-segment prefix of another.
   */
  const matchesPath = (pathname: string, path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const isActiveItem = (item: { path: string; alsoActiveFor?: string[] }) =>
    matchesPath(location.pathname, item.path) ||
    (item.alsoActiveFor ?? []).some((path) => matchesPath(location.pathname, path));

  /**
   * One nav item, for both groups.
   *
   * Extracted when the single list became two. The alternative was the same forty lines
   * of markup twice, and two copies of a button drift: the day somebody adjusts the
   * active styling they will adjust one of them.
   */
  const renderNavItem = (item: {
    label: string;
    role: string;
    path: string;
    icon: typeof Users;
    color: string;
    tint: string;
    alsoActiveFor?: string[];
  }) => {
    const isActive = isActiveItem(item);
    const Icon = item.icon;
    return (
      <button
        key={item.label}
        onClick={() => navigate(item.path)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 w-full px-2.5 py-2.5 rounded-2xl transition-all duration-300 group relative",
          isActive
            ? "bg-primary/5 shadow-sm border border-primary/10"
            : "hover:bg-secondary/50 border border-transparent"
        )}
      >
        {/* Active accent bar */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary transition-all duration-300",
            isActive ? "h-6 opacity-100" : "h-0 opacity-0"
          )}
        />
        {/* Icon tile */}
        <span
          aria-hidden="true"
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
  };

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

            {/* The journey, in order. `aria-current="page"` on the active item rather
                than colour alone, so the highlight is available to a screen reader and
                not only to somebody who can see the accent bar. */}
            <nav aria-label="Go-to-market journey" className="space-y-1.5">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Go-to-Market
              </p>
              {journeyItems.map((item) => renderNavItem(item))}
            </nav>

            {/* Everything that is a place rather than a step. */}
            <nav aria-label="Workspace" className="space-y-1.5">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                Workspace
              </p>
              {workspaceItems.map((item) => renderNavItem(item))}
            </nav>

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
