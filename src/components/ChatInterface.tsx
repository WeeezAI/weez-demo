import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, FileText, Search, Presentation, ClipboardList, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "search" | "summary" | "qna" | "rfp" | "presentation";
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
      content: "Welcome to the Weez.AI demo 👋. You can try me by asking to search documents, get summaries, run Q&A (RAG), or even generate new deliverables like RFPs, reports, or presentations — all using this demo data. Example: 'Search multi-cloud cost optimization' or 'Create an RFP for a data migration project with $500K budget and 6 month timeline'."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  // Mock demo data
  const demoData = {
    documents: [
      { title: "Multi-Cloud Cost Optimization Strategy", type: "Report", snippet: "Organizations implementing multi-cloud strategies can reduce costs by 25-40% through automated workload placement and resource optimization across AWS, Azure, and GCP platforms." },
      { title: "Enterprise Data Migration RFP Template", type: "RFP", snippet: "Comprehensive template for enterprise data migration projects including timeline, budget considerations, security requirements, and vendor evaluation criteria." },
      { title: "SaaS Implementation Case Study", type: "Case Study", snippet: "Successful implementation of enterprise SaaS solution resulting in 60% operational efficiency improvement and $2M annual savings." },
      { title: "Cloud Security Assessment Report", type: "Report", snippet: "Security audit findings and recommendations for cloud infrastructure including identity management, data protection, and compliance frameworks." }
    ]
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

    // Simulate AI processing
    setTimeout(() => {
      const response = generateResponse(textToSend);
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 1500);
  };

  const generateResponse = (userInput: string): Message => {
    const lowInput = userInput.toLowerCase();
    
    if (lowInput.includes("search") || lowInput.includes("find")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Search Results:**\n\n${demoData.documents.slice(0, 2).map(doc => 
          `📄 **${doc.title}** (${doc.type})\n${doc.snippet}\n`
        ).join('\n')}\n*Do you want me to summarize these results or turn them into an RFP?*`,
        type: "search"
      };
    }
    
    if (lowInput.includes("rfp") || lowInput.includes("request for proposal")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Generated RFP: Data Migration Project**\n\n**Project Overview:**\nEnterprise data migration from legacy systems to modern cloud infrastructure\n\n**Budget:** $500,000\n**Timeline:** 6 months\n\n**Key Requirements:**\n• Data assessment and mapping\n• Migration strategy and execution\n• Security and compliance validation\n• Testing and quality assurance\n• Training and documentation\n\n**Deliverables:**\n• Migration plan and timeline\n• Risk assessment report\n• Security implementation guide\n• Performance benchmarks\n\n*Do you want me to make a slide deck or report version of this RFP?*`,
        type: "rfp"
      };
    }
    
    if (lowInput.includes("summary") || lowInput.includes("summarize")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Executive Summary:**\n\n• **Multi-cloud optimization** can reduce infrastructure costs by 25-40%\n• **Enterprise SaaS implementations** show 60% efficiency improvements\n• **Data migration projects** require comprehensive security and compliance frameworks\n• **Cloud security assessments** are critical for maintaining regulatory compliance\n\n*Would you like me to create a presentation or generate an RFP based on this summary?*`,
        type: "summary"
      };
    }
    
    if (lowInput.includes("presentation") || lowInput.includes("slide")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Presentation Outline: Enterprise Cloud Strategy**\n\n**Slide 1:** Executive Summary\n- Key benefits and ROI projections\n\n**Slide 2:** Multi-Cloud Cost Optimization\n- 25-40% cost reduction strategies\n- Automated workload placement\n\n**Slide 3:** Migration Strategy\n- Timeline and budget considerations\n- Risk mitigation approaches\n\n**Slide 4:** Security & Compliance\n- Data protection frameworks\n- Regulatory requirements\n\n**Slide 5:** Implementation Roadmap\n- Phase-by-phase delivery plan\n- Success metrics\n\n*Would you like me to expand on any specific slide or create additional content?*`,
        type: "presentation"
      };
    }
    
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `I can help you with:\n\n🔍 **Search documents** - "Search multi-cloud optimization"\n📋 **Summarize content** - "Summarize the latest reports"\n❓ **Q&A (RAG)** - "What are the security requirements for cloud migration?"\n📄 **Generate RFPs** - "Create an RFP for a $500K data migration project"\n📊 **Create presentations** - "Make a slide deck about cloud strategy"\n\nTry one of these examples or ask me anything else!`
    };
  };

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") return <User className="w-4 h-4" />;
    
    switch (message.type) {
      case "search": return <Search className="w-4 h-4 text-weez-blue" />;
      case "rfp": return <ClipboardList className="w-4 h-4 text-weez-blue" />;
      case "presentation": return <Presentation className="w-4 h-4 text-weez-blue" />;
      case "summary": return <FileText className="w-4 h-4 text-weez-blue" />;
      default: return <Bot className="w-4 h-4 text-weez-blue" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="p-4 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToCapabilities}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Capabilities
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <Card key={message.id} className={`p-4 ${
              message.role === "user" ? "ml-12 bg-weez-gray-50" : "mr-12 bg-card"
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  message.role === "user" ? "bg-muted" : "bg-gradient-primary"
                }`}>
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    getMessageIcon(message)
                  )}
                </div>
                <div className="flex-1">
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {message.content}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {isLoading && (
            <Card className="mr-12 bg-card p-4">
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
      
      <div className="border-t border-border p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to search documents, create summaries, generate RFPs, or make presentations..."
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim()}
              className="shadow-button"
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