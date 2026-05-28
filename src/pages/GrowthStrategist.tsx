// pages/GrowthStrategist.tsx
// LinkedIn Growth Strategist — Weekly suggestions + Profile Copy + Sarah AI

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User, MessageCircle, UserPlus, Users, Building, Sparkles,
  RefreshCw, Copy, Check, Loader2, ChevronRight, Send, X,
  ArrowLeft, Zap, Target, TrendingUp, Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";

// ── Icon map for suggestion sections ──────────────────────────────────────
const SECTION_ICONS: Record<string, any> = {
  profile: User,
  commenting: MessageCircle,
  connections: UserPlus,
  team: Users,
  org_invites: Building,
};

const SECTION_COLORS: Record<string, string> = {
  profile: "from-violet-500 to-purple-600",
  commenting: "from-blue-500 to-cyan-600",
  connections: "from-emerald-500 to-teal-600",
  team: "from-amber-500 to-orange-600",
  org_invites: "from-rose-500 to-pink-600",
};

// ── Sarah AI Chat Bubble ──────────────────────────────────────────────────
function SarahChat({ brandId }: { brandId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "sarah"; content: string }[]>([
    { role: "sarah", content: "Hey! I'm Sarah, your LinkedIn growth advisor. Ask me anything about increasing engagement, profile views, or lead generation." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await weezAPI.chatWithSarah(brandId, userMsg);
      setMessages(prev => [...prev, { role: "sarah", content: res.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "sarah", content: "Sorry, I'm having trouble right now. Try again in a moment." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-zinc-900 scale-90" : "bg-gradient-to-br from-violet-600 to-indigo-700 hover:scale-110"
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          </div>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-700 text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Sarah</p>
                <p className="text-[10px] opacity-80">LinkedIn Growth Advisor</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-zinc-900 text-white rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask Sarah anything..."
                className="flex-1 text-sm px-4 py-2.5 rounded-full bg-zinc-100 border-none outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors group" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" />}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function GrowthStrategist() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const brandId = spaceId || "";

  const [activeTab, setActiveTab] = useState<"suggestions" | "profile">("suggestions");
  const [suggestions, setSuggestions] = useState<any>(null);
  const [profileCopy, setProfileCopy] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await weezAPI.getGrowthSuggestions(brandId);
      setSuggestions(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const fetchProfileCopy = async () => {
    setLoadingProfile(true);
    try {
      const data = await weezAPI.getProfileCopy(brandId);
      setProfileCopy(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate profile copy");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const data = await weezAPI.regenerateProfileCopy(brandId, "all");
      setProfileCopy(data);
      toast.success("Fresh alternatives generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (activeTab === "suggestions" && !suggestions) fetchSuggestions();
    if (activeTab === "profile" && !profileCopy) fetchProfileCopy();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/autonomous-marketing/${spaceId}`)} className="p-2 rounded-xl hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-900 uppercase">Growth Strategist</h1>
              <p className="text-[11px] text-zinc-500 font-medium">Weekly LinkedIn growth playbook</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-violet-200 text-violet-700 px-3 py-1">
              <Zap className="w-3 h-3 mr-1" /> AI-Powered
            </Badge>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-full p-1 w-fit">
          {[
            { id: "suggestions", label: "Weekly Playbook", icon: Target },
            { id: "profile", label: "Profile Copy", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all",
                  isActive ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "suggestions" && (
          <div className="space-y-6">
            {/* Refresh button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500 font-medium">Personalized actions to amplify your LinkedIn presence this week.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Refresh
              </Button>
            </div>

            {loadingSuggestions ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Generating your playbook...</p>
              </div>
            ) : suggestions?.sections ? (
              <>
                <div className="grid grid-cols-1 gap-5">
                  {suggestions.sections.map((section: any) => {
                    const Icon = SECTION_ICONS[section.id] || Target;
                    const gradient = SECTION_COLORS[section.id] || "from-zinc-500 to-zinc-600";
                    return (
                      <Card key={section.id} className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", gradient)}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">{section.title}</h3>
                              <p className="text-[11px] text-violet-600 font-semibold mt-1 italic">{section.why_it_matters}</p>
                              <ul className="mt-4 space-y-3">
                                {section.actions?.map((action: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2.5">
                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                                    <span className="text-[13px] text-zinc-700 leading-relaxed">{action}</span>
                                  </li>
                                ))}
                              </ul>
                              {section.template && (
                                <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Connection Template</span>
                                    <CopyButton text={section.template} />
                                  </div>
                                  <p className="text-[12px] text-zinc-600 italic leading-relaxed">{section.template}</p>
                                </div>
                              )}
                              {section.slack_template && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">Team Message Template</span>
                                    <CopyButton text={section.slack_template} />
                                  </div>
                                  <p className="text-[12px] text-zinc-600 italic leading-relaxed">{section.slack_template}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Highest Leverage Action */}
                {suggestions.highest_leverage_action && (
                  <Card className="border-2 border-violet-200 bg-violet-50/50 rounded-2xl p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-1">15-Minute Power Move</p>
                        <p className="text-sm text-zinc-800 font-semibold leading-relaxed">{suggestions.highest_leverage_action}</p>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <TrendingUp className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-sm text-zinc-500">Click Refresh to generate your weekly playbook</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500 font-medium">AI-generated LinkedIn headlines and about section based on your brand voice.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={loadingProfile || regenerating}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Regenerate
              </Button>
            </div>

            {loadingProfile ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Crafting your profile copy...</p>
              </div>
            ) : profileCopy ? (
              <div className="space-y-6">
                {/* Headlines */}
                <Card className="border-none shadow-md bg-white rounded-2xl p-6">
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" /> Headline Options
                  </h3>
                  <div className="space-y-3">
                    {profileCopy.headlines?.map((headline: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 group hover:border-violet-200 transition-colors">
                        <p className="text-[13px] text-zinc-800 font-medium flex-1">{headline}</p>
                        <CopyButton text={headline} />
                      </div>
                    ))}
                  </div>
                  {profileCopy.recommended_headline && (
                    <div className="mt-4 p-4 bg-violet-50 rounded-xl border border-violet-200">
                      <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 mb-2">Recommended</p>
                      <p className="text-sm text-zinc-900 font-semibold">{profileCopy.recommended_headline.text}</p>
                      <p className="text-[11px] text-zinc-500 mt-1 italic">{profileCopy.recommended_headline.reason}</p>
                    </div>
                  )}
                </Card>

                {/* About Section */}
                <Card className="border-none shadow-md bg-white rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-violet-500" /> About Section
                    </h3>
                    <CopyButton text={profileCopy.about_section || ""} />
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[13px] text-zinc-700 leading-[1.8] whitespace-pre-wrap">{profileCopy.about_section}</p>
                  </div>
                </Card>

                {/* Taglines & Hooks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: "Taglines", items: profileCopy.taglines },
                    { title: "Hook Lines", items: profileCopy.hook_lines },
                    { title: "Positioning", items: profileCopy.positioning_statements },
                  ].map((group) => (
                    <Card key={group.title} className="border-none shadow-md bg-white rounded-2xl p-5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">{group.title}</h4>
                      <div className="space-y-2">
                        {group.items?.map((item: string, i: number) => (
                          <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
                            <p className="text-[12px] text-zinc-700 leading-relaxed">{item}</p>
                            <CopyButton text={item} />
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <Sparkles className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-sm text-zinc-500">Generating your profile copy...</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sarah AI Assistant */}
      <SarahChat brandId={brandId} />
    </div>
  );
}
