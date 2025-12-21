import { useEffect, useState } from "react";
import { Cable, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import googleDriveIcon from "@/assets/google-drive-icon.png";
import dropboxIcon from "@/assets/dropbox-icon.png";
import onedriveIcon from "@/assets/onedrive-icon.png";
import slackIcon from "@/assets/slack-icon.png";
import notionIcon from "@/assets/notion-icon.png";

import { useAuth } from "@/contexts/AuthContext";
import { platformAPI } from "@/services/platformAPI";
import { metadataAPI } from "@/services/metadataAPI";
import FolderSelectionModal from "./connections/FolderSelectionModal";
import { toast } from "sonner";

interface ConnectionsPanelProps {
  onConnectorSync: (platform: string) => void;
}

interface Connector {
  name: string;
  providerKey: string;
  iconImage?: string;
  connected: boolean;
  description: string;
  color: string;
}

const ConnectionsPanel = ({ onConnectorSync }: ConnectionsPanelProps) => {
  const { currentSpace } = useAuth();
  const token = localStorage.getItem("token");

  const [connectors, setConnectors] = useState<Connector[]>([
    {
      name: "Google Drive",
      providerKey: "google",
      iconImage: googleDriveIcon,
      connected: false,
      description: "Creative assets, documents",
      color: "text-yellow-600",
    },
    {
      name: "Dropbox",
      providerKey: "dropbox",
      iconImage: dropboxIcon,
      connected: false,
      description: "File sharing, collaboration",
      color: "text-blue-500",
    },
    {
      name: "OneDrive",
      providerKey: "onedrive",
      iconImage: onedriveIcon,
      connected: false,
      description: "Microsoft Office files",
      color: "text-blue-600",
    },
    {
      name: "Slack",
      providerKey: "slack",
      iconImage: slackIcon,
      connected: false,
      description: "Team communication",
      color: "text-purple-600",
    },
    {
      name: "Notion",
      providerKey: "notion",
      iconImage: notionIcon,
      connected: false,
      description: "Documentation",
      color: "text-foreground",
    },
  ]);

  // ---------------------------------------------------
  // 🔄 Load connected platforms
  // ---------------------------------------------------
  const loadConnections = async () => {
    if (!currentSpace || !token) return;

    try {
      const list = await platformAPI.getConnections(currentSpace.id, token);
      const connectedPlatforms = list.map((c: any) =>
        c.platform?.toLowerCase()
      );

      setConnectors((prev) =>
        prev.map((c) => ({
          ...c,
          connected: connectedPlatforms.includes(c.providerKey),
        }))
      );
    } catch (err) {
      console.error("Failed to load connections:", err);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [currentSpace]);

  // ---------------------------------------------------
  // 🔗 OAuth start
  // ---------------------------------------------------
  const handleConnect = async (connector: Connector) => {
    if (!currentSpace || !token) return;

    try {
      const resp = await platformAPI.getAuthUrl(
        currentSpace.id,
        connector.providerKey,
        token
      );

      if (!resp.auth_url) {
        toast.error("Failed to start OAuth");
        return;
      }

      window.location.href = resp.auth_url;
    } catch (err) {
      toast.error("OAuth flow failed");
    }
  };

  // ---------------------------------------------------
  // 🗂 Folder Selection
  // ---------------------------------------------------
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderList, setFolderList] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const openFolderSelection = async () => {
    if (!currentSpace || !token) return;

    try {
      const resp = await platformAPI.getFolders(
        currentSpace.id,
        "google",
        token
      );
      setFolderList(resp.folders || []);
      setFolderModalOpen(true);
    } catch (err) {
      toast.error("Failed to load folders");
    }
  };

  // ---------------------------------------------------
  // ✅ FINAL: Sync → Metadata
  // ---------------------------------------------------
  const handleFolderConfirm = async (selectedFolders: any[]) => {
    if (!currentSpace || selectedFolders.length === 0) return;

    setFolderModalOpen(false);
    setSyncing(true);

    try {
      // 1️⃣ Sync selected folders
      await platformAPI.syncFolders(
        currentSpace.id,
        "google",
        selectedFolders,
        token
      );

      toast.success("Folders synced. Generating metadata...");

      // 2️⃣ Trigger metadata processing
      await metadataAPI.processAll(currentSpace.id);

      toast.success("Assets processed and ready!");
      onConnectorSync("google");
    } catch (err) {
      console.error(err);
      toast.error("Folder sync or metadata processing failed");
    } finally {
      setSyncing(false);
    }
  };

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------
  return (
    <>
      <div className="hidden md:flex w-72 lg:w-80 bg-background border-l border-border flex-col h-screen">
        <div className="p-6 border-b border-border">
          <h3 className="text-foreground font-semibold flex items-center gap-2">
            <Cable className="w-4 h-4 text-muted-foreground" />
            Link your tools
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect platforms to sync your creative & marketing assets
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-1 py-6 space-y-3">
            {connectors.map((connector) => (
              <Card
                key={connector.name}
                onClick={() =>
                  !connector.connected && handleConnect(connector)
                }
                className="p-3 hover:bg-muted cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                    <img
                      src={connector.iconImage}
                      alt={connector.name}
                      className="w-5 h-5"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="font-medium text-sm">{connector.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {connector.description}
                    </div>
                  </div>

                  {connector.connected ? (
                    <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Connected
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-weez-accent bg-weez-accent/10 rounded-full text-xs">
                      Connect
                    </div>
                  )}
                </div>

                {connector.connected &&
                  connector.providerKey === "google" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openFolderSelection();
                      }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Select folders →
                    </button>
                  )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <FolderSelectionModal
        open={folderModalOpen}
        folders={folderList}
        onClose={() => setFolderModalOpen(false)}
        onConfirm={handleFolderConfirm}
      />
    </>
  );
};

export default ConnectionsPanel;
