// src/pages/VerificationSuccess.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerificationSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/auth");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 relative overflow-hidden">

        {/* Background Accents */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldCheck className="w-48 h-48 -rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8">
          {/* Icon */}
          <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-emerald-500" />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Identity Confirmed</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
              Access <br />
              <span className="text-muted-foreground/30">Granted.</span>
            </h1>
            <p className="text-lg font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
              Your credentials have been securely verified. Welcome to the grid.
            </p>
          </div>

          {/* Divider */}
          <div className="w-16 h-1 bg-border/50 rounded-full" />

          {/* Action */}
          <Button
            onClick={() => navigate("/auth")}
            className="w-full h-16 rounded-[1.5rem] bg-foreground text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/5"
          >
            Enter System ({countdown}s) <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 pt-4">
            Redirecting automatically...
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationSuccess;