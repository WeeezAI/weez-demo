import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, FileText, Search, Presentation, ClipboardList, Loader2, Download, ExternalLink, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuggestionBubbles from "./SuggestionBubbles";
import DocumentCard from "./DocumentCard";
import { searchDocuments } from "@/data/demoDocuments";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "search" | "summary" | "qna" | "rfp" | "presentation" | "report" | "progress" | "welcome";
  documents?: any[];
  actions?: string[];
  isProgress?: boolean;
}

interface ChatInterfaceProps {
  initialExample?: string;
  onConnectorMessage?: (message: string) => void;
}

const ChatInterface = ({ initialExample, onConnectorMessage }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-send initial example when provided
  useEffect(() => {
    if (initialExample) {
      setInputValue(initialExample);
      setTimeout(() => {
        handleSendMessage(initialExample);
      }, 500);
    }
  }, [initialExample]);

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSendMessage(suggestion);
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputValue;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInputValue("");
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
    setCurrentProgress("Searching demo corpus — scanning 24 documents...");
    
    setTimeout(() => {
      const results = searchDocuments(query);
      setCurrentProgress(null);
      
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Found ${results.length} relevant documents in our demo corpus:`,
        type: "search",
        documents: results,
        actions: ["Summarize Results", "Create RFP", "Make Presentation"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 1400);
  };

  const handleRFPGeneration = (query: string) => {
    setCurrentProgress("Generating RFP — Step 1/3: drafting executive summary...");
    
    setTimeout(() => {
      setCurrentProgress("Generating RFP — Step 2/3: assembling scope & deliverables...");
    }, 1500);
    
    setTimeout(() => {
      setCurrentProgress("Generating RFP — Step 3/3: formatting & finalizing...");
    }, 3000);
    
    setTimeout(() => {
      setCurrentProgress(null);
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
    setCurrentProgress("Converting content → Slide deck (6 slides)...");
    
    setTimeout(() => {
      setCurrentProgress("Generating slide content and structure...");
    }, 1200);
    
    setTimeout(() => {
      setCurrentProgress("Finalizing presentation format...");
    }, 2400);
    
    setTimeout(() => {
      setCurrentProgress(null);
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
        handleSendMessage(mappedAction);
      }
    }
  };

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") return <User className="w-4 h-4" />;
    
    if (message.isProgress) return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    
    switch (message.type) {
      case "search": return <Search className="w-4 h-4 text-primary" />;
      case "rfp": return <ClipboardList className="w-4 h-4 text-primary" />;
      case "presentation": return <Presentation className="w-4 h-4 text-primary" />;
      case "summary": 
      case "report": return <FileText className="w-4 h-4 text-primary" />;
      case "welcome": return <Bot className="w-4 h-4 text-primary" />;
      default: return <Bot className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Welcome message */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Experience Weez.AI Capabilities</h2>
              <p className="text-muted-foreground">
                Try searching documents, get summaries, run Q&A (RAG), or generate new deliverables like RFPs, reports, or presentations — all using demo data.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Search multi-cloud cost optimization")}>
                🔍 Search
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Summarize Cloud Migration Report 2024")}>
                📄 Summarize
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("What are key security requirements for enterprise cloud?")}>
                🤖 RAG Q&A
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Create an RFP for a data migration project with $500K budget, 6 months")}>
                📝 Create RFP
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Make a 6-slide presentation on cloud migration risks & mitigation")}>
                📊 Make Presentation
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Create a 1-page report on cost optimization opportunities")}>
                📑 Create Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      {messages.length > 0 && (
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-4xl mx-auto py-6 space-y-5">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-[18px] py-[14px] ${
                  message.role === 'user' 
                    ? 'bg-primary text-white ml-12' 
                    : 'bg-gradient-to-br from-muted to-card text-foreground mr-12'
                }`}>
                  <div className="flex items-start space-x-3">
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 mt-1">
                        {getMessageIcon(message)}
                      </div>
                    )}
                    <div className="flex-1 space-y-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      
                      {message.documents && message.documents.length > 0 && (
                        <div className="space-y-2">
                          {message.documents.map((doc, docIndex) => (
                            <DocumentCard
                              key={docIndex}
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
                      
                      {message.actions && message.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-3">
                          {message.actions.map((action, actionIndex) => (
                            <Button
                              key={actionIndex}
                              variant="outline"
                              size="sm"
                              onClick={() => handleActionClick(action)}
                              className="text-xs px-4 py-2 rounded-xl bg-accent/10 border-accent/20 text-accent hover:bg-accent/20 hover:border-accent/40 transition-all hover:scale-105"
                            >
                              {action}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Progress indicator */}
      {currentProgress && (
        <div className="px-4 py-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-start">
              <div className="bg-muted/30 rounded-2xl px-[18px] py-[14px] mr-12 border border-border/20">
                <p className="text-sm text-muted-foreground flex items-center">
                  <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full mr-2"></div>
                  {currentProgress}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <SuggestionBubbles onSuggestionClick={handleSuggestionClick} disabled={isLoading} />
          <div className="flex space-x-3">
            <Button
              variant="outline"  
              size="icon"
              className="flex-shrink-0 w-10 h-10 rounded-full border-border hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              placeholder="Ask me anything... e.g. 'Create RFP for $500k data migration'"
              className="flex-1 h-10 rounded-full bg-input border-border text-foreground placeholder-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              size="icon"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all"
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