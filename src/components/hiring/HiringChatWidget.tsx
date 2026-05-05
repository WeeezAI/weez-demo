import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    X,
    Send,
    Paperclip,
    Loader2,
    CheckCircle2,
    Bot,
    User,
    ChevronDown,
    Briefcase
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { weezAPI } from '@/services/weezAPI';
import { toast } from "sonner";
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_SUGGESTIONS = [
    "What is Dexraflow?",
    "View Openings",
    "Company Perks",
    "Our Culture"
];

type Message = {
    id: string;
    type: 'bot' | 'user';
    content: string;
    attachment?: string;
    component?: React.ReactNode;
};

const HiringChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'intro' | 'jobs' | 'intake' | 'upload' | 'results'>('intro');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            type: 'bot',
            content: "Hi! I'm the Dexraflow HR Bot. You can ask me about our mission, work perks, culture, or simply view open roles. How can I help you join the team?"
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [jobs, setJobs] = useState<any[]>([]);
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [userEmail, setUserEmail] = useState('');
    const [candidateId, setCandidateId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<any>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const addBotMessage = (content: string, component?: React.ReactNode) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content, component }]);
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg = { id: Date.now().toString(), type: 'user' as const, content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        if (step === 'intro') {
            const lowText = text.toLowerCase();
            if (lowText.includes('job') || lowText.includes('openings') || lowText.includes('hiring')) {
                await fetchJobs();
            } else {
                setIsProcessing(true);
                try {
                    const res = await (weezAPI as any).hiringChat(text);
                    addBotMessage(res.reply);
                } catch (err) {
                    addBotMessage("I'm here to help with hiring! To see available roles, just type 'jobs' or click the button.");
                } finally {
                    setIsProcessing(false);
                }
            }
        }
    };

    const renderContent = (content: string) => {
        // Simple regex to handle **bold** text
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const fetchJobs = async () => {
        setIsProcessing(true);
        try {
            const jobList = await (weezAPI as any).getHiringJobs();
            setJobs(jobList);
            setStep('jobs');
            if (jobList.length === 0) {
                addBotMessage("We don't have any specific openings listed right now, but feel free to ask me anything about Dexraflow!");
            } else {
                addBotMessage("Here are our current openings. Which one interests you?");
            }
        } catch (err) {
            toast.error("Failed to load jobs");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleJobSelect = (job: any) => {
        setSelectedJob(job);
        setStep('intake');
        addBotMessage(`Excellent choice! Applying for **${job.title}**. Let's start with your contact details. Please enter your email:`);
    };

    const handleContactSubmit = async (email: string) => {
        if (!email.includes('@')) {
            toast.error("Please enter a valid email");
            return;
        }
        setUserEmail(email);
        setIsProcessing(true);
        try {
            const res = await (weezAPI as any).applyHiring({
                job_id: selectedJob.id,
                name: "Candidate",
                email: email,
                phone: "0000000000"
            });
            setCandidateId(res.candidate_id);
            setStep('upload');
            addBotMessage(`Perfect! I've registered your application with **${email}**. Now, please upload your resume in PDF format for ATS evaluation.`);
        } catch (err) {
            toast.error("Contact submission failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !candidateId) return;

        if (file.type !== 'application/pdf') {
            toast.error("Please upload a PDF file");
            return;
        }

        setIsProcessing(true);
        addBotMessage("Parsing your resume and calculating ATS match score...", (
            <div className="flex items-center gap-2 text-zinc-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing background...
            </div>
        ));

        try {
            const res = await (weezAPI as any).uploadResume(candidateId, file);
            setResults(res);
            setStep('results');
            addBotMessage("Great! I've analyzed your background and the matching report has been sent to your email.");
        } catch (err) {
            toast.error("Resume analysis failed");
            addBotMessage("I encountered an error analyzing your resume. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] font-sans">
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-primary shadow-2xl hover:scale-110 transition-all group"
                >
                    <MessageSquare className="w-8 h-8 group-hover:animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                </button>
            )}

            {isOpen && (
                <Card className="w-[400px] h-[600px] bg-white border-zinc-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                    {/* Header */}
                    <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Bot className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-black tracking-tight leading-tight">Dexraflow HR</h4>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Intelligence</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Chat Feed */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fcfcfc] scroll-smooth" ref={scrollRef}>
                        <AnimatePresence initial={false}>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className={cn(
                                        "flex gap-3 max-w-[85%]",
                                        msg.type === 'user' ? "ml-auto flex-row-reverse" : ""
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                                        msg.type === 'bot' ? "bg-primary/10 text-primary" : "bg-zinc-900 text-white"
                                    )}>
                                        {msg.type === 'bot' ? <Bot size={14} /> : <User size={14} />}
                                    </div>
                                    <div className="space-y-2">
                                        <div className={cn(
                                            "p-4 rounded-2xl text-sm leading-relaxed",
                                            msg.type === 'bot'
                                                ? "bg-white/80 backdrop-blur-md border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-zinc-700"
                                                : "bg-[#0A0A0A] text-white font-medium shadow-lg"
                                        )}>
                                            {renderContent(msg.content)}
                                        </div>
                                        {msg.component}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Suggestions */}
                        {step === 'intro' && !isProcessing && (
                            <div className="flex flex-wrap gap-2 pl-11 pt-2">
                                {INITIAL_SUGGESTIONS.map((s) => (
                                    <motion.button
                                        key={s}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleSendMessage(s)}
                                        className="px-4 py-2 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-600 hover:border-primary hover:text-primary transition-all shadow-sm"
                                    >
                                        {s}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {/* Interaction Components */}
                        {step === 'jobs' && (
                            <div className="grid grid-cols-1 gap-2 pl-11">
                                {jobs.map(job => (
                                    <button
                                        key={job.id}
                                        onClick={() => handleJobSelect(job)}
                                        className="p-3 bg-white border border-zinc-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-zinc-900">{job.title}</p>
                                            <Briefcase className="w-3 h-3 text-zinc-300 group-hover:text-primary" />
                                        </div>
                                        <p className="text-[10px] text-zinc-500 line-clamp-1">{job.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 'intake' && !isProcessing && (
                            <div className="pl-11 space-y-3">
                                <Input
                                    placeholder="Enter your email"
                                    className="rounded-2xl border-zinc-200 focus:ring-primary/20"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleContactSubmit((e.target as HTMLInputElement).value);
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {step === 'upload' && !isProcessing && (
                            <div className="pl-11 pt-2">
                                <label className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-200 rounded-[2rem] hover:border-primary/40 transition-all cursor-pointer bg-white group">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <Paperclip className="w-6 h-6" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-black text-zinc-900">Upload Resume (PDF)</p>
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Select File</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                                </label>
                            </div>
                        )}

                        {step === 'results' && (
                            <div className="pl-11 space-y-4">
                                <Card className="rounded-[2rem] border-none shadow-xl bg-zinc-900 p-8 text-white text-center">
                                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                                        <Send className="w-8 h-8 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-black mb-2">Application Received!</h3>
                                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                                        Our AI has analyzed your profile. To maintain privacy, we've sent the detailed results directly to your inbox.
                                    </p>
                                </Card>
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                                    <p className="text-[11px] text-emerald-800 font-bold leading-tight uppercase tracking-wider">
                                        Check **{userEmail || 'your email'}** for updates within the next few minutes.
                                    </p>
                                </div>
                                <Button onClick={() => setStep('intro')} className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-bold text-xs gap-2 hover:bg-black transition-colors">
                                    Explore More Roles <Briefcase className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer Input */}
                    <div className="p-4 bg-white border-t border-zinc-100">
                        <div className="relative">
                            <Input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="h-12 pr-12 rounded-2xl bg-zinc-50 border-none focus:ring-primary/20"
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                            />
                            <button
                                onClick={() => handleSendMessage(inputValue)}
                                className="absolute right-2 top-2 w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center text-white hover:bg-black transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default HiringChatWidget;
