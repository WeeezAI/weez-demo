import { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Link2 } from "lucide-react";
import ConversationSidebar from "@/components/ConversationSidebar";
import ConnectorsView, { WEBSITE_CONNECTOR_ANCHOR } from "@/components/ConnectorsView";
import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { WorkspaceSetupChecklist } from "@/components/setup/WorkspaceSetupChecklist";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspaceSetup, type SetupStepId } from "@/hooks/useWorkspaceSetup";

/**
 * Standalone Connections page.
 *
 * Previously the connectors UI was only reachable as a tab inside Autonomous
 * Marketing (/autonomous-marketing/:id?tab=connectors). It now has its own
 * route (/connections/:spaceId) so the sidebar, the OAuth callback, and the
 * new-space setup flow can link straight here without detouring through the
 * marketing workspace.
 *
 * ── The setup rail, and why the welcome stopped being a toast ──
 *
 * Creating a workspace sends the founder straight here, which is the right destination —
 * nothing works until the website is connected. What was missing was an exit. The page
 * announced itself with a toast, the founder connected their website, the toast was long
 * gone, and the page went back to looking like a settings screen. There was nothing on it
 * that said this was step one of anything or where step two lived, so the next move was a
 * guess.
 *
 * The rail replaces the toast because the information is not an announcement, it is state:
 * a founder needs it after they act, not before, and a toast is gone by then. It names all
 * three steps, marks the one they just finished, and carries the control for the next one —
 * which for this page means handing off to Nina, since setting the goal is her job and not
 * a connector.
 *
 * It renders only while the workspace has not launched. Somebody opening Settings to
 * reconnect a channel mid-campaign is not onboarding and gets the page as it was.
 */
const Connections = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isSetup = params.get("setup") === "true";

  // The balance, in chrome, from the provider that already wraps `Routes` (R17.1). This
  // page spends nothing, so there is nothing to refresh it after. Rendered
  // unconditionally: `CreditBalanceBadge` is what decides that an unread balance shows
  // nothing, and a `balance && …` guard here would hide a genuine 0 (R17.7).
  const { balance } = useCredits();

  const {
    websiteConnected,
    goalSet,
    launched,
    needsSetup,
    nextStep,
    refresh,
  } = useWorkspaceSetup();

  /**
   * While the website is still missing, re-read the setup state on a slow poll.
   *
   * `ConnectorsView` owns the website form and reports success to itself; this page has no
   * way to hear about it. Without the poll the rail would keep saying "connect your
   * website" after the founder just did, which is the exact staleness that made the old
   * flow feel broken. It stops the moment the answer is `true`, and it never runs for a
   * workspace that is already set up.
   */
  useEffect(() => {
    if (!needsSetup || websiteConnected !== false) return;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [needsSetup, websiteConnected, refresh]);

  // A founder who connects the website in another tab, or comes back from an OAuth
  // round trip, should see the rail move rather than a stale step.
  useEffect(() => {
    if (!needsSetup) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [needsSetup, refresh]);

  const advance = (step: SetupStepId) => {
    if (step === "website") {
      // The form being asked for is already on this page, just below the rail — so this
      // control puts it on screen rather than navigating somewhere to ask again.
      document
        .getElementById(WEBSITE_CONNECTOR_ANCHOR)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Both remaining steps are the campaign-creation workflow, which is a place now.
    navigate(`/gtm-setup/${spaceId}`);
  };

  // Shown for a new workspace, and also for anyone who arrived through the explicit
  // `?setup=true` hand-off. Never for a workspace whose workforce is already running.
  const showRail = needsSetup || (isSetup && launched !== true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Slim top bar for consistency with the other workspace pages */}
        <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 shadow-sm">
            <Link2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Integrations
            </span>
            <span className="text-sm font-semibold text-zinc-900">Manage your connections</span>
          </div>

          <CreditBalanceBadge balance={balance} className="ml-auto hidden sm:inline-flex" />
        </header>

        {/* Above the connectors and outside their scroll container, so it stays put while
            the founder works down the list rather than scrolling away from the answer to
            "what do I do after this". */}
        {showRail && (
          <div className="shrink-0 border-b border-zinc-200/70 bg-white/60 px-6 py-5 lg:px-10">
            <WorkspaceSetupChecklist
              variant="rail"
              headingLevel="h2"
              completed={{ website: websiteConnected, goal: goalSet, launch: launched }}
              activeStep={nextStep ?? (websiteConnected === true ? "goal" : "website")}
              onAdvance={advance}
            />
          </div>
        )}

        <ConnectorsView brandId={spaceId!} />
      </div>
    </div>
  );
};

export default Connections;
