import { useState, useEffect } from "react";
import { Brain, Palette, Megaphone, Lightbulb, Search, Zap, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const FACTS = [
    {
        icon: Search,
        text: "Analyzing your Instagram visual history...",
        subtext: "We scan your past posts to decode your aesthetic DNA."
    },
    {
        icon: Palette,
        text: "Extracting your unique color palette...",
        subtext: "Identifying the exact hues that define your brand identity."
    },
    {
        icon: Megaphone,
        text: "Calibrating your brand voice...",
        subtext: "Learning how you speak to your audience to replicate it perfectly."
    },
    {
        icon: Search,
        text: "Spying on your competitors...",
        subtext: "Finding the content gaps where your brand can win."
    },
    {
        icon: Lightbulb,
        text: "Synthesizing content ideas...",
        subtext: "Generating high-performing concepts tailored to your goals."
    },
    {
        icon: Brain,
        text: "Finalizing Brand Memory...",
        subtext: "Locking in your new autonomous marketing strategy."
    }
];

export function EducationalLoader() {
    const [index, setIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Rotate facts every 3.5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % FACTS.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    // Simulate progress bar (stalls at 90% until complete)
    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((oldProgress) => {
                if (oldProgress >= 90) return 90;
                const diff = Math.random() * 2;
                return Math.min(oldProgress + diff, 90);
            });
        }, 100);
        return () => clearInterval(timer);
    }, []);

    const CurrentFact = FACTS[index];
    const Icon = CurrentFact.icon;

    return (
        <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700 max-w-lg mx-auto p-6 bg-background/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm">

            {/* Icon Circle with Pulse */}
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75 blur-xl duration-[2000ms]"></div>
                <div className="w-32 h-32 bg-background border-4 border-primary/10 rounded-full flex items-center justify-center relative z-10 shadow-xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-50" />
                    <Icon className="w-14 h-14 text-primary animate-pulse duration-[3000ms] relative z-20 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 p-2 rounded-full animate-bounce delay-1000 shadow-lg border-2 border-background z-30">
                    <Zap className="w-4 h-4 text-white fill-current" />
                </div>
            </div>

            {/* Text Content with Fade Transition */}
            <div className="text-center space-y-3 min-h-[100px] transition-all duration-500 w-full">
                <h2 key={CurrentFact.text} className="text-xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {CurrentFact.text}
                </h2>
                <p key={CurrentFact.subtext} className="text-muted-foreground text-sm px-4 animate-in fade-in slide-in-from-bottom-1 duration-700 delay-100">
                    {CurrentFact.subtext}
                </p>
            </div>

            {/* Progress Bar Section */}
            <div className="w-full space-y-3 pt-4">
                <Progress value={progress} className="h-2 w-full bg-secondary" />

                <div className="flex justify-between items-center text-xs text-muted-foreground font-mono uppercase tracking-wider px-1">
                    <span className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing Intelligence
                    </span>
                    <span>{Math.round(progress)}%</span>
                </div>
            </div>
        </div>
    );
}
