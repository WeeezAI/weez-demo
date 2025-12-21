import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, Zap, Target, TrendingUp, Users, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import Hero3DElement from "@/components/Hero3DElement";

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-gray-900 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-gray-900 bg-clip-text text-transparent">
            Weez.AI
          </span>
        </div>
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
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                <span className="text-gray-900">The Future of</span>
                <br />
                <span className="bg-gradient-to-r from-purple-600 via-violet-500 to-gray-900 bg-clip-text text-transparent">
                  Digital Marketing
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-8">
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

            {/* Right 3D Element */}
            <div className="hidden lg:block relative">
              <Hero3DElement />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-6 md:px-12 py-20 bg-gradient-to-b from-purple-50/50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
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

      {/* CTA Section */}
      <section className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-purple-600 via-violet-600 to-gray-900 text-white shadow-2xl shadow-purple-500/30">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
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
      <footer className="relative z-10 px-6 md:px-12 py-8 border-t border-purple-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-gray-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Weez.AI</span>
          </div>
          <p className="text-sm text-gray-500">
            © 2025 Weez.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
