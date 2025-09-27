import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, FileText, Search, Presentation, ClipboardList, ArrowLeft, Loader2, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuggestionBubbles from "./SuggestionBubbles";
import ProgressSteps from "./ProgressSteps";
import DocumentCard from "./DocumentCard";
import { searchDocuments, demoDocuments } from "@/data/demoDocuments";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "search" | "summary" | "qna" | "rfp" | "presentation" | "report" | "progress" | "welcome";
  documents?: any[];
  actions?: string[];
  isProgress?: boolean;
  progressSteps?: string[];
}

interface ChatInterfaceProps {
  initialExample?: string;
  onBackToCapabilities: () => void;
}

const ChatInterface = ({ initialExample, onBackToCapabilities }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      type: "welcome",
      content: "Welcome to the Weez.AI demo 👋. You can try me by asking to search documents, get summaries, run Q&A (RAG), or even generate new deliverables like RFPs, reports, or presentations — all using this demo data.",
      actions: ["🔍 Search", "📄 Summarize", "🤖 RAG Q&A", "📝 Create RFP", "📊 Make Presentation", "📑 Create Report"]
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const { toast } = useToast();

  // Auto-send initial example when provided
  useEffect(() => {
    if (initialExample) {
      setInput(initialExample);
      setTimeout(() => {
        handleSend(initialExample);
      }, 500);
    }
  }, [initialExample]);

  const handleSuggestionClick = (suggestion: string) => {
    // Show micro-visualization toast
    toast({
      title: "Preparing demo data...",
      description: "Loading documents and processing request",
      duration: 1000,
    });
    
    setTimeout(() => {
      handleSend(suggestion);
    }, 800);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput("");
    setIsLoading(true);

    // Determine response type and handle accordingly
    const lowInput = textToSend.toLowerCase();
    
    if (lowInput.includes("search") || lowInput.includes("find")) {
      handleSearch(textToSend);
    } else if (lowInput.includes("rfp") || lowInput.includes("request for proposal")) {
      handleRFPGeneration(textToSend);
    } else if (lowInput.includes("presentation") || lowInput.includes("slide")) {
      handlePresentationGeneration(textToSend);
    } else if (lowInput.includes("summary") || lowInput.includes("summarize")) {
      handleSummarization(textToSend);
    } else if (lowInput.includes("report")) {
      handleReportGeneration(textToSend);
    } else {
      // Default Q&A response
      setTimeout(() => {
        const response = generateDefaultResponse(textToSend);
        setMessages(prev => [...prev, response]);
        setIsLoading(false);
      }, 1200);
    }
  };

  const handleSearch = (query: string) => {
    // Show search progress
    const searchMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Searching demo corpus — scanning 24 documents...",
      type: "search",
      isProgress: true
    };
    
    setMessages(prev => [...prev, searchMessage]);
    
    setTimeout(() => {
      const results = searchDocuments(query);
      const response: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `**Search Results:**\n\nFound ${results.length} relevant documents:`,
        type: "search",
        documents: results,
        actions: ["Summarize Results", "Create RFP", "Make Presentation"]
      };
      
      setMessages(prev => prev.slice(0, -1).concat([response]));
      setIsLoading(false);
    }, 1400);
  };

  const handleRFPGeneration = (query: string) => {
    const steps = [
      "Generating RFP — Step 1/3: drafting executive summary...",
      "Generating RFP — Step 2/3: assembling scope & deliverables...",
      "Generating RFP — Step 3/3: formatting & finalizing..."
    ];
    
    setProgressSteps(steps);
    setShowProgress(true);
    
    setTimeout(() => {
      setShowProgress(false);
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Generated RFP: Data Migration Project**\n\n**Executive Summary:**\nEnterprise data migration from legacy systems to modern cloud infrastructure.\n\n**Project Overview:**\n• **Budget:** $500,000\n• **Timeline:** 6 months\n• **Scope:** End-to-end data center migration\n\n**Key Requirements:**\n• Data assessment and mapping\n• Migration strategy and execution\n• Security and compliance validation\n• Testing and quality assurance\n• Training and documentation\n\n**Deliverables:**\n• Migration plan and timeline\n• Risk assessment report\n• Security implementation guide\n• Performance benchmarks\n\n**Evaluation Criteria:**\n• Technical Depth (30%)\n• Cost (25%)\n• Security & Compliance (20%)\n• SLA & Uptime (15%)\n• References & Past Projects (10%)\n\n---\n**Executive Summary:** This RFP seeks a qualified vendor to execute a $500K, 6-month data migration project with comprehensive security validation and post-migration support.`,
        type: "rfp",
        actions: ["Download .docx", "Download PDF", "Make Presentation", "Create Report"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 4500);
  };

  const handlePresentationGeneration = (query: string) => {
    const steps = [
      "Converting content → Slide deck (6 slides)...",
      "Generating slide content and structure...",
      "Finalizing presentation format..."
    ];
    
    setProgressSteps(steps);
    setShowProgress(true);
    
    setTimeout(() => {
      setShowProgress(false);
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Presentation: Enterprise Cloud Migration Strategy**\n\n**Slide 1:** Executive Summary\n• Key benefits and ROI projections\n• Strategic overview and objectives\n\n**Slide 2:** Multi-Cloud Cost Optimization\n• 25-40% cost reduction strategies\n• Automated workload placement\n• Resource optimization techniques\n\n**Slide 3:** Migration Strategy\n• Timeline and budget considerations\n• Risk mitigation approaches\n• Phase-by-phase implementation\n\n**Slide 4:** Security & Compliance\n• Data protection frameworks\n• Regulatory requirements (GDPR/CCPA)\n• Identity and access management\n\n**Slide 5:** Implementation Roadmap\n• Phase 1: Discovery and assessment\n• Phase 2: Pilot migration\n• Phase 3: Bulk migration and cutover\n\n**Slide 6:** Success Metrics & Next Steps\n• Performance benchmarks\n• Success criteria and KPIs\n• Contact information and timeline`,
        type: "presentation",
        actions: ["Preview Slides", "Download PPTX", "Export as PDF", "Get Speaker Notes"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 3800);
  };

  const handleSummarization = (query: string) => {
    setTimeout(() => {
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Executive Summary:**\n\n• **Multi-cloud optimization** can reduce infrastructure costs by 25–40%\n• **Enterprise SaaS implementations** show 60% efficiency improvements\n• **Data migration projects** require comprehensive security and compliance frameworks\n• **Cloud security assessments** are critical for maintaining regulatory compliance\n• **Vendor evaluation** should prioritize technical depth, cost, and SLA commitments\n• **Implementation success** depends on proper planning, testing, and change management\n\n---\n*This summary covers key findings from our demo document corpus focusing on cloud migration, cost optimization, and enterprise implementation strategies.*`,
        type: "summary",
        actions: ["Create RFP", "Make Presentation", "Generate Report", "Show Full Files"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 1200);
  };

  const handleReportGeneration = (query: string) => {
    setTimeout(() => {
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Report: Cloud Migration Strategy Analysis**\n\n**1. Executive Overview**\nEnterprise cloud migration represents a critical strategic initiative with potential for significant cost reduction and operational improvements.\n\n**2. Cost Optimization Opportunities**\n• Multi-cloud strategies can reduce TCO by 25-40%\n• Automated workload placement optimizes resource utilization\n• Rightsizing and governance policies prevent cost overruns\n\n**3. Security Requirements**\n• Identity and access management with least privilege\n• Data encryption at rest and in transit\n• Continuous vulnerability scanning and SIEM integration\n• Compliance with GDPR, CCPA, and industry regulations\n\n**4. Implementation Strategy**\n• Phase 1: Discovery and assessment (4-6 weeks)\n• Phase 2: Pilot migration (6-8 weeks)\n• Phase 3: Bulk migration (12-16 weeks)\n• Phase 4: Optimization and cutover (4-6 weeks)\n\n**5. Risk Mitigation**\n• Legacy system compatibility assessment\n• Data egress cost management\n• Comprehensive testing protocols\n• Rollback and disaster recovery procedures\n\n**6. Success Metrics**\n• RTO improvement to <2 hours\n• 25% TCO reduction within 12 months\n• 99.9% uptime SLA achievement\n• Zero security incidents during migration`,
        type: "report",
        actions: ["Download Report", "Create Executive Summary", "Make Presentation", "Generate RFP"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 2000);
  };

  const generateDefaultResponse = (userInput: string): Message => {
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `I can help you with:\n\n🔍 **Search documents** - "Search multi-cloud optimization"\n📋 **Summarize content** - "Summarize the latest reports"\n❓ **Q&A (RAG)** - "What are the security requirements for cloud migration?"\n📄 **Generate RFPs** - "Create an RFP for a $500K data migration project"\n📊 **Create presentations** - "Make a slide deck about cloud strategy"\n📑 **Generate reports** - "Create a 1-page report on cost optimization"\n\nTry one of these examples or ask me anything else!`,
      actions: ["Search Documents", "Create RFP", "Make Presentation", "Generate Summary"]
    };
  };

  const handleActionClick = (action: string) => {
    const actionMap: { [key: string]: string } = {
      "🔍 Search": "Search multi-cloud cost optimization",
      "📄 Summarize": "Summarize the latest cloud migration reports",
      "🤖 RAG Q&A": "What are key security requirements for enterprise cloud?",
      "📝 Create RFP": "Create an RFP for a data migration project with $500K budget, 6 months",
      "📊 Make Presentation": "Make a 6-slide presentation on cloud migration risks & mitigation",
      "📑 Create Report": "Create a 1-page report on cost optimization opportunities",
      "Search Documents": "Search multi-cloud cost optimization",
      "Create RFP": "Create an RFP for a $500K data migration project",
      "Make Presentation": "Make a slide deck about cloud strategy",
      "Generate Summary": "Summarize the latest reports",
      "Summarize Results": "Summarize these search results",
      "Download .docx": "download-docx",
      "Download PDF": "download-pdf",
      "Preview Slides": "preview-slides",
      "Download PPTX": "download-pptx"
    };
    
    const mappedAction = actionMap[action];
    if (mappedAction) {
      if (mappedAction.startsWith("download-") || mappedAction.startsWith("preview-")) {
        toast({
          title: `${action} initiated`,
          description: `Your ${action.toLowerCase()} is being prepared...`,
          duration: 2000,
        });
      } else {
        handleSend(mappedAction);
      }
    }
  };

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") return <User className="w-4 h-4" />;
    
    if (message.isProgress) return <Loader2 className="w-4 h-4 text-weez-blue animate-spin" />;
    
    switch (message.type) {
      case "search": return <Search className="w-4 h-4 text-weez-blue" />;
      case "rfp": return <ClipboardList className="w-4 h-4 text-weez-blue" />;
      case "presentation": return <Presentation className="w-4 h-4 text-weez-blue" />;
      case "summary": 
      case "report": return <FileText className="w-4 h-4 text-weez-blue" />;
      case "welcome": return <Bot className="w-4 h-4 text-weez-blue" />;
      default: return <Bot className="w-4 h-4 text-weez-blue" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Back button */}
      <div className="p-4 border-b border-weez-blue/20">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToCapabilities}
            className="mb-2 text-weez-text hover:bg-weez-surface"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Capabilities
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {showProgress && (
            <ProgressSteps
              steps={progressSteps}
              duration={4000}
              onComplete={() => setShowProgress(false)}
            />
          )}
          
          {messages.map((message) => (
            <Card key={message.id} className={`message-enter p-4 ${
              message.role === "user" 
                ? "ml-12 bg-weez-surface border-weez-blue/10" 
                : "mr-12 bg-weez-card border-weez-blue/20"
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  message.role === "user" 
                    ? "bg-weez-surface" 
                    : message.isProgress 
                      ? "bg-weez-blue/20" 
                      : "bg-gradient-primary"
                }`}>
                  {getMessageIcon(message)}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="whitespace-pre-line text-sm leading-relaxed text-weez-text">
                    {message.content}
                  </div>
                  
                  {/* Document cards */}
                  {message.documents && message.documents.length > 0 && (
                    <div className="space-y-3">
                      {message.documents.map((doc, index) => (
                        <DocumentCard
                          key={index}
                          title={doc.title}
                          type={doc.type}
                          date={doc.date}
                          snippet={doc.snippet}
                          onOpen={() => toast({
                            title: "Opening document",
                            description: `Opening ${doc.title}...`,
                            duration: 2000,
                          })}
                          onSummarize={() => handleActionClick("Summarize Results")}
                          onCite={() => toast({
                            title: "Citation copied",
                            description: `Citation for ${doc.title} copied to clipboard`,
                            duration: 2000,
                          })}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {message.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleActionClick(action)}
                          className="bg-weez-blue/10 border-weez-blue/30 text-weez-blue hover:bg-weez-blue/20"
                        >
                          {action.includes("Download") && <Download className="w-3 h-3 mr-1" />}
                          {action.includes("Preview") && <ExternalLink className="w-3 h-3 mr-1" />}
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          
          {isLoading && !showProgress && (
            <Card className="mr-12 bg-weez-card border-weez-blue/20 p-4">
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-primary">
                  <Bot className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-weez-blue rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-weez-blue rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-weez-blue rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </ScrollArea>
      
      <div className="border-t border-weez-blue/20 p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <SuggestionBubbles 
            onSuggestionClick={handleSuggestionClick}
            disabled={isLoading}
          />
          
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try: "Search multi-cloud cost optimization" OR "Create an RFP for a $500K data migration"'
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
              disabled={isLoading}
              className="flex-1 bg-weez-surface border-weez-blue/20 text-weez-text placeholder:text-weez-text/50 focus:border-weez-blue"
            />
            <Button 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim()}
              className="shadow-button bg-weez-blue hover:bg-weez-blue-light"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;