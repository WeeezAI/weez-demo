import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { Sparkles, Zap, Target, TrendingUp, Users, MessageSquare, ArrowRight, CheckCircle2, Star, Check, AlertTriangle } from "lucide-react";
import dexraflowLogo from "@/assets/dexraflow-logo.png";
import heroIllustration from "@/assets/weez-hero-illustration.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "AI-Powered Campaigns",
      description: "Generate high-converting marketing campaigns with advanced AI algorithms"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Smart Targeting",
      description: "Reach your ideal audience with precision targeting powered by machine learning"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Performance Analytics",
      description: "Real-time insights and predictive analytics to optimize your ROI"
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Content Generation",
      description: "Create compelling copy, visuals, and videos in seconds"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Audience Insights",
      description: "Deep understanding of your customers through AI-driven analysis"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Automation",
      description: "Automate repetitive tasks and focus on strategic growth"
    }
  ];

  const benefits = [
    "10x faster campaign creation",
    "50% reduction in marketing costs",
    "3x higher conversion rates",
    "24/7 AI-powered optimization"
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Animated Background - Purple orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] bg-purple-400/10 rounded-full blur-[80px] animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center">
          <img src={dexraflowLogo} alt="Dexraflow" className="h-20 md:h-28 w-auto" />
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#uniqueness" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">Uniqueness</a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">Pricing</a>
          <Link to="/privacy-policy" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">Privacy Policy</Link>
          <Link to="/terms-conditions" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">Terms & Conditions</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')}
            className="text-gray-600 hover:text-gray-900"
          >
            Sign In
          </Button>
          <Button 
            onClick={() => navigate('/auth')}
            className="bg-gradient-to-r from-purple-600 to-gray-900 hover:from-purple-700 hover:to-black text-white shadow-lg shadow-purple-500/25"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 md:px-12 pt-8 md:pt-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 border border-purple-200 mb-8">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-700 font-medium">AI-Powered Marketing Revolution</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight font-agrandir">
                <span className="text-gray-900">Introducing Weez.AI</span>
                <br />
                <span className="bg-gradient-to-r from-purple-600 via-violet-500 to-gray-900 bg-clip-text text-transparent">
                  The Future of Digital Marketing
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-8 text-center lg:text-center mx-auto lg:mx-0">
                Transform your marketing with AI that understands your brand, audience, and goals. 
                Create campaigns that convert, content that captivates, and strategies that scale.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-8">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-purple-600 to-gray-900 hover:from-purple-700 hover:to-black text-white px-8 py-6 text-lg group shadow-xl shadow-purple-500/25"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="px-8 py-6 text-lg border-purple-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300"
                >
                  Watch Demo
                </Button>
              </div>

              {/* Benefits */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Hero Illustration */}
            <div className="hidden lg:block relative">
              <img 
                src={heroIllustration} 
                alt="Marketing collage showcasing creative designs" 
                className="w-full max-w-xl mx-auto rounded-2xl shadow-2xl shadow-purple-500/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Uniqueness Section */}
      <section id="uniqueness" className="relative z-10 px-6 md:px-12 py-20 bg-gradient-to-b from-purple-50/50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 font-agrandir">
              Everything You Need to
              <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent"> Dominate </span>
              Digital Marketing
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Our AI-powered platform provides all the tools you need to create, optimize, and scale your marketing efforts.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-2xl bg-white border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 group-hover:from-purple-600 group-hover:to-gray-900 group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 font-agrandir">
              Simple, Transparent
              <span className="bg-gradient-to-r from-purple-600 to-violet-500 bg-clip-text text-transparent"> Pricing</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Choose the plan that fits your needs. Scale as you grow.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Starter Plan */}
            <div className="relative p-8 rounded-3xl bg-white border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                <p className="text-sm text-gray-500">Best for solo marketers & freelancers</p>
              </div>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$49</span>
                <span className="text-gray-500"> / month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">AI Chat with assets (files, images, videos)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Proposal Generator (limited usage)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Creative Mode (basic)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Monthly usage limits (fair use)</span>
                </li>
              </ul>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-6">
                <div className="flex items-center gap-2 text-amber-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Deep Research not included</span>
                </div>
              </div>

              <Button 
                onClick={() => navigate('/auth')}
                variant="outline"
                className="w-full py-6 border-purple-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300"
              >
                Get Started
              </Button>
            </div>

            {/* Pro Plan - Featured */}
            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-purple-600 via-violet-600 to-gray-900 text-white shadow-2xl shadow-purple-500/30 scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 text-sm font-semibold shadow-lg">
                  <Star className="w-4 h-4 fill-current" />
                  Most Popular
                </div>
              </div>
              
              <div className="mb-6 pt-2">
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <p className="text-sm text-purple-200">Best for small to mid-size agencies</p>
              </div>
              
              <div className="mb-6">
                <span className="text-4xl font-bold">$149</span>
                <span className="text-purple-200"> / month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">AI Chat with full asset intelligence</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">Proposal Generator (unlimited)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">Deep Research Mode</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">Creative Mode (advanced)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">Higher context memory</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-300 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-100 text-sm">Faster AI generations</span>
                </li>
              </ul>

              <Button 
                onClick={() => navigate('/auth')}
                className="w-full py-6 bg-white text-purple-700 hover:bg-purple-50"
              >
                Get Started
              </Button>
            </div>

            {/* Agency Plan */}
            <div className="relative p-8 rounded-3xl bg-white border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Agency</h3>
                <p className="text-sm text-gray-500">Best for agencies managing multiple brands</p>
              </div>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$399</span>
                <span className="text-gray-500"> / month</span>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Multiple brand workspaces</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Client-specific AI memory</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Priority inference</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Early access to automation features</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 text-sm">Higher usage & generation limits</span>
                </li>
              </ul>

              <Button 
                onClick={() => navigate('/auth')}
                variant="outline"
                className="w-full py-6 border-purple-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300"
              >
                Get Started
              </Button>
            </div>
          </div>

          {/* Add-ons Section */}
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 font-agrandir mb-2">Optional Add-ons</h3>
              <p className="text-gray-500">Add flexibility and scale without bloating your plan</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">Extra Deep Research Credits</p>
                <p className="text-lg font-bold text-purple-600">$29 / pack</p>
              </div>
              <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">Extra Creative Generations</p>
                <p className="text-lg font-bold text-purple-600">$49</p>
              </div>
              <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">White-label Access</p>
                <p className="text-lg font-bold text-purple-600">$199 / month</p>
                <p className="text-xs text-gray-400 mt-1">Coming soon</p>
              </div>
              <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">Custom Onboarding & Setup</p>
                <p className="text-lg font-bold text-purple-600">$499 – $1,499</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-purple-600 via-violet-600 to-gray-900 text-white shadow-2xl shadow-purple-500/30">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-agrandir">
              Ready to Transform Your Marketing?
            </h2>
            <p className="text-purple-100 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already using Weez.AI to revolutionize their digital marketing.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-white text-purple-700 hover:bg-purple-50 px-10 py-6 text-lg shadow-lg"
            >
              Get Started for Free
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-12 py-12 border-t border-purple-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Brand Column */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <img src={dexraflowLogo} alt="Dexraflow" className="h-10 w-auto" />
              </div>
              <p className="text-sm text-gray-500">
                Weez.AI - Creative OS for Marketing Teams & Brands, Redefining How Marketing Works
              </p>
            </div>
            
            {/* Product Column */}
            <div className="flex flex-col gap-3">
              <h4 className="font-semibold text-gray-900">Product</h4>
              <Link to="/auth" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Get Started</Link>
              <a href="#features" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Pricing</a>
            </div>
            
            {/* Legal Column */}
            <div className="flex flex-col gap-3">
              <h4 className="font-semibold text-gray-900">Legal</h4>
              <Link to="/privacy-policy" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Privacy Policy</Link>
              <Link to="/terms-conditions" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Terms & Conditions</Link>
              <a href="mailto:support@dexraflow.com" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">Contact Support</a>
            </div>
          </div>
          
          <div className="pt-8 border-t border-purple-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © 2025 Dexraflow. All rights reserved.
            </p>
            <p className="text-sm text-gray-400">
              Weez.AI is a registered trademark of Dexraflow.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
