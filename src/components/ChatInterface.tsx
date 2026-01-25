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
    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "user" ? (
        <div className="max-w-[70%] bg-card border rounded-lg px-4 py-3">{msg.content}</div>
      ) : (
        <div className="max-w-[85%] space-y-3">
          <div className="flex items-start space-x-3">
            <Bot className="w-4 h-4 text-primary mt-1" />
            <div className="flex-1 space-y-3">
              <div className="prose prose-sm max-w-none dark:prose-invert">
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
    const progress = (type: string) => downloadProgress.get(`${meta.jobId}-${type}`) || 0;

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {meta.canDownload && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleDownload(meta.jobId!, "persuasion_document")} disabled={isDl("persuasion_document")}>
                {isDl("persuasion_document") ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                Outlined
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownload(meta.jobId!, "parsed_document")} disabled={isDl("parsed_document")}>
                {isDl("parsed_document") ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                Full
              </Button>
            </>
          )}
          {meta.canCancel && (
            <Button size="sm" variant="destructive" onClick={() => handleCancelJob(meta.jobId!)}>
              <XCircle className="w-3 h-3 mr-1" /> Cancel
            </Button>
          )}
        </div>
        {/* Progress bars could be added here if needed */}
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col min-h-full">
          {messages.length === 0 ? (
            <ContentIdeas
              onGenerateClick={() => navigate(`/one-click-post/${currentSpace?.id}`)}
              disabled={isLoading}
            />
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 relative">
        <div className="max-w-4xl mx-auto flex space-x-3">
          <Button variant="outline" size="icon" onClick={() => setShowCommandMenu(!showCommandMenu)}>
            <Plus className="w-4 h-4" />
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowCommandMenu(e.target.value.endsWith("@"));
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder="Ask anything… (type @ for commands)"
            disabled={isLoading}
          />
          <Button onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {showCommandMenu && (
          <div className="absolute bottom-24 left-8 bg-popover border rounded-lg shadow-lg w-64 z-50">
            <button className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted text-sm" onClick={() => { setShowCommandMenu(false); setShowRFPModal(true); setInputValue(""); }}>
              <FileText className="w-4 h-4" /> Generate Proposal
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