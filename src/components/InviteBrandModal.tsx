import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface InviteBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSent: (brandName: string, email: string) => void;
}

const InviteBrandModal = ({ isOpen, onClose, onInviteSent }: InviteBrandModalProps) => {
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");

  const handleSendInvite = () => {
    if (brandName.trim() && email.trim()) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "Invitation Sent!",
        description: `Invite sent to ${brandName} at ${email}`,
      });
      
      onInviteSent(brandName, email);
      setBrandName("");
      setEmail("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inviting a Brand</DialogTitle>
          <DialogDescription>
            Invite a brand to share their creative assets with your Weez.AI workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Brand Name</Label>
            <Input
              id="brand-name"
              placeholder="e.g., Acme Corporation"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-email">Email Address</Label>
            <Input
              id="brand-email"
              type="email"
              placeholder="e.g., contact@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              className="border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleSendInvite} 
            disabled={!brandName.trim() || !email.trim()}
            className="w-full"
          >
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteBrandModal;
