import React, { useState, useEffect, useRef } from "react";
import {
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Sparkles,
    CheckCircle2,
    Loader2,
    ArrowRight,
    Play,
    Pause,
    MessageSquare,
    AlertCircle,
    User,
    Info,
    Smile,
    Heart,
    Zap,
    TrendingUp,
    Bookmark
} from "lucide-react";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FounderVoiceOnboardingProps {
    spaceId: string;
    onComplete: (voiceProfile?: any) => void;
    onSkip: () => void;
}

interface MessageLog {
    sender: "assistant" | "user";
    text: string;
}

// ── Nina — the AI CMO who runs onboarding ───────────────────────────────────
// Note: the team artwork spells it "Ninna"; product copy uses "Nina". Change
// NINA_NAME here to flip everything in one place.
const NINA_NAME = "Nina";
const NINA_TITLE = "AI CMO";
// Drop Nina's cropped portrait at frontend/public/assets/nina.png. If the file
// is missing the UI gracefully falls back to an initials avatar (no build break).
const NINA_AVATAR = "/assets/nina.png";
// Nina's voice is played through a WebAudio gain node so it can go LOUDER than
// the 1.0 cap on an <audio> element. 1.0 = normal; 1.8 = noticeably louder.
const NINA_VOICE_GAIN = 1.8;

/** Nina's avatar with a graceful initials fallback when the image is absent. */
function NinaAvatar({ className = "" }: { className?: string }) {
    const [ok, setOk] = useState(true);
    if (ok) {
        return (
            <img
                src={NINA_AVATAR}
                alt={`${NINA_NAME}, ${NINA_TITLE}`}
                onError={() => setOk(false)}
                className={`object-cover ${className}`}
            />
        );
    }
    return (
        <div className={`bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black ${className}`}>
            {NINA_NAME.charAt(0)}
        </div>
    );
}

