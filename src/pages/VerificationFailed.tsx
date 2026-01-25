// src/pages/VerificationFailed.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerificationFailed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const error = searchParams.get("error");
    switch (error) {
      case "invalid_token":
        setErrorMessage("The verification link is invalid or has been compromised.");
        break;
      case "expired_token":
        setErrorMessage("The secure link has expired. Protocol requires new verification.");
        break;
      case "already_verified":
        setErrorMessage("Identity already active. Please proceed to login.");
        break;
      default:
        setErrorMessage("Verification protocol failed due to an unknown error.");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 relative overflow-hidden">

        {/* Background Accents */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldAlert className="w-48 h-48 -rotate-12 text-red-500" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8">
          {/* Icon */}
          <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-4">
            <X className="w-10 h-10 text-red-500" />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-red-600">Protocol Failure</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
              Access <br />
              <span className="text-muted-foreground/30">Denied.</span>
            </h1>
            <p className="text-lg font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
              {errorMessage}
            </p>
          </div>

          {/* Divider */}
          <div className="w-16 h-1 bg-border/50 rounded-full" />

          {/* Action */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
            >
              Return to Login <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <a href="mailto:support@weez.ai" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors py-2">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationFailed;