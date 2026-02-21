import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Instagram, Facebook, ArrowRight, CheckCircle2 } from "lucide-react";
import { weezAPI } from "@/services/weezAPI";

interface InstagramConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    spaceId: string;
}

const InstagramConnectModal = ({ isOpen, onClose, spaceId }: InstagramConnectModalProps) => {
    const handleContinue = () => {
        if (spaceId) {
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
                    {/* Step 1 */}
                    <div className="relative pl-14 group">
                        <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-black text-xs text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                            01
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xl font-black uppercase tracking-tight">Convert to Professional Identity</h4>
                            <div className="p-6 rounded-2xl bg-secondary/30 border border-border/40 space-y-3">
                                <p className="text-sm font-bold text-muted-foreground">Inside Instagram app:</p>
                                <div className="flex items-center gap-3 text-sm font-black text-foreground">
                                    <span>Settings</span>
                                    <ArrowRight className="w-3 h-3 opacity-30" />
                                    <span>Account</span>
                                    <ArrowRight className="w-3 h-3 opacity-30" />
                                    <span className="text-pink-600">Switch to Professional</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="relative pl-14 group">
                        <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-black text-xs text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                            02
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xl font-black uppercase tracking-tight">Handshake with Facebook Page</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-6 rounded-2xl bg-secondary/30 border border-border/40 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Instagram className="w-3.5 h-3.5 text-pink-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Via Instagram</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-black leading-tight">
                                        <span>Settings</span>
                                        <ArrowRight className="w-3 h-3 opacity-30" />
                                        <span>Business</span>
                                        <ArrowRight className="w-3 h-3 opacity-30" />
                                        <span className="text-pink-600">Connect to Facebook Page</span>
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl bg-secondary/30 border border-border/40 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Facebook className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Via Facebook</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-black leading-tight">
                                        <span>Settings</span>
                                        <ArrowRight className="w-3 h-3 opacity-30" />
                                        <span>Linked Accounts</span>
                                        <ArrowRight className="w-3 h-3 opacity-30" />
                                        <span className="text-blue-600">Instagram</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-12 pt-0">
                    <Button
                        onClick={handleContinue}
                        className="w-full h-20 rounded-[1.5rem] bg-foreground text-white hover:bg-primary transition-all text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 flex gap-4"
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
        </Dialog>
    );
};

export default InstagramConnectModal;
