import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, FileText, MessageCircle, ClipboardList, Presentation, Zap } from "lucide-react";

interface CapabilityCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  example: string;
  onClick: (example: string) => void;
}

const CapabilityCard = ({ icon, title, description, example, onClick }: CapabilityCardProps) => (
  <Card className="p-6 hover:shadow-soft transition-shadow cursor-pointer border-l-4 border-l-primary" 
        onClick={() => onClick(example)}>
    <div className="flex items-start space-x-4">
      <div className="flex items-center justify-center w-12 h-12 bg-gradient-primary rounded-lg">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        <Button variant="outline" size="sm" className="text-xs">
          Try: "{example}"
        </Button>
      </div>
    </div>
  </Card>
);

interface CapabilitiesPanelProps {
  onExampleClick: (example: string) => void;
}

const CapabilitiesPanel = ({ onExampleClick }: CapabilitiesPanelProps) => {
  const capabilities = [
    {
      icon: <Search className="w-6 h-6 text-white" />,
      title: "Document Search",
      description: "Intelligent search across your document corpus with contextual results and snippets.",
      example: "Search multi-cloud cost optimization"
    },
    {
      icon: <FileText className="w-6 h-6 text-white" />,
      title: "Smart Summaries", 
      description: "Generate executive summaries from multiple documents with key insights and bullet points.",
      example: "Summarize the latest cloud migration reports"
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-white" />,
      title: "RAG Q&A",
      description: "Ask questions and get accurate answers based on your document corpus and general knowledge.",
      example: "What are the key security requirements for enterprise cloud migration?"
    },
    {
      icon: <ClipboardList className="w-6 h-6 text-white" />,
      title: "RFP Generation",
      description: "Create structured RFPs based on your requirements, budget, and timeline specifications.",
      example: "Create an RFP for a data migration project with $500K budget and 6 month timeline"
    },
    {
      icon: <Presentation className="w-6 h-6 text-white" />,
      title: "Presentation Creation",
      description: "Transform summaries and RFPs into structured slide decks with clear outlines.",
      example: "Make a presentation about enterprise cloud strategy"
    },
    {
      icon: <Zap className="w-6 h-6 text-white" />,
      title: "Report Generation",
      description: "Generate comprehensive reports with structured sections, data analysis, and recommendations.",
      example: "Generate a cloud optimization report with cost analysis"
    }
  ];

  return (
    <div className="p-6 bg-gradient-subtle min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Experience Weez.AI Capabilities
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover how our AI can transform your document workflows. Click any capability below to try it with our demo data.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((capability, index) => (
            <CapabilityCard
              key={index}
              {...capability}
              onClick={onExampleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CapabilitiesPanel;