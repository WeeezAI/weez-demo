import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, BrainCircuit, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { weezAPI } from "@/services/weezAPI";

const PlatformCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isConnected = params.get("connected") === "true";
  const brandId = params.get("state");

  useEffect(() => {
    if (isConnected && brandId) {
      handleRunAnalysis(brandId);
    }
  }, [isConnected, brandId]);

  const handleRunAnalysis = async (id: string) => {
    setIsAnalyzing(true);
    try {
      // 1. Trigger the brand analysis pipeline on the backend
      await weezAPI.triggerAnalysis(id);

      setIsAnalyzing(false);
      setIsSuccess(true);
      toast.success("Brand Identity Locked!");

      // 2. Redirect to the primary workspace (Campaign Hub)
      setTimeout(() => {
        navigate(`/one-click-post/${id}`);
      }, 2000);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Cloud analysis encountered an error.");
      setIsAnalyzing(false);
      // Fallback redirect
      setTimeout(() => navigate("/spaces"), 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {isAnalyzing ? (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                  <BrainCircuit className="w-12 h-12 text-primary animate-pulse" />
                </div>
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="w-6 h-6 text-yellow-500 animate-bounce" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Analyzing Your Brand...</h1>
              <p className="text-muted-foreground">
                We're synthesizing your Instagram profiles, color schemas, and market winning patterns to build your deep-brand memory.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-mono text-primary/70 tracking-widest uppercase">Executing Neural Pipeline</p>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Deep Memory Synced!</h1>
              <p className="text-muted-foreground">
                Your brand identity is now locked. Redirecting to your content hub...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Initializing connection...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformCallback;
