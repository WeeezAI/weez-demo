import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Zap, TrendingUp, Users, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface ContentIdea {
  id: string;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  whyItWorks: string;
  expectedOutcome: string;
  prompt: string;
  icon: React.ReactNode;
}

const contentIdeas: ContentIdea[] = [
  {
    id: "offer-post",
    title: "Post an Offer Today",
    badge: "Highly Recommended",
    badgeVariant: "default",
    whyItWorks: "Limited-time offers create urgency and drive immediate engagement. Posts with clear value propositions see 3x higher click-through rates.",
    expectedOutcome: "15-25% increase in engagement, higher conversion rates, and boosted visibility in follower feeds.",
    prompt: "Create a compelling limited-time offer post for my audience. Include attention-grabbing headline, clear value proposition, urgency elements, and a strong call-to-action.",
    icon: <TrendingUp className="w-5 h-5 text-primary" />,
  },
  {
    id: "hiring-story",
    title: "Hiring Story",
    badge: "Great for Growth",
    badgeVariant: "secondary",
    whyItWorks: "Hiring posts humanize your brand and show growth. They attract talent while demonstrating company culture and success.",
    expectedOutcome: "Increased brand credibility, organic reach through shares, and qualified applicant interest.",
    prompt: "Create an engaging hiring story post that showcases our company culture, highlights the role we're hiring for, and encourages qualified candidates to apply. Make it personal and authentic.",
    icon: <Users className="w-5 h-5 text-primary" />,
  },
  {
    id: "behind-scenes",
    title: "Behind-the-Scenes Content",
    badge: "Builds Trust",
    badgeVariant: "outline",
    whyItWorks: "Authentic behind-the-scenes content builds emotional connections. It shows the human side of your brand and increases follower loyalty.",
    expectedOutcome: "Higher engagement rates, increased story views, and stronger community connection.",
    prompt: "Create a behind-the-scenes post that shows our team at work, our process, or a day in the life at our company. Make it authentic and relatable.",
    icon: <Sparkles className="w-5 h-5 text-primary" />,
  },
  {
    id: "product-launch",
    title: "Product Launch Teaser",
    badge: "High Impact",
    badgeVariant: "default",
    whyItWorks: "Teasers build anticipation and create buzz before a launch. They prime your audience and maximize launch day engagement.",
    expectedOutcome: "Pre-launch excitement, higher launch day conversions, and increased brand awareness.",
    prompt: "Create a product launch teaser post that builds excitement and anticipation. Include hints about features, a countdown element, and encourage followers to stay tuned.",
    icon: <Zap className="w-5 h-5 text-primary" />,
  },
];

const OneClickPost = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();

  useEffect(() => {
    if (loadingAuth) return;
    if (!isAuthenticated) navigate("/auth");
  }, [loadingAuth, isAuthenticated]);

  useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    const found = spaces.find((s) => s.id === spaceId);
    if (!found) {
      navigate("/spaces");
      return;
    }
    selectSpace(found);
  }, [spaces, spaceId]);

  if (loadingAuth || !currentSpace) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  const handleGenerate = (prompt: string) => {
    // Navigate to chat with the prompt as a query parameter
    navigate(`/chat/${spaceId}?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/chat/${spaceId}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-6 h-6" />
              One Click Post
            </h1>
            <p className="text-sm text-muted-foreground">{currentSpace.name}</p>
          </div>
        </div>

        {/* Description */}
        <div className="text-center mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            AI-Powered Content Ideas
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select a content idea below and generate professional social media content with just one click. 
            Each suggestion is optimized for engagement and tailored for your brand.
          </p>
        </div>

        {/* Content Ideas Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {contentIdeas.map((idea) => (
            <Card 
              key={idea.id} 
              className="group hover:border-primary/40 transition-all duration-200 hover:shadow-lg"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      {idea.icon}
                    </div>
                    <CardTitle className="text-lg">{idea.title}</CardTitle>
                  </div>
                  {idea.badge && (
                    <Badge variant={idea.badgeVariant} className="shrink-0 text-xs">
                      {idea.badge}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Why this works</p>
                  <p className="text-sm text-foreground">{idea.whyItWorks}</p>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Expected Outcome</p>
                  <p className="text-sm text-foreground">{idea.expectedOutcome}</p>
                </div>

                <Button 
                  onClick={() => handleGenerate(idea.prompt)}
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  size="lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  One-Click Generate
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <Card className="p-6 bg-muted/30 border-dashed">
            <h3 className="font-semibold text-foreground mb-2">Want Custom Content Ideas?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Go to the chat and describe your specific content needs. Our AI will create personalized suggestions just for you.
            </p>
            <Button variant="outline" onClick={() => navigate(`/chat/${spaceId}`)}>
              Open Chat
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OneClickPost;
