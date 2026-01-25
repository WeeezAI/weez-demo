import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, LifeBuoy, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HelpCenterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpCenterModal = ({ isOpen, onClose }: HelpCenterModalProps) => {
    const { toast } = useToast();
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSend = async () => {
        if (!subject.trim() || !message.trim()) return;

        setIsSending(true);
        try {
            const response = await fetch("http://localhost:8002/support/query", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ subject, message })
            });

            if (!response.ok) {
                throw new Error("Failed to send query");
            }

            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setSubject("");
                setMessage("");
            }, 2000);

            toast({
                title: "Query Sent",
                description: "Our support team has received your message.",
                className: "bg-emerald-500 text-white border-none"
            });

        } catch (error) {
            toast({
                title: "Submission Failed",
                description: "Could not send your message. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-0 border-none bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-secondary/30 p-10 pb-8 border-b border-border/40">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/[0.02]">
                            <LifeBuoy className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black tracking-tight uppercase">Help Center</DialogTitle>
                            <DialogDescription className="text-muted-foreground font-medium">Direct line to Weez Support.</DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-10 space-y-8">
                    {isSuccess ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Message Received!</h3>
                            <p className="text-muted-foreground max-w-xs">We've sent a confirmation to your email. Expect a response within 24 hours.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Subject</Label>
                                    <Input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="e.g. Issue with Instagram connection..."
                                        className="h-14 rounded-2xl bg-secondary/30 border-transparent focus:border-primary/20 font-medium"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Describe your problem</Label>
                                    <Textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Tell us what's happening..."
                                        className="min-h-[150px] rounded-3xl bg-secondary/30 border-transparent focus:border-primary/20 p-5 font-medium resize-none text-base"
                                    />
                                </div>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-2xl flex items-start gap-3 border border-orange-100">
                                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-orange-800 font-medium leading-relaxed">
                                    Support hours are 9 AM - 6 PM EST. Priority support is available for Premium users.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isSuccess && (
                    <div className="p-10 pt-0">
                        <Button
                            onClick={handleSend}
                            disabled={isSending || !subject.trim() || !message.trim()}
                            className="w-full h-16 rounded-[1.5rem] bg-foreground text-white hover:bg-primary transition-all text-sm font-black uppercase tracking-widest shadow-xl"
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                            {isSending ? "Sending..." : "Submit Query"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default HelpCenterModal;
