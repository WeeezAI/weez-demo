import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Settings, Shield, Clock, Gauge, Bot, Zap,
  Target, MessageSquare, ThumbsUp, AlertTriangle,
  ShieldAlert, Share2, UserX, Save,
} from "lucide-react";
import {
  commentResponseAPI,
  type CommentReplyConfigDTO,
} from "@/services/commentResponseAPI";

interface AutoReplySettingsProps {
  brandId: string;
}

const ALL_INTENTS = [
  { key: "HIGH_INTENT_LEAD", label: "High-Intent Lead", Icon: Target, desc: "Buying signals, pricing questions" },
  { key: "QUESTION", label: "Question", Icon: MessageSquare, desc: "Questions about your product/topic" },
  { key: "POSITIVE_SENTIMENT", label: "Positive", Icon: ThumbsUp, desc: "Compliments and positive reactions" },
  { key: "NEGATIVE_SENTIMENT", label: "Negative", Icon: AlertTriangle, desc: "Criticism or complaints" },
  { key: "COMPETITOR_MENTION", label: "Competitor", Icon: ShieldAlert, desc: "Mentions a competitor" },
  { key: "REFERRAL", label: "Referral", Icon: Share2, desc: "Tags or recommends someone" },
  { key: "SPAM", label: "Spam", Icon: ShieldAlert, desc: "Irrelevant or bot-like" },
  { key: "IGNORE", label: "Ignore", Icon: UserX, desc: "Own team, test accounts" },
];

const AutoReplySettings = ({ brandId }: AutoReplySettingsProps) => {
  const [config, setConfig] = useState<CommentReplyConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<CommentReplyConfigDTO>>({});

  const loadConfig = useCallback(async () => {
    try {
      const data = await commentResponseAPI.getConfig(brandId);
      setConfig(data);
      setLocalConfig(data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await commentResponseAPI.updateConfig(brandId, localConfig);
      toast.success("Settings saved!");
      loadConfig();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getIntentBucket = (intent: string): "auto" | "review" | "skip" => {
    if ((localConfig.auto_reply_intents || []).includes(intent)) return "auto";
    if ((localConfig.human_review_intents || []).includes(intent)) return "review";
    return "skip";
  };

  const setIntentBucket = (intent: string, bucket: "auto" | "review" | "skip") => {
    const auto = (localConfig.auto_reply_intents || []).filter((i) => i !== intent);
    const review = (localConfig.human_review_intents || []).filter((i) => i !== intent);
    const skip = (localConfig.skip_intents || []).filter((i) => i !== intent);

    if (bucket === "auto") auto.push(intent);
    else if (bucket === "review") review.push(intent);
    else skip.push(intent);

    setLocalConfig((prev) => ({
      ...prev,
      auto_reply_intents: auto,
      human_review_intents: review,
      skip_intents: skip,
    }));
  };

  if (loading || !config) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-8">
        <div className="text-center py-12 text-muted-foreground/30 text-sm font-bold">Loading settings...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black">Auto-Reply Engine</p>
              <p className="text-[10px] text-muted-foreground/50 font-bold">
                Automatically respond to LinkedIn comments using AI
              </p>
            </div>
          </div>
          <Switch
            checked={localConfig.auto_reply_enabled}
            onCheckedChange={(v) => setLocalConfig((p) => ({ ...p, auto_reply_enabled: v }))}
          />
        </div>
      </Card>

      {/* Intent Routing */}
      <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-black uppercase tracking-wider">Intent Routing</h4>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-bold mb-4">
          Choose how each comment type is handled: auto-reply, send to review queue, or skip entirely.
        </p>

        <div className="space-y-3">
          {ALL_INTENTS.map((intent) => {
            const bucket = getIntentBucket(intent.key);
            return (
              <div key={intent.key} className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <intent.Icon className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <div>
                    <p className="text-xs font-bold">{intent.label}</p>
                    <p className="text-[9px] text-muted-foreground/40">{intent.desc}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {(["auto", "review", "skip"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setIntentBucket(intent.key, b)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                        bucket === b
                          ? b === "auto"
                            ? "bg-emerald-500 text-white"
                            : b === "review"
                            ? "bg-amber-500 text-white"
                            : "bg-gray-400 text-white"
                          : "bg-muted/20 text-muted-foreground/40 hover:bg-muted/40"
                      )}
                    >
                      {b === "auto" ? "Auto" : b === "review" ? "Review" : "Skip"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Rate Limits */}
      <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-black uppercase tracking-wider">Safety Limits</h4>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="p-4 rounded-2xl bg-muted/10">
            <Gauge className="w-4 h-4 text-muted-foreground/30 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Per Hour</p>
            <input
              type="number"
              value={localConfig.max_replies_per_hour || 10}
              onChange={(e) => setLocalConfig((p) => ({ ...p, max_replies_per_hour: +e.target.value }))}
              className="w-full text-xl font-black bg-transparent outline-none"
              min={1}
              max={30}
            />
          </div>
          <div className="p-4 rounded-2xl bg-muted/10">
            <Gauge className="w-4 h-4 text-muted-foreground/30 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Per Day</p>
            <input
              type="number"
              value={localConfig.max_replies_per_day || 50}
              onChange={(e) => setLocalConfig((p) => ({ ...p, max_replies_per_day: +e.target.value }))}
              className="w-full text-xl font-black bg-transparent outline-none"
              min={1}
              max={200}
            />
          </div>
          <div className="p-4 rounded-2xl bg-muted/10">
            <Clock className="w-4 h-4 text-muted-foreground/30 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Min Delay (sec)</p>
            <input
              type="number"
              value={localConfig.min_delay_seconds || 90}
              onChange={(e) => setLocalConfig((p) => ({ ...p, min_delay_seconds: +e.target.value }))}
              className="w-full text-xl font-black bg-transparent outline-none"
              min={30}
              max={600}
            />
          </div>
        </div>
      </Card>

      {/* Persona */}
      <Card className="border-none bg-white rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-4 h-4 text-violet-500" />
          <h4 className="text-sm font-black uppercase tracking-wider">Reply Persona</h4>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">
              Tone Override
            </p>
            <Textarea
              value={localConfig.persona_tone || ""}
              onChange={(e) => setLocalConfig((p) => ({ ...p, persona_tone: e.target.value }))}
              placeholder="e.g., Professional yet approachable, uses dry humor occasionally"
              className="rounded-xl text-sm"
              rows={2}
            />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">
              Extra Context
            </p>
            <Textarea
              value={localConfig.persona_context || ""}
              onChange={(e) => setLocalConfig((p) => ({ ...p, persona_context: e.target.value }))}
              placeholder="e.g., We are launching a new product next month. Mention the waitlist for leads."
              className="rounded-xl text-sm"
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default AutoReplySettings;
