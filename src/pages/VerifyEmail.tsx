// src/pages/VerifyEmail.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);

    const messageParam = searchParams.get("message");
    const errorParam = searchParams.get("error");

    if (messageParam === "already_verified") {
      navigate("/auth"); // Redirect to login immediately if verified
    } else if (errorParam === "invalid_token") {
      setStatus("error");
      setMessage("Invalid verification link.");
    } else if (errorParam === "expired_token") {
      setStatus("error");
      setMessage("Verification link expired.");
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-[0_40px_80px_rgba(0,0,0,0.05)] border border-border/40 relative overflow-hidden">

        {/* Background Accents */}
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Mail className="w-48 h-48 -rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8">
          {/* Icon */}
          <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-4">
            <Mail className="w-10 h-10 text-primary" />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Action Required</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground leading-[0.95]">
              Check Your <br />
              <span className="text-muted-foreground/30">Inbox.</span>
            </h1>
            <p className="text-lg font-medium text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">
              We've sent a secure verification signal to <br />
              <span className="text-foreground font-bold">{email || "your email"}</span>
            </p>
          </div>

          {/* Divider */}
          <div className="w-16 h-1 bg-border/50 rounded-full" />

          {/* Interactive Status */}
          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground/50 bg-secondary/50 px-6 py-4 rounded-2xl w-full justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Waiting for verification...</span>
          </div>

          {/* Action */}
          <Button
            variant="outline"
            className="w-full h-16 rounded-[1.5rem] border-border bg-white text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all"
            onClick={() => window.open("https://gmail.com", "_blank")}
          >
            Open Email Client <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 pt-4">
            Link expires in 24 hours
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;