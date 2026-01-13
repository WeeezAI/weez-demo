import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, Zap, ChevronRight } from "lucide-react";

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

interface ContentIdeasProps {
  onGenerateClick: (prompt: string) => void;
  disabled?: boolean;
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

const ContentIdeas = ({ onGenerateClick, disabled }: ContentIdeasProps) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Content Ideas for Today
        </h2>
        <p className="text-muted-foreground">
          Get started with these AI-powered content suggestions tailored for your brand
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {contentIdeas.map((idea) => (
          <Card 
            key={idea.id} 
            className="group hover:border-primary/40 transition-all duration-200 hover:shadow-md"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
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
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">Why this works: </span>
                  <span className="text-muted-foreground">{idea.whyItWorks}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Expected Outcome: </span>
                  <span className="text-muted-foreground">{idea.expectedOutcome}</span>
                </div>
              </div>
              
              <Button
                onClick={() => onGenerateClick(idea.prompt)}
                disabled={disabled}
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                variant="outline"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                One-Click Generate
                <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ContentIdeas;
