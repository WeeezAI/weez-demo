import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConnectorModalProps {
  platform: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConnectorModal = ({ platform, isOpen, onClose, onConfirm }: ConnectorModalProps) => {
  if (!platform) return null;

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Google Drive": return "🗂️";
      case "Dropbox": return "📦";
      case "OneDrive": return "☁️";
      case "Slack": return "💬";
      case "Notion": return "📝";
      default: return "🔌";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">{getPlatformIcon(platform)}</span>
            <span>Connect {platform}</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This will simulate connecting to {platform} and importing demo files for testing purposes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-weez-surface rounded-lg p-4 border border-weez-blue/20">
            <p className="text-sm text-foreground mb-2">Demo Connection Features:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Import sample documents</li>
              <li>• Simulate file sync process</li>
              <li>• Enable search across demo files</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-primary hover:bg-primary/90">
            Authorize Demo Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectorModal;