import React, { useEffect, useState } from "react";
import {
    Calendar,
    Rocket,
    Users,
    Briefcase,
    TrendingUp,
    Target,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    ShieldAlert,
    Check,
    Globe,
    Linkedin,
    Link2,
    RefreshCw,
    Lightbulb,
    Crosshair,
} from "lucide-react";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ── Nina avatar (matches the onboarding component; graceful fallback) ────────
const NINA_NAME = "Nina";
const NINA_AVATAR = "/assets/nina.png";
function NinaFace({ className = "" }: { className?: string }) {
    const [ok, setOk] = useState(true);
    if (ok) {
        return <img src={NINA_AVATAR} alt={NINA_NAME} onError={() => setOk(false)} className={`object-cover ${className}`} />;
    }
    return (
        <div className={`bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black ${className}`}>
            {NINA_NAME.charAt(0)}
        </div>
    );
}

const ICONS: Record<string, any> = {
    calendar: Calendar,
    rocket: Rocket,
    users: Users,
    briefcase: Briefcase,
    "trending-up": TrendingUp,
};

interface Goal {
    id: string;
    label: string;
    description: string;
    metric: string;
    icon: string;
    orientation?: string;
}

interface Question {
    field: string;
    question: string;
    type: string;
    options?: string[];
    placeholder?: string;
}

type Phase = "checking" | "connect" | "goals" | "questions" | "generating" | "strategy";

interface Connections {
    website_connected: boolean;
    linkedin_connected: boolean;
    ready: boolean;
    missing: string[];
    nina_message: string;
    connect_actions?: Array<{ type: string; label: string; endpoint: string }>;
}

