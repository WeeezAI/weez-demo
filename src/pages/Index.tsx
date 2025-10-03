import { useState } from "react";
import WeezHeader from "@/components/WeezHeader";
import ChatInterface from "@/components/ChatInterface";
import ConversationSidebar from "@/components/ConversationSidebar";
import ConnectionsPanel from "@/components/ConnectionsPanel";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [initialExample, setInitialExample] = useState("");
  const [chatKey, setChatKey] = useState(0);
  const { toast } = useToast();

  const handleNewChat = () => {
    setInitialExample("");
    setChatKey(prev => prev + 1);
  };

  const handleConnectorSync = (platform: string) => {
    // Simulate sync messages in chat  
    const syncMessages = [
      `🔌 Connecting to ${platform}...`,
      `📂 Syncing demo assets (images, videos, files)...`,
      `✅ Imported 12 demo marketing & creative documents — ready to search.`
    ];

    // Show toast notification
    toast({
      title: "Connection Successful", 
      description: `Imported 12 marketing assets from ${platform} — added to demo workspace.`,
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground w-full">
      {/* Left Sidebar - Conversations only */}
      <ConversationSidebar onNewChat={handleNewChat} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <WeezHeader />
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

export default Index;
