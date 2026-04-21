import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Rocket, Users, Heart, ArrowRight, Bot, Sparkles } from 'lucide-react';
import HiringChatWidget from '@/components/hiring/HiringChatWidget';

const Careers = () => {
    return (
        <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-primary/20">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-black tracking-tighter text-xl text-zinc-900">Dexraflow <span className="text-primary font-outline-1">Careers</span></span>
                </div>
                <Button variant="ghost" className="font-bold text-zinc-500 hover:text-zinc-900">View Openings</Button>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-8 max-w-7xl mx-auto text-center space-y-8">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                    <Sparkles className="w-3 h-3 mr-2" /> Shape the Future of AI
                </Badge>
                <h1 className="text-6xl lg:text-8xl font-black tracking-tighter text-zinc-900 leading-[0.9]">
                    Build the Brain of <br />
                    <span className="text-primary font-outline-2 italic">Autonomous Marketing</span>
                </h1>
                <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-medium leading-relaxed">
                    We're building the world's first autonomous marketing engine. Join a team of engineers, designers, and AI researchers obsessed with technical speed and creative excellence.
                </p>
                <div className="flex justify-center gap-4 pt-4">
                    <Button className="h-16 px-10 rounded-full bg-zinc-900 hover:bg-black text-white font-bold text-lg gap-2 shadow-2xl transition-transform hover:scale-105 active:scale-95">
                        Explore Open Roles <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            </section>

            {/* Why Dexraflow */}
            <section className="py-24 bg-white border-y border-zinc-100 px-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Rocket className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900">AI-Native Culture</h3>
                        <p className="text-zinc-500 font-medium leading-relaxed">We don't just use AI; we build core workflows around it. You'll work with the latest GPT-4o, Flux, and proprietary model pipelines.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white">
                            <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900">Radical Ownership</h3>
                        <p className="text-zinc-500 font-medium leading-relaxed">Small, high-agency teams. You own your features from ideation to production. We value results over hours spent.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Heart className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900">Human-Centric</h3>
                        <p className="text-zinc-500 font-medium leading-relaxed">Flexible remote work, competitive equity, and a team that genuinely cares about your growth and well-being.</p>
                    </div>
                </div>
            </section>

            {/* Call to Chat */}
            <section className="py-32 px-8 max-w-5xl mx-auto text-center space-y-12">
                <div className="bg-zinc-900 rounded-[3rem] p-16 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-primary/30" />
                    <div className="relative z-10 space-y-6">
                        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter">Ready to start your journey?</h2>
                        <p className="text-zinc-400 text-lg font-medium max-w-xl mx-auto">
                            Don't see a perfect role? Open the chat widget in the corner to talk to our HR agent and submit your resume for future openings.
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-zinc-100 px-8 text-center text-zinc-400 text-sm font-bold tracking-widest uppercase">
                &copy; 2026 Dexraflow Inc. Built with AI.
            </footer>

            {/* Floating Chat Widget */}
            <HiringChatWidget />
        </div>
    );
};

export default Careers;
