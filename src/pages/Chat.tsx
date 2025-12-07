import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import WeezHeader from "@/components/WeezHeader";
import ChatInterface from "@/components/ChatInterface";
import ConversationSidebar from "@/components/ConversationSidebar";
import ConnectionsPanel from "@/components/ConnectionsPanel";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const Chat = () => {
  const [initialExample, setInitialExample] = useState("");
  const [chatKey, setChatKey] = useState(0);
  const { toast } = useToast();
  const { isAuthenticated, currentSpace } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    } else if (!currentSpace) {
      navigate("/spaces");
    }
  }, [isAuthenticated, currentSpace, navigate]);

  const handleNewChat = () => {
    setInitialExample("");
    setChatKey(prev => prev + 1);
  };

  const handleConnectorSync = (platform: string) => {
    toast({
      title: "Connection Successful", 
      description: `Imported 12 marketing assets from ${platform} — added to demo workspace.`,
      duration: 3000,
    });
  };

  if (!isAuthenticated || !currentSpace) {
    return null;
  }

  return (
    <div className="h-screen flex bg-background text-foreground w-full overflow-hidden">
      {/* Left Sidebar - Conversations only */}
      <ConversationSidebar onNewChat={handleNewChat} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <WeezHeader spaceName={currentSpace.name} />
        <ChatInterface 
          key={chatKey}
          initialExample={initialExample} 
          onConnectorMessage={(message) => console.log(message)}
        />
      </div>
      
      {/* Right Panel - Connections */}
      <ConnectionsPanel onConnectorSync={handleConnectorSync} />
      
      <Toaster />
    </div>
  );
};

export default Chat;
