// Chat.tsx — WITH CONVERSATION HISTORY (Updated for new schema)

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import WeezHeader from "@/components/WeezHeader";
import ChatInterface from "@/components/ChatInterface";
import ConversationSidebar from "@/components/ConversationSidebar";
import ConnectionsPanel from "@/components/ConnectionsPanel";

import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchConversationHistory } from "@/services/conversationAPI";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const Chat = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    loadingAuth,
    isAuthenticated,
    spaces,
    currentSpace,
    selectSpace,
    user,
  } = useAuth();

  const [chatKey, setChatKey] = useState(0);
  const [initialExample, setInitialExample] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);

  // ------------------------------
  // Ensure auth is loaded
  // ------------------------------
  useEffect(() => {
    if (loadingAuth) return;
    if (!isAuthenticated) navigate("/auth");
  }, [loadingAuth, isAuthenticated]);

  // ------------------------------
  // Load correct space from URL
  // ------------------------------
  useEffect(() => {
    if (!spaces || spaces.length === 0) return;

    const found = spaces.find((s) => s.id === spaceId);
    if (!found) {
      navigate("/spaces");
      return;
    }

    selectSpace(found);
  }, [spaces, spaceId]);

  // ------------------------------
  // Load Conversation History
  // ------------------------------
  const loadConversationHistory = async (conversationId: string) => {
    if (!spaceId || !user?.id) return;

    setLoadingConversation(true);
    try {
      const turns = await fetchConversationHistory(conversationId, spaceId, user.id);
      
      console.log(`📚 Loaded ${turns.length} turns from conversation ${conversationId}`);
      
      // Convert turns to message format for ChatInterface
      // Each turn has user_query and agent_response
      const formattedMessages: Message[] = [];
      
      turns.forEach((turn) => {
        // Add user message
        formattedMessages.push({
          id: `${turn.id}-user`,
          role: "user",
          content: turn.user_query,
          timestamp: turn.timestamp,
        });
        
        // Add assistant message
        formattedMessages.push({
          id: `${turn.id}-assistant`,
          role: "assistant",
          content: turn.agent_response,
          timestamp: turn.timestamp,
        });
      });

      console.log(`✅ Formatted ${formattedMessages.length} messages for display`);
      setConversationHistory(formattedMessages);
      
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive",
        duration: 3000,
      });
      setConversationHistory([]);
    } finally {
      setLoadingConversation(false);
    }
  };

  // ------------------------------
  // Handle Conversation Selection
  // ------------------------------
  const handleSelectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    await loadConversationHistory(conversationId);
    // Force ChatInterface to re-render with new history
    setChatKey((prev) => prev + 1);
  };

  // ------------------------------
  // New Chat
  // ------------------------------
  const handleNewChat = () => {
    setCurrentConversationId(null);
    setConversationHistory([]);
    setInitialExample("");
    setChatKey((prev) => prev + 1);
  };

  // ------------------------------
  // Update conversation ID after first message
  // ------------------------------
  const handleNewMessage = (conversationId: string) => {
    if (!currentConversationId) {
      setCurrentConversationId(conversationId);
    }
  };

  // Show loading state
  if (loadingAuth || !currentSpace) {
    return <div className="p-10 text-center">Loading workspace...</div>;
  }

  // ------------------------------
  // Connections Sync
  // ------------------------------
  const handleConnectorSync = (platform: string) => {
    toast({
      title: "Connection Successful",
      description: `Imported assets from ${platform}`,
      duration: 3000,
    });
  };

  return (
    <div className="h-screen flex bg-background text-foreground w-full overflow-hidden">
      
      {/* Left Sidebar */}
      <ConversationSidebar 
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
        spaceId={spaceId || ""}
      />

      {/* Middle Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <WeezHeader spaceName={currentSpace.name} />
        
        {loadingConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <ChatInterface
            key={chatKey}
            initialExample={initialExample}
            onConnectorMessage={(msg) => console.log(msg)}
            conversationId={currentConversationId}
            initialHistory={conversationHistory}
            onNewMessage={handleNewMessage}
          />
        )}
      </div>

      {/* Right Panel */}
      <ConnectionsPanel onConnectorSync={handleConnectorSync} />

      <Toaster />
    </div>
  );
};

export default Chat;