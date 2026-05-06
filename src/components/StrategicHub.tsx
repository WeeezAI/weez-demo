import React from "react";
import { motion } from "framer-motion";
import {
    BrainCircuit,
    Zap,
    Target,
    Activity,
    Sparkles,
    Clock,
    Bot,
    Library,
    ArrowUp,
    Mic,
    ChevronDown,
    History,
    Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StrategicHubProps {
    onSend: (text: string) => void;
    campaignDuration: string;
    setCampaignDuration: (val: string) => void;
    campaignType: string;
    setCampaignType: (val: string) => void;
    marketingMode: string;
    setMarketingMode: (val: string) => void;
    input: string;
    setInput: (val: string) => void;
    isThinking: boolean;
    onMicClick: () => void;
    isRecording: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const STRATEGIC_CARDS = [
    {
        title: "Full Autopilot",
        subtitle: "Complete Strategy & Execution",
        icon: BrainCircuit,
        color: "from-violet-500 to-indigo-600",
        description: "Let AI architect and manage your entire marketing workforce."
    },
    {
        title: "Design Studio",
        subtitle: "Visual Content Generation",
        icon: Zap,
        color: "from-amber-400 to-orange-500",
        description: "Generate high-converting posters and visual assets instantly."
    },
    {
        title: "Strategy Hub",
        subtitle: "Marketing Intelligence",
        icon: Target,
        color: "from-emerald-400 to-teal-500",
        description: "Deep audience analysis and competitive benchmarking."
    }
];

const PRESET_CHIPS = [
    "🚀 Increase 20% Engagement in 30 Days",
    "🎯 Aggressive Marketing for 15 Days",
    "💡 Rapid Lead Gen (Coming Soon)"
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: "easeOut" }
    }
};

export const StrategicHub: React.FC<StrategicHubProps> = ({
    onSend,
    campaignDuration,
    setCampaignDuration,
    campaignType,
    setCampaignType,
    marketingMode,
    setMarketingMode,
    input,
    setInput,
    isThinking,
    onMicClick,
    isRecording,
    textareaRef
}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend(input);
        }
    };

    return (
        <motion.div
            className="flex-1 overflow-y-auto px-8 py-12 bg-white flex flex-col items-center"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <div className="max-w-5xl w-full flex flex-col items-center space-y-16">

                {/* Hero Section */}
                <motion.div variants={itemVariants} className="text-center space-y-6">
                    <div className="relative inline-block">
                        <motion.div
                            className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150"
                            animate={{ opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                        <div className="relative w-24 h-24 bg-white shadow-2xl rounded-[2.5rem] border border-black/5 flex items-center justify-center overflow-hidden">
                            <BrainCircuit className="w-12 h-12 text-primary animate-float" />
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/[0.02] to-transparent" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-5xl font-black tracking-tight text-gray-900 sm:text-6xl">
                            Marketing that <span className="text-primary">Runs Itself</span>
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg font-medium text-gray-500/80 leading-relaxed italic">
                            "Starting from a single goal, Weez AI architects your strategy, generates
                            your content, and manages your entire marketing workforce autonomously."
                        </p>
                    </div>
                </motion.div>

                {/* Workflow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    {STRATEGIC_CARDS.map((card, i) => (
                        <motion.button
                            key={card.title}
                            variants={itemVariants}
                            whileHover={{ y: -5, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="group relative flex flex-col items-start p-8 rounded-[2rem] bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all text-left"
                            onClick={() => onSend(card.title)}
                        >
                            <div className={cn(
                                "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-6 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-500",
                                card.color
                            )}>
                                <card.icon className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">{card.subtitle}</h3>
                            <h2 className="text-xl font-black text-gray-900 mb-3">{card.title}</h2>
                            <p className="text-sm text-gray-500 leading-relaxed font-medium line-clamp-2">
                                {card.description}
                            </p>
                            <div className="mt-6 flex items-center text-primary font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                Launch Workflow <ArrowUp className="ml-2 w-3 h-3 rotate-90" />
                            </div>
                        </motion.button>
                    ))}
                </div>

                {/* Preset Chips */}
                <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3">
                    {PRESET_CHIPS.map((chip) => (
                        <button
                            key={chip}
                            onClick={() => onSend(chip)}
                            className="px-6 py-3 rounded-2xl bg-gray-50/80 border border-gray-100/50 text-xs font-black text-gray-600 hover:border-black/20 hover:bg-white hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            {chip}
                        </button>
                    ))}
                </motion.div>

                {/* Configuration Hub */}
                <motion.div
                    variants={itemVariants}
                    className="w-full bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-10 space-y-10 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                        <BrainCircuit size={200} />
                    </div>

                    <div className="relative text-center">
                        <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Workspace Configuration</h2>
                        <h3 className="text-2xl font-black text-gray-900">Configure Your Automated Campaign</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2 ml-1">
                                <Clock className="w-3 h-3" /> Campaign Duration
                            </Label>
                            <Select value={campaignDuration} onValueChange={setCampaignDuration}>
                                <SelectTrigger className="h-14 bg-gray-50/50 rounded-2xl border-gray-100 shadow-none hover:bg-white focus:ring-black transition-all font-bold">
                                    <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                                    <SelectItem value="7" className="font-bold">Short Campaign (7 Days)</SelectItem>
                                    <SelectItem value="30" className="font-bold">Standard Campaign (30 Days)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2 ml-1">
                                <Target className="w-3 h-3" /> Campaign Type
                            </Label>
                            <Select value={campaignType} onValueChange={setCampaignType}>
                                <SelectTrigger className="h-14 bg-gray-50/50 rounded-2xl border-gray-100 shadow-none hover:bg-white focus:ring-black transition-all font-bold">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                                    <SelectItem value="engagement" className="font-bold text-primary">Engagement Campaign</SelectItem>
                                    <SelectItem value="awareness" disabled className="opacity-50 blur-[0.5px] font-bold">Brand Awareness (Soon)</SelectItem>
                                    <SelectItem value="leads" disabled className="opacity-50 blur-[0.5px] font-bold">Lead Generation (Soon)</SelectItem>
                                    <SelectItem value="sales" disabled className="opacity-50 blur-[0.5px] font-bold">Conversion/Sales (Soon)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2 ml-1">
                                <Activity className="w-3 h-3" /> Marketing Mode
                            </Label>
                            <Select value={marketingMode} onValueChange={setMarketingMode}>
                                <SelectTrigger className="h-14 bg-gray-50/50 rounded-2xl border-gray-100 shadow-none hover:bg-white focus:ring-black transition-all font-bold">
                                    <SelectValue placeholder="Select intensity" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                                    <SelectItem value="low" className="font-bold">Low Mode (3 Post / Week)</SelectItem>
                                    <SelectItem value="medium" className="font-bold">Medium Mode (5 Post / Week)</SelectItem>
                                    <SelectItem value="high" className="font-bold">Aggressive Mode (1 Post / Day)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Chat Input Bar */}
                    <div className="pt-4 space-y-6">
                        <div className={cn(
                            "flex items-end gap-4 p-5 bg-gray-50/50 rounded-[2.5rem] border transition-all duration-300",
                            isThinking ? "opacity-60 grayscale-[0.2]" : "border-gray-100 focus-within:border-primary/30 focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-primary/5"
                        )}>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message Weez AI Automation engine..."
                                disabled={isThinking}
                                rows={1}
                                className="flex-1 bg-transparent border-none outline-none resize-none text-base text-gray-800 placeholder:text-gray-400 font-bold leading-relaxed max-h-40 py-2"
                                style={{ minHeight: 45 }}
                            />

                            <div className="flex items-center gap-3 pb-1 flex-shrink-0">
                                <button
                                    onClick={onMicClick}
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                        isRecording ? "bg-red-50 text-red-500 animate-pulse ring-2 ring-red-100" : "bg-white text-gray-400 hover:text-primary shadow-sm hover:shadow-md"
                                    )}
                                >
                                    <Mic className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => onSend(input)}
                                    disabled={isThinking || !input.trim()}
                                    className={cn(
                                        "h-12 px-8 rounded-full flex items-center justify-center gap-3 transition-all font-black text-xs uppercase tracking-[0.2em]",
                                        input.trim() && !isThinking ? "bg-black text-white shadow-xl shadow-black/20 active:scale-95" : "bg-gray-100 text-gray-300"
                                    )}
                                >
                                    Proceed <ArrowUp className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Secondary Utility Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
                            <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gray-50/80 border border-gray-100/50 text-[10px] font-black uppercase text-gray-500 hover:bg-white hover:shadow-sm transition-all">
                                    <Bot className="w-4 h-4 text-primary" />
                                    Marketing Persona: Default
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gray-50/80 border border-gray-100/50 text-[10px] font-black uppercase text-gray-500 hover:bg-white hover:shadow-sm transition-all">
                                    <Library className="w-4 h-4 text-primary" />
                                    Prompt Library
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <button className="p-3 rounded-full hover:bg-gray-50 text-gray-400 hover:text-primary transition-colors">
                                    <History className="w-5 h-5" />
                                </button>
                                <button className="p-3 rounded-full hover:bg-gray-50 text-gray-400 hover:text-primary transition-colors">
                                    <Settings2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Bottom Ghost Text */}
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col items-center gap-3 py-10"
                >
                    <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.5em] animate-pulse">
                        Autonomous Workforce Deployment Platform
                    </p>
                </motion.div>

            </div>
        </motion.div>
    );
};
