// ChatInterface.tsx — Optimized for readability and maintainability
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  Plus,
  Loader2,
  FileText,
  Download,
  ExternalLink,
  XCircle,
} from "lucide-react";
import SuggestionBubbles from "./SuggestionBubbles";
import ContentIdeas from "./ContentIdeas";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/contexts/AuthContext";
import { streamChat, chatNonStream } from "@/services/agentAPI";
import {
  generateRFP,
  pollUntilComplete,
  downloadDocumentToFile,
  cancelPipeline,
  getDocumentPaths,
  formatDuration,
  isJobRunning,
  type PipelineStatusResponse,
  type GenerateRFPRequest,
  type DownloadOptions,
} from "@/services/rfpAPI";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  metadata?: {
    type?: "rfp_generation";
    jobId?: string;
    status?: "pending" | "running" | "completed" | "failed" | "cancelled";
    canDownload?: boolean;
    canCancel?: boolean;
  };
}

interface ChatInterfaceProps {
  initialExample?: string;
  onConnectorMessage?: (msg: any) => void;
  conversationId?: string | null;
  initialHistory?: Message[];
  onNewMessage?: (conversationId: string) => void;
}

const ChatInterface = ({
  initialExample = "",
  conversationId,
  initialHistory = [],
  onNewMessage,
}: ChatInterfaceProps) => {
  const { user, currentSpace } = useAuth();
  const navigate = useNavigate();

  // --- STATE ---
  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useStreaming] = useState(true);

  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [showRFPModal, setShowRFPModal] = useState(false);
  const [rfpBriefName, setRfpBriefName] = useState("");

  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());

  // --- REFS ---
  const activeJobsRef = useRef<Map<string, AbortController>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    if (initialExample) {
      setInputValue(initialExample);
      setTimeout(() => handleSendMessage(initialExample), 300);
    }
  }, [initialExample]);

  useEffect(() => {
    return () => {
      activeJobsRef.current.forEach((controller) => controller.abort());
      activeJobsRef.current.clear();
    };
  }, []);

  // --- HANDLERS ---
  const handleSendMessage = async (forced?: string) => {
    const text = forced || inputValue;
    if (!text.trim() || isLoading) return;

    if (!user || !currentSpace) {
      alert("User or space missing");
      return;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue("");
    setIsLoading(true);

    const chatPayload = {
      user_id: user.id,
      space_id: currentSpace.id,
      query: text,
      conversation_id: conversationId || undefined,
    };

    if (useStreaming) {
      streamChat(
        chatPayload,
        (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        (error) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: `⚠️ Error: ${error}` }
                : msg
            )
          );
          setIsLoading(false);
        },
        (returnedConversationId) => {
          setIsLoading(false);
          if (!conversationId && returnedConversationId) {
            onNewMessage?.(returnedConversationId);
          }
        }
      );
    } else {
      try {
        const data = await chatNonStream(chatPayload);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: data.assistant || "⚠️ No response." }
              : msg
          )
        );
        if (!conversationId && data.conversation_id) {
          onNewMessage?.(data.conversation_id);
        }
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: "⚠️ Error connecting to AI server." }
              : msg
          )
        );
      }
      setIsLoading(false);
    }
  };

  const handleGenerateRFP = async () => {
    if (!user || !currentSpace) return;
    const briefName = rfpBriefName.trim();
    if (!briefName) return;

    setShowRFPModal(false);
    setRfpBriefName("");

    const assistantMsgId = `assistant-rfp-${Date.now()}`;
    const initialMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "🚀 **Starting Proposal Generation**\n\nInitializing pipeline...",
      metadata: { type: "rfp_generation", status: "pending" },
    };

    setMessages((prev) => [...prev, initialMsg]);

    try {
      const payload: GenerateRFPRequest = {
        user_id: user.email || user.id,
        brief_name: briefName,
        space_id: currentSpace.id,
      };

      const response = await generateRFP(payload);
      const jobId = response.job_id;

      const abortController = new AbortController();
      activeJobsRef.current.set(jobId, abortController);

      const result = await pollUntilComplete(jobId, {
        interval: 2000,
        onProgress: (status: PipelineStatusResponse) => {
          if (abortController.signal.aborted) throw new Error("Job cancelled");

          const filled = Math.floor((status.progress_percentage || 0) / 5);
          const progressBar = `[${"█".repeat(filled)}${"░".repeat(20 - filled)}] ${status.progress_percentage || 0}%`;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                  ...msg,
                  content: `⚙️ **Generating Proposal**\n\n**Brief:** ${briefName}\n**Job ID:** \`${jobId}\`\n\n${progressBar}\n\n**Step:** ${status.current_step || "Processing..."}`,
                  metadata: {
                    type: "rfp_generation",
                    jobId,
                    status: status.status,
                    canCancel: isJobRunning(status),
                  },
                }
                : msg
            )
          );
        },
      });

      activeJobsRef.current.delete(jobId);
      const docs = getDocumentPaths(result);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              content: `✅ **Proposal Generated Successfully!**\n\n**Brief:** ${briefName}\n**Job ID:** \`${jobId}\`\n\nYour proposal is ready for download.`,
              metadata: {
                type: "rfp_generation",
                jobId,
                status: "completed",
                canDownload: !!(docs.persuasion || docs.parsed),
                canCancel: false,
              },
            }
            : msg
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              content: `❌ **Proposal Generation Failed**\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
              metadata: { type: "rfp_generation", status: "failed" },
            }
            : msg
        )
      );
    }
  };

  const handleDownload = async (jobId: string, type: "persuasion_document" | "parsed_document") => {
    const key = `${jobId}-${type}`;
    if (downloadingJobs.has(key)) return;

    setDownloadingJobs((prev) => new Set(prev).add(key));
    try {
      await downloadDocumentToFile(jobId, type, {
        useProxy: true,
        onProgress: (loaded, total) => {
          setDownloadProgress((prev) => new Map(prev).set(key, (loaded / total) * 100));
        },
      });
    } catch (error) {
      alert("Download failed");
    } finally {
      setDownloadingJobs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm("Cancel proposal?")) return;
    activeJobsRef.current.get(jobId)?.abort();
    activeJobsRef.current.delete(jobId);
    await cancelPipeline(jobId);
  };

  // --- RENDER HELPERS ---
  const renderMessage = (msg: Message) => (
    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
      {msg.role === "user" ? (
        <div className="max-w-[80%] bg-primary/95 text-primary-foreground border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm font-medium leading-relaxed tracking-tight">
          {msg.content}
        </div>
      ) : (
        <div className="max-w-[90%] space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="glass-card rounded-2xl rounded-tl-sm px-5 py-4 prose prose-sm max-w-none dark:prose-invert text-foreground/90 leading-relaxed font-normal tracking-tight">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
              {msg.metadata?.type === "rfp_generation" && renderRfpActions(msg.metadata)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRfpActions = (meta: Message["metadata"]) => {
    if (!meta?.jobId) return null;
    const isDl = (type: string) => downloadingJobs.has(`${meta.jobId}-${type}`);

    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {meta.canDownload && (
          <>
            <Button variant="outline" className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border-indigo-500/20 bg-indigo-500/5 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all" onClick={() => handleDownload(meta.jobId!, "persuasion_document")} disabled={isDl("persuasion_document")}>
              {isDl("persuasion_document") ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Download className="w-3 h-3 mr-1.5" />}
              Draft
            </Button>
            <Button variant="outline" className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all" onClick={() => handleDownload(meta.jobId!, "parsed_document")} disabled={isDl("parsed_document")}>
              {isDl("parsed_document") ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Download className="w-3 h-3 mr-1.5" />}
              Full
            </Button>
          </>
        )}
        {meta.canCancel && (
          <Button variant="ghost" className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10" onClick={() => handleCancelJob(meta.jobId!)}>
            <XCircle className="w-3 h-3 mr-1.5" /> Cancel
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background/5 overflow-hidden relative">
      <ScrollArea className="flex-1">
        <div className="flex flex-col min-h-full">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
               <ContentIdeas
                onGenerateClick={() => navigate(`/one-click-post/${currentSpace?.id}`)}
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} className="h-10" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating Glass Input Area */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-30">
        <div className="glass-card rounded-2xl p-2 flex items-center gap-2 shadow-2xl shadow-indigo-500/10 border-white/50 dark:border-white/10 group focus-within:ring-2 ring-indigo-500/20 transition-all">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 shrink-0"
            onClick={() => setShowCommandMenu(!showCommandMenu)}
          >
            <Plus className={cn("w-4 h-4 transition-transform duration-300", showCommandMenu && "rotate-45")} />
          </Button>
          
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowCommandMenu(e.target.value.endsWith("@"));
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder="Ask Weez AI area..."
            className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0 text-sm font-medium placeholder:text-muted-foreground/50"
            disabled={isLoading}
          />

          <Button 
            onClick={() => handleSendMessage()} 
            disabled={isLoading || !inputValue.trim()}
            className={cn(
              "h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all duration-300 scale-95 opacity-0 pointer-events-none",
              inputValue.trim() && "scale-100 opacity-100 pointer-events-auto"
            )}
          >
            {isLoading ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : "Send"}
          </Button>
        </div>

        {/* Command Menu Popover */}
        {showCommandMenu && (
          <div className="absolute bottom-full mb-3 left-4 glass-card p-1.5 rounded-xl border border-white/40 shadow-2xl w-56 animate-fade-in-up">
            <button 
              className="flex items-center gap-3 w-full px-3 py-2 hover:bg-indigo-500/5 text-xs font-bold rounded-lg transition-colors group" 
              onClick={() => { setShowCommandMenu(false); setShowRFPModal(true); setInputValue(""); }}
            >
              <FileText className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" /> 
              <span>Generate Proposal</span>
            </button>
          </div>
        )}
      </div>

      {showRFPModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg w-[480px] space-y-4 border shadow-xl">
            <h3 className="text-lg font-semibold">Generate Proposal</h3>
            <Input placeholder="Brief Name" value={rfpBriefName} onChange={(e) => setRfpBriefName(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowRFPModal(false)}>Cancel</Button>
              <Button disabled={!rfpBriefName.trim()} onClick={handleGenerateRFP}>Generate</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;