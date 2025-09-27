import { useState } from "react";
import { MessageCircle, Plus, CheckCircle, Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ConnectorModal from "./ConnectorModal";

interface AppSidebarProps {
  onNewChat: () => void;
  onConnectorSync: (platform: string) => void;
}

interface Connector {
  name: string;
  icon: string;
  connected: boolean;
}

const AppSidebar = ({ onNewChat, onConnectorSync }: AppSidebarProps) => {
  const [connectors, setConnectors] = useState<Connector[]>([
    { name: "Google Drive", icon: "🗂️", connected: false },
    { name: "Dropbox", icon: "📦", connected: false },
    { name: "OneDrive", icon: "☁️", connected: false },
    { name: "Slack", icon: "💬", connected: false },
    { name: "Notion", icon: "📝", connected: false },
  ]);
  
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleConnectorClick = (connectorName: string) => {
    const connector = connectors.find(c => c.name === connectorName);
    if (!connector?.connected) {
      setSelectedConnector(connectorName);
      setShowModal(true);
    }
  };

  const handleConnectorSync = (platform: string) => {
    setConnectors(prev => 
      prev.map(c => c.name === platform ? { ...c, connected: true } : c)
    );
    onConnectorSync(platform);
    setShowModal(false);
    setSelectedConnector(null);
  };

  return (
    <>
      <div className="w-64 h-full bg-background border-r border-border flex flex-col">
        <div className="p-6">
          <Button 
            onClick={onNewChat}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <Accordion type="multiple" defaultValue={["conversations", "connections"]} className="w-full">
            <AccordionItem value="conversations" className="border-none">
              <AccordionTrigger className="text-foreground hover:no-underline py-3 px-3">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-medium">Conversations</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-1 px-3">
                  <div className="text-sm text-muted-foreground py-2">
                    No previous conversations
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="connections" className="border-none">
              <AccordionTrigger className="text-foreground hover:no-underline py-3 px-3">
                <div className="flex items-center space-x-2">
                  <Cable className="w-4 h-4" />
                  <span className="font-medium">Connections</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-2 px-3">
                  {connectors.map((connector) => (
                    <Button
                      key={connector.name}
                      variant="ghost"
                      className="w-full justify-start h-auto py-2 px-3 bg-card hover:bg-card/80"
                      onClick={() => handleConnectorClick(connector.name)}
                    >
                      <span className="mr-2">{connector.icon}</span>
                      <span className="flex-1 text-left text-sm">{connector.name}</span>
                      {connector.connected ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Cable className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </div>

      <ConnectorModal
        platform={selectedConnector}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedConnector(null);
        }}
        onConfirm={() => selectedConnector && handleConnectorSync(selectedConnector)}
      />
    </>
  );
};

export default AppSidebar;