import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Folder {
  id: string;
  name: string;
}

interface FolderSelectionModalProps {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  onConfirm: (selected: Folder[]) => void;
}

export default function FolderSelectionModal({
  open,
  onClose,
  folders,
  onConfirm,
}: FolderSelectionModalProps) {

  const [selected, setSelected] = useState<Folder[]>([]);

  const toggleFolder = (folder: Folder) => {
    setSelected(prev =>
      prev.some(f => f.id === folder.id)
        ? prev.filter(f => f.id !== folder.id)
        : [...prev, folder]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Folders to Sync</DialogTitle>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto mt-4 border p-3 rounded-md">
          {folders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between py-2 px-2 hover:bg-muted rounded cursor-pointer"
              onClick={() => toggleFolder(f)}
            >
              <span>{f.name}</span>
              <input
                type="checkbox"
                checked={!!selected.find(s => s.id === f.id)}
                readOnly
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(selected)}>
            Save Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

