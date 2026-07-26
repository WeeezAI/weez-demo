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
    Link2,
    RefreshCw,
    Lightbulb,
    Crosshair,
    Radar,
    Send,
    ShieldCheck,
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

    // AI, brand-voiced suggestion bubbles per question (optional — the free-text
    // input always stays; founders can tap a suggestion or type their own).
    const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Connection gate (website must be connected before goals).
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

    const recheck = async () => {
        setRechecking(true);
        await checkReadiness({ silent: true });
        setRechecking(false);
    };

    const fetchSuggestions = async (goalId: string) => {
        setSuggestions({});
        setLoadingSuggestions(true);
        try {
            const res = await weezAPI.getNinaIntakeSuggestions(spaceId, goalId);
            setSuggestions(res.suggestions || {});
        } catch {
            // Suggestions are a bonus — never block the questions on them.
        } finally {
            setLoadingSuggestions(false);
        }
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
            setSuggestions({});
            if (res.ready || (res.questions || []).length === 0) {
                await buildStrategy(goal, {});
            } else {
                setPhase("questions");
                // Fire-and-forget: show questions instantly, let bubbles pop in.
                void fetchSuggestions(goal.id);
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
        setSuggestions({});
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

    // ── Connection gate (website only) ──────────────────────────────────────────
    if (phase === "connect") {
        const websiteMissing = connections?.missing?.includes("website");
        return (
            <div className="w-full max-w-xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                        <NinaFace className="w-full h-full" />
                    </div>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-800 font-medium leading-relaxed">
                        {connections?.nina_message ||
                            "Before we pick a goal, let's connect your website so I can build something grounded in your real brand, product, and ICP."}
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
                        <p className="text-sm font-semibold text-zinc-900">Hi, I'm {NINA_NAME} — your GTM strategist.</p>
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

                <div className="flex items-start gap-3 mb-2">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
                        <NinaFace className="w-full h-full" />
                    </div>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-800 font-medium leading-relaxed">
                        {ninaMessage || `Quick questions so I can tailor "${selectedGoal?.label}".`}
                    </div>
                </div>
                <p className="text-[11px] text-zinc-400 mb-6 ml-14 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-400" /> Tap a suggestion to use it, or type your own.
                </p>

                <div className="space-y-5">
                    {questions.map((q) => {
                        const qsug = suggestions[q.field] || [];
                        return (
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

                            {/* AI, brand-voiced suggestion bubbles (input stays above) */}
                            {loadingSuggestions && qsug.length === 0 ? (
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-0.5">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Nina's drafting a few ideas…
                                </div>
                            ) : qsug.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {qsug.map((sug, i) => {
                                        const active = (answers[q.field] || "").trim() === sug.trim();
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setAnswers((a) => ({ ...a, [q.field]: sug }))}
                                                className={`text-left text-xs rounded-full border px-3 py-1.5 transition-all ${
                                                    active
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                                                        : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:text-indigo-700"
                                                }`}
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Sparkles className={`w-3 h-3 ${active ? "text-indigo-500" : "text-indigo-400"}`} />
                                                    {sug}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                        );
                    })}
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
                <p className="text-sm text-zinc-400 mt-2">Mapping who Eva targets and the angle Max will reach them with.</p>
            </div>
        );
    }

    // ── Strategy ──────────────────────────────────────────────────────────────
    const s = strategy || {};
    const adj = s.adjusted_target || {};
    const evaPlan = s.eva_plan || {};
    const maxPlan = s.max_plan || {};

    // ACV tier grounding (outbound operating model)
    const tier: string | null = s.acv_tier || null;
    const tierStrat = s.acv_tier_strategy || {};
    const targeting = maxPlan.targeting_approach || {};
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

            {/* ACV playbook (outbound operating model) */}
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
                        {tierStrat.primary_metric && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Primary metric</span>{tierStrat.primary_metric}</div>}
                        {targeting.personalization_depth && <div className="rounded-xl bg-zinc-50 px-3 py-2"><span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] block">Personalization</span>{targeting.personalization_depth}</div>}
                    </div>
                    {tierStrat.outbound_summary && <p className="text-xs text-zinc-500 mt-3 leading-relaxed italic">{tierStrat.outbound_summary}</p>}
                </div>
            )}

            {/* Eva — account discovery (which channels she monitors) */}
            {(evaPlan.role || (Array.isArray(evaPlan.channels_monitored) && evaPlan.channels_monitored.length > 0) || evaPlan.monitoring_focus) && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Radar className="w-4 h-4 text-teal-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-teal-700">Eva — account discovery</span>
                    </div>
                    {evaPlan.role && <p className="text-xs text-teal-900 leading-relaxed">{evaPlan.role}</p>}
                    {evaPlan.monitoring_focus && (
                        <p className="text-xs text-teal-900 mt-2 leading-relaxed"><span className="font-bold">Watching for:</span> {evaPlan.monitoring_focus}</p>
                    )}
                    {Array.isArray(evaPlan.trigger_signals) && evaPlan.trigger_signals.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600/70">Trigger signals</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {evaPlan.trigger_signals.slice(0, 6).map((sig: string, i: number) => (
                                    <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white text-teal-700 border border-teal-100">{sig}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {Array.isArray(evaPlan.channels_monitored) && evaPlan.channels_monitored.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600/70">Channels monitored</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {evaPlan.channels_monitored.slice(0, 8).map((ch: string, i: number) => (
                                    <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white text-teal-700 border border-teal-100">{ch}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {Array.isArray(evaPlan.priority_icp_slices) && evaPlan.priority_icp_slices.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600/70">Targets first</span>
                            <ul className="space-y-1 mt-1">
                                {evaPlan.priority_icp_slices.slice(0, 4).map((slice: string, i: number) => (
                                    <li key={i} className="text-xs text-teal-900 leading-relaxed">• {slice}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {Array.isArray(evaPlan.takeaways) && evaPlan.takeaways.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1">
                            {evaPlan.takeaways.slice(0, 4).map((t: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-teal-800">
                                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-teal-500" /> {t}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Max — personalized outreach (the angle he'll use) */}
            {(maxPlan.role || targeting.how_it_targets || (Array.isArray(maxPlan.personalized_angles) && maxPlan.personalized_angles.length > 0)) && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Send className="w-4 h-4 text-indigo-600" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700">Max — personalized outreach</span>
                        </div>
                        {targeting.approach && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-100">
                                {approachLabel[targeting.approach] || targeting.approach}
                            </span>
                        )}
                    </div>
                    {maxPlan.role && <p className="text-xs text-indigo-900 leading-relaxed">{maxPlan.role}</p>}
                    {targeting.how_it_targets && (
                        <p className="text-xs text-indigo-900 mt-2 leading-relaxed"><span className="font-bold">How he reaches them:</span> {targeting.how_it_targets}</p>
                    )}
                    {Array.isArray(maxPlan.personalized_angles) && maxPlan.personalized_angles.length > 0 && (
                        <div className="mt-3">
                            <div className="flex items-center gap-1.5">
                                <Crosshair className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/70">Personalized angles</span>
                            </div>
                            <ul className="space-y-1 mt-1.5">
                                {maxPlan.personalized_angles.slice(0, 4).map((angle: string, i: number) => (
                                    <li key={i} className="text-xs text-indigo-900 leading-relaxed">• {angle}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {maxPlan.buying_committee_plan && (
                        <p className="text-xs text-indigo-900 mt-3 leading-relaxed"><span className="font-bold">Buying committee:</span> {maxPlan.buying_committee_plan}</p>
                    )}
                    {Array.isArray(targeting.channels) && targeting.channels.length > 0 && (
                        <div className="mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/70">Outreach channels</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {targeting.channels.slice(0, 6).map((ch: string, i: number) => (
                                    <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white text-indigo-700 border border-indigo-100">{ch}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {Array.isArray(maxPlan.messaging_guardrails) && maxPlan.messaging_guardrails.length > 0 && (
                        <div className="mt-3 rounded-xl bg-white/70 border border-indigo-100 p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/70">Messaging guardrails</span>
                            </div>
                            <ul className="space-y-1">
                                {maxPlan.messaging_guardrails.slice(0, 4).map((g: string, i: number) => (
                                    <li key={i} className="text-xs text-indigo-900 leading-relaxed">• {g}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {maxPlan.expected_contribution && (
                        <p className="text-xs text-indigo-800 mt-3"><span className="font-bold">Expected contribution:</span> {maxPlan.expected_contribution}</p>
                    )}
                    {Array.isArray(maxPlan.takeaways) && maxPlan.takeaways.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1">
                            {maxPlan.takeaways.slice(0, 4).map((t: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-indigo-800">
                                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" /> {t}
                                </div>
                            ))}
                        </div>
                    )}
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
                            <><Loader2 className="w-5 h-5 animate-spin" /> Building your GTM plan…</>
                        ) : (
                            <>Proceed — build my GTM plan <ArrowRight className="w-5 h-5" /></>
                        )}
                    </Button>
                    <p className="text-[11px] text-zinc-400 text-center">
                        I'll turn this strategy into EVA's account targeting and MAX's outreach plan. Continuously optimized.
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
