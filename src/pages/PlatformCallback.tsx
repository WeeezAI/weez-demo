import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Instagram, Facebook, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { weezAPI } from "@/services/weezAPI";
import { EducationalLoader } from "@/components/EducationalLoader";
import { Button } from "@/components/ui/button";

const PlatformCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isConnected = params.get("connected") === "true";
  const brandId = params.get("state") || "";
  const error = params.get("error");

  // Enriched Meta Data
  const username = params.get("username");
  const pageName = params.get("page_name");
  const accountType = params.get("account_type");
  const publishingEnabled = params.get("publishing_enabled") === "true";

  useEffect(() => {
    if (isConnected && brandId && !isSuccess) {
      handleRunAnalysis(brandId);
    }
  }, [isConnected, brandId]);

  const handleRunAnalysis = async (id: string) => {
    setIsAnalyzing(true);
    try {
      await weezAPI.triggerAnalysis(id);
      setIsAnalyzing(false);
      setIsSuccess(true);
      toast.success("Brand Identity Locked!");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Cloud analysis encountered an error.");
      setIsAnalyzing(false);
    }
  };

  const handleTryAgain = () => {
    navigate("/spaces");
    // The user will need to re-open the modal from spaces
  };

  const renderFailure = () => {
    let title = "Connection Failed";
    let description = "We couldn't synchronize your Instagram account.";
    let steps: string[] = [];

    if (error === "no_ig_business_found") {
      title = "Instagram Not Detected";
      description = "We found your Facebook Pages, but no Instagram Business account is linked to them.";
      steps = [
        "Open Instagram app → Settings → Business → Connect Facebook Page",
        "Ensure you have 'Full Control' of the linked Facebook Page",
        "Log out of Facebook and log back in to refresh permissions",
        "If the Page was created by another account, ask the owner to grant you Full Control"
      ];
    } else if (error === "no_pages_found") {
      title = "No Pages Found";
      description = "Your Facebook account doesn't seem to manage any Facebook Pages.";
      steps = [
        "Ensure you have a Facebook Page for your business",
        "Verify you are an Admin of that Facebook Page",
        "Try creating a fresh Page if your legacy one is restricted"
      ];
    }

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-amber-500" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{title}</h1>
          <p className="text-muted-foreground font-medium">{description}</p>
        </div>

        {steps.length > 0 && (
          <div className="bg-secondary/30 rounded-[2.5rem] p-10 space-y-6 border border-border/40">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">Guided Troubleshooting</h3>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black shrink-0 border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                    {i + 1}
                  </div>
                  <p className="text-sm font-bold text-foreground/80 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Button
            onClick={handleTryAgain}
            className="w-full h-16 rounded-2xl bg-foreground text-white font-black uppercase tracking-widest text-[11px]"
          >
            Try Again
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/spaces")}
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Return to Spaces
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-[3rem] flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Connection Active 🎉</h1>
          <p className="text-muted-foreground font-medium text-lg">Your brand identity is now synchronized and live.</p>
        </div>

        <div className="grid gap-4">
          <div className="p-8 rounded-[2.5rem] bg-white border border-border/80 shadow-xl shadow-black/[0.02] space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-pink-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Username</span>
                  <span className="text-lg font-black uppercase tracking-tight">{username || "Syncing..."}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/40 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Facebook className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Linked Page</span>
                  <span className="text-lg font-black uppercase tracking-tight">{pageName || "Syncing..."}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Account Type</span>
                  <span className="flex items-center gap-2 mt-1">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest">{accountType || "Business"}</span>
                  </span>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Publishing</span>
                  <span className="flex items-center gap-2 mt-1">
                    <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Enabled</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={() => navigate(`/one-click-post/${brandId}`)}
          className="w-full h-20 rounded-[2rem] bg-primary text-white font-black uppercase tracking-widest text-[11px] hover:bg-accent transition-all shadow-2xl shadow-primary/20"
        >
          Enter Dashboard Hub
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBFF] p-6 font-sans">
      <div className="max-w-xl w-full">
        {isAnalyzing ? (
          <EducationalLoader />
        ) : isSuccess ? (
          renderSuccess()
        ) : error ? (
          renderFailure()
        ) : (
          <div className="space-y-6 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-40">Orchestrating Connection</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformCallback;
