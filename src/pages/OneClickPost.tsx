import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Zap, TrendingUp, Sparkles, ChevronRight, Loader2, CheckCircle2, MessageSquare, Send, Activity, Target, BrainCircuit, Plus, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";
import { weezAPI, ContentIdea, CreativeResponse } from "@/services/weezAPI";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OneClickPost = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user, loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();

  const [postCount, setPostCount] = useState(0);

  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [isCustomGenerating, setIsCustomGenerating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCreative, setGeneratedCreative] = useState<CreativeResponse | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [instagramAccount, setInstagramAccount] = useState<any>(null);
  const [hasPosted, setHasPosted] = useState(false);

  // Editable fields for the modal
  const [editableCaption, setEditableCaption] = useState("");
  const [editableHashtags, setEditableHashtags] = useState<string[]>([]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!isAuthenticated) navigate("/auth");
  }, [loadingAuth, isAuthenticated]);

  useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    const found = spaces.find((s) => s.id === spaceId);
    if (!found) {
      navigate("/spaces");
      return;
    }
    selectSpace(found);
  }, [spaces, spaceId]);

  useEffect(() => {
    if (spaceId) {
      fetchIdeas();
      fetchPostCount();
      weezAPI.getInstagramStatus(spaceId).then(setInstagramAccount);
    }
  }, [spaceId]);

  const fetchPostCount = async () => {
    try {
      const posters = await weezAPI.getGallery(spaceId || "");
      setPostCount(posters.length);
    } catch (error) {
      console.error("Failed to fetch post count", error);
    }
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const brandId = spaceId || "test-brand-123";
      const fetchedIdeas = await weezAPI.getIdeas(brandId);
      setIdeas(fetchedIdeas);
    } catch (error) {
      console.error("Failed to fetch ideas:", error);
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleRefresh = async () => {
    setLoadingIdeas(true);
    try {
      const brandId = spaceId || "test-brand-123";
      const refreshedIdeas = await weezAPI.refreshIdeas(brandId);
      setIdeas(refreshedIdeas);
      toast.success("Intelligence pool refreshed");
    } catch (error) {
      toast.error("Process failed");
    } finally {
      setLoadingIdeas(false);
    }
  };

  const checkLimit = () => {
    if (user?.plan_type === "free" && postCount >= 10) {
      toast.error("Artifact Limit Reached", {
        description: "Free tier is limited to 10 posts. Upgrade for infinite production.",
      });
      navigate("/plans");
      return false;
    }
    return true;
  };

  const handleGenerate = async (idea: ContentIdea) => {
    if (!checkLimit()) return;
    setIsGenerating(true);
    setIsPreviewOpen(true);
    setGeneratedCreative(null);
    setHasPosted(false);

    try {
      const brandId = spaceId || "test-brand-123";
      const result = await weezAPI.generateFromIdea(brandId, idea);
      setGeneratedCreative(result);
      setEditableCaption(result.caption);
      setEditableHashtags(result.hashtags);
      fetchIdeas();
    } catch (error: any) {
      toast.error("Generation failed");
      setIsPreviewOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;
    if (!checkLimit()) return;

    setIsCustomGenerating(true);
    setIsPreviewOpen(true);
    setGeneratedCreative(null);
    setHasPosted(false);
    setIsGenerating(true);

    try {
      const brandId = spaceId || "test-brand-123";
      const result = await weezAPI.generateFromPrompt(brandId, userPrompt);
      setGeneratedCreative(result);
      setEditableCaption(result.caption);
      setEditableHashtags(result.hashtags);
      setUserPrompt("");
      toast.success("Strategic alignment complete");
    } catch (error: any) {
      toast.error("Alignment failure");
      setIsPreviewOpen(false);
    } finally {
      setIsCustomGenerating(false);
      setIsGenerating(false);
    }
  };

  const handleApproveAndPost = async () => {
    if (!generatedCreative) return;
    setIsPosting(true);
    try {
      const brandId = spaceId || "test-brand-123";
      await weezAPI.approveAndPost(brandId, {
        image_url: generatedCreative.image_url,
        blob_name: generatedCreative.blob_name,
        caption: editableCaption,
        hashtags: editableHashtags,
      });
      setHasPosted(true);
      toast.success("Artifact deployed successfully");
      setTimeout(() => {
        setIsPreviewOpen(false);
        navigate(`/gallery/${spaceId}`);
      }, 2000);
    } catch (error) {
      toast.error("Deployment failed");
    } finally {
      setIsPosting(false);
    }
  };

  if (loadingAuth || !currentSpace) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">Calibrating Neurons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background text-foreground w-full overflow-hidden">
      <ConversationSidebar
        onNewChat={() => navigate(`/chat/${spaceId}`)}
        spaceId={spaceId || ""}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FDFBFF]">
        <WeezHeader spaceName={currentSpace.name} />

        <div className="flex-1 overflow-auto p-10 scrollbar-hide">
          <div className="max-w-[1200px] mx-auto space-y-16 pb-20">

            {/* Minimal Hero Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="space-y-4">
                {instagramAccount?.username && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/10 text-pink-500 shadow-lg shadow-pink-500/5">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">Connected Identity</span>
                      <span className="text-lg font-black tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">@{instagramAccount.username}</span>
                    </div>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Ideas Engine</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-foreground leading-[0.9]">
                  Create.
                </h1>
                <p className="text-base font-medium text-muted-foreground max-w-xl leading-relaxed">
                  Deeply aligned content objects architected from your brand memory and market competitive signals.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={loadingIdeas}
                className="h-14 px-8 rounded-2xl border-border bg-white text-xs font-black uppercase tracking-widest hover:bg-secondary transition-all gap-3 shadow-sm active:scale-95"
              >
                {loadingIdeas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Refresh
              </Button>
            </div>

            {/* Conversational Command Bar */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000" />
              <Card className="relative border-none bg-white/80 backdrop-blur-3xl shadow-2xl rounded-[2rem] overflow-hidden">
                <CardContent className="p-2">
                  <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <MessageSquare className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-40" />
                      <Input
                        placeholder="What do you want to create?"
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        className="h-20 pl-16 pr-10 bg-transparent border-none text-xl font-bold placeholder:text-muted-foreground/30 focus-visible:ring-0 shadow-none"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!userPrompt.trim() || isCustomGenerating}
                      className="h-16 px-10 rounded-[1.5rem] bg-primary text-white font-black uppercase tracking-widest text-xs hover:shadow-xl shadow-primary/20 transition-all active:scale-95 flex gap-3"
                    >
                      {isCustomGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Create
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Tactical Discovery Grid */}
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">Ideas</h2>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {loadingIdeas ? (
                <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[4/5] bg-white rounded-[2.5rem] border-2 border-dashed animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                  {ideas.map((idea, idx) => (
                    <Card
                      key={idx}
                      className="group cursor-pointer border-none bg-white hover:bg-white hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] rounded-[3rem] transition-all duration-500 flex flex-col overflow-hidden relative"
                      onClick={() => handleGenerate(idea)}
                    >
                      <div className="p-8 pb-0 flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary transition-colors duration-500">
                          <Target className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors duration-500" />
                        </div>
                        <Badge variant="secondary" className="bg-secondary text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border-none">
                          {idea.content_type}
                        </Badge>
                      </div>

                      <CardHeader className="p-8 pt-6 pb-4">
                        <CardTitle className="text-2xl font-black leading-[1.1] tracking-tight group-hover:text-primary transition-colors duration-500">
                          {idea.headline}.
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="px-8 pb-8 space-y-6 flex-1 flex flex-col justify-between">
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed opacity-60">
                          "{idea.visual_focus}"
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Create Post</span>
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Poster Preview Modal - Majestic Edition */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => !isPosting && setIsPreviewOpen(open)}>
        <DialogContent className="max-w-[1200px] p-0 border-none bg-transparent shadow-none overflow-visible">
          <div className="flex flex-col md:flex-row h-full max-h-[92vh] bg-white rounded-[4rem] overflow-hidden shadow-[0_120px_240px_rgba(139,92,246,0.3)] border border-white/20">

            {/* Visual Side: The Canvas */}
            <div className="md:w-[60%] bg-[#080808] relative overflow-hidden flex items-center justify-center min-h-[500px] group/canvas">
              {isGenerating ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-12 p-16 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-accent/20 animate-pulse" />
                  <div className="relative">
                    <div className="w-40 h-40 border-2 border-white/10 border-t-primary rounded-full animate-spin duration-[2.5s]" />
                    <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-14 h-14 animate-pulse" />
                  </div>
                  <div className="space-y-6 relative z-10">
                    <h3 className="text-3xl font-black text-white uppercase tracking-[0.4em] leading-none">Creating_</h3>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Almost Ready</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-1000 z-10" />
                  <img
                    src={generatedCreative?.image_url}
                    alt="Post Preview"
                    className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-1000"
                  />
                  <div className="absolute bottom-10 left-10 p-6 bg-white/5 backdrop-blur-3xl rounded-[2rem] border border-white/10 z-20 opacity-0 group-hover/canvas:opacity-100 translate-y-4 group-hover/canvas:translate-y-0 transition-all duration-700">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Category</span>
                        <span className="text-sm font-bold text-white mt-1 uppercase tracking-tight">{generatedCreative?.content_type}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Data Side: Orchestration Center */}
            <div className="flex-1 p-14 flex flex-col justify-between bg-[#FDFBFF] relative border-l border-border/40 overflow-y-auto">
              <div className="space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] border-none px-6 py-2.5 rounded-full">Post Draft</Badge>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Secure</span>
                    </div>
                  </div>
                  <h2 className="text-5xl font-black tracking-tighter leading-none uppercase">Post <br /><span className="text-muted-foreground/30">Editor.</span></h2>
                </div>

                {/* Editable Section */}
                <div className="space-y-10">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between px-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-60">Caption</Label>
                      <span className="text-[9px] font-mono opacity-20 uppercase tracking-widest">Editing...</span>
                    </div>
                    <div className="relative group/input">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[2rem] blur opacity-0 group-focus-within/input:opacity-100 transition-opacity" />
                      <textarea
                        value={editableCaption}
                        onChange={(e) => setEditableCaption(e.target.value)}
                        disabled={isGenerating || isPosting}
                        className="w-full min-h-[160px] p-8 rounded-[2rem] bg-white border-2 border-transparent focus:border-primary/10 text-lg font-bold text-foreground leading-relaxed placeholder:text-muted-foreground/20 transition-all resize-none shadow-inner relative z-10"
                        placeholder="Write your caption..."
                      />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <Label className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-60 px-2">Hashtags</Label>
                    <div className="flex flex-wrap gap-2.5">
                      {editableHashtags.map((t, i) => (
                        <span key={i} className="group/tag inline-flex items-center gap-2 text-[10px] font-black text-primary bg-primary/5 px-5 py-2.5 rounded-full border border-primary/10 transition-all hover:bg-primary/10">
                          {t}
                          <button
                            onClick={() => setEditableHashtags(prev => prev.filter((_, idx) => idx !== i))}
                            className="opacity-0 group-hover/tag:opacity-40 hover:!opacity-100 transition-opacity"
                          >
                            <Plus className="w-3 h-3 rotate-45" />
                          </button>
                        </span>
                      ))}
                      <button
                        className="p-2.5 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        title="Add Signal"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8 pt-12">
                {!isGenerating && !hasPosted && (
                  <Button
                    onClick={handleApproveAndPost}
                    disabled={isPosting}
                    className="w-full h-24 rounded-[2.5rem] bg-foreground text-white text-xl font-black uppercase tracking-[0.3em] hover:bg-primary transition-all active:scale-95 shadow-[0_40px_80px_rgba(0,0,0,0.15)] group relative overflow-hidden"
                  >
                    {isPosting ? <Loader2 className="animate-spin" /> : "Publish Now"}
                    {!isPosting && <ChevronRight className="ml-3 w-8 h-8 opacity-30 group-hover:translate-x-2 transition-all" />}
                  </Button>
                )}

                {hasPosted && (
                  <div className="bg-emerald-500 text-white rounded-[2.5rem] h-24 flex items-center justify-center gap-6 text-2xl font-black uppercase tracking-[0.3em] animate-in zoom-in-95 duration-700 shadow-[0_40px_80px_rgba(16,185,129,0.25)] border-2 border-white/20">
                    <CheckCircle2 className="w-10 h-10" />
                    Published
                  </div>
                )}

                <div className="flex flex-col items-center gap-6">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    disabled={isPosting}
                    className="text-[11px] font-black uppercase tracking-[0.5em] text-muted-foreground hover:text-red-500 transition-colors opacity-30 py-2"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-4 opacity-10">
                    <Activity className="w-4 h-4" />
                    <span className="text-[8px] font-black uppercase tracking-[0.4em]">Signal_Grid_Static</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OneClickPost;
