import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, Zap, ChevronRight, Loader2, BrainCircuit } from "lucide-react";
import { weezAPI, ContentIdea } from "@/services/weezAPI";
import { useAuth } from "@/contexts/AuthContext";

interface ContentIdeasProps {
  onGenerateClick: (idea: ContentIdea) => void;
  disabled?: boolean;
}

const ContentIdeas = ({ onGenerateClick, disabled }: ContentIdeasProps) => {
  const { currentSpace } = useAuth();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentSpace?.id) {
      fetchIdeas();
    }
  }, [currentSpace?.id]);

  const fetchIdeas = async () => {
    setIsLoading(true);
    try {
      const fetched = await weezAPI.getIdeas(currentSpace!.id);
      setIdeas(fetched);
    } catch (error) {
      console.error("Failed to fetch ideas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    if (type.toLowerCase().includes("product")) return <Zap className="w-5 h-5 text-primary" />;
    if (type.toLowerCase().includes("hiring")) return <Users className="w-5 h-5 text-primary" />;
    if (type.toLowerCase().includes("growth")) return <TrendingUp className="w-5 h-5 text-primary" />;
    return <Sparkles className="w-5 h-5 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
            <BrainCircuit className="w-10 h-10 text-primary" />
          </div>
          <Loader2 className="absolute inset-0 w-20 h-20 text-primary animate-spin opacity-20" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Curating ideas according to your brand...</h2>
          <p className="text-sm text-muted-foreground animate-pulse">
            Analyzing deep memory repositories and market patterns.
          </p>
        </div>
      </div>
    );
  }

  if (ideas.length === 0 && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-8 bg-white/40 rounded-[3rem] border border-dashed border-primary/10">
        <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto opacity-40">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black uppercase tracking-tight opacity-40">Intelligence Pool Empty.</h3>
          <p className="text-muted-foreground max-w-xs mx-auto text-sm font-medium">Define a custom breakthrough campaign above or refresh the pool to generate new tactical signals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Content Ideas for Today
        </h2>
        <p className="text-muted-foreground">
          AI-powered suggestions tailored for <span className="text-primary font-medium">{currentSpace?.name}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea, index) => (
          <Card
            key={index}
            className="group hover:border-primary/40 transition-all duration-200 hover:shadow-md h-full flex flex-col"
          >
            <CardHeader className="pb-3 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getIconForType(idea.content_type)}
                  </div>
                  <CardTitle className="text-lg leading-tight">{idea.headline}</CardTitle>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase font-mono tracking-wider">
                  {idea.content_type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3 text-sm text-left">
                <div>
                  <span className="font-semibold text-foreground/80">Strategy: </span>
                  <span className="text-muted-foreground">{idea.angle}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground/80">Expected Outcome: </span>
                  <span className="text-muted-foreground">{idea.expected_outcome}</span>
                </div>
              </div>

              <Button
                onClick={() => onGenerateClick(idea)}
                disabled={disabled}
                className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                variant="outline"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                One-Click Post
                <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ContentIdeas;