export default function NinaGoalIntake({
    spaceId,
    onProceed,
}: {
    spaceId: string;
    onProceed?: (target: string, strategy: any) => void | Promise<void>;
}) {
    const [phase, setPhase] = useState<Phase>("checking");
    const [proceeding, setProceeding] = useState(false);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loadingGoals, setLoadingGoals] = useState(true);

    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
    const [ninaMessage, setNinaMessage] = useState("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [strategy, setStrategy] = useState<any>(null);

    // Connection gate (website + LinkedIn must be connected before goals).
    const [connections, setConnections] = useState<Connections | null>(null);
    const [websiteInput, setWebsiteInput] = useState("");
    const [connectingWebsite, setConnectingWebsite] = useState(false);
    const [rechecking, setRechecking] = useState(false);

    const checkReadiness = async (opts: { silent?: boolean } = {}) => {
        if (!opts.silent) setPhase("checking");
        try {
            const res = await weezAPI.getNinaReadiness(spaceId);
            setGoals(res.goals || []);
            setLoadingGoals(false);
            setConnections(res.connections);
            if (res.ready) {
                setPhase("goals");
            } else {
                setPhase("connect");
            }
        } catch (e: any) {
            // Fail open to the goal picker so a readiness hiccup never blocks the user.
            try {
                const g = await weezAPI.listNinaGoals();
                setGoals(g.goals || []);
            } catch { /* ignore */ }
            setLoadingGoals(false);
            setPhase("goals");
        }
    };

    useEffect(() => {
        let active = true;
        (async () => {
            if (active) await checkReadiness();
        })();
        return () => { active = false; };
    }, [spaceId]);

    const connectWebsite = async () => {
        const url = websiteInput.trim();
        if (!url) {
            toast.info("Paste your website URL so Nina can learn your brand.");
            return;
        }
        setConnectingWebsite(true);
        try {
            await weezAPI.connectWebsite(spaceId, url);
            toast.success("Website connected — Nina is analysing your brand.");
            await checkReadiness({ silent: true });
        } catch (e: any) {
            toast.error(e.message || "Couldn't connect that website");
        } finally {
            setConnectingWebsite(false);
        }
    };

    const connectLinkedIn = () => {
        window.location.href = weezAPI.getLinkedInAuthUrl(spaceId);
    };

    const recheck = async () => {
        setRechecking(true);
        await checkReadiness({ silent: true });
        setRechecking(false);
    };

    const pickGoal = async (goal: Goal) => {
        setSelectedGoal(goal);
        setBusy(true);
        try {
            const res = await weezAPI.getNinaGoalIntake(spaceId, goal.id);
            // Backend gates on connections — respect it.
            if (res.status === "needs_connection") {
                setConnections(res.connections);
                setSelectedGoal(null);
                setPhase("connect");
                return;
            }
            setNinaMessage(res.nina_message || "");
            setQuestions(res.questions || []);
            setAnswers({});
            if (res.ready || (res.questions || []).length === 0) {
                await buildStrategy(goal, {});
            } else {
                setPhase("questions");
            }
        } catch (e: any) {
            toast.error(e.message || "Couldn't start that goal");
            setSelectedGoal(null);
        } finally {
            setBusy(false);
        }
    };

    const buildStrategy = async (goal: Goal, ans: Record<string, string>) => {
        setPhase("generating");
        try {
            const res = await weezAPI.generateNinaStrategy(spaceId, goal.label, ans);
            if (res.status === "needs_connection") {
                setConnections(res.connections);
                setPhase("connect");
                return;
            }
            if (res.status !== "ok" || !res.strategy) {
                throw new Error(res.reason || "Strategy couldn't be generated right now.");
            }
            setStrategy(res.strategy);
            setPhase("strategy");
        } catch (e: any) {
            toast.error(e.message || "Couldn't build the strategy");
            setPhase("questions");
        }
    };

    const allAnswered = questions.every((q) => (answers[q.field] || "").trim().length > 0);

    const submitAnswers = () => {
        if (!selectedGoal) return;
        if (!allAnswered) {
            toast.info("Just fill in the quick answers so Nina can tailor this.");
            return;
        }
        buildStrategy(selectedGoal, answers);
    };

    const reset = () => {
        setPhase("goals");
        setSelectedGoal(null);
        setQuestions([]);
        setAnswers({});
        setStrategy(null);
    };

    // ── Checking connections ──────────────────────────────────────────────────
    if (phase === "checking") {
        return (
            <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-3xl overflow-hidden ring-2 ring-indigo-200 mb-5">
                    <NinaFace className="w-full h-full" />
                </div>
                <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" /> Getting things ready…
                </div>
            </div>
        );
    }

    // ── Connection gate (website + LinkedIn) ────────────────────────────────────
    if (phase === "connect") {
        const websiteMissing = connections?.missing?.includes("website");
        const linkedinMissing = connections?.missing?.includes("linkedin");
        return (
            <div className="w-full max-w-xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                        <NinaFace className="w-full h-full" />
                    </div>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-800 font-medium leading-relaxed">
                        {connections?.nina_message ||
                            "Before we pick a goal, let's connect your website and LinkedIn so I can build something grounded in your real brand and live numbers."}
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Website */}
                    <div className={`rounded-2xl border p-5 transition-all ${
                        connections?.website_connected ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-white"
                    }`}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                connections?.website_connected ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                            }`}>
                                <Globe className="w-4.5 h-4.5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-zinc-900">Website</p>
                                <p className="text-xs text-zinc-500">Nina's source for your brand voice, ICP & product.</p>
                            </div>
                            {connections?.website_connected && <Check className="w-5 h-5 text-emerald-600" />}
                        </div>
                        {websiteMissing && (
                            <div className="flex gap-2 mt-3">
                                <input
                                    type="url"
                                    value={websiteInput}
                                    onChange={(e) => setWebsiteInput(e.target.value)}
                                    placeholder="https://yourcompany.com"
                                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                                />
                                <Button
                                    onClick={connectWebsite}
                                    disabled={connectingWebsite}
                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 gap-1.5"
                                >
                                    {connectingWebsite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                    Connect
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* LinkedIn */}
                    <div className={`rounded-2xl border p-5 transition-all ${
                        connections?.linkedin_connected ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-white"
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                connections?.linkedin_connected ? "bg-emerald-100 text-emerald-600" : "bg-[#0A66C2]/10 text-[#0A66C2]"
                            }`}>
                                <Linkedin className="w-4.5 h-4.5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-zinc-900">LinkedIn</p>
                                <p className="text-xs text-zinc-500">The channel we run on — and how I read what's landing.</p>
                            </div>
                            {connections?.linkedin_connected ? (
                                <Check className="w-5 h-5 text-emerald-600" />
                            ) : linkedinMissing ? (
                                <Button onClick={connectLinkedIn} className="rounded-xl bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white font-bold px-4 gap-1.5">
                                    <Linkedin className="w-4 h-4" /> Connect
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>

                <button
                    onClick={recheck}
                    disabled={rechecking}
                    className="mt-6 w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 hover:border-indigo-300 hover:text-indigo-700 transition-all disabled:opacity-60"
                >
                    {rechecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    I've connected — continue
                </button>
            </div>
        );
    }

    // ── Goal picker ─────────────────────────────────────────────────────────
    if (phase === "goals") {
        return (
            <div className="w-full max-w-3xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                        <NinaFace className="w-full h-full text-lg" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-zinc-900">Hi, I'm {NINA_NAME} — your marketing lead.</p>
                        <p className="text-sm text-zinc-500">What do you want to focus on first? Pick a goal and I'll take it from there.</p>
                    </div>
                </div>

                {loadingGoals ? (
                    <div className="flex items-center justify-center py-16 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading goals…
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {goals.map((g) => {
                            const Icon = ICONS[g.icon] || Target;
                            return (
                                <button
                                    key={g.id}
                                    onClick={() => pickGoal(g)}
                                    disabled={busy}
                                    className="group text-left p-5 rounded-2xl border border-zinc-200 bg-white hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold text-zinc-900">{g.label}</span>
                                    </div>
                                    <p className="text-sm text-zinc-500 leading-relaxed">{g.description}</p>
                                </button>
                            );
                        })}
                    </div>
                )}
                {busy && (
                    <div className="flex items-center justify-center pt-6 text-zinc-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Getting {NINA_NAME} ready…
                    </div>
                )}
            </div>
        );
    }

    // ── 2-3 smart questions ───────────────────────────────────────────────────
    if (phase === "questions") {
        return (
            <div className="w-full max-w-2xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button onClick={reset} className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-700 mb-5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Pick a different goal
                </button>

                <div className="flex items-start gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                        <NinaFace className="w-full h-full" />
                    </div>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-800 font-medium leading-relaxed">
                        {ninaMessage || `Quick questions so I can tailor "${selectedGoal?.label}".`}
                    </div>
                </div>

                <div className="space-y-5">
                    {questions.map((q) => (
                        <div key={q.field} className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-800">{q.question}</label>
                            {q.type === "choice" && q.options ? (
                                <div className="flex flex-col gap-2">
                                    {q.options.map((opt) => {
                                        const active = answers[q.field] === opt;
                                        return (
                                            <button
                                                key={opt}
                                                onClick={() => setAnswers((a) => ({ ...a, [q.field]: opt }))}
                                                className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                                                    active
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                                                        : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200"
                                                }`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    {active && <Check className="w-4 h-4 text-indigo-600" />}
                                                    {opt}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={answers[q.field] || ""}
                                    placeholder={q.placeholder}
                                    onChange={(e) => setAnswers((a) => ({ ...a, [q.field]: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all"
                                />
                            )}
                        </div>
                    ))}
                </div>

                <Button
                    onClick={submitAnswers}
                    disabled={!allAnswered}
                    className="mt-6 w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2"
                >
                    Build my strategy <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    // ── Generating ────────────────────────────────────────────────────────────
    if (phase === "generating") {
        return (
            <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-3xl overflow-hidden ring-2 ring-indigo-200 mb-5">
                    <NinaFace className="w-full h-full" />
                </div>
                <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" /> {NINA_NAME} is building your strategy…
                </div>
                <p className="text-sm text-zinc-400 mt-2">Weighing your buying motion, pricing, and best-fit customers.</p>
            </div>
        );
    }

    // ── Strategy ──────────────────────────────────────────────────────────────
    const s = strategy || {};
    const adj = s.adjusted_target || {};
    const split = s.contribution_split || {};
    const inbound = s.inbound || {};
    const outbound = s.outbound || {};
    const fmtPct = (p: any) => (Array.isArray(p) ? `${p[0]}–${p[1]}%` : p ? `${p}%` : "—");

    // ACV tier + LinkedIn grounding
    const tier: string | null = s.acv_tier || null;
    const tierStrat = s.acv_tier_strategy || {};
    const contentMix = tierStrat.content_mix || {};
    const targeting = outbound.targeting_approach || {};
    const li = s.linkedin_metrics || {};
    // Full class strings (Tailwind JIT can't see interpolated class names).
    const tierBadgeClass =
        tier === "high" ? "bg-violet-50 text-violet-700"
        : tier === "medium" ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
    const approachLabel: Record<string, string> = {
        volume_signal: "Volume · signal-based",
        signal_and_trigger: "Trigger-aware",
        event_driven_abm: "Event-driven ABM",
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                    <NinaFace className="w-full h-full" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-900">Here's how I'd run it.</p>
                    <p className="text-xs text-zinc-500">Goal: {s.goal?.requested || selectedGoal?.label}</p>
                </div>
            </div>

            {/* Realistic target */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Realistic target</span>
                    {adj.verdict && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            adj.verdict === "realistic" ? "bg-emerald-50 text-emerald-700" :
                            adj.verdict === "aggressive" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                        }`}>{adj.verdict}</span>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[["Conservative", adj.conservative], ["Expected", adj.expected], ["Stretch", adj.stretch]].map(([k, v]) => (
                        <div key={k as string} className="rounded-xl bg-zinc-50 py-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{k}</div>
                            <div className="text-lg font-black text-zinc-900">{(v as string) || "—"}</div>
                        </div>
                    ))}
                </div>
                {adj.reasoning && <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{adj.reasoning}</p>}
            </div>

            {/* Inbound / outbound split */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Inbound vs outbound</span>
                <div className="flex gap-3 mt-3">
                    <div className="flex-1 rounded-xl bg-cyan-50 p-4">
                        <div className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Inbound {inbound.should_lead ? "· lead" : ""}</div>
                        <div className="text-2xl font-black text-cyan-900">{fmtPct(split.inbound_pct)}</div>
                    </div>
                    <div className="flex-1 rounded-xl bg-indigo-50 p-4">
                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Outbound {outbound.should_lead ? "· lead" : ""}</div>
                        <div className="text-2xl font-black text-indigo-900">{fmtPct(split.outbound_pct)}</div>
                    </div>
                </div>
                {split.why && <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{split.why}</p>}
            </div>

            {/* ACV tier + content mix */}
            {tier && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Your ACV playbook</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${tierBadgeClass}`}>
                            {tierStrat.label || `${tier} ACV`}
                        </span>
                    </div>
                    {tierStrat.play && <p className="text-sm font-bold text-zinc-900">{tierStrat.play} play</p>}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        {tierStrat.buyer && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Buyer</span>{tierStrat.buyer}</div>}
                        {tierStrat.sales_cycle && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Sales cycle</span>{tierStrat.sales_cycle}</div>}
                        {tierStrat.founder_job && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Founder posts</span>{tierStrat.founder_job}</div>}
                        {tierStrat.org_job && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Org posts</span>{tierStrat.org_job}</div>}
                    </div>
                    {/* Content mix Growth : Leads : Trust */}
                    {(contentMix.growth != null) && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                                <span>Content mix</span><span>Growth · Leads · Trust</span>
                            </div>
                            <div className="flex h-3 rounded-full overflow-hidden">
                                <div className="bg-sky-400" style={{ width: `${(contentMix.growth || 0) * 100}%` }} title={`Growth ${Math.round((contentMix.growth || 0) * 100)}%`} />
                                <div className="bg-indigo-500" style={{ width: `${(contentMix.leads || 0) * 100}%` }} title={`Leads ${Math.round((contentMix.leads || 0) * 100)}%`} />
                                <div className="bg-violet-600" style={{ width: `${(contentMix.trust || 0) * 100}%` }} title={`Trust ${Math.round((contentMix.trust || 0) * 100)}%`} />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-zinc-500 mt-1">
                                <span>{Math.round((contentMix.growth || 0) * 100)}% growth</span>
                                <span>{Math.round((contentMix.leads || 0) * 100)}% leads</span>
                                <span>{Math.round((contentMix.trust || 0) * 100)}% trust</span>
                            </div>
                        </div>
                    )}
                    {tierStrat.posting_note && <p className="text-xs text-zinc-500 mt-3 leading-relaxed italic">{tierStrat.posting_note}</p>}
                </div>
            )}

            {/* Inbound / outbound takeaways */}
            {(Array.isArray(inbound.takeaways) && inbound.takeaways.length > 0) ||
             (Array.isArray(outbound.takeaways) && outbound.takeaways.length > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.isArray(inbound.takeaways) && inbound.takeaways.length > 0 && (
                        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-cyan-600" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-cyan-700">Inbound — takeaways</span>
                            </div>
                            <ul className="space-y-1.5">
                                {inbound.takeaways.slice(0, 4).map((t: string, i: number) => (
                                    <li key={i} className="text-xs text-cyan-900 leading-relaxed">• {t}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {Array.isArray(outbound.takeaways) && outbound.takeaways.length > 0 && (
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-indigo-600" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700">Outbound — takeaways</span>
                            </div>
                            <ul className="space-y-1.5">
                                {outbound.takeaways.slice(0, 4).map((t: string, i: number) => (
                                    <li key={i} className="text-xs text-indigo-900 leading-relaxed">• {t}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Outbound targeting approach (how it reaches people, by ACV) */}
            {(targeting.approach || targeting.how_it_targets) && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Crosshair className="w-4 h-4 text-zinc-500" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Outbound targeting</span>
                        </div>
                        {targeting.approach && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                                {approachLabel[targeting.approach] || targeting.approach}
                            </span>
                        )}
                    </div>
                    {targeting.how_it_targets && <p className="text-xs text-zinc-600 leading-relaxed">{targeting.how_it_targets}</p>}
                    {targeting.monitoring && (
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed"><span className="font-bold text-zinc-700">Monitoring:</span> {targeting.monitoring}</p>
                    )}
                    {Array.isArray(targeting.trigger_signals) && targeting.trigger_signals.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Trigger signals</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {targeting.trigger_signals.slice(0, 6).map((sig: string, i: number) => (
                                    <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-zinc-50 text-zinc-600 border border-zinc-100">{sig}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {Array.isArray(targeting.channels) && targeting.channels.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Channels monitored</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {targeting.channels.slice(0, 6).map((ch: string, i: number) => (
                                    <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">{ch}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grounded in your live LinkedIn */}
            {li.connected && (li.followers > 0 || li.avg_engagement_rate > 0) && (
                <div className="rounded-2xl border border-[#0A66C2]/20 bg-[#0A66C2]/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#0A66C2]">Grounded in your LinkedIn</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-zinc-700">
                        {li.followers > 0 && <span><b className="text-zinc-900">{li.followers.toLocaleString()}</b> followers</span>}
                        {li.avg_engagement_rate > 0 && <span><b className="text-zinc-900">{li.avg_engagement_rate}%</b> avg engagement</span>}
                        {li.audience?.decision_maker_pct > 0 && <span><b className="text-zinc-900">{li.audience.decision_maker_pct}%</b> decision-makers</span>}
                    </div>
                </div>
            )}

            {/* Risks */}
            {Array.isArray(s.risks) && s.risks.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">What could go wrong</span>
                    </div>
                    <ul className="space-y-1.5">
                        {s.risks.slice(0, 4).map((r: any, i: number) => (
                            <li key={i} className="text-xs text-amber-900 leading-relaxed">• {typeof r === "string" ? r : r.risk}</li>
                        ))}
                    </ul>
                    {s.risk_note && <p className="text-xs text-amber-800 mt-2 italic">{s.risk_note}</p>}
                </div>
            )}

            {/* Proceed → kick off the weekly content planner */}
            {onProceed && (
                <div className="flex flex-col items-center gap-3 pt-2">
                    <Button
                        onClick={async () => {
                            setProceeding(true);
                            try {
                                await onProceed(s.goal?.requested || selectedGoal?.label || "", s);
                            } finally {
                                setProceeding(false);
                            }
                        }}
                        disabled={proceeding}
                        className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {proceeding ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Building your content plan…</>
                        ) : (
                            <>Proceed — build my content plan <ArrowRight className="w-5 h-5" /></>
                        )}
                    </Button>
                    <p className="text-[11px] text-zinc-400 text-center">
                        I'll generate this week's LinkedIn content plan from this strategy. New plan every week.
                    </p>
                </div>
            )}

            <button
                onClick={reset}
                disabled={proceeding}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-700 mx-auto disabled:opacity-50"
            >
                <Sparkles className="w-3.5 h-3.5" /> Try a different goal
            </button>
        </div>
    );
}
