import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Plus, ChevronDown, ChevronRight, BookOpen, Users, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import KnowledgeBase from "./KnowledgeBase";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  conversation_id: string;
  preview: string;
  last_updated: string;
  message_count: number;
}

interface ConversationSidebarProps {
  onNewChat: () => void;
  onSelectConversation?: (conversationId: string) => void;
  currentConversationId?: string | null;
  spaceId: string;
}

const ConversationSidebar = ({ 
  onNewChat, 
  onSelectConversation,
  currentConversationId,
  spaceId 
}: ConversationSidebarProps) => {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const { exitSpace, user } = useAuth();
  const navigate = useNavigate();
  
  // Use localhost for development, update for production
  const AGENT_BASE_URL = "https://dexraflow-asset-agent-ddfcf7d0fgg9ezc8.canadacentral-01.azurewebsites.net";

  const demoUsers = [
    { id: "1", name: "Sarah Johnson", role: "Marketing Lead", avatar: "SJ" },
    { id: "2", name: "Mike Chen", role: "Creative Director", avatar: "MC" },
    { id: "3", name: "Emily Davis", role: "Content Manager", avatar: "ED" },
    { id: "4", name: "James Wilson", role: "Designer", avatar: "JW" },
  ];

  const handleBackToSpaces = () => {
    exitSpace();
    navigate("/spaces");
  };

  // Fetch conversations on mount and when spaceId changes
  useEffect(() => {
    if (spaceId && user?.id) {
      fetchConversations();
    }
  }, [spaceId, user?.id]);

  const fetchConversations = async () => {
    if (!spaceId || !user?.id) return;
    
    setLoading(true);
    try {
      const url = `${AGENT_BASE_URL}/api/conversations?space_id=${encodeURIComponent(spaceId)}&user_id=${encodeURIComponent(user.id)}`;
      console.log("🔍 Fetching conversations from:", url);
      
      const response = await fetch(url);
      
      console.log("📡 Response status:", response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error("❌ Error response:", text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      
      const data = await response.json();
      console.log("✅ Conversations data:", data);
      
      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
        console.log(`📊 Loaded ${data.conversations.length} conversations`);
      } else {
        console.warn("⚠️ No conversations array in response");
        setConversations([]);
      }
    } catch (error) {
      console.error("❌ Failed to fetch conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    onNewChat();
    // Refresh conversations list after short delay to catch new conversation
    setTimeout(() => fetchConversations(), 1500);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Unknown";
    }
  };

  return (
    <div className="w-full md:w-64 lg:w-72 bg-background border-r border-border flex flex-col h-screen flex-shrink-0">
      <div className="p-4 border-b border-border flex-shrink-0 space-y-3">
        <Button 
          variant="ghost"
          onClick={handleBackToSpaces}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Spaces
        </Button>
        <Button 
          onClick={handleNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 py-4 space-y-4">
            {/* Knowledge Base Section */}
            <Collapsible open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
              <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                {knowledgeOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Knowledge Base</span>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2 pl-6">
                <KnowledgeBase />
              </CollapsibleContent>
            </Collapsible>

            {/* Users Section */}
            <Collapsible open={usersOpen} onOpenChange={setUsersOpen}>
              <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                {usersOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Users</span>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="pl-6">
                  <div className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {demoUsers.length} members
                    </div>
                  </div>
                  <div className="space-y-2">
                    {demoUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md transition-colors cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-medium text-primary">{user.avatar}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {user.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Recent Conversations */}
            <div>
              <div className="flex items-center space-x-2 mb-2 p-2">
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-foreground text-sm">Recent Conversations</h3>
              </div>
              
              {loading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  Loading...
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center px-2">
                  Start a new conversation to see your chat history here
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => onSelectConversation?.(conv.conversation_id)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        currentConversationId === conv.conversation_id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground line-clamp-2 mb-1">
                            {conv.preview}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(conv.last_updated)}</span>
                            <span>•</span>
                            <span>{conv.message_count} {conv.message_count === 1 ? 'turn' : 'turns'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          Weez.AI - Future of Digital Marketing
        </p>
      </div>
    </div>
  );
};

export default ConversationSidebar;