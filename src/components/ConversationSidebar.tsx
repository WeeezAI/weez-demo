import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Signal as SignalIcon,
  Users,
  ListChecks,
  Sparkles,
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

  // ── Seven destinations, in two groups, and the split is the product's own shape ──
  //
  // Capability-based navigation. The AI workforce (Nina, EVA, MAX) runs behind the
  // scenes — a rep navigates by outcome, not by agent.
  //
  // The first four are the journey, in the order a prospect travels it:
  //
  //   1 Market Intelligence   discovery and qualification — accounts, the leads on them,
  //                           and the Enrich Now that promotes one into the GTM flow
  //   2 Prospect Intelligence the enriched prospects only, and the whole of one prospect:
  //                           who they are, what changed, what it means, and the decision
  //                           to contact now or activate intelligence
  //   3 Action Queue          what needs a rep today, across prospects
  //   4 Nina                  the day's orchestration — where a morning starts
  //
  // Reading the group top to bottom is reading the product. The three below are real and
  // useful but they are not steps in that loop: Meetings is where work lands after it
  // leaves the loop, Analytics is a day-by-day read *of* the loop, and Settings is
  // configuration. Mixing all seven into one list made the journey unreadable — a rep
  // could not tell which items were sequential and which were just places.
  //
  // **The numbers are the teaching.** A rep opening this product for the first time has no
  // idea which of these to click, and two nouns ending in "Intelligence" do not tell them:
  // "Market Intelligence" and "Prospect Intelligence" sound like two views of the same
  // list. They are not — this one holds everything discovery qualified, that one holds only
  // what has been enriched. Numbering them makes the sidebar the shortest explanation of
  // the product in the whole app.
  //
  // The `role` lines are verbs and outcomes, not features. "Enriched decision makers" (what
  // one of these used to say) describes a data structure. "Decide who to contact" describes
  // what the rep does when they get there.
  //
  // Four entries this list used to carry are gone, and each removal is a claim about where
  // the thing now lives rather than a deletion of the thing:
  //
  //   Learning      → `/gtm-dashboard` — folded into the prospect under "What we've
  //                   learned". Learning about a prospect belongs beside that prospect,
  //                   not on a page a rep has to remember to visit.
  //   Outreach      → `/sales` — outreach is contextual now. It arrives with the prospect
  //                   and the reason already attached, from a recommendation, so there is
  //                   nothing to navigate *to*.
  //   Relationship  → `/relationship-intelligence` — the per-prospect execution surface
  //     Intelligence  folded into Prospect Intelligence, and the path is now a redirect.
  //                   That is also why step 2 no longer carries an `alsoActiveFor` for it:
  //                   a redirect can never be the active location.
  //   Dashboard     → renamed Nina and promoted into the journey as step 4, because
  //                   "where to start" is a step, not a place.
  //
  // All three retired paths stay registered in `App.tsx` for bookmarks and shared links
  // (see `routes/retired.ts`); none of them may be *offered* here.
  const journeyItems = [
    {
      step: 1,
      label: "Market Intelligence",
      role: "Find who's worth it",
      path: `/eva/${spaceId}`,
      icon: SignalIcon,
      color: "text-emerald-500",
      tint: "bg-emerald-500/10",
    },
    {
      step: 2,
      label: "Prospect Intelligence",
      role: "Decide who to contact",
      path: `/prospect-intelligence/${spaceId}`,
      icon: Users,
      color: "text-violet-500",
      tint: "bg-violet-500/10",
    },
    {
      step: 3,
      label: "Action Queue",
      role: "Know what needs you today",
      path: `/action-queue/${spaceId}`,
      icon: ListChecks,
      color: "text-sky-500",
      tint: "bg-sky-500/10",
    },
    {
      step: 4,
      label: "Nina",
      role: "Start your day here",
      path: `/ninna/${spaceId}`,
      icon: Sparkles,
      color: "text-indigo-500",
      tint: "bg-indigo-500/10",
    },
  ];

  const workspaceItems = [
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
      role: "Day by day performance",
      path: `/analytics/${spaceId}`,
      icon: BarChart3,
      color: "text-cyan-500",
      tint: "bg-cyan-500/10",
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
   * a sibling route is never a path-segment prefix of another. With Outreach gone that
   * particular collision is moot, but the correctness is still load-bearing — Analytics
   * at `/analytics/<id>` must not light up on `/linkedin-analytics/<id>`, and a substring
   * match would light it up on every one of them.
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
    /** Present on the four journey steps, absent on the workspace items. */
    step?: number;
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
        // The current destination, for assistive technology as well as for the accent
        // bar and the tint below. Colour alone would leave a screen-reader user with no
        // way to tell where they are.
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
              "flex items-center gap-1.5 text-[13px] font-bold tracking-tight transition-colors",
              isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
            )}
          >
            {/* The step number. `aria-hidden` because the order is already carried by the
                list itself, and a screen reader announcing "1 Market Intelligence" would be
                reading the ordinal twice. */}
            {item.step !== undefined && (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black tabular-nums",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/60 text-muted-foreground/70"
                )}
              >
                {item.step}
              </span>
            )}
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

            {/* ── What Weez is, in one contrast ──
                The differentiation, stated where every rep will see it on every page rather
                than only on the Activate Intelligence card — which a rep who never reaches an
                enriched prospect would never read.

                Written as a contrast because that is what makes it land. "We monitor prospect
                signals and evolve state to recommend actions" describes the machinery; "most
                tools help you send more, Weez tells you who to contact and why now" tells a
                rep what is different about their day. Two lines, no illustration, no dismiss
                button: it is orientation, not an announcement, so it does not need to be
                cleared and should not compete with the navigation under it. */}
            <div className="mx-1 rounded-2xl border border-primary/10 bg-primary/[0.03] px-3 py-2.5">
              <p className="text-[10.5px] font-semibold leading-snug text-foreground/80">
                Most tools help you send more.
              </p>
              <p className="mt-0.5 text-[10.5px] font-bold leading-snug text-primary">
                Weez tells you who to contact, how, and why now.
              </p>
            </div>

            {/* The journey, in order. `aria-current="page"` on the active item rather
                than colour alone, so the highlight is available to a screen reader and
                not only to somebody who can see the accent bar. */}
            <nav aria-label="Go-to-market journey" className="space-y-1.5">
              <p className="px-3 mb-2 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                How it works
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
