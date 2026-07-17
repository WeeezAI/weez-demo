import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Mic,
    MicOff,
    Volume2,
    Sparkles,
    Loader2,
    X,
    MessageSquare,
    CheckCircle2,
    Settings2,
    Bell,
} from "lucide-react";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SageAssistantProps {
    spaceId: string;
    /** Position of the floating check-in button (defaults to bottom-right). */
    fabClassName?: string;
}

// Nina's face for the check-in (reuses the shipped CMO avatar, graceful "N" fallback).
const NINA_AVATAR = "/assets/nina.png";

function NinaFace({ className = "" }: { className?: string }) {
    const [ok, setOk] = useState(true);
    return (
        <div className={`overflow-hidden shrink-0 ${className}`}>
            {ok ? (
                <img src={NINA_AVATAR} alt="Nina" onError={() => setOk(false)} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black">
                    N
                </div>
            )}
        </div>
    );
}

interface MessageLog {
    sender: "assistant" | "user";
    text: string;
}

type SageStep = "idle" | "connecting" | "live" | "processing" | "completed";

interface SageStatus {
    due: boolean;
    has_sessions: boolean;
    session_count: number;
    frequency: "weekly" | "biweekly";
    next_checkin_date: string | null;
    last_session_date: string | null;
    reminder_message: string;
}

/**
 * Sage — Founder Memory & Context Capture
 * ────────────────────────────────────────
 * A floating, voice-first assistant for weekly founder check-ins. The floating
 * action button lives bottom-right; clicking it opens a ChatGPT-style voice
 * chat drawer powered by the OpenAI Realtime API (via the backend's ephemeral
 * WebRTC session). When a check-in is due, the button pulses with a soft glow.
 */
