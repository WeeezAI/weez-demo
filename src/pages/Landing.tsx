import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Instagram, BrainCircuit, Search, Zap, LayoutGrid, Palette, BarChart3, Clock, Rocket, MessageSquare } from "lucide-react";
import { AnimatedSection, StaggeredChildren } from "@/components/AnimatedSection";
import { Badge } from "@/components/ui/badge";
import { Gravity, MatterBody } from "@/components/ui/gravity";
import AuroraHero from "@/components/AuroraHero";
import logo from "@/assets/weez-logo.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <BrainCircuit className="w-6 h-6" />,
      title: "Smart Content Ideas",
      description: "Get endless post ideas tailored to your brand's voice and industry trends automatically."
    },
    {
      icon: <Instagram className="w-6 h-6" />,
      title: "One-Click Publishing",
      description: "Connect your Instagram and post generated content instantly without leaving the platform."
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: "On-Brand Visuals",
      description: "Generate professional images and graphics that perfectly match your brand's style guide."
    },
    {
      icon: <LayoutGrid className="w-6 h-6" />,
      title: "Workspace Management",
      description: "Organize different brands or projects in separate, secure workspaces."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Simple Analytics",
      description: "Track what's working with clear, actionable insights on your top performing content."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Time Saving",
      description: "Reduce hours of content planning into minutes of automated generation."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FDFBFF] text-foreground font-sans selection:bg-primary/10">



      {/* Zen Navigation */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70 border-b border-border/40 transition-all duration-300">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logo} alt="Weez AI" className="h-8 w-auto" />
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            </nav>
            <div className="h-4 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="font-bold hover:bg-secondary rounded-xl"
              >
                Log In
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="h-11 px-6 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-32 px-6 relative overflow-hidden">
        {/* Living Background */}
        <AuroraHero />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          <AnimatedSection animation="fade-up">
            <Badge className="bg-secondary text-primary border-primary/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              The Autonomous Marketing Workforce
            </Badge>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={100}>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-foreground leading-[0.95]">
              Marketing that <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Runs Itself.</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
              Weez AI learns your brand, generates premium content, and manages your social presence automatically. Stop micromanaging and start scaling.
            </p>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={300} className="pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate('/auth')}
                className="h-16 px-10 rounded-[2rem] bg-foreground text-background text-lg font-bold shadow-2xl hover:bg-foreground/90 transition-all active:scale-95 min-w-[200px]"
              >
                Start for Free
              </Button>
              <Button
                variant="outline"
                className="h-16 px-10 rounded-[2rem] border-2 bg-transparent text-lg font-bold hover:bg-secondary transition-all min-w-[200px]"
              >
                How it Works
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground font-medium">
              No credit card required · Cancel anytime
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Floating UI Demo */}
      <section className="pb-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <AnimatedSection animation="fade-up" delay={400}>
            <div className="relative rounded-[3rem] overflow-hidden border border-borderShadow shadow-[0_100px_200px_-50px_rgba(0,0,0,0.1)] bg-[#FCFCFC]">
              <div className="absolute inset-0 bg-grid-black/[0.02] -z-10" />
              <div className="p-12 md:p-20 relative h-[600px] flex items-center justify-center overflow-hidden">
                {/* Floating Element 1 - Left */}
                <div className="absolute left-[10%] top-[20%] p-6 bg-white rounded-[2rem] shadow-xl border border-black/5 w-64 animate-float">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase">Schedule</div>
                      <div className="text-sm font-black">Post Published</div>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full w-full bg-green-500 rounded-full" />
                  </div>
                </div>

                {/* Floating Element 2 - Right */}
                <div className="absolute right-[10%] bottom-[30%] p-6 bg-white rounded-[2rem] shadow-xl border border-black/5 w-72 animate-float-delayed">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-muted-foreground uppercase">Generation</div>
                      <div className="text-sm font-black">3 New Ideas Ready</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 w-full bg-slate-100 rounded-xl" />
                    ))}
                  </div>
                </div>

                {/* Center Main UI Representation */}
                <div className="relative z-10 bg-white rounded-[2.5rem] shadow-2xl border border-black/5 p-8 w-full max-w-xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black">Content Calendar</h3>
                    <Badge variant="outline" className="rounded-full">October</Badge>
                  </div>
                  <div className="grid grid-cols-7 gap-4 text-center mb-4">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                      <div key={d} className="text-xs font-bold text-muted-foreground">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-4">
                    {[...Array(14)].map((_, i) => (
                      <div key={i} className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-medium transition-colors ${i === 3 || i === 8 || i === 12 ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-secondary/50 text-muted-foreground'}`}>
                        {i === 3 || i === 8 || i === 12 ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 bg-secondary/30" id="features">
        <div className="max-w-[1200px] mx-auto space-y-24">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              Everything Included.
            </h2>
            <p className="text-lg text-muted-foreground">
              Weez AI replaces disconnected tools with one unified creative operating system.
            </p>
          </div>

          <StaggeredChildren staggerDelay={100} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-8 rounded-[2.5rem] bg-white border border-transparent hover:border-primary/10 hover:shadow-xl transition-all duration-500">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </StaggeredChildren>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-6" id="pricing">
        <div className="max-w-[1200px] mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Simple Pricing.</h2>
            <p className="text-lg text-muted-foreground">Start for free, scale when you're ready.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-center">
            {/* Free */}
            <div className="p-10 rounded-[3rem] border border-border bg-white hover:shadow-lg transition-all">
              <div className="space-y-6">
                <h3 className="text-2xl font-black">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">$0</span>
                  <span className="text-muted-foreground font-medium">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Perfect for trying out the platform.</p>
                <Button onClick={() => navigate('/auth')} variant="outline" className="w-full h-14 rounded-2xl font-bold">Get Started</Button>
                <ul className="space-y-4 pt-4">
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> 1 Brand Workspace</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> 10 AI Generations</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Basic Analytics</li>
                </ul>
              </div>
            </div>

            {/* Pro - Featured */}
            <div className="relative p-10 rounded-[3.5rem] bg-[#1a1a1a] text-white shadow-2xl scale-105 z-10">
              <div className="absolute top-6 right-8">
                <Badge className="bg-primary hover:bg-primary border-none text-white px-3 py-1">POPULAR</Badge>
              </div>
              <div className="space-y-6">
                <h3 className="text-2xl font-black">Monthly</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">$29</span>
                  <span className="text-white/60 font-medium">/mo</span>
                </div>
                <p className="text-sm text-white/60 font-medium">For growing brands and creators.</p>
                <Button onClick={() => navigate('/auth')} className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-bold">Start Free Trial</Button>
                <ul className="space-y-4 pt-4 text-white/80">
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Unlimited Workspaces</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Unlimited Generations</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Advanced SEO Tools</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Priority Support</li>
                </ul>
              </div>
            </div>

            {/* Yearly */}
            <div className="p-10 rounded-[3rem] border border-border bg-white hover:shadow-lg transition-all">
              <div className="space-y-6">
                <h3 className="text-2xl font-black">Yearly</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">$299</span>
                  <span className="text-muted-foreground font-medium">/yr</span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Best value for long-term growth.</p>
                <Button onClick={() => navigate('/auth')} variant="outline" className="w-full h-14 rounded-2xl font-bold">Choose Yearly</Button>
                <ul className="space-y-4 pt-4">
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Everything in Monthly</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> 2 Months Free</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="w-4 h-4 text-primary" /> Early Access features</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto bg-primary rounded-[4rem] text-center p-12 md:p-24 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">Ready to automate?</h2>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              Join thousands of brands using Weez AI to scale their content without the burnout.
            </p>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-20 px-12 rounded-[2rem] bg-white text-primary text-lg font-black uppercase tracking-widest hover:bg-white/90 shadow-xl"
            >
              Get Started Now
            </Button>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-20 px-6 border-t border-border/40">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="font-bold tracking-tight">WEEZ INC.</span>
          </div>
          <div className="flex gap-8 text-sm font-medium">
            <span onClick={() => navigate('/privacy-policy')} className="cursor-pointer hover:text-foreground transition-colors">Privacy</span>
            <span onClick={() => navigate('/terms-conditions')} className="cursor-pointer hover:text-foreground transition-colors">Terms</span>
            <span onClick={() => navigate('/data-deletion')} className="cursor-pointer hover:text-foreground transition-colors">Delete Account</span>
          </div>
          <div className="text-sm font-medium">
            © 2024 Weez AI. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
};

// Helper for checkmarks
const Check = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default Landing;
