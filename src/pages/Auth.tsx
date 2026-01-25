import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Eye, EyeOff, ArrowRight, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/spaces");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        result = await register(name, email, password);
      }

      if (result.success) {
        if (isLogin) {
          toast({
            title: "System Access Granted",
            description: "Welcome back to the grid.",
          });
          navigate("/spaces");
        } else {
          toast({
            title: "Identity Created",
            description: "Verification signal sent to your email.",
          });
          setTimeout(() => {
            navigate(`/verify-email?email=${encodeURIComponent(email)}`);
          }, 500);
        }
      } else {
        toast({
          title: "Access Denied",
          description: result.error || "Invalid credentials.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "System Error",
        description: "Connection protocol failed.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBFF] text-foreground font-sans flex overflow-hidden">

      {/* Left: Tactical Form Section */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-10 md:p-14 relative z-10">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-xl shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white fill-white/20" />
          </div>
          <span className="text-sm font-black tracking-tighter uppercase">Weez.AI // CORE</span>
        </div>

        {/* Main Form */}
        <div className="max-w-md w-full mx-auto space-y-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary rounded-full border border-border/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                {isLogin ? "Secure Login" : "New Operator"}
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-[0.9] uppercase text-foreground">
              {isLogin ? "Welcome" : "Join the"} <br />
              <span className="text-muted-foreground/30">
                {isLogin ? "Back." : "Grid."}
              </span>
            </h1>
            <p className="text-lg font-medium text-muted-foreground/60 leading-relaxed max-w-sm">
              {isLogin
                ? "Enter your credentials to access the autonomous marketing workforce."
                : "Initialize your brand workspace and begin scaling."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {!isLogin && (
              <div className="space-y-3 group">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-focus-within:text-primary transition-colors">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Operator Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-16 px-6 rounded-[1.5rem] bg-white border-2 border-transparent focus:border-primary/10 text-lg font-bold placeholder:text-muted-foreground/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                  required
                />
              </div>
            )}

            <div className="space-y-3 group">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-focus-within:text-primary transition-colors">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-16 px-6 rounded-[1.5rem] bg-white border-2 border-transparent focus:border-primary/10 text-lg font-bold placeholder:text-muted-foreground/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                required
              />
            </div>

            <div className="space-y-3 group">
              <Label htmlFor="password" class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-focus-within:text-primary transition-colors">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-16 px-6 pr-14 rounded-[1.5rem] bg-white border-2 border-transparent focus:border-primary/10 text-lg font-bold placeholder:text-muted-foreground/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-20 rounded-[2rem] bg-foreground text-white text-sm font-black uppercase tracking-[0.25em] hover:bg-primary transition-all active:scale-95 shadow-2xl shadow-black/10 flex gap-4 group/btn"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Initialize Session" : "Create Account"}
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors py-2"
            >
              {isLogin ? "Need an account? Sign up" : "Already have access? Log in"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          © 2024 Weez AI Systems.
        </div>
      </div>

      {/* Right: Visual Cinematic Section */}
      <div className="hidden lg:flex flex-1 bg-black relative m-4 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Animated Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />

        <div className="relative z-10 w-full h-full flex flex-col justify-end p-20">
          <div className="space-y-8">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/10">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
            <div className="space-y-4 max-w-xl">
              <h2 className="text-5xl font-black tracking-tighter text-white leading-tight">
                Autonomous <br />
                Creative Power.
              </h2>
              <p className="text-lg font-medium text-white/60 leading-relaxed">
                Unlock the full potential of your marketing strategy with AI-driven content generation and surgical analytics.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-8">
              <div className="flex -space-x-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-12 h-12 rounded-full border-2 border-black bg-white/20 backdrop-blur-sm" />
                ))}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold">2,000+ Brands</span>
                <span className="text-white/40 text-xs font-medium">Scaling on Weez AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Auth;