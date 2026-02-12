import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, BrainCircuit, Instagram, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { weezAPI } from "@/services/weezAPI";
import logo from "@/assets/weez-logo.png";

interface WeezHeaderProps {
  spaceName?: string;
}

const WeezHeader = ({ spaceName }: WeezHeaderProps) => {
  const { spaceId } = useParams();
  const [isConnected, setIsConnected] = useState(false);

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
      window.location.href = weezAPI.getInstagramAuthUrl(spaceId);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-3xl bg-background/60 border-b border-border/40">
      <div className="flex h-20 items-center justify-between px-10 max-w-[1600px] mx-auto">
        {/* Left: Identity */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 group cursor-pointer">
            <img
              src={logo}
              alt="Weez AI"
              className="h-8 weez-logo transition-transform duration-500 group-hover:scale-105 group-active:scale-95"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-50">{spaceName || "Dashboard"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center pr-6 border-r border-border/50">
            {isConnected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Connected</span>
              </div>
            ) : (
              <Button
                data-tutorial-id="connect-instagram-button"
                onClick={handleConnect}
                variant="outline"
                className="h-11 px-6 rounded-xl border-pink-500/20 bg-pink-500/5 text-pink-600 text-[10px] font-black uppercase tracking-widest hover:bg-pink-500 hover:text-white transition-all gap-3 active:scale-95 shadow-sm"
              >
                <Instagram className="w-4 h-4" />
                Connect Instagram
              </Button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default WeezHeader;
