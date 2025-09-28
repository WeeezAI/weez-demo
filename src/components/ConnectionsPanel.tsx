import { useState } from "react";
import { Cable, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ConnectorModal from "./ConnectorModal";

interface ConnectionsPanelProps {
  onConnectorSync: (platform: string) => void;
}

interface Connector {
  name: string;
  icon: string;
  connected: boolean;
  description: string;
}

const ConnectionsPanel = ({ onConnectorSync }: ConnectionsPanelProps) => {
  const [connectors, setConnectors] = useState<Connector[]>([
    { name: "Google Drive", icon: "GD", connected: false, description: "Creative assets, documents" },
    { name: "Dropbox", icon: "DB", connected: false, description: "File sharing, collaboration" },
    { name: "OneDrive", icon: "OD", connected: false, description: "Microsoft Office files" },
    { name: "Slack", icon: "SL", connected: false, description: "Team communications" },
    { name: "Notion", icon: "NT", connected: false, description: "Project documentation" },
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
      <div className="w-80 h-full bg-background border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2 mb-2">
            <Cable className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground">Link your tools</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect your marketing platforms to search and analyze your creative assets
          </p>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {connectors.map((connector) => (
            <Card key={connector.name} className="p-3 hover:shadow-button transition-shadow">
              <Button
                variant="ghost"
                className="w-full h-auto p-0 justify-start"
                onClick={() => handleConnectorClick(connector.name)}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground">{connector.icon}</span>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {connector.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {connector.description}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {connector.connected ? (
                      <div className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        <span>Connected</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center space-x-1 px-2 py-1 bg-weez-accent/10 text-weez-accent rounded-full text-xs font-medium hover:bg-weez-accent-hover/10 hover:text-weez-accent-hover transition-colors">
                        <Cable className="w-3 h-3" />
                        <span>Connect</span>
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            </Card>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Demo mode - connections simulate real integrations
          </p>
        </div>
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

export default ConnectionsPanel;