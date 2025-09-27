import { useState } from "react";
import WeezHeader from "@/components/WeezHeader";
import ChatInterface from "@/components/ChatInterface";
import AppSidebar from "@/components/AppSidebar";
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
      `📂 Syncing files (12/12)`,
      `✅ Imported 12 demo files — ready to search.`
    ];

    // Show toast notification
    toast({
      title: "Connection Successful",
      description: `Imported 12 files from ${platform} — added to demo workspace.`,
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <AppSidebar onNewChat={handleNewChat} onConnectorSync={handleConnectorSync} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <WeezHeader />
        <ChatInterface 
          key={chatKey}
          initialExample={initialExample} 
          onConnectorMessage={(message) => console.log(message)}
        />
      </div>
      
      <Toaster />
    </div>
  );
};

export default Index;