export default function SageAssistant({ spaceId, fabClassName = "bottom-6 right-6" }: SageAssistantProps) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<SageStatus | null>(null);

    const [step, setStep] = useState<SageStep>("idle");
    const [isMuted, setIsMuted] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState<MessageLog[]>([]);
    const [agentSpeaking, setAgentSpeaking] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [processingMessage, setProcessingMessage] = useState("Capturing this week...");
    const [showSettings, setShowSettings] = useState(false);

    const questionIdRef = useRef<string | undefined>(undefined);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const transcriptAccumulatorRef = useRef<MessageLog[]>([]);
    const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

    // ── Status polling (drives the reminder + pulse) ──────────────────────────
    const refreshStatus = useCallback(async () => {
        if (!spaceId) return;
        try {
            const res = await weezAPI.getSageStatus(spaceId);
            setStatus(res);
        } catch {
            // Non-fatal: button still works, just no pulse/reminder.
        }
    }, [spaceId]);

    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, 60_000); // re-check every minute
        return () => clearInterval(interval);
    }, [refreshStatus]);

    // Surface an in-app reminder when a check-in is due.
    const remindedRef = useRef(false);
    useEffect(() => {
        if (status?.due && !remindedRef.current && !open) {
            remindedRef.current = true;
            toast.message("Your weekly check-in with Nina is due", {
                description: status.reminder_message,
                icon: <Bell className="w-4 h-4 text-indigo-600" />,
                action: { label: "Start", onClick: () => setOpen(true) },
                duration: 12000,
            });
        }
    }, [status, open]);

    useEffect(() => () => cleanupWebRTC(), []);

    useEffect(() => {
        // Auto-scroll transcript
        if (transcriptScrollRef.current) {
            transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
        }
    }, [transcript]);

    const cleanupWebRTC = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current = null;
        }
        setIsConnected(false);
        setAgentSpeaking(false);
    };

    const startCheckin = async () => {
        setStep("connecting");
        setTranscript([]);
        transcriptAccumulatorRef.current = [];

        try {
            // 1. Ephemeral WebRTC session (with rotated questions + personalized opener)
            const session = await weezAPI.createSageSession(spaceId);
            questionIdRef.current = session.question_id;

            // 2. Microphone
            let localStream: MediaStream;
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localStreamRef.current = localStream;
            } catch {
                toast.error("Nina needs microphone access for your voice check-in. Enable it in your browser settings.");
                setStep("idle");
                return;
            }

            // 3. Peer connection
            const pc = new RTCPeerConnection({ iceServers: session.ice_servers || [] });
            pcRef.current = pc;

            const remoteAudio = new Audio();
            remoteAudio.autoplay = true;
            remoteAudioRef.current = remoteAudio;
            pc.ontrack = (event) => {
                remoteAudio.srcObject = event.streams[0];
            };

            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

            // 4. Data channel for live transcripts
            const dc = pc.createDataChannel("oai-events");
            dataChannelRef.current = dc;
            dc.onopen = () => {
                setIsConnected(true);
                setStep("live");
            };
            dc.onmessage = (event) => {
                try {
                    const ev = JSON.parse(event.data);
                    if (ev.type === "conversation.item.input_audio_transcription.completed") {
                        const text = ev.transcript?.trim();
                        if (text) addMessageLog("user", text);
                    } else if (ev.type === "response.audio_transcript.done") {
                        const text = ev.transcript?.trim();
                        if (text) addMessageLog("assistant", text);
                    } else if (ev.type === "response.created") {
                        setAgentSpeaking(true);
                    } else if (ev.type === "response.done") {
                        setAgentSpeaking(false);
                    }
                } catch {
                    /* ignore malformed events */
                }
            };

            // 5. Local audio visualizer
            setupAudioVisualizer(localStream);

            // 6. SDP offer/answer handshake
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpResponse = await fetch(session.url, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    "Content-Type": "application/sdp",
                    Authorization: `Bearer ${session.token}`,
                },
            });
            if (!sdpResponse.ok) throw new Error("Voice connection handshake failed");

            const sdpAnswer = await sdpResponse.text();
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: sdpAnswer }));
        } catch (err: any) {
            console.error("Sage check-in failed to start:", err);
            toast.error(err.message || "Couldn't reach Nina right now. Try again in a moment.");
            cleanupWebRTC();
            setStep("idle");
        }
    };

    const setupAudioVisualizer = (stream: MediaStream) => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkLevel = () => {
                if (!localStreamRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                setAudioLevel(Math.min((sum / bufferLength) * 1.6, 100));
                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };
            checkLevel();
        } catch {
            /* visualizer is non-essential */
        }
    };

    const addMessageLog = (sender: "assistant" | "user", text: string) => {
        const msg: MessageLog = { sender, text };
        transcriptAccumulatorRef.current = [...transcriptAccumulatorRef.current, msg];
        setTranscript([...transcriptAccumulatorRef.current]);
    };

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    const finishCheckin = async () => {
        cleanupWebRTC();
        setStep("processing");

        const messages = [
            "Capturing this week...",
            "Listening for what broke and what worked...",
            "Pulling out your customer signals...",
            "Saving your exact words...",
            "Updating your founder memory...",
        ];
        let idx = 0;
        setProcessingMessage(messages[0]);
        const interval = setInterval(() => {
            idx++;
            if (idx < messages.length) setProcessingMessage(messages[idx]);
            else clearInterval(interval);
        }, 2200);

        try {
            const fullTranscript = transcriptAccumulatorRef.current
                .map((m) => `${m.sender === "user" ? "FOUNDER" : "SAGE"}: ${m.text}`)
                .join("\n\n");

            if (!fullTranscript || fullTranscript.trim().length < 40) {
                throw new Error("Not enough of the conversation was captured. Let's try the check-in again.");
            }

            await weezAPI.processSageSession(spaceId, fullTranscript, questionIdRef.current);
            clearInterval(interval);
            setStep("completed");
            toast.success("This week's check-in is saved to your founder memory.");
            refreshStatus();
        } catch (err: any) {
            clearInterval(interval);
            console.error("Sage processing failed:", err);
            toast.error(err.message || "Couldn't process the check-in. Please try again.");
            setStep("idle");
        }
    };

    const closeModal = () => {
        cleanupWebRTC();
        setStep("idle");
        setShowSettings(false);
        setOpen(false);
    };

    const changeFrequency = async (frequency: "weekly" | "biweekly") => {
        try {
            await weezAPI.setSageFrequency(spaceId, frequency);
            toast.success(`Check-in cadence set to ${frequency === "weekly" ? "weekly" : "bi-weekly"}.`);
            refreshStatus();
        } catch (err: any) {
            toast.error(err.message || "Couldn't update your cadence.");
        }
    };

    const due = status?.due ?? false;

    // ── Waveform bars (animated when Sage is speaking) ────────────────────────
    const WAVE_BARS = 28;

    return (
        <>
            {/* ── FLOATING ACTION BUTTON ──────────────────────────────────────── */}
            {!open && (
                <div className={`fixed ${fabClassName} z-[90] flex flex-col items-center gap-2`}>
                    <button
                        onClick={() => setOpen(true)}
                        aria-label="Open your Nina check-in"
                        className="group relative w-16 h-16 rounded-full shadow-2xl shadow-indigo-600/30 transition-transform hover:scale-105 active:scale-95"
                    >
                        {/* Soft glow pulse when a check-in is due */}
                        {due && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-indigo-500/40 animate-ping" />
                                <span className="absolute -inset-1 rounded-full bg-indigo-400/20 blur-md animate-pulse" />
                            </>
                        )}
                        <NinaFace className="relative w-16 h-16 rounded-full ring-2 ring-white" />
                        {due && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white" />
                        )}
                    </button>
                    <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-[11px] font-bold text-zinc-700 shadow-sm border border-zinc-100">
                        Check-in
                    </span>
                </div>
            )}

            {/* ── VOICE CHAT DRAWER ───────────────────────────────────────────── */}
            {open && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in" onClick={closeModal} />

                    {/* Right-side drawer */}
                    <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <NinaFace className="w-10 h-10 rounded-2xl shadow-lg" />
                                <div>
                                    <h3 className="text-sm font-black text-zinc-900 leading-none">Nina</h3>
                                    <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">
                                        {status?.has_sessions
                                            ? `${status.session_count} check-in${status.session_count === 1 ? "" : "s"} captured`
                                            : "Your weekly founder check-in"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowSettings((s) => !s)}
                                    className="w-9 h-9 rounded-xl hover:bg-zinc-100 flex items-center justify-center text-zinc-500"
                                    aria-label="Check-in settings"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={closeModal}
                                    className="w-9 h-9 rounded-xl hover:bg-zinc-100 flex items-center justify-center text-zinc-500"
                                    aria-label="Close check-in"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Settings panel (cadence) */}
                        {showSettings && (
                            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 animate-in slide-in-from-top-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                    Check-in cadence
                                </p>
                                <div className="flex gap-2">
                                    {(["weekly", "biweekly"] as const).map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => changeFrequency(f)}
                                            className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                                                status?.frequency === f
                                                    ? "bg-indigo-600 text-white shadow"
                                                    : "bg-white border border-zinc-200 text-zinc-600 hover:border-indigo-300"
                                            }`}
                                        >
                                            {f === "weekly" ? "Weekly" : "Bi-weekly"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Body */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* IDLE — intro / reminder */}
                            {step === "idle" && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-8 space-y-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                                        <NinaFace className="relative w-20 h-20 rounded-3xl shadow-2xl ring-2 ring-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-black text-zinc-900">
                                            {status?.due ? "Time for this week's check-in" : "Talk to Nina"}
                                        </h2>
                                        <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-xs">
                                            {status?.reminder_message ||
                                                "A few minutes, voice only. I'll capture what this week taught you and remember it in your own words."}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={startCheckin}
                                        className="h-12 px-8 rounded-2xl bg-black hover:bg-black/90 text-white font-bold gap-2 shadow-lg"
                                    >
                                        <Mic className="w-4 h-4" /> Start voice check-in
                                    </Button>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                        🎙️ Nina Voice · ⚡ Realtime · 🔒 Private
                                    </p>
                                </div>
                            )}

                            {/* CONNECTING / LIVE — waveform + transcript */}
                            {(step === "connecting" || step === "live") && (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Waveform / orb area */}
                                    <div className="flex flex-col items-center justify-center py-8 px-6 bg-gradient-to-b from-indigo-50/40 to-transparent">
                                        <div className="flex items-end justify-center gap-1 h-20 mb-4">
                                            {Array.from({ length: WAVE_BARS }).map((_, i) => {
                                                const center = WAVE_BARS / 2;
                                                const distance = Math.abs(i - center) / center;
                                                const base = agentSpeaking ? 0.55 : 0.18;
                                                const reactive = isMuted
                                                    ? 0.08
                                                    : agentSpeaking
                                                    ? base + Math.sin(Date.now() / 120 + i) * 0.3 * (1 - distance)
                                                    : base + (audioLevel / 100) * (1 - distance) * 0.9;
                                                const height = Math.max(6, Math.min(72, reactive * 72));
                                                return (
                                                    <span
                                                        key={i}
                                                        className={`w-1.5 rounded-full transition-all duration-100 ${
                                                            agentSpeaking
                                                                ? "bg-gradient-to-t from-indigo-500 to-purple-400"
                                                                : isMuted
                                                                ? "bg-zinc-300"
                                                                : "bg-gradient-to-t from-indigo-400 to-indigo-300"
                                                        }`}
                                                        style={{ height: `${height}px` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-widest text-zinc-700">
                                            {step === "connecting"
                                                ? "Connecting to Nina..."
                                                : isMuted
                                                ? "Microphone muted"
                                                : agentSpeaking
                                                ? "Nina is speaking..."
                                                : "Nina is listening..."}
                                        </p>
                                    </div>

                                    {/* Live transcript */}
                                    <div className="flex items-center gap-2 px-5 pb-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Live transcript
                                        </span>
                                        <span className={`ml-auto w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                                    </div>
                                    <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
                                        {transcript.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-300 gap-2 py-8">
                                                <Volume2 className="w-7 h-7 opacity-40 animate-pulse" />
                                                <p className="text-xs font-semibold max-w-[200px]">
                                                    Your conversation will appear here as you and Nina talk.
                                                </p>
                                            </div>
                                        ) : (
                                            transcript.map((msg, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 ${
                                                        msg.sender === "user" ? "justify-end" : "justify-start"
                                                    }`}
                                                >
                                                    {msg.sender === "assistant" && (
                                                        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[9px] font-black text-indigo-600 shrink-0">
                                                            N
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`px-3.5 py-2 rounded-2xl max-w-[80%] text-xs font-medium leading-relaxed ${
                                                            msg.sender === "user"
                                                                ? "bg-zinc-950 text-white rounded-tr-sm"
                                                                : "bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-tl-sm"
                                                        }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-zinc-100">
                                        <Button
                                            onClick={toggleMute}
                                            variant="outline"
                                            size="icon"
                                            disabled={step === "connecting"}
                                            className={`w-12 h-12 rounded-2xl ${
                                                isMuted ? "bg-red-50 text-red-600 border-red-100" : "bg-white"
                                            }`}
                                        >
                                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-zinc-600" />}
                                        </Button>
                                        <Button
                                            onClick={finishCheckin}
                                            disabled={step === "connecting"}
                                            className="h-12 px-6 rounded-2xl bg-black hover:bg-black/90 text-white font-bold gap-2 shadow-lg"
                                        >
                                            {step === "connecting" ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Finish & save"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* PROCESSING */}
                            {step === "processing" && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-8 space-y-5">
                                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                    <p className="text-sm font-bold text-zinc-700">{processingMessage}</p>
                                    <p className="text-xs text-zinc-400 font-medium">
                                        Extracting your wins, failures, customer signals, and exact phrases.
                                    </p>
                                </div>
                            )}

                            {/* COMPLETED */}
                            {step === "completed" && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-8 space-y-5">
                                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-black text-zinc-900">This week is captured</h2>
                                        <p className="text-sm text-zinc-500 font-medium max-w-xs">
                                            Your founder memory is updated. I'll use your own words the next time we
                                            craft your posts.
                                        </p>
                                    </div>
                                    <Button onClick={closeModal} className="h-11 px-6 rounded-2xl bg-black text-white font-bold">
                                        Done
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
