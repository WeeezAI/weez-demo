// ChatInterface.tsx — Updated download implementation with proxy support
// ✅ Uses downloadDocumentToFile with proper options
// ✅ Includes progress tracking
// ✅ Better error handling
// ✅ Download state management

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  Plus,
  Loader2,
  FileText,
  Download,
  ExternalLink,
  XCircle,
} from "lucide-react";
import SuggestionBubbles from "./SuggestionBubbles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/contexts/AuthContext";
import { streamChat, chatNonStream } from "@/services/agentAPI";

// 🔹 Updated RFP API imports
import {
  generateRFP,
  pollUntilComplete,
  downloadDocumentToFile,
  cancelPipeline,
  getDocumentPaths,
  formatDuration,
  isJobCompleted,
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
  onConnectorMessage,
  conversationId,
  initialHistory = [],
  onNewMessage,
}: ChatInterfaceProps) => {
  const { user, currentSpace } = useAuth();

  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);

  // 🔹 RFP UI STATES
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [showRFPModal, setShowRFPModal] = useState(false);
  const [rfpBriefName, setRfpBriefName] = useState("");

  // 🔹 DOWNLOAD STATES
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());

  // Track active RFP jobs for cancellation
  const activeJobsRef = useRef<Map<string, AbortController>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update messages when initialHistory changes
  useEffect(() => {
    setMessages(initialHistory);
  }, [initialHistory]);

  // Auto-send initial example
  useEffect(() => {
    if (initialExample) {
      setInputValue(initialExample);
      setTimeout(() => handleSendMessage(initialExample), 300);
    }
  }, [initialExample]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel all active jobs when component unmounts
      activeJobsRef.current.forEach((controller) => controller.abort());
      activeJobsRef.current.clear();
    };
  }, []);

  // --------------------------------------------------------------------
  // SEND CHAT MESSAGE
  // --------------------------------------------------------------------
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
        (token: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        (error: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: `⚠️ Error: ${error}` }
                : msg
            )
          );
          setIsLoading(false);
        },
        (returnedConversationId?: string) => {
          setIsLoading(false);
          
          if (!conversationId && returnedConversationId) {
            console.log("✅ New conversation created:", returnedConversationId);
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

  // --------------------------------------------------------------------
  // RFP GENERATION (Aligned with updated rfpAPI.ts)
  // --------------------------------------------------------------------
  const handleGenerateRFP = async () => {
    if (!user || !currentSpace) {
      alert("User or space missing");
      return;
    }

    const briefName = rfpBriefName.trim();
    if (!briefName) return;

    setShowRFPModal(false);
    setRfpBriefName("");

    const assistantMsgId = `assistant-rfp-${Date.now()}`;
    let jobId = "";

    // Add initial message
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "🚀 **Starting Proposal Generation**\n\nInitializing pipeline...",
        metadata: {
          type: "rfp_generation",
          status: "pending",
        },
      },
    ]);

    try {
      // Start RFP generation with correct payload structure
      const payload: GenerateRFPRequest = {
        user_id: user.email || user.id,
        brief_name: briefName,
        space_id: currentSpace.id,
      };

      const response = await generateRFP(payload);
      jobId = response.job_id;

      // Create abort controller for this job
      const abortController = new AbortController();
      activeJobsRef.current.set(jobId, abortController);

      // Update message with job ID and cancellable status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `🚀 **Starting Proposal Generation**\n\n**Brief:** ${briefName}\n**Job ID:** \`${jobId}\`\n\nInitializing agents...`,
                metadata: {
                  type: "rfp_generation",
                  jobId,
                  status: "running",
                  canCancel: true,
                },
              }
            : msg
        )
      );

      // Poll for completion with progress updates
      const result = await pollUntilComplete(jobId, {
        interval: 2000,
        timeout: 1800000,
        onProgress: (status: PipelineStatusResponse) => {
          if (abortController.signal.aborted) {
            throw new Error("Job cancelled by user");
          }

          const progressBar = generateProgressBar(
            status.progress_percentage || 0
          );

          let elapsedStr = "";
          if (status.started_at) {
            const startTime = new Date(status.started_at).getTime();
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - startTime) / 1000);
            elapsedStr = formatDuration(elapsedSeconds);
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: `⚙️ **Generating Proposal**

**Brief:** ${briefName}
**Job ID:** \`${jobId}\`

${progressBar}

**Current Step:** ${status.current_step || "Processing..."}
**Progress:** ${status.progress_percentage || 0}%

${elapsedStr ? `**Elapsed:** ${elapsedStr}` : ""}`,
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

      // Remove from active jobs
      activeJobsRef.current.delete(jobId);

      // Get document paths using the utility function
      const documents = getDocumentPaths(result);
      const hasPersuasion = !!documents.persuasion;
      const hasParsed = !!documents.parsed;

      // Format duration using utility
      const durationStr = formatDuration(result.duration_seconds);

      // Extract summary data safely
      const summary = result.result_summary;
      const keyMetrics = summary?.key_metrics || {};

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `✅ **Proposal Generated Successfully!**

**Brief:** ${briefName}
**Job ID:** \`${jobId}\`
**Duration:** ${durationStr}

---

### 📄 Generated Documents

${hasParsed ? "Proposal Generated Successfully" : ""}

Your proposal has been generated and is ready for download.

${
  keyMetrics.total_investment ||
  keyMetrics.roi_multiplier ||
  keyMetrics.document_pages ||
  keyMetrics.word_count
    ? `
**Summary:**
${keyMetrics.total_investment ? `- **Total Investment:** ${keyMetrics.total_investment}` : ""}
${keyMetrics.roi_multiplier ? `- **ROI Multiplier:** ${keyMetrics.roi_multiplier}` : ""}
${keyMetrics.document_pages ? `- **Document Pages:** ${keyMetrics.document_pages}` : ""}
${keyMetrics.word_count ? `- **Word Count:** ${keyMetrics.word_count}` : ""}`
    : ""
}`,
                metadata: {
                  type: "rfp_generation",
                  jobId,
                  status: "completed",
                  canDownload: hasPersuasion || hasParsed,
                  canCancel: false,
                },
              }
            : msg
        )
      );
    } catch (error) {
      if (jobId) {
        activeJobsRef.current.delete(jobId);
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `❌ **Proposal Generation Failed**

${jobId ? `**Job ID:** \`${jobId}\`` : ""}

**Error:** ${errorMessage}

Please try again or contact support if the issue persists.`,
                metadata: {
                  type: "rfp_generation",
                  jobId: jobId || undefined,
                  status: "failed",
                  canCancel: false,
                },
              }
            : msg
        )
      );
    }
  };

  // --------------------------------------------------------------------
  // DOWNLOAD DOCUMENT (Updated with proxy support and progress tracking)
  // --------------------------------------------------------------------
  const handleDownloadDocument = async (
    jobId: string,
    documentType: "persuasion_document" | "parsed_document"
  ) => {
    // Prevent multiple simultaneous downloads of the same document
    const downloadKey = `${jobId}-${documentType}`;
    if (downloadingJobs.has(downloadKey)) {
      console.log("Download already in progress for:", downloadKey);
      return;
    }

    // Mark as downloading
    setDownloadingJobs((prev) => new Set(prev).add(downloadKey));
    setDownloadProgress((prev) => new Map(prev).set(downloadKey, 0));

    try {
      // Generate appropriate filename
      const typeLabel = documentType === "persuasion_document" 
        ? "Proposal_Outlined" 
        : "Proposal_Full";
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${typeLabel}_${timestamp}.docx`;

      // Download options with progress tracking
      const downloadOptions: DownloadOptions = {
        useProxy: true, // Use proxy mode to avoid CORS issues
        filename: filename,
        onProgress: (loaded: number, total: number) => {
          const percentage = (loaded / total) * 100;
          setDownloadProgress((prev) => 
            new Map(prev).set(downloadKey, percentage)
          );
        },
      };

      // Use the downloadDocumentToFile helper from rfpAPI
      await downloadDocumentToFile(jobId, documentType, downloadOptions);

      // Show success feedback
      console.log(`✅ Downloaded ${documentType} for job ${jobId}`);
      
      // Optional: Show a toast notification here
      // toast.success(`Document downloaded: ${filename}`);

    } catch (error) {
      console.error("Download failed:", error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Unknown error occurred";

      alert(`Failed to download document: ${errorMessage}\n\nPlease try again or contact support.`);
      
      // Optional: Show error toast
      // toast.error(`Download failed: ${errorMessage}`);
    } finally {
      // Clear downloading state
      setDownloadingJobs((prev) => {
        const updated = new Set(prev);
        updated.delete(downloadKey);
        return updated;
      });

      // Clear progress after a short delay
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const updated = new Map(prev);
          updated.delete(downloadKey);
          return updated;
        });
      }, 1000);
    }
  };

  // --------------------------------------------------------------------
  // CANCEL RFP JOB
  // --------------------------------------------------------------------
  const handleCancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this proposal generation?")) {
      return;
    }

    try {
      // Abort local polling
      const controller = activeJobsRef.current.get(jobId);
      if (controller) {
        controller.abort();
        activeJobsRef.current.delete(jobId);
      }

      // Cancel on server using correct API method
      await cancelPipeline(jobId);

      // Update message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.metadata?.jobId === jobId
            ? {
                ...msg,
                content: msg.content + "\n\n⚠️ **Job cancelled by user.**",
                metadata: {
                  ...msg.metadata,
                  status: "cancelled",
                  canCancel: false,
                },
              }
            : msg
        )
      );
    } catch (error) {
      alert(
        `Failed to cancel job: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // --------------------------------------------------------------------
  // HELPER: Progress Bar
  // --------------------------------------------------------------------
  const generateProgressBar = (percentage: number): string => {
    const filled = Math.floor(percentage / 5);
    const empty = 20 - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percentage}%`;
  };

  // --------------------------------------------------------------------
  // HELPER: Get download progress for a specific document
  // --------------------------------------------------------------------
  const getDownloadProgress = (
    jobId: string,
    documentType: "persuasion_document" | "parsed_document"
  ): number => {
    const downloadKey = `${jobId}-${documentType}`;
    return downloadProgress.get(downloadKey) || 0;
  };

  // --------------------------------------------------------------------
  // HELPER: Check if document is downloading
  // --------------------------------------------------------------------
  const isDownloading = (
    jobId: string,
    documentType: "persuasion_document" | "parsed_document"
  ): boolean => {
    const downloadKey = `${jobId}-${documentType}`;
    return downloadingJobs.has(downloadKey);
  };

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col min-h-full">
          <div className="flex-1 py-6">
            <div className="max-w-4xl mx-auto px-4 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[70%] bg-card border rounded-lg px-4 py-3">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%] space-y-3">
                      <div className="flex items-start space-x-3">
                        <Bot className="w-4 h-4 text-primary mt-1" />
                        <div className="flex-1 space-y-3">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {/* RFP Actions */}
                          {msg.metadata?.type === "rfp_generation" && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {/* Download Buttons */}
                                {msg.metadata.canDownload &&
                                  msg.metadata.jobId && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleDownloadDocument(
                                            msg.metadata!.jobId!,
                                            "persuasion_document"
                                          )
                                        }
                                        disabled={isDownloading(
                                          msg.metadata.jobId,
                                          "persuasion_document"
                                        )}
                                      >
                                        {isDownloading(
                                          msg.metadata.jobId,
                                          "persuasion_document"
                                        ) ? (
                                          <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Downloading...
                                          </>
                                        ) : (
                                          <>
                                            <Download className="w-3 h-3 mr-1" />
                                            Outlined Proposal
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleDownloadDocument(
                                            msg.metadata!.jobId!,
                                            "parsed_document"
                                          )
                                        }
                                        disabled={isDownloading(
                                          msg.metadata.jobId,
                                          "parsed_document"
                                        )}
                                      >
                                        {isDownloading(
                                          msg.metadata.jobId,
                                          "parsed_document"
                                        ) ? (
                                          <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Downloading...
                                          </>
                                        ) : (
                                          <>
                                            <Download className="w-3 h-3 mr-1" />
                                            Full Proposal
                                          </>
                                        )}
                                      </Button>
                                    </>
                                  )}

                                {/* Cancel Button */}
                                {msg.metadata.canCancel &&
                                  msg.metadata.jobId && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        handleCancelJob(msg.metadata!.jobId!)
                                      }
                                    >
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Cancel
                                    </Button>
                                  )}

                                {/* View Details Link */}
                                {msg.metadata.jobId && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      console.log(
                                        "View details for:",
                                        msg.metadata?.jobId
                                      );
                                    }}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    View Details
                                  </Button>
                                )}
                              </div>

                              {/* Download Progress Bars */}
                              {msg.metadata.jobId && (
                                <>
                                  {isDownloading(
                                    msg.metadata.jobId,
                                    "persuasion_document"
                                  ) && (
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground">
                                        Downloading Outlined Proposal...{" "}
                                        {getDownloadProgress(
                                          msg.metadata.jobId,
                                          "persuasion_document"
                                        ).toFixed(0)}
                                        %
                                      </div>
                                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary transition-all duration-300"
                                          style={{
                                            width: `${getDownloadProgress(
                                              msg.metadata.jobId,
                                              "persuasion_document"
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {isDownloading(
                                    msg.metadata.jobId,
                                    "parsed_document"
                                  ) && (
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground">
                                        Downloading Full Proposal...{" "}
                                        {getDownloadProgress(
                                          msg.metadata.jobId,
                                          "parsed_document"
                                        ).toFixed(0)}
                                        %
                                      </div>
                                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary transition-all duration-300"
                                          style={{
                                            width: `${getDownloadProgress(
                                              msg.metadata.jobId,
                                              "parsed_document"
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* INPUT */}
      <div className="border-t p-4 relative">
        <div className="max-w-4xl mx-auto space-y-3">
          <SuggestionBubbles
            onSuggestionClick={(s) => handleSendMessage(s)}
            disabled={isLoading}
          />

          <div className="flex space-x-3">
            <Button variant="outline" size="icon">
              <Plus className="w-4 h-4" />
            </Button>

            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowCommandMenu(e.target.value.endsWith("@"));
              }}
              placeholder="Ask anything… (type @ for commands)"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* COMMAND MENU */}
        {showCommandMenu && (
          <div className="absolute bottom-24 left-8 bg-popover border rounded-lg shadow-lg w-64 z-50">
            <button
              className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted text-sm"
              onClick={() => {
                setShowCommandMenu(false);
                setShowRFPModal(true);
                setInputValue("");
              }}
            >
              <FileText className="w-4 h-4" />
              Generate Proposal
            </button>
          </div>
        )}
      </div>

      {/* RFP MODAL */}
      {showRFPModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg w-[480px] space-y-4 border shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Generate Proposal</h3>
              <p className="text-sm text-muted-foreground">
                Create a comprehensive AI-powered proposal using your space
                data
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Brief Name</label>
              <Input
                placeholder="e.g., Anti Stress Project, Q4 Marketing Campaign"
                value={rfpBriefName}
                onChange={(e) => setRfpBriefName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rfpBriefName.trim()) {
                    handleGenerateRFP();
                  }
                }}
                autoFocus
              />
            </div>

            {user && currentSpace && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">User:</span> {user.email}
                </div>
                <div>
                  <span className="font-medium">Space:</span>{" "}
                  {currentSpace.name || currentSpace.id}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRFPModal(false);
                  setRfpBriefName("");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!rfpBriefName.trim()}
                onClick={handleGenerateRFP}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;