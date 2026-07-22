import { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import ConversationSidebar from "@/components/ConversationSidebar";
import ConnectorsView from "@/components/ConnectorsView";

/**
 * Standalone Connections page.
 *
 * Previously the connectors UI was only reachable as a tab inside Autonomous
 * Marketing (/autonomous-marketing/:id?tab=connectors). It now has its own
 * route (/connections/:spaceId) so the sidebar, the OAuth callback, and the
 * new-space setup flow can link straight here without detouring through the
 * marketing workspace.
 */
const Connections = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isSetup = params.get("setup") === "true";

  useEffect(() => {
    if (isSetup) {
      toast.message("Welcome to your new Space!", {
        description:
          "Connect your channels so Weez can publish, send outbound email, and book meetings for you.",
      });
    }
  }, [isSetup]);

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
        </header>

        <ConnectorsView brandId={spaceId!} />
      </div>
    </div>
  );
};

export default Connections;
