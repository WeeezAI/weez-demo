import { useState } from "react";
import { Cable, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConnectorModal from "./ConnectorModal";
import CustomConnectorModal from "./CustomConnectorModal";
import googleDriveIcon from "@/assets/google-drive-icon.png";
import dropboxIcon from "@/assets/dropbox-icon.png";
import onedriveIcon from "@/assets/onedrive-icon.png";
import slackIcon from "@/assets/slack-icon.png";
import notionIcon from "@/assets/notion-icon.png";

interface ConnectionsPanelProps {
  onConnectorSync: (platform: string) => void;
}

interface Connector {
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconImage?: string;
  connected: boolean;
  description: string;
  color: string;
}

const ConnectionsPanel = ({ onConnectorSync }: ConnectionsPanelProps) => {
  const [connectors, setConnectors] = useState<Connector[]>([
    { name: "Google Drive", iconImage: googleDriveIcon, connected: false, description: "Creative assets, documents", color: "text-yellow-600" },
    { name: "Dropbox", iconImage: dropboxIcon, connected: false, description: "File sharing, collaboration", color: "text-blue-500" },
    { name: "OneDrive", iconImage: onedriveIcon, connected: false, description: "Microsoft Office files", color: "text-blue-600" },
    { name: "Slack", iconImage: slackIcon, connected: false, description: "Team communications", color: "text-purple-600" },
    { name: "Notion", iconImage: notionIcon, connected: false, description: "Project documentation", color: "text-foreground" },
  ]);
  
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

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

  const handleCustomConnector = (platformName: string) => {
    const newConnector: Connector = {
      name: platformName,
      icon: Cable,
      connected: true,
      description: "Custom integration",
      color: "text-muted-foreground"
    };
    setConnectors(prev => [...prev, newConnector]);
    onConnectorSync(platformName);
    setShowCustomModal(false);
  };

  return (
    <>
      <div className="hidden md:flex w-72 lg:w-80 bg-background border-l border-border flex-col h-screen flex-shrink-0">
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center space-x-2 mb-2">
            <Cable className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground">Link your tools</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect your marketing platforms to search and analyze your creative assets
          </p>
        </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 pr-12 space-y-3">
            {connectors.map((connector) => {
              return (
                <Card 
                  key={connector.name} 
                  className="p-3 hover:bg-muted hover:shadow-button transition-all cursor-pointer"
                  onClick={() => handleConnectorClick(connector.name)}
                >
                    <div className="flex items-center space-x-3 w-full">
                      <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                        {connector.iconImage ? (
                          <img src={connector.iconImage} alt={connector.name} className="w-5 h-5 object-contain" />
                        ) : connector.icon && (
                          <connector.icon className={`w-4 h-4 ${connector.color}`} />
                        )}
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
                </Card>
              );
            })}

              <Button
                variant="outline"
                className="w-full justify-start mt-2"
                onClick={() => setShowCustomModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Connection
              </Button>
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 border-t border-border flex-shrink-0">
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

      <CustomConnectorModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onConfirm={handleCustomConnector}
      />
    </>
  );
};

export default ConnectionsPanel;