import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, BrainCircuit, Instagram, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { weezAPI } from "@/services/weezAPI";
import logo from "@/assets/weez-logo.png";

import InstagramConnectModal from "./InstagramConnectModal";

interface WeezHeaderProps {
  spaceName?: string;
}

const WeezHeader = ({ spaceName }: WeezHeaderProps) => {
  const { spaceId } = useParams();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  useEffect(() => {
    if (spaceId) {
      checkStatus();
    }
  }, [spaceId]);

  const checkStatus = async () => {
    try {
      const status = await weezAPI.getInstagramStatus(spaceId!);
      setIsConnected(status.connected);
    } catch (e) {
      console.error("Failed to check IG status:", e);
    }
  };

  const handleConnect = () => {
    if (spaceId) {
      setIsConnectModalOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-3xl bg-background/40 border-b border-border/40 transition-all duration-500">
      <div className="flex h-14 items-center justify-between px-6 max-w-[1600px] mx-auto">
        {/* Left: Identity */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => (window.location.href = "/spaces")}>
            <img
              src={logo}
              alt="Weez AI"
              className="h-6 w-auto weez-logo transition-all duration-500 group-hover:scale-105 group-active:scale-95"
            />
            <div className="flex items-center gap-2 border-l border-border/50 pl-3">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-40">{spaceName || "Dashboard"}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center pr-4">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 text-emerald-600 rounded-lg border border-emerald-500/10 transition-all hover:bg-emerald-500/10">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
              </div>
            ) : (
              <Button
                data-tutorial-id="connect-instagram-button"
                onClick={handleConnect}
                variant="outline"
                className="h-9 px-4 rounded-lg border-indigo-500/20 bg-indigo-500/5 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all gap-2 active:scale-95 shadow-none"
              >
                <Instagram className="w-3.5 h-3.5" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>
      <InstagramConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        spaceId={spaceId || ""}
      />
    </header>
  );
};

export default WeezHeader;
