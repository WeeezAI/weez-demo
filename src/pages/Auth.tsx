import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/weez-logo.png";

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
    if (isAuthenticated) navigate("/spaces");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = isLogin
        ? await login(email, password)
        : await register(name, email, password);

      if (result.success) {
        if (isLogin) {
          toast({ title: "Welcome back", description: "You're signed in." });
          navigate("/spaces");
        } else {
          toast({ title: "Account created", description: "Check your email to verify." });
          setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(email)}`), 400);
        }
      } else {
        toast({ title: "Sign in failed", description: result.error || "Invalid credentials.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-foreground font-sans flex">
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 md:p-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="Weez AI" className="h-7 w-auto" />
            <span className="text-base font-semibold tracking-tight">Weez AI</span>
          </button>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? "Create account" : "Sign in"}
          </button>
        </div>

        {/* Form */}
        <div className="max-w-sm w-full mx-auto">
          <div className="space-y-2 mb-10">
            <h1 className="text-4xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? "Sign in to continue to your workspace."
                : "Start automating your marketing in minutes."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl bg-white border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-white border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                {isLogin && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-11 rounded-xl bg-white border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm font-medium gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign in" : "Create account"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center pt-2">
              By continuing, you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground">Terms</a> &{" "}
              <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
            </p>
          </form>
        </div>

        <div className="text-xs text-muted-foreground">
          © 2026 Weez AI
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-1 p-3">
        <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black">
          <video
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          >
            <source src="https://secretimages.blob.core.windows.net/images/Untitled%20design%20(2)%20(1).mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="relative z-10 h-full flex flex-col justify-end p-12">
            <div className="max-w-md space-y-4">
              <h2 className="text-4xl font-semibold tracking-tight text-white leading-tight">
                Marketing that runs itself.
              </h2>
              <p className="text-white/70 leading-relaxed">
                Plan, create, launch and optimize campaigns — all on autopilot.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-white/20 backdrop-blur" />
                ))}
              </div>
              <span className="text-sm text-white/70">Trusted by 2,000+ brands</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
