import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (platformName: string) => void;
}

const CustomConnectorModal = ({ isOpen, onClose, onConfirm }: CustomConnectorModalProps) => {
  const [platformName, setPlatformName] = useState("");

  const handleConfirm = () => {
    if (platformName.trim()) {
      onConfirm(platformName.trim());
      setPlatformName("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Connection</DialogTitle>
          <DialogDescription>
            Connect a custom platform to your Weez.AI workspace. Enter the platform name below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input
              id="platform-name"
              placeholder="e.g., Airtable, Asana, Trello..."
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!platformName.trim()}>
            Add Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomConnectorModal;
