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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <span className="text-2xl">{getPlatformIcon(platform)}</span>
            <span>Authorize Demo Connection</span>
          </DialogTitle>
          <DialogDescription>
            Connect to <strong>{platform}</strong> to sync your marketing assets and creative files for demo purposes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">Demo Connection Will:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Import sample marketing & creative documents</li>
              <li>• Enable search across demo asset library</li>
              <li>• Simulate real platform integration</li>
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground">
            This is a demo environment. No real credentials are required or stored.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
            Authorize Demo Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectorModal;