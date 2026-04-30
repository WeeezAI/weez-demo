import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Zap, 
  Rocket, 
  Check, 
  X, 
  Cpu, 
  Globe, 
  ShieldCheck,
  TrendingUp,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  daysRemaining?: number;
  isExpired?: boolean;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ 
  isOpen, 
  onClose, 
  daysRemaining = 14,
  isExpired = false
}) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const features = [
    { 
      icon: <Zap className="w-4 h-4" />, 
      title: "Unlimited Generations", 
      description: "Scale your content without limits or boundaries." 
    },
    { 
      icon: <Rocket className="w-4 h-4" />, 
      title: "Priority Intelligence", 
      description: "Get faster rendering and priority AI processing." 
    },
    { 
      icon: <TrendingUp className="w-4 h-4" />, 
      title: "Advanced Analytics", 
      description: "Deep insights into your audience engagement." 
    },
    { 
      icon: <ShieldCheck className="w-4 h-4" />, 
      title: "Multi-Brand Vault", 
      description: "Manage multiple brands from a single command center." 
    }
  ];

  const handleUpgrade = () => {
    onClose();
    navigate("/plans");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[3rem] bg-white shadow-2xl flex flex-col md:flex-row"
          >
            {/* Left Side: Hero Section */}
            <div className="md:w-1/2 bg-foreground text-background p-10 md:p-14 flex flex-col justify-between relative overflow-hidden">
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10 space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Premium Access Required</span>
                </div>

                <div className="space-y-4">
                  <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-none uppercase italic">
                    Unlock <br />
                    <span className="text-primary">Ultimate</span> <br />
                    Power.
                  </h2>
                  <p className="text-lg font-medium text-white/60 leading-relaxed max-w-xs">
                    Your trial is {isExpired ? "now expired" : `expiring in ${daysRemaining} days`}. Transact now for absolute scale.
                  </p>
                </div>

                {!isExpired && (
                   <div className="flex items-center gap-4 py-4 px-6 bg-white/5 rounded-2xl border border-white/5 w-fit">
                    <Clock className="w-5 h-5 text-primary animate-pulse" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Time Remaining</div>
                      <div className="text-xl font-bold">{daysRemaining} Days Left</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-12">
                 <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-foreground bg-secondary flex items-center justify-center overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-foreground bg-primary flex items-center justify-center text-[10px] font-black">
                      +1k
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/40 italic">
                    Joined by 1,400+ Market Leaders
                  </p>
              </div>
            </div>

            {/* Right Side: Features & CTA */}
            <div className="md:w-1/2 bg-white p-10 md:p-14 flex flex-col justify-between relative">
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-2 rounded-full hover:bg-secondary transition-colors opacity-40 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-12">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight">Premium Capabilities</h3>
                  <div className="h-1 w-12 bg-primary/20 rounded-full" />
                </div>

                <div className="grid gap-8">
                  {features.map((feature, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex gap-5 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors duration-500">
                        <div className="text-primary">{feature.icon}</div>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-tight">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-16 space-y-6">
                <Button 
                  onClick={handleUpgrade}
                  className="w-full h-20 rounded-[2rem] bg-primary text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:bg-accent transition-all active:scale-[0.98]"
                >
                  Upgrade to Premium
                </Button>
                
                <p className="text-[9px] font-bold text-center text-muted-foreground uppercase tracking-widest opacity-40">
                  Cancel anytime. Instant activation.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PremiumModal;
