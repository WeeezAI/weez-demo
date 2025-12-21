import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Folder } from "lucide-react";

const PLATFORM_BASE = "https://dexraflow-platform-connection-hrd4akh9eqgeeqe9.canadacentral-01.azurewebsites.net";

interface FolderItem {
  id: string;
  name: string;
}

export default function Folders() {
  const { currentSpace, token } = useAuth() as any;
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const navigate = useNavigate();

  // Redirect if directly opening the page
  useEffect(() => {
    if (!currentSpace) {
      navigate("/spaces");
      return;
    }
    fetchFolders();
  }, []);

  // -------------------------------------
  // FETCH FOLDERS FROM BACKEND
  // -------------------------------------
  const fetchFolders = async () => {
    try {
      const res = await fetch(
        `${PLATFORM_BASE}/platforms/${currentSpace.id}/google/folders`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail);

      setFolders(data.folders || []);
    } catch (err: any) {
      toast.error("Failed to load Google Drive folders");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------
  // TOGGLE SELECTION
  // -------------------------------------
  const toggle = (folderId: string) => {
    setSelected((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  // -------------------------------------
  // SYNC SELECTED FOLDERS
  // -------------------------------------
  const syncSelectedFolders = async () => {
    if (selected.length === 0) return;

    setSyncing(true);

    const payload = {
      folders: folders
        .filter((f) => selected.includes(f.id))
        .map((f) => ({ id: f.id, name: f.name })),
    };

    try {
      const res = await fetch(
        `${PLATFORM_BASE}/sync/${currentSpace.id}/google/folders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail);

      toast.success(`Synced ${data.synced_count} files successfully!`);

      // Redirect to chat or assets after sync
      navigate("/chat");

    } catch (err: any) {
      toast.error(err.message || "Folder sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------
  // RENDER
  // -------------------------------------
  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-3">Select Folders to Sync</h1>
      <p className="text-muted-foreground mb-6">
        Choose which Google Drive folders you want to import into this space.
      </p>

      {folders.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No folders found in your Google Drive.
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-3">
          <div className="space-y-3">
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className={`p-4 flex items-center justify-between cursor-pointer border ${
                  selected.includes(folder.id)
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
                onClick={() => toggle(folder.id)}
              >
                <div className="flex items-center space-x-3">
                  <Folder className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{folder.name}</span>
                </div>

                <Checkbox checked={selected.includes(folder.id)} />
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <Button
        className="w-full mt-6"
        disabled={selected.length === 0 || syncing}
        onClick={syncSelectedFolders}
      >
        {syncing ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        Sync Selected Folders
      </Button>
    </div>
  );
}