export default function FounderVoiceOnboarding({ spaceId, onComplete, onSkip }: FounderVoiceOnboardingProps) {
    const [step, setStep] = useState<"intro" | "insist" | "interview" | "processing" | "completed">("intro");
    
    // WebRTC & Audio state
    const [isMuted, setIsMuted] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [realtimeSession, setRealtimeSession] = useState<any>(null);
    const [transcript, setTranscript] = useState<MessageLog[]>([]);
    
    // Analysis and profile results
    const [processingMessage, setProcessingMessage] = useState("Initializing analysis...");
    const [voiceProfile, setVoiceProfile] = useState<any>(null);

    // Active visualizer state
    const [audioLevel, setAudioLevel] = useState(0);          // founder's mic level
    const [agentAudioLevel, setAgentAudioLevel] = useState(0); // Nina's voice level
    const [agentSpeaking, setAgentSpeaking] = useState(false);
    
    // WebRTC Refs
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const transcriptAccumulatorRef = useRef<MessageLog[]>([]);
    // WebAudio graph used to amplify Nina's (remote) voice above the element cap,
    // plus an analyser so her voice drives the on-screen sound waves.
    const remoteAudioCtxRef = useRef<AudioContext | null>(null);
    const remoteGainRef = useRef<GainNode | null>(null);
    const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
    const remoteRafRef = useRef<number | null>(null);

    useEffect(() => {
        // Cleanup WebRTC connections on unmount
        return () => {
            cleanupWebRTC();
        };
    }, []);

    const cleanupWebRTC = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (remoteRafRef.current) {
            cancelAnimationFrame(remoteRafRef.current);
            remoteRafRef.current = null;
        }
        remoteAnalyserRef.current = null;
        setAgentAudioLevel(0);
        if (remoteGainRef.current) {
            try { remoteGainRef.current.disconnect(); } catch { /* noop */ }
            remoteGainRef.current = null;
        }
        if (remoteAudioCtxRef.current) {
            remoteAudioCtxRef.current.close().catch(() => {});
            remoteAudioCtxRef.current = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current = null;
        }
        setIsConnected(false);
        setIsConnecting(false);
    };

    const startVoiceInterview = async () => {
        setIsConnecting(true);
        setStep("interview");
        setTranscript([]);
        transcriptAccumulatorRef.current = [];

        try {
            // 1. Get WebRTC ephemeral session token from backend
            const sessionData = await weezAPI.createRealtimeSession(spaceId);
            setRealtimeSession(sessionData);

            // 2. Access local microphone
            let localStream: MediaStream;
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localStreamRef.current = localStream;
            } catch (err) {
                console.error("Microphone permission denied", err);
                toast.error("Microphone access is required for the voice interview. Please enable it in your browser settings.");
                setStep("intro");
                setIsConnecting(false);
                return;
            }

            // 3. Create RTCPeerConnection
            const pc = new RTCPeerConnection({
                iceServers: sessionData.ice_servers || []
            });
            pcRef.current = pc;

            // 4. Play remote audio stream when tracks arrive
            const remoteAudio = new Audio();
            remoteAudio.autoplay = true;
            remoteAudioRef.current = remoteAudio;
            pc.ontrack = (event) => {
                const [stream] = event.streams;
                remoteAudio.srcObject = stream;
                // Amplify Nina's voice above the 1.0 HTMLMediaElement volume cap by
                // routing her remote audio through a WebAudio gain node. The <audio>
                // element stays attached but muted (keeps the WebRTC track flowing);
                // the WebAudio graph produces the louder audible output.
                try {
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    const ctx = new AudioCtx();
                    remoteAudioCtxRef.current = ctx;
                    const source = ctx.createMediaStreamSource(stream);
                    const gain = ctx.createGain();
                    gain.gain.value = NINA_VOICE_GAIN;
                    remoteGainRef.current = gain;
                    source.connect(gain);
                    gain.connect(ctx.destination);
                    remoteAudio.muted = true;
                    if (ctx.state === "suspended") ctx.resume().catch(() => {});

                    // Analyser tap so Nina's voice animates the sound-wave ring.
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 64;
                    gain.connect(analyser);
                    remoteAnalyserRef.current = analyser;
                    const freq = new Uint8Array(analyser.frequencyBinCount);
                    const tickRemote = () => {
                        if (!remoteAnalyserRef.current) return;
                        analyser.getByteFrequencyData(freq);
                        let sum = 0;
                        for (let i = 0; i < freq.length; i++) sum += freq[i];
                        setAgentAudioLevel(Math.min((sum / freq.length) * 1.7, 100));
                        remoteRafRef.current = requestAnimationFrame(tickRemote);
                    };
                    tickRemote();
                } catch (e) {
                    // Fallback: play through the element at max volume if WebAudio fails.
                    remoteAudio.muted = false;
                    remoteAudio.volume = 1.0;
                }
            };

            // Add local microphone audio track to peer connection
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            // 5. Establish Data Channel for transcribing text updates
            const dc = pc.createDataChannel("oai-events");
            dataChannelRef.current = dc;

            dc.onopen = () => {
                console.log("WebRTC Data Channel is open");
                setIsConnected(true);
                setIsConnecting(false);
            };

            dc.onmessage = (event) => {
                try {
                    const oaiEvent = JSON.parse(event.data);
                    
                    // User audio speech transcribing completed
                    if (oaiEvent.type === "conversation.item.input_audio_transcription.completed") {
                        const text = oaiEvent.transcript?.trim();
                        if (text) {
                            addMessageLog("user", text);
                        }
                    } 
                    
                    // Assistant response audio transcribing completed
                    else if (oaiEvent.type === "response.audio_transcript.done") {
                        const text = oaiEvent.transcript?.trim();
                        if (text) {
                            addMessageLog("assistant", text);
                        }
                    }

                    // Speaking state detection
                    else if (oaiEvent.type === "response.created") {
                        setAgentSpeaking(true);
                    } else if (oaiEvent.type === "response.done") {
                        setAgentSpeaking(false);
                    }
                } catch (e) {
                    console.error("Failed to parse data channel event:", e);
                }
            };

            // 6. Setup local audio visualizer level analyzer
            setupAudioVisualizer(localStream);

            // 7. Create SDP Offer & exchange with Azure WebRTC Signaling
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpResponse = await fetch(sessionData.url, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    "Content-Type": "application/sdp",
                    "Authorization": `Bearer ${sessionData.token}`
                }
            });

            if (!sdpResponse.ok) {
                throw new Error("WebRTC signaling handshake failed");
            }

            const sdpAnswer = await sdpResponse.text();
            await pc.setRemoteDescription(new RTCSessionDescription({
                type: "answer",
                sdp: sdpAnswer
            }));

            toast.success("Voice Connection Established!");

        } catch (err: any) {
            console.error("Failed to start voice session:", err);
            toast.error(err.message || `Failed to establish voice session with ${NINA_NAME}. Please try again.`);
            cleanupWebRTC();
            setStep("intro");
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
            analyser.fftSize = 32;

            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkLevel = () => {
                if (!localStreamRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // Scale average value (0 - 255) to a percentage level (0 - 100)
                setAudioLevel(Math.min(average * 1.5, 100));
                
                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };

            checkLevel();
        } catch (e) {
            console.error("Failed to setup audio visualizer:", e);
        }
    };

    const addMessageLog = (sender: "assistant" | "user", text: string) => {
        const newMsg: MessageLog = { sender, text };
        transcriptAccumulatorRef.current = [...transcriptAccumulatorRef.current, newMsg];
        setTranscript([...transcriptAccumulatorRef.current]);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
                toast.info(audioTrack.enabled ? "Microphone Unmuted" : "Microphone Muted");
            }
        }
    };

    const finishInterviewAndAnalyze = async () => {
        cleanupWebRTC();
        setStep("processing");

        // Dynamic progress message indicator
        const messages = [
            "Structuring founder transcript details...",
            "Analyzing communication styles and rhythm...",
            "Isolating business storytelling vectors...",
            "Extracting core point of views & contrarian beliefs...",
            "Identifying voice traits & tone boundaries...",
            "Generating your synthesized Founder Voice Profile..."
        ];

        let index = 0;
        setProcessingMessage(messages[0]);
        const interval = setInterval(() => {
            index++;
            if (index < messages.length) {
                setProcessingMessage(messages[index]);
            } else {
                clearInterval(interval);
            }
        }, 3000);

        try {
            // Aggregate all transcripts into a single coherent text block
            const fullTranscriptText = transcriptAccumulatorRef.current
                .map(m => `${m.sender.toUpperCase()}: ${m.text}`)
                .join("\n\n");

            if (!fullTranscriptText || fullTranscriptText.trim().length < 50) {
                // Fallback transcript in case WebRTC transcripts didn't log due to WebRTC disconnect, 
                // but user did speak or want to preview
                throw new Error(`No substantial conversation recorded. Please speak to ${NINA_NAME} or re-run the interview.`);
            }

            const result = await weezAPI.processFounderVoice(spaceId, fullTranscriptText);
            clearInterval(interval);
            setVoiceProfile(result.founder_voice);
            setStep("completed");
            toast.success("Founder Voice Profile Synthesized Successfully!");

        } catch (err: any) {
            clearInterval(interval);
            console.error("Failed to process founder voice:", err);
            toast.error(err.message || "Failed to process interview. Let's try again or skip voice onboarding.");
            setStep("intro");
        }
    };

    const handleSkip = () => {
        setStep("insist");
    };

    const confirmSkip = () => {
        onSkip();
    };

    // The latest thing Nina said aloud — shown in plain text under her circle.
    const currentQuestion = [...transcript].reverse().find((m) => m.sender === "assistant")?.text || "";
    // Combined level: reacts to whoever is talking (Nina or the founder).
    const waveLevel = isMuted ? agentAudioLevel : Math.max(audioLevel, agentAudioLevel);

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-y-auto px-6 py-8">
            {/* Background cinematic effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] bg-indigo-200/20 rounded-full blur-[140px]" />
                <div className="absolute bottom-[10%] left-[20%] w-[40%] h-[35%] bg-purple-200/10 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-4xl flex flex-col h-full max-h-[85vh]">
                
                {/* ── STEP 1: INTRO SCREEN ────────────────────────────────────────────── */}
                {step === "intro" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 max-w-2xl mx-auto my-auto animate-in fade-in zoom-in-95 duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                            <div className="relative w-24 h-24 rounded-[1.8rem] bg-indigo-600 shadow-2xl overflow-hidden ring-4 ring-white">
                                <NinaAvatar className="w-full h-full text-3xl" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg border-2 border-white">
                                {NINA_TITLE}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Badge className="bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-600 border-none px-4 py-1.5 font-bold tracking-widest uppercase rounded-full">
                                Setup Phase: Meet Your CMO
                            </Badge>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-950 uppercase leading-none">
                                Meet {NINA_NAME}, Your <br />
                                <span className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-cyan-500 bg-clip-text text-transparent">AI Chief Marketing Officer</span>
                            </h1>
                            <p className="text-zinc-500 text-sm font-semibold leading-relaxed max-w-md mx-auto">
                                {NINA_NAME} runs marketing for you. Give her 2 minutes and 5 quick questions about your product, customers, and goals — she'll use it to build a real go-to-market strategy, not a generic plan, and to make your content sound exactly like you.
                            </p>
                        </div>

                        <div className="space-y-4 w-full max-w-xs">
                            <Button 
                                onClick={startVoiceInterview}
                                className="w-full h-12 rounded-2xl bg-black hover:bg-black/90 text-white font-bold gap-3 shadow-lg shadow-black/10 active:scale-95 transition-all"
                            >
                                <Play className="w-4 h-4 fill-white" /> Talk to {NINA_NAME} (2m)
                            </Button>
                            <Button 
                                onClick={handleSkip}
                                variant="ghost" 
                                className="w-full h-10 rounded-xl text-zinc-400 hover:text-zinc-900 font-semibold transition-all"
                            >
                                Skip for now
                            </Button>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-6 border-t border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-full">
                            <span>🎙️ {NINA_NAME}'s Voice (Live)</span>
                            <span>⚡ WebRTC Realtime API</span>
                            <span>🔒 100% Private</span>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: INSISTENCE WARNING SCREEN ────────────────────────────────── */}
                {step === "insist" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-md mx-auto my-auto animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                            <AlertCircle className="w-7 h-7" />
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Are you absolutely sure?</h2>
                            <p className="text-zinc-500 text-xs font-semibold leading-relaxed">
                                Without this, {NINA_NAME} has to guess at your business. Answering her 5 quick questions lets her build a <strong className="text-indigo-600 font-black">realistic, tailored GTM strategy</strong> and content that sounds like you.
                            </p>
                            <p className="text-zinc-600 text-xs font-bold bg-indigo-50/50 p-4 rounded-xl leading-relaxed italic">
                                "This single step makes your AI-generated marketing up to 10x more personalized, emotional, and authentic to your personal journey."
                            </p>
                        </div>

                        <div className="space-y-3 w-full">
                            <Button 
                                onClick={startVoiceInterview}
                                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shadow-lg shadow-indigo-600/10"
                            >
                                Let's talk with {NINA_NAME} (Recommended)
                            </Button>
                            <Button 
                                onClick={confirmSkip}
                                variant="outline" 
                                className="w-full h-10 rounded-xl border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all font-semibold"
                            >
                                Skip voice onboarding for now
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: ACTIVE VOICE INTERVIEW ───────────────────────────────────── */}
                {step === "interview" && (
                    <div className="flex-1 flex flex-col lg:flex-row gap-8 h-full max-h-[75vh]">
                        
                        {/* Left Column: Voice Orb visualizer & connection state */}
                        <div className="flex-[4] flex flex-col items-center justify-center bg-zinc-50/30 rounded-[2rem] border border-zinc-100 p-8 relative overflow-hidden">
                            
                            {/* Glowing ambient ring */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={`w-[240px] h-[240px] rounded-full blur-3xl transition-all duration-1000 ${
                                    isConnecting ? "bg-amber-400/10" : 
                                    agentSpeaking ? "bg-emerald-400/10 scale-110 animate-pulse" : 
                                    isMuted ? "bg-red-400/5" : "bg-indigo-400/10 scale-105"
                                }`} />
                            </div>

                            {/* ── Nina circle with a live sound-wave circumference ── */}
                            <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
                                {/* Expanding ripple rings emanating from the circle edge */}
                                {isConnected && (
                                    <>
                                        <div
                                            className={`absolute rounded-full border animate-ping ${agentSpeaking ? "border-emerald-400/30" : "border-indigo-400/25"}`}
                                            style={{ width: `${232 + waveLevel * 0.9}px`, height: `${232 + waveLevel * 0.9}px`, animationDuration: "2s" }}
                                        />
                                        <div
                                            className={`absolute rounded-full border animate-ping ${agentSpeaking ? "border-emerald-400/15" : "border-indigo-400/10"}`}
                                            style={{ width: `${232 + waveLevel * 1.6}px`, height: `${232 + waveLevel * 1.6}px`, animationDuration: "3s" }}
                                        />
                                    </>
                                )}

                                {/* Radial waveform bars sitting on the circumference (react to whoever is talking) */}
                                {Array.from({ length: 56 }).map((_, i) => {
                                    const angle = (i / 56) * 360;
                                    const wobble = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.9));
                                    const dynamic = isConnecting ? 4 : 4 + (Math.min(waveLevel, 100) / 100) * 26 * wobble;
                                    const color = isMuted
                                        ? "rgb(148 163 184)"
                                        : agentSpeaking ? "rgb(16 185 129)" : "rgb(99 102 241)";
                                    return (
                                        <span
                                            key={i}
                                            className="absolute left-1/2 top-1/2 rounded-full"
                                            style={{
                                                width: 3,
                                                height: `${dynamic}px`,
                                                background: color,
                                                opacity: 0.75,
                                                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-118px)`,
                                                transition: "height 110ms ease-out, background 300ms ease",
                                            }}
                                        />
                                    );
                                })}

                                {/* The circle: Nina's image inside */}
                                <div
                                    className={`relative w-52 h-52 rounded-full overflow-hidden shadow-2xl ring-4 transition-all duration-500 ${
                                        isConnecting ? "ring-amber-200" :
                                        agentSpeaking ? "ring-emerald-200" :
                                        isMuted ? "ring-zinc-200" : "ring-indigo-200"
                                    }`}
                                    style={{ transform: `scale(${1 + Math.min(waveLevel, 100) / 600})` }}
                                >
                                    <NinaAvatar className="w-full h-full text-5xl" />
                                    {(isConnecting || isMuted) && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                            {isConnecting
                                                ? <Loader2 className="w-9 h-9 text-white animate-spin" />
                                                : <MicOff className="w-9 h-9 text-white" />}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status line */}
                            <div className="text-center mt-8 relative z-10">
                                <div className="inline-flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isConnected ? (agentSpeaking ? "bg-emerald-500" : "bg-indigo-500") + " animate-pulse" : "bg-zinc-300"}`} />
                                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                                        {isConnecting ? `Connecting to ${NINA_NAME}…` :
                                         isMuted ? "Your mic is muted" :
                                         agentSpeaking ? `${NINA_NAME} is speaking…` :
                                         `${NINA_NAME} is listening…`}
                                    </h3>
                                </div>
                            </div>

                            {/* Current question — shown in plain, simple text below the circle */}
                            <div className="mt-4 min-h-[4.5rem] max-w-md text-center px-4 relative z-10">
                                {currentQuestion ? (
                                    <p className="text-lg md:text-xl font-semibold text-zinc-800 leading-relaxed animate-in fade-in duration-500">
                                        {currentQuestion}
                                    </p>
                                ) : (
                                    <p className="text-sm text-zinc-400 font-medium">
                                        {isConnecting ? "Getting Nina ready…" : "Nina will say hello and ask her first question in a moment."}
                                    </p>
                                )}
                            </div>

                            {/* Control Actions Panel */}
                            <div className="flex items-center gap-4 mt-8 relative z-10">
                                <Button
                                    onClick={toggleMute}
                                    variant="outline"
                                    size="icon"
                                    className={`w-12 h-12 rounded-2xl border-zinc-200 transition-all ${
                                        isMuted ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-100" : "bg-white hover:bg-zinc-50"
                                    }`}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-zinc-600" />}
                                </Button>
                                
                                <Button
                                    onClick={finishInterviewAndAnalyze}
                                    disabled={isConnecting}
                                    className="h-12 px-8 rounded-2xl bg-black hover:bg-black/90 text-white font-bold gap-2 shadow-lg active:scale-95 transition-all"
                                >
                                    Finish & Continue
                                </Button>
                            </div>
                        </div>

                        {/* Right Column: Dynamic Realtime Transcript Logger */}
                        <div className="flex-[5] flex flex-col border border-zinc-100 bg-white rounded-[2rem] p-6 shadow-sm overflow-hidden h-full max-h-[70vh]">
                            <div className="flex items-center justify-between border-b border-zinc-50 pb-4 mb-4">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800">Real-time Transcript</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{isConnected ? "Connected" : "Offline"}</span>
                                </div>
                            </div>

                            {/* Transcripts view scrollbox */}
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-sm max-h-[45vh]">
                                {transcript.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-300 space-y-2 py-10">
                                        <Volume2 className="w-8 h-8 opacity-40 animate-pulse" />
                                        <p className="text-xs font-semibold">Voice transcripts will appear here in real-time as you speak.</p>
                                    </div>
                                ) : (
                                    transcript.map((msg, i) => (
                                        <div 
                                            key={i} 
                                            className={`flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                                                msg.sender === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {msg.sender === 'assistant' && (
                                                <div className="w-7 h-7 rounded-lg overflow-hidden border border-indigo-100/50 shrink-0" title={`${NINA_NAME}, ${NINA_TITLE}`}>
                                                    <NinaAvatar className="w-full h-full text-[10px]" />
                                                </div>
                                            )}
                                            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs font-medium leading-relaxed ${
                                                msg.sender === 'user' 
                                                    ? 'bg-zinc-950 text-white rounded-tr-sm' 
                                                    : 'bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-tl-sm'
                                            }`}>
                                                <p>{msg.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Quick Questions Tracker Progress footer */}
                            <div className="border-t border-zinc-50 pt-4 mt-4 space-y-2">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Interview Checklist</span>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[
                                        "Product & Who",
                                        "Origin Story",
                                        "Market POV",
                                        "Lived Moment",
                                        "Tone Bounds"
                                    ].map((q, idx) => {
                                        // Count assistant dialogue questions as they occur
                                        const assistantMsgs = transcript.filter(m => m.sender === 'assistant');
                                        const currentQIdx = Math.min(assistantMsgs.length, 5);
                                        const isDone = idx < currentQIdx;
                                        const isActive = idx === currentQIdx;
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                className={`py-1.5 px-1 text-center rounded-lg border text-[8px] font-black uppercase tracking-wider transition-all leading-tight ${
                                                    isDone ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                    isActive ? "bg-indigo-50 border-indigo-100 text-indigo-700 scale-105" :
                                                    "bg-zinc-50/50 border-zinc-100 text-zinc-400"
                                                }`}
                                            >
                                                {q}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 4: ANALYSIS PROCESSING LOADER ──────────────────────────────── */}
                {step === "processing" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-lg mx-auto my-auto animate-in fade-in zoom-in-95 duration-1000">
                        <div className="relative shrink-0 flex items-center justify-center">
                            <div className="absolute w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
                            <div className="relative w-24 h-24 rounded-[2rem] bg-white border border-indigo-500/10 shadow-2xl flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/50 to-transparent" />
                                <Sparkles className="w-12 h-12 text-indigo-600 animate-bounce" />
                            </div>
                        </div>

                        <div className="space-y-4 w-full">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Analysing Voice Dynamics</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-950 uppercase leading-none">
                                Building Voice Identity...
                            </h2>
                            <p className="text-zinc-500 text-sm font-semibold max-w-sm mx-auto italic">
                                "{processingMessage}"
                            </p>
                        </div>

                        <div className="w-64 space-y-2">
                            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden relative">
                                <div className="h-full bg-indigo-600 rounded-full w-full animate-shimmer-loading-custom" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 5: ONBOARDING COMPLETED PROFILE DISPLAY ──────────────────────── */}
                {step === "completed" && voiceProfile && (
                    <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-1 animate-in fade-in duration-700">
                        
                        {/* Upper Section: Archetype Banner Card */}
                        <div className="relative bg-gradient-to-br from-indigo-900 to-purple-950 rounded-[2.5rem] p-8 md:p-10 shadow-xl overflow-hidden text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_60%)] pointer-events-none" />
                            
                            <div className="space-y-3 relative z-10 flex-1">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-indigo-200 border border-white/10 text-[9px] font-black uppercase tracking-widest">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Identity Synthesized
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-none">
                                    {voiceProfile.voice_archetype || "The Challenger Educator"}
                                </h2>
                                <p className="text-indigo-200/80 text-xs font-semibold max-w-xl leading-relaxed">
                                    {voiceProfile.founder_voice_summary || "Capturing an authentic brand archetype defined by deep industry clarity, lived storytelling expertise, and structured point of views."}
                                </p>
                            </div>

                            {/* Glowing brand badge decoration */}
                            <div className="relative shrink-0 flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 border border-white/10 shadow-inner">
                                <Zap className="w-10 h-10 text-indigo-300 fill-indigo-300/10 animate-pulse" />
                            </div>
                        </div>

                        {/* Middle Section: Profiles insights grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                            
                            {/* Column 1: Personality & Context */}
                            <Card className="border-zinc-100 bg-zinc-50/20 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                                <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto">
                                    {/* Context factoid */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Bookmark className="w-3.5 h-3.5 text-zinc-400" /> Founder Perspective Context
                                        </label>
                                        <p className="text-xs font-semibold text-zinc-800 leading-relaxed bg-white border border-zinc-100/50 p-4 rounded-2xl italic">
                                            "{voiceProfile.founder_context || "Ready to deliver high impact growth value aligned to authentic builder priorities."}"
                                        </p>
                                    </div>

                                    {/* Personality Traits list */}
                                    {voiceProfile.founder_personality_traits && voiceProfile.founder_personality_traits.length > 0 && (
                                        <div className="space-y-2.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <Heart className="w-3.5 h-3.5 text-zinc-400" /> Identity Core Traits
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {voiceProfile.founder_personality_traits.map((trait: string, idx: number) => (
                                                    <Badge key={idx} variant="secondary" className="text-[10px] font-black bg-white border-zinc-100 text-zinc-800 py-1.5 px-3.5 rounded-xl uppercase tracking-wider shadow-sm">
                                                        ⚡ {trait}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content directions goals */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Smile className="w-3.5 h-3.5 text-zinc-400" /> Audience Feeling Intent
                                        </label>
                                        <p className="text-xs font-bold text-zinc-700 leading-relaxed bg-indigo-50/20 border border-indigo-100/20 p-4 rounded-2xl">
                                            {voiceProfile.content_goals || "How do you want readers to feel? Empathized, educated, and ready to trigger high value outcomes."}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Column 2: Industry Core Beliefs & Contrarian Points */}
                            <Card className="border-zinc-100 bg-zinc-50/20 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
                                <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto">
                                    
                                    {/* Contrarian POV points */}
                                    {voiceProfile.contrarian_views && voiceProfile.contrarian_views.length > 0 && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" /> Contrarian Industry POVs
                                            </label>
                                            <div className="space-y-2.5">
                                                {voiceProfile.contrarian_views.map((view: string, idx: number) => (
                                                    <div key={idx} className="flex gap-3 items-start bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl">
                                                        <div className="w-5 h-5 rounded-lg bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                                            !
                                                        </div>
                                                        <p className="text-xs text-amber-900 font-semibold leading-relaxed">{view}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Voice boundaries blocks */}
                                    {voiceProfile.voice_boundaries && voiceProfile.voice_boundaries.length > 0 && (
                                        <div className="space-y-2.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                <AlertCircle className="w-3.5 h-3.5 text-zinc-400" /> Voice Boundaries (What to avoid)
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {voiceProfile.voice_boundaries.map((bound: string, idx: number) => (
                                                    <Badge key={idx} className="bg-red-500/5 hover:bg-red-500/10 text-red-600 border border-red-500/10 text-[9px] font-black uppercase tracking-wider py-1 px-3 rounded-lg shadow-sm">
                                                        🚫 {bound}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Industry POV summary */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" /> Industry Point of View
                                        </label>
                                        <p className="text-xs font-semibold text-zinc-700 leading-relaxed bg-white border border-zinc-100/50 p-4 rounded-2xl">
                                            {voiceProfile.industry_point_of_view || "Formulating an authentic, authoritative perspective..."}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Lower Section: Actions bar */}
                        <div className="flex justify-end pt-4 shrink-0">
                            <Button
                                onClick={() => onComplete(voiceProfile)}
                                className="h-12 px-10 rounded-2xl bg-black hover:bg-black/90 text-white font-bold gap-2 shadow-lg shadow-black/10 active:scale-95 transition-all"
                            >
                                Enter Workspace & Apply Voice <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
