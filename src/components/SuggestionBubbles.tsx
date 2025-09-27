import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SuggestionBubblesProps {
  onSuggestionClick: (suggestion: string) => void;
  disabled: boolean;
}

const suggestions = [
  "Search multi-cloud cost optimization",
  "Summarize \"Cloud Migration Report 2024\" (exec summary)",
  "What are key security requirements for enterprise cloud?",
  "Create an RFP for a data migration project with $500K budget, 6 months",
  "Make a 6-slide presentation on cloud migration risks & mitigation",
  "Generate a vendor comparison for AWS vs Azure vs GCP",
  "Create a 1-page report on cost optimization opportunities (short)",
  "Summarize the RFP \"Acme Corp - Data Center Exit\" (bullets)",
  "Show me the full file: \"Acme Cloud Migration Plan 2024\"",
  "Extract the timeline and deliverables from \"Cloud Migration RFP - Demo\"",
  "Generate vendor comparison: AWS vs Azure vs GCP",
  "What are the security requirements for cloud migration?"
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
              className="suggestion-bubble whitespace-nowrap bg-weez-surface border-weez-blue/20 text-weez-text hover:bg-weez-blue/10 hover:border-weez-blue/40 flex-shrink-0"
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