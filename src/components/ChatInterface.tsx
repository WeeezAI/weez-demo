import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, FileText, Search, Presentation, ClipboardList, Loader2, Download, ExternalLink, Plus, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuggestionBubbles from "./SuggestionBubbles";
import DocumentCard from "./DocumentCard";
import LoadingAnimation from "./LoadingAnimation";
import FilePreviewCard from "./FilePreviewCard";
import { searchDocuments } from "@/data/demoDocuments";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "search" | "summary" | "qna" | "rfp" | "presentation" | "report" | "progress" | "welcome" | "loading";
  documents?: any[];
  actions?: string[];
  isProgress?: boolean;
  fileName?: string;
  fileSize?: string;
  fileType?: "docx" | "pdf" | "pptx";
}

interface ChatInterfaceProps {
  initialExample?: string;
  onConnectorMessage?: (message: string) => void;
}

const ChatInterface = ({ initialExample, onConnectorMessage }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'deep-research' | 'creative' | null>(null);
  const [currentProgress, setCurrentProgress] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-send initial example when provided
  useEffect(() => {
    if (initialExample) {
      setInputValue(initialExample);
      setTimeout(() => {
        handleSendMessage(initialExample);
      }, 500);
    }
  }, [initialExample]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSendMessage(suggestion);
  };

  const handleModeClick = (mode: 'deep-research' | 'creative') => {
    if (activeMode === mode) {
      setActiveMode(null);
      setInputValue("");
    } else {
      setActiveMode(mode);
      const prompt = mode === 'deep-research' 
        ? "Analyze the current market trends and provide comprehensive insights with data sources"
        : "Generate creative content ideas and marketing strategies for our latest campaign";
      setInputValue(prompt);
    }
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

    // Check if this is a mode-specific prompt
    if (activeMode === 'deep-research' && textToSend.includes("market trends")) {
      setActiveMode(null);
      simulateDeepResearchResponse();
      return;
    } else if (activeMode === 'creative' && textToSend.includes("creative content ideas")) {
      setActiveMode(null);
      simulateCreativeResponse();
      return;
    }

    // Determine response type and handle accordingly
    const lowInput = textToSend.toLowerCase();
    
    if (lowInput.includes("search") || lowInput.includes("find") || lowInput.includes("assets") || lowInput.includes("asset")) {
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

  const simulateDeepResearchResponse = () => {
    setCurrentProgress("Analyzing market data...");

    setTimeout(() => {
      setCurrentProgress("Gathering insights from multiple sources...");
    }, 1000);

    setTimeout(() => {
      setCurrentProgress("Generating comprehensive report...");
    }, 2000);

    setTimeout(() => {
      setCurrentProgress(null);
      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `# 📊 Deep Market Research Report

## Executive Summary
Based on comprehensive analysis across multiple data sources, here are the key market insights:

## 🎯 Market Trends Analysis

### Current Market Dynamics
- **Growth Rate**: Market showing 23% YoY growth
- **Key Drivers**: Digital transformation, automation, AI integration
- **Market Size**: Estimated $45B globally

### Consumer Sentiment Analysis

**Positive Indicators:**
- 78% customer satisfaction rate
- Strong brand recognition increasing by 15%
- High engagement on social platforms

**Areas of Concern:**
- Price sensitivity in emerging markets
- Competition intensifying in Q4
- Supply chain considerations

## 📈 Data Insights

### Source Analysis

**Reddit Discussions** ([r/technology](https://reddit.com/r/technology))
- 2.3K mentions in past 30 days
- Overall sentiment: 72% positive
- Key topics: Innovation, user experience

**Twitter Analytics** ([@TechNews](https://twitter.com/TechNews))
- 15.4K tweets analyzed
- Trending hashtags: #Innovation #DigitalTransformation
- Influencer engagement: High

**Industry Reports** ([TechCrunch](https://techcrunch.com))
- Featured in 12 major publications
- Analyst ratings: Mostly positive
- Investment interest increasing

## 💡 Strategic Recommendations

1. **Market Expansion**
   - Focus on untapped regions
   - Leverage digital channels
   - Partnership opportunities

2. **Product Development**
   - Enhance AI capabilities
   - Improve user interface
   - Mobile-first approach

3. **Marketing Strategy**
   - Increase social media presence
   - Influencer partnerships
   - Content marketing focus

## 🔍 Competitive Landscape

- Main competitors showing similar growth patterns
- Market share opportunities in mid-tier segment
- Innovation remains key differentiator

---

*Analysis completed at ${new Date().toLocaleString()}*  
*Sources: Reddit, Twitter, Industry Reports, Market Research Databases*`,
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 3000);
  };

  const simulateCreativeResponse = () => {
    setCurrentProgress("Generating creative ideas...");

    setTimeout(() => {
      setCurrentProgress("Analyzing campaign assets...");
    }, 1000);

    setTimeout(() => {
      setCurrentProgress("Crafting content strategies...");
    }, 2000);

    setTimeout(() => {
      setCurrentProgress(null);
      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `# 🎨 Creative Content & Marketing Ideas

## Campaign Overview
Here are innovative content ideas and marketing strategies tailored for your campaign:

## 💡 Content Ideas

### 1. Interactive Content Series
**"Behind the Scenes" Campaign**
- Weekly video series showcasing team culture
- User-generated content challenges
- Live Q&A sessions with product experts
- **Engagement Potential**: High (Est. 40% increase)

### 2. Educational Content Hub
**"Master Class Monday"**
- Tutorial videos and how-to guides
- Industry expert interviews
- Case study breakdowns
- Downloadable resources and templates

### 3. Social Media Storytelling
**"Customer Success Stories"**
- Real testimonials in video format
- Before/after transformations
- Mini-documentary series
- Share across all platforms

## 🚀 Marketing Strategies

### Multi-Channel Approach

**Social Media Tactics:**
- Instagram Reels showcasing product features
- TikTok challenges with branded hashtags
- LinkedIn thought leadership articles
- Twitter polls for audience engagement

**Content Calendar Highlights:**
- Monday: Educational content
- Wednesday: Product spotlights
- Friday: Community engagement
- Weekend: User-generated content

## 📱 Platform-Specific Ideas

### Instagram
- Carousel posts with tips and tricks
- Stories with polls and quizzes
- IGTV for longer format content
- Reels trending audio integration

### LinkedIn
- Industry insights articles
- Professional case studies
- Webinar promotions
- Employee advocacy posts

### TikTok
- Trend-jacking opportunities
- Educational snippets (< 60 sec)
- Behind-the-scenes culture
- Product demos with humor

## 🎯 Engagement Tips

### Building Community
1. **Respond promptly** to comments and messages
2. **Create conversation starters** with thought-provoking questions
3. **Host virtual events** (webinars, AMAs, live demos)
4. **Reward engagement** with exclusive content or early access

### Content Optimization
- Use high-quality visuals consistently
- Incorporate trending topics naturally
- A/B test headlines and thumbnails
- Optimize posting times per platform

### Storytelling Framework
- **Hook**: Grab attention in first 3 seconds
- **Problem**: Identify pain points
- **Solution**: Present your offering
- **Call-to-Action**: Clear next steps

## 📊 Success Metrics to Track

- Engagement rate (likes, comments, shares)
- Reach and impressions
- Click-through rates
- Conversion rates
- Follower growth
- Content saves/bookmarks

## 🌟 Innovative Campaign Concepts

### Concept 1: "Innovation Challenge"
Partner with customers to co-create solutions. Monthly challenges with prizes.

### Concept 2: "Spotlight Series"
Feature different team members, customers, or partners weekly.

### Concept 3: "Value Drop Fridays"
Release exclusive tips, resources, or discounts every Friday.

---

*Creative brief generated at ${new Date().toLocaleString()}*  
*Ready to implement? Let's bring these ideas to life! 🚀*`,
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 3000);
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
    // Show "Weezy is working..." first
    const loadingMsg: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Weezy is working...",
      type: "loading"
    };
    setMessages(prev => [...prev, loadingMsg]);
    
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      setCurrentProgress("Generating RFP — Step 1/3: drafting executive summary...");
    }, 1500);
    
    setTimeout(() => {
      setCurrentProgress("Generating RFP — Step 2/3: assembling scope & deliverables...");
    }, 3000);
    
    setTimeout(() => {
      setCurrentProgress("Generating RFP — Step 3/3: formatting & finalizing...");
    }, 4500);
    
    setTimeout(() => {
      setCurrentProgress(null);
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Generated RFP: Data Migration Project**\n\n**Executive Summary:**\nEnterprise data migration from legacy systems to modern cloud infrastructure.\n\n**Project Overview:**\n• **Budget:** $500,000\n• **Timeline:** 6 months\n• **Scope:** End-to-end data center migration\n\n**Key Requirements:**\n• Data assessment and mapping\n• Migration strategy and execution\n• Security and compliance validation\n• Testing and quality assurance\n• Training and documentation\n\n**Deliverables:**\n• Migration plan and timeline\n• Risk assessment report\n• Security implementation guide\n• Performance benchmarks\n\n**Evaluation Criteria:**\n• Technical Depth (30%)\n• Cost (25%)\n• Security & Compliance (20%)\n• SLA & Uptime (15%)\n• References & Past Projects (10%)\n\n---\n**Executive Summary:** This RFP seeks a qualified vendor to execute a $500K, 6-month data migration project with comprehensive security validation and post-migration support.`,
        type: "rfp",
        fileName: "Enterprise_RFP_Draft.docx",
        fileSize: "2.4 MB",
        fileType: "docx",
        actions: ["Make Presentation", "Create Report"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 6000);
  };

  const handlePresentationGeneration = (query: string) => {
    // Show "Weezy is working..." first
    const loadingMsg: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Weezy is working...",
      type: "loading"
    };
    setMessages(prev => [...prev, loadingMsg]);
    
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      setCurrentProgress("Creating Slide Deck — Designing layouts...");
    }, 1500);
    
    setTimeout(() => {
      setCurrentProgress("Generating slide content and structure...");
    }, 2700);
    
    setTimeout(() => {
      setCurrentProgress("Finalizing presentation format...");
    }, 3900);
    
    setTimeout(() => {
      setCurrentProgress(null);
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Presentation: Enterprise Cloud Migration Strategy**\n\n**Slide 1:** Executive Summary\n• Key benefits and ROI projections\n• Strategic overview and objectives\n\n**Slide 2:** Multi-Cloud Cost Optimization\n• 25-40% cost reduction strategies\n• Automated workload placement\n• Resource optimization techniques\n\n**Slide 3:** Migration Strategy\n• Timeline and budget considerations\n• Risk mitigation approaches\n• Phase-by-phase implementation\n\n**Slide 4:** Security & Compliance\n• Data protection frameworks\n• Regulatory requirements (GDPR/CCPA)\n• Identity and access management\n\n**Slide 5:** Implementation Roadmap\n• Phase 1: Discovery and assessment\n• Phase 2: Pilot migration\n• Phase 3: Bulk migration and cutover\n\n**Slide 6:** Success Metrics & Next Steps\n• Performance benchmarks\n• Success criteria and KPIs\n• Contact information and timeline`,
        type: "presentation",
        fileName: "Cloud_Migration_Strategy.pptx",
        fileSize: "5.8 MB",
        fileType: "pptx",
        actions: ["Export as PDF", "Get Speaker Notes"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 5300);
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
    // Show "Weezy is working..." first
    const loadingMsg: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Weezy is working...",
      type: "loading"
    };
    setMessages(prev => [...prev, loadingMsg]);
    
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      setCurrentProgress("Analyzing Data — Structuring report...");
    }, 1500);
    
    setTimeout(() => {
      setCurrentProgress("Formatting Document — Finalizing...");
    }, 2700);
    
    setTimeout(() => {
      setCurrentProgress(null);
      const response: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Report: Cloud Migration Strategy Analysis**\n\n**1. Executive Overview**\nEnterprise cloud migration represents a critical strategic initiative with potential for significant cost reduction and operational improvements.\n\n**2. Cost Optimization Opportunities**\n• Multi-cloud strategies can reduce TCO by 25-40%\n• Automated workload placement optimizes resource utilization\n• Rightsizing and governance policies prevent cost overruns\n\n**3. Security Requirements**\n• Identity and access management with least privilege\n• Data encryption at rest and in transit\n• Continuous vulnerability scanning and SIEM integration\n• Compliance with GDPR, CCPA, and industry regulations\n\n**4. Implementation Strategy**\n• Phase 1: Discovery and assessment (4-6 weeks)\n• Phase 2: Pilot migration (6-8 weeks)\n• Phase 3: Bulk migration (12-16 weeks)\n• Phase 4: Optimization and cutover (4-6 weeks)\n\n**5. Risk Mitigation**\n• Legacy system compatibility assessment\n• Data egress cost management\n• Comprehensive testing protocols\n• Rollback and disaster recovery procedures\n\n**6. Success Metrics**\n• RTO improvement to <2 hours\n• 25% TCO reduction within 12 months\n• 99.9% uptime SLA achievement\n• Zero security incidents during migration`,
        type: "report",
        fileName: "Migration_Analysis_Report.pdf",
        fileSize: "3.2 MB",
        fileType: "pdf",
        actions: ["Create Executive Summary", "Make Presentation", "Generate RFP"]
      };
      
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 4200);
  };

  const generateDefaultResponse = (userInput: string): Message => {
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `I can help you with marketing & creative work:\n\n**Search creative assets** - "Search campaign performance data"\n**Summarize briefs** - "Summarize Q4 Holiday Campaign Brief"\n**Creative Q&A** - "What are our top-performing creative assets?"\n**Generate RFPs** - "Create an RFP for influencer marketing campaign"\n**Create presentations** - "Make a presentation on brand refresh strategy"\n**Generate reports** - "Create a competitor analysis report"\n\nTry one of these examples or ask me anything about your marketing campaigns!`,
      actions: ["Find Assets", "Create RFP", "Make Presentation", "Generate Report"]
    };
  };

  const handleActionClick = (action: string) => {
    const actionMap: { [key: string]: string } = {
      "Find Assets": "Search campaign performance data",
      "Summarize Brief": "Summarize Q4 Holiday Campaign Brief", 
      "Creative Q&A": "What are our top-performing creative assets?",
      "Create RFP": "Create an RFP for influencer marketing campaign",
      "Make Presentation": "Make a presentation on brand refresh strategy",
      "Create Report": "Create a competitor analysis report",
      "Generate Report": "Create a competitor analysis report",
      "Summarize Results": "Summarize these search results",
      "Export as PDF": "export-pdf",
      "Get Speaker Notes": "speaker-notes"
    };
    
    const mappedAction = actionMap[action];
    if (mappedAction) {
      if (mappedAction.startsWith("download-") || mappedAction.startsWith("preview-") || mappedAction.startsWith("export-") || mappedAction.startsWith("speaker-")) {
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
      case "loading": return null;
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
    <div className="flex-1 min-w-0 flex flex-col bg-background overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col min-h-full">
      {/* Welcome message */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8 min-h-[calc(100vh-200px)]">
          <div className="max-w-2xl text-center space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Hi, I'm Weez</h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
                Your AI teammate for marketing & creative work. You can search, summarize, generate RFPs, create presentations, or build reports instantly.
              </p>
              <p className="text-sm text-muted-foreground">
                Try linking a tool on the right or just start chatting below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Search campaign performance data")} className="text-sm">
                Find Assets
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Summarize Q4 Holiday Campaign Brief")} className="text-sm">
                Summarize Brief
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("What are our top-performing creative assets?")} className="text-sm">
                Creative Q&A
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Create an RFP for influencer marketing campaign")} className="text-sm">
                Create RFP
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Make a presentation on brand refresh strategy")} className="text-sm">
                Make Presentation
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSuggestionClick("Generate a competitor analysis report")} className="text-sm">
                Create Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      {messages.length > 0 && (
        <div className="flex-1 py-6">
          <div className="max-w-4xl mx-auto px-4 space-y-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 {message.role === 'user' ? (
                  /* User message in clean container */
                  <div className="max-w-[70%] bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
                    <p className="text-sm text-foreground leading-relaxed font-medium">{message.content}</p>
                  </div>
                 ) : (
                  /* AI message as clean plain text */
                  <div className="max-w-[85%] space-y-3">
                    {message.type === "loading" ? (
                      <LoadingAnimation message={message.content} />
                    ) : (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getMessageIcon(message)}
                        </div>
                        <div className="flex-1 space-y-3">
                           {/* Render markdown content with ReactMarkdown */}
                          <div className="prose prose-sm max-w-none">
                            {(() => {
                              const normalizeBullets = (text: string) =>
                                text
                                  .replace(/^\s*•\s+/gm, '- ') // convert bullet symbol to markdown list
                                  .replace(/\n\s*•\s+/g, '\n- ');
                              const normalized = normalizeBullets(message.content);
                              return (
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    h1: ({node, ...props}) => <h1 className="text-xl font-semibold mb-3 mt-4 text-foreground" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-lg font-semibold mb-2 mt-3 text-foreground" {...props} />,
                                    h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-2 mt-2 text-foreground" {...props} />,
                                    p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-muted-foreground" {...props} />,
                                    ul: ({node, ...props}) => <ul className="mb-3 space-y-1 pl-6 list-disc text-muted-foreground" {...props} />,
                                    ol: ({node, ...props}) => <ol className="mb-3 space-y-1 pl-6 list-decimal text-muted-foreground" {...props} />,
                                    li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                                    strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                                    code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                                  }}
                                >
                                  {normalized}
                                </ReactMarkdown>
                              );
                            })()}
                          </div>
                          
                          {message.fileName && message.fileSize && message.fileType && (
                            <FilePreviewCard
                              fileName={message.fileName}
                              fileSize={message.fileSize}
                              fileType={message.fileType}
                              onDownload={() => toast({
                                title: "Download started",
                                description: `Downloading ${message.fileName}...`,
                                duration: 2000,
                              })}
                              onPreview={() => toast({
                                title: "Opening preview",
                                description: `Opening ${message.fileName}...`,
                                duration: 2000,
                              })}
                            />
                          )}
                          
                          {message.documents && message.documents.length > 0 && (
                            <div className="space-y-3">
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
                            <div className="flex flex-wrap gap-2 pt-2">
                              {message.actions.map((action, actionIndex) => (
                                <Button
                                  key={actionIndex}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleActionClick(action)}
                                  className="text-xs px-3 py-1.5 rounded-lg border-weez-accent/20 text-weez-accent hover:bg-weez-accent/10 hover:border-weez-accent/40 transition-all hover:scale-105"
                                >
                                  {action}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
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
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border bg-background p-4 flex-shrink-0">
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
          
          {/* Mode Buttons */}
          <div className="flex items-center gap-2 px-1">
            <Button
              variant={activeMode === 'deep-research' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeClick('deep-research')}
              disabled={isLoading}
              className="h-8 rounded-full text-xs font-medium transition-all"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Deep Research Mode
            </Button>
            <Button
              variant={activeMode === 'creative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeClick('creative')}
              disabled={isLoading}
              className="h-8 rounded-full text-xs font-medium transition-all"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Creative Mode
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;