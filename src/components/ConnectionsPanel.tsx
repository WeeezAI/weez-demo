import { useEffect, useState } from "react";
import { Cable, Check, Share2, Database, Zap, Mail, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import googleDriveIcon from "@/assets/google-drive-icon.png";
import instagramIcon from "@/assets/instagram-icon.jpeg";

import { useAuth } from "@/contexts/AuthContext";
import { platformAPI } from "@/services/platformAPI";
import { metadataAPI } from "@/services/metadataAPI";
import FolderSelectionModal from "./connections/FolderSelectionModal";
import { toast } from "sonner";
import { weezAPI } from "@/services/weezAPI";

interface ConnectionsPanelProps {
  onConnectorSync: (platform: string) => void;
}

interface Connector {
  name: string;
  providerKey: string;
  iconImage?: string;
  icon?: any;
  connected: boolean;
  description: string;
  color: string;
}

const ConnectionsPanel = ({ onConnectorSync }: ConnectionsPanelProps) => {
  const { currentSpace } = useAuth();
  const token = sessionStorage.getItem("token");

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
      name: "Gmail",
      providerKey: "gmail",
      icon: Mail,
      connected: false,
      description: "Email delivery & outreach",
      color: "text-red-500",
    },
    {
      name: "Outlook",
      providerKey: "outlook",
      icon: Mail,
      connected: false,
      description: "Microsoft email & outreach",
      color: "text-blue-500",
    },
    {
      name: "Google Calendar",
      providerKey: "google_calendar",
      icon: Calendar,
      connected: false,
      description: "Schedule meetings & events",
      color: "text-green-500",
    },
    {
      name: "Microsoft Calendar",
      providerKey: "microsoft_calendar",
      icon: Calendar,
      connected: false,
      description: "Outlook calendar integration",
      color: "text-blue-600",
    },
  ]);

  const [socialConnectors, setSocialConnectors] = useState<Connector[]>([
    {
      name: "Instagram",
      providerKey: "instagram",
      iconImage: instagramIcon,
      connected: false,
      description: "Share posts & stories",
      color: "text-pink-500",
    },
  ]);

  // ---------------------------------------------------
  // 🔄 Load connected platforms
  // ---------------------------------------------------
  const loadConnections = async () => {
    if (!currentSpace || !token) return;

    try {
      // 1. Load generic platform connections
      const list = await platformAPI.getConnections(currentSpace.id, token);
      const connectedPlatforms = list.map((c: any) =>
        c.platform?.toLowerCase()
      );

      // 2. Load dedicated Weez Instagram status
      const igStatus = await weezAPI.getInstagramStatus(currentSpace.id);

      // Update generic connectors (including Gmail, Outlook, Calendar)
      setConnectors((prev) =>
        prev.map((c) => ({
          ...c,
          connected: connectedPlatforms.includes(c.providerKey),
        }))
      );

      // Update social connectors (Instagram)
      setSocialConnectors((prev) =>
        prev.map((c) => {
          if (c.providerKey === "instagram") {
            return { ...c, connected: igStatus.connected || connectedPlatforms.includes("instagram") };
          }
          return c;
        })
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

    // Specific logic for Instagram (Weez Pipeline)
    if (connector.providerKey === "instagram") {
      try {
        const authUrl = await weezAPI.getInstagramAuthUrl(currentSpace.id);
        console.log("🚀 Redirecting to Weez Instagram OAuth:", authUrl);
        window.location.href = authUrl;
      } catch (err) {
        console.error("Failed to get Instagram auth URL:", err);
        toast.error("Failed to start Instagram connection");
      }
      return;
    }

    // Generic logic for other platforms
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
            <Database className="w-4 h-4 text-muted-foreground" />
            Strategic Assets
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connected brand repositories and repositories.
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-6 space-y-3">
            {/* Strategic Assets Connectors */}
            {connectors.map((connector) => (
              <Card
                key={connector.providerKey}
                className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => !connector.connected && handleConnect(connector)}
              >
                <div className="flex items-center gap-3">
                  {connector.iconImage ? (
                    <img
                      src={connector.iconImage}
                      alt={connector.name}
                      className="w-8 h-8 rounded"
                    />
                  ) : connector.icon ? (
                    <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${connector.color}`}>
                      <connector.icon className="w-4 h-4" />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{connector.name}</span>
                      {connector.connected && (
                        <Check className="w-3 h-3 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{connector.description}</p>
                  </div>
                </div>
              </Card>
            ))}

            {/* Social connectors removed as they are managed via the Campaign Hub / Spaces grid */}

            <div className="flex flex-col items-center justify-center p-8 text-center gap-4 opacity-20 mt-10">
              <Zap className="w-10 h-10" />
              <span className="text-[10px] font-black uppercase tracking-widest">Active Intelligence Shell</span>
            </div>
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
