import { useState } from "react";
import WeezHeader from "@/components/WeezHeader";
import ChatInterface from "@/components/ChatInterface";
import CapabilitiesPanel from "@/components/CapabilitiesPanel";
import { Toaster } from "@/components/ui/toaster";

const Index = () => {
  const [showCapabilities, setShowCapabilities] = useState(true);
  const [initialExample, setInitialExample] = useState("");

  const handleExampleClick = (example: string) => {
    setInitialExample(example);
    setShowCapabilities(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WeezHeader />
      
      {showCapabilities ? (
        <CapabilitiesPanel onExampleClick={handleExampleClick} />
      ) : (
        <div className="flex-1 flex flex-col">
          <ChatInterface initialExample={initialExample} onBackToCapabilities={() => setShowCapabilities(true)} />
        </div>
      )}
      
      <Toaster />
    </div>
  );
};

export default Index;
