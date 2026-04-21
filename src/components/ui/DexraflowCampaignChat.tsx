"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
    Sparkles,
    Target,
    Layers,
    Share2,
    BrainCircuit,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
    Flame,
    Zap,
    Settings2,
    Calendar,
    Trophy,
    Rocket,
    X,
    ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AutoResizeProps { minHeight: number; maxHeight?: number; }

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const adjustHeight = useCallback((reset?: boolean) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = `${minHeight}px`;
        if (reset) return;
        const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? 300));
        textarea.style.height = `${newHeight}px`;
    }, [minHeight, maxHeight]);

    useEffect(() => {
        if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
    }, [minHeight]);

    return { textareaRef, adjustHeight };
}

export function DexraflowCampaignChat({ 
    value, 
    setValue, 
    onGenerate, 
    onAutonomousCampaign,
    campaignDuration,
    setCampaignDuration,
    campaignType,
    setCampaignType,
    marketingMode,
    setMarketingMode
}: { 
    value: string; 
    setValue: (v: string) => void; 
    onGenerate: () => void; 
    onAutonomousCampaign: () => void;
    campaignDuration: string;
    setCampaignDuration: (v: string) => void;
    campaignType: string;
    setCampaignType: (v: string) => void;
    marketingMode: string;
    setMarketingMode: (v: string) => void;
}) {
    const { currentSpace } = useAuth();
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 64, maxHeight: 240 });

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                onGenerate();
            }
        }
    };

    const brandName = currentSpace?.name || "your brand";
    const phrases = [
        "increase the engagement by 20% in 30 days",
        "do rapid marketing for 7 days",
        "do content posting for 30 days",
        "Architect your next breakthrough..."
    ];
    
    const [displayText, setDisplayText] = useState("");
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(50);

    useEffect(() => {
        const handleType = () => {
            const currentPhrase = phrases[phraseIndex];
            if (isDeleting) {
                setDisplayText(currentPhrase.substring(0, displayText.length - 1));
                setTypingSpeed(25);
            } else {
                setDisplayText(currentPhrase.substring(0, displayText.length + 1));
                setTypingSpeed(50);
            }

            if (!isDeleting && displayText === currentPhrase) {
                setTimeout(() => setIsDeleting(true), 2000);
            } else if (isDeleting && displayText === "") {
                setIsDeleting(false);
                setPhraseIndex((prev) => (prev + 1) % phrases.length);
            }
        };

        const timer = setTimeout(handleType, typingSpeed);
        return () => clearTimeout(timer);
    }, [displayText, isDeleting, phraseIndex, typingSpeed]);

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header with Brand Data */}
            <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 scale-95">
                    <Zap className="w-3 h-3 fill-current animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Autonomous Marketing Workforce</span>
                </div>
                <h1 className="text-[34px] font-black tracking-tight text-zinc-950 leading-tight">
                    What shall we architect for <br />
                    <span className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-cyan-500 bg-clip-text text-transparent">{brandName}</span> today?
                </h1>
                <p className="text-zinc-800 text-[16px] font-bold tracking-tight max-w-2xl mx-auto leading-relaxed">
                    Deploy conversion-optimized artifacts and strategic narratives with absolute brand alignment.
                </p>
            </div>

            <div className="w-full max-w-3xl space-y-6">
                {/* Indigo Glassmorphic Chat Input */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-3xl blur opacity-10 group-focus-within:opacity-25 transition duration-1000"></div>
                    <div className="relative glass-panel bg-white/60 backdrop-blur-3xl rounded-[1.5rem] border border-white/20 shadow-xl overflow-hidden transition-all duration-500 group-focus-within:shadow-indigo-500/10">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
                            onKeyDown={handleKeyDown}
                            placeholder={displayText}
                            className="w-full px-8 py-5 resize-none bg-transparent border-none text-zinc-950 text-base font-bold placeholder:text-muted-foreground/30 focus-visible:ring-0 min-h-[64px] scrollbar-hide leading-relaxed transition-all duration-500"
                        />

                        <div className="flex items-center justify-end px-6 py-4 border-t border-white/5 bg-white/5">
                            <button 
                                onClick={() => setIsConfigOpen(!isConfigOpen)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all border shadow-sm",
                                    isConfigOpen 
                                        ? "bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/20" 
                                        : "bg-white/40 hover:bg-white/60 border-white/10 text-foreground"
                                )}
                            >
                                <Settings2 className={cn("w-3.5 h-3.5", isConfigOpen && "animate-spin-slow")} />
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] font-black">Configure Workspace</span>
                                <ChevronDown className={cn("w-3 h-3 transition-transform duration-300 opacity-50", isConfigOpen && "rotate-180")} />
                            </button>
                        </div>

                        {/* Expandable Configuration Section */}
                        <div className={cn(
                            "grid transition-all duration-500 ease-in-out",
                            isConfigOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}>
                            <div className="overflow-hidden">
                                <div className="px-8 py-5 border-t border-white/10 bg-indigo-50/30 flex flex-col gap-5">
                                    <div className="grid grid-cols-3 gap-4">
                                        <ConfigOption 
                                            label="Duration" 
                                            icon={<Calendar className="w-3 h-3" />}
                                            value={campaignDuration + " Days"}
                                            options={["7", "14", "30", "90"]}
                                            onSelect={setCampaignDuration}
                                        />
                                        <ConfigOption 
                                            label="Intensity" 
                                            icon={<Flame className="w-3 h-3" />}
                                            value={marketingMode}
                                            options={["low", "medium", "high"]}
                                            onSelect={setMarketingMode}
                                        />
                                        <ConfigOption 
                                            label="Strategic Goal" 
                                            icon={<Trophy className="w-3 h-3" />}
                                            value={campaignType}
                                            options={["engagement", "awareness", "conversion"]}
                                            onSelect={setCampaignType}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Action Section */}
                <div className="flex flex-col gap-5 pt-2">
                    <button 
                        onClick={onAutonomousCampaign}
                        className="w-full max-w-xl mx-auto relative group overflow-hidden py-7 rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 active:scale-[0.98] transition-all duration-500 transform-gpu"
                    >
                        {/* Dynamic Button Shine / Shimmer */}
                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine transition-transform duration-1000" />
                        
                        {/* Pulsing Aura */}
                        <div className="absolute inset-0 bg-indigo-400/20 opacity-0 group-hover:opacity-100 animate-pulse-slow transition-opacity duration-700" />
                        
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <div className="relative flex items-center justify-center gap-3 font-black">
                            <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1.5 group-hover:scale-110 transition-all duration-500 ease-out" />
                            <span className="text-[11px] font-black uppercase tracking-[0.25em] drop-shadow-sm">Run Autonomous Campaign</span>
                        </div>

                        {/* Interactive Sparkles or Dots can be added here if needed */}
                    </button>

                    {/* Quick Tactical Actions Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                         <StrategicAction icon={<Layers className="text-indigo-500" />} label="10x Carousel" />
                         <StrategicAction icon={<Sparkles className="text-indigo-500" />} label="Vision series" />
                         <StrategicAction icon={<Share2 className="text-indigo-500" />} label="Platform Switch" />
                         <StrategicAction icon={<BrainCircuit className="text-indigo-500" />} label="Strategic Brief" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ConfigOption({ label, icon, value, options, onSelect }: { label: string, icon: any, value: string, options: string[], onSelect: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 ml-0.5">
                <div className="text-indigo-600">{icon}</div>
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                    <button
                        key={opt}
                        onClick={() => onSelect(opt)}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all border",
                            (value.toLowerCase().includes(opt.toLowerCase()))
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
                                : "bg-white/50 text-zinc-900/60 border-white/20 hover:border-indigo-200 hover:bg-white"
                        )}
                    >
                        {opt} {label === "Duration" ? "D" : ""}
                    </button>
                ))}
            </div>
        </div>
    );
}

function StrategicAction({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <button className="flex flex-col items-center justify-center gap-3 p-4 glass-card bg-white/40 hover:bg-white/80 border border-white/10 rounded-2xl transition-all hover:-translate-y-1 group">
            <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <div className="scale-100">{icon}</div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-indigo-600 transition-colors">{label}</span>
        </button>
    );
}
