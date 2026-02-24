import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Instagram, Facebook, ArrowRight, CheckCircle2, AlertCircle, Check } from "lucide-react";
import { weezAPI } from "@/services/weezAPI";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface InstagramConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    spaceId: string;
}

const InstagramConnectModal = ({ isOpen, onClose, spaceId }: InstagramConnectModalProps) => {
    const [isConfirmed, setIsConfirmed] = useState(false);

    const handleContinue = () => {
        if (spaceId && isConfirmed) {
            window.location.href = weezAPI.getInstagramAuthUrl(spaceId);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl p-0 border-none bg-white rounded-[3rem] shadow-2xl overflow-hidden">
                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent p-12 pb-8">
                    <div className="flex items-center gap-5 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-pink-500/10">
                            <Instagram className="w-7 h-7 text-pink-500" />
                        </div>
                        <div>
                            <DialogTitle className="text-3xl font-black tracking-tighter uppercase">Connection Guide</DialogTitle>
                            <DialogDescription className="text-muted-foreground font-medium text-lg">Follow these steps to synchronize your identity.</DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div className="p-12 pt-4 space-y-10">
                    {/* Checklist */}
                    <div className="relative pl-14 pt-4">
                        <div className="absolute left-0 top-4 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-xl font-black uppercase tracking-tight">Pre-Connection Checklist</h4>
                            <div className="space-y-3">
                                {[
                                    "Your Instagram must be a Business Account (not Personal).",
                                    "Your Instagram must be linked to a Facebook Page.",
                                    "You must have Full Control access to that Facebook Page.",
                                    "The Facebook Page must be published (not in draft).",
                                    "Ensure you are assigned Full Control inside Business Manager if the Page was created by another account."
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-3 items-start">
                                        <div className="mt-1 w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground leading-snug">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Confirmation Checkbox */}
                    <div className="flex items-start gap-4 p-6 rounded-[2rem] bg-pink-500/5 border border-pink-500/10">
                        <Checkbox
                            id="confirm-reqs"
                            checked={isConfirmed}
                            onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
                            className="mt-1 border-pink-500/20 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                        />
                        <label
                            htmlFor="confirm-reqs"
                            className="text-sm font-bold text-pink-700/70 leading-relaxed cursor-pointer select-none"
                        >
                            I confirm my Instagram and Facebook Page meet the above requirements.
                        </label>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-12 pt-0">
                    <Button
                        onClick={handleContinue}
                        disabled={!isConfirmed}
                        className="w-full h-20 rounded-[1.5rem] bg-foreground text-white hover:bg-primary disabled:opacity-30 disabled:grayscale transition-all text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 flex gap-4"
                    >
                        Continue to Connect
                        <CheckCircle2 className="w-5 h-5" />
                    </Button>
                    <button
                        onClick={onClose}
                        className="w-full text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground hover:text-foreground transition-colors opacity-30 py-6"
                    >
                        Cancel Handshake
                    </button>
                </div>
            </DialogContent>
        </Dialog >
    );
};

export default InstagramConnectModal;
