import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Edit3, Clock, Send, User, Sparkles,
  AlertTriangle, Target, MessageSquare, ThumbsUp, ShieldAlert,
  Bot, UserX, Share2, type LucideIcon,
} from "lucide-react";
import {
  commentResponseAPI,
  type TrackedCommentDTO,
  type IntentClass,
} from "@/services/commentResponseAPI";

interface ReviewQueueProps {
  brandId: string;
}

const INTENT_CONFIG: Record<IntentClass, { label: string; color: string; Icon: LucideIcon }> = {
  HIGH_INTENT_LEAD: { label: "Lead", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", Icon: Target },
  QUESTION: { label: "Question", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", Icon: MessageSquare },
  POSITIVE_SENTIMENT: { label: "Positive", color: "bg-violet-500/10 text-violet-600 border-violet-500/20", Icon: ThumbsUp },
  NEGATIVE_SENTIMENT: { label: "Negative", color: "bg-red-500/10 text-red-600 border-red-500/20", Icon: AlertTriangle },
  SPAM: { label: "Spam", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", Icon: ShieldAlert },
  COMPETITOR_MENTION: { label: "Competitor", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", Icon: ShieldAlert },
  REFERRAL: { label: "Referral", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", Icon: Share2 },
  IGNORE: { label: "Ignore", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", Icon: UserX },
};

const ReviewQueue = ({ brandId }: ReviewQueueProps) => {
  const [queue, setQueue] = useState<TrackedCommentDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await commentResponseAPI.getQueue(brandId);
      setQueue(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleApprove = async (comment: TrackedCommentDTO, edited?: string) => {
    setActionLoading(comment.id);
    try {
      await commentResponseAPI.approveComment(brandId, comment.id, edited);
      toast.success("Reply approved and posted!");
      setEditingId(null);
      loadQueue();
    } catch {
      toast.error("Failed to approve reply");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (comment: TrackedCommentDTO) => {
    setActionLoading(comment.id);
    try {
      await commentResponseAPI.rejectComment(brandId, comment.id);
      toast.success("Comment rejected — no reply sent");
      loadQueue();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const getTimeSinceComment = (createdAt: string | null): string => {
    if (!createdAt) return "";
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-10">
        <div className="flex items-center justify-center py-16 gap-3">
          <Bot className="w-5 h-5 text-blue-500 animate-pulse" />
          <span className="text-sm font-bold text-muted-foreground/50">Loading review queue...</span>
        </div>
      </Card>
    );
  }

  if (queue.length === 0) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-10">
        <div className="text-center py-16 space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-500/5 inline-flex">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/30" />
          </div>
          <h3 className="text-lg font-black text-muted-foreground/40 uppercase">Queue Clear</h3>
          <p className="text-xs text-muted-foreground/30">No comments need human review right now.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-black tracking-tight uppercase">Review Queue.</h3>
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] font-black">
            {total} pending
          </Badge>
        </div>
        <Button onClick={loadQueue} variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest">
          Refresh
        </Button>
      </div>

      {queue.map((comment) => {
        const intent = comment.intent_class ? INTENT_CONFIG[comment.intent_class] : null;
        const isEditing = editingId === comment.id;
        const isActioning = actionLoading === comment.id;

        return (
          <Card key={comment.id} className="border-none bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-4">
              {/* Header: commenter info + intent badge */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-muted/30">
                    <User className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-black">{comment.actor_name || "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground/50 font-bold">
                      {comment.actor_headline || "LinkedIn User"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {intent && (
                    <Badge className={cn("text-[8px] font-black uppercase tracking-widest border", intent.color)}>
                      <intent.Icon className="w-2.5 h-2.5 mr-1" />
                      {intent.label}
                    </Badge>
                  )}
                  {comment.confidence && (
                    <Badge className="bg-muted/30 text-muted-foreground/50 border-none text-[8px] font-black">
                      {Math.round(comment.confidence)}%
                    </Badge>
                  )}
                  <span className="text-[9px] font-bold text-muted-foreground/30 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {getTimeSinceComment(comment.created_at_li)}
                  </span>
                </div>
              </div>

              {/* Comment text */}
              <div className="p-4 rounded-2xl bg-muted/20">
                <p className="text-sm text-foreground/80 leading-relaxed">"{comment.message_text}"</p>
              </div>

              {/* AI Generated Reply */}
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">AI Reply</span>
                </div>
                {isEditing ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[80px] text-sm border-blue-500/20 rounded-xl"
                    maxLength={1250}
                  />
                ) : (
                  <p className="text-sm text-foreground/70 leading-relaxed">{comment.generated_reply}</p>
                )}
                {isEditing && (
                  <p className="text-[9px] text-muted-foreground/40 mt-1 text-right font-bold">
                    {editText.length}/1250
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      className="text-[10px] font-black uppercase tracking-widest"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(comment, editText)}
                      disabled={isActioning || !editText.trim()}
                      className="text-[10px] font-black uppercase tracking-widest gap-1.5 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Send className="w-3 h-3" />
                      Send Edited
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(comment)}
                      disabled={isActioning}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 hover:bg-red-500/5 gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Skip
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingId(comment.id); setEditText(comment.generated_reply || ""); }}
                      disabled={isActioning}
                      className="text-[10px] font-black uppercase tracking-widest gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(comment)}
                      disabled={isActioning}
                      className="text-[10px] font-black uppercase tracking-widest gap-1.5 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve & Send
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ReviewQueue;
