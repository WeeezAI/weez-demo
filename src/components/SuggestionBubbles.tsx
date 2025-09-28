import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SuggestionBubblesProps {
  onSuggestionClick: (suggestion: string) => void;
  disabled: boolean;
}

const suggestions = [
  "Search campaign performance data",
  "Summarize Q4 Holiday Campaign Brief",
  "What are our top-performing creative assets?",
  "Create an RFP for influencer marketing campaign",
  "Make a presentation on brand refresh strategy",
  "Generate a competitor analysis report",
  "Create a campaign performance summary",
  "Analyze social media benchmarking data",
  "Show me the Nike partnership pitch deck",
  "Extract key insights from Meta Ads performance",
  "Generate creative brief for sustainability campaign",
  "What are the latest brand guideline updates?"
];

const SuggestionBubbles = ({ onSuggestionClick, disabled }: SuggestionBubblesProps) => {
  return (
    <div className="pb-2">
      <ScrollArea className="w-full">
        <div className="flex space-x-2 px-4">
          {suggestions.slice(0, 8).map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(suggestion)}
              disabled={disabled}
              className="suggestion-bubble whitespace-nowrap bg-card border-border text-foreground hover:bg-muted hover:border-weez-accent/40 flex-shrink-0"
            >
              {suggestion.length > 40 ? suggestion.substring(0, 40) + "..." : suggestion}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SuggestionBubbles;