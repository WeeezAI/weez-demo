import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Image, Sparkles, Zap, Loader2, CheckCircle2, ChevronRight, ExternalLink, Activity, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PosterArtifact {
  id: string;
  image_url: string;
  blob_name: string;
  caption: string;
  hashtags: string[];
  is_published: boolean;
  content_type: string;
  angle: string;
  instagram_post_id?: string;
  _ts?: number;
}

const Gallery = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();

  const [posters, setPosters] = useState<PosterArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

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
      fetchPosters();
    }
  }, [spaceId]);

  const fetchPosters = async () => {
    setIsLoading(true);
    try {
      const data = await weezAPI.getGallery(spaceId || "test-brand-123");
      setPosters(data);
    } catch (error) {
      console.error("Failed to fetch gallery:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (poster: PosterArtifact) => {
    setIsPublishing(poster.id);
    try {
      const brandId = spaceId || "test-brand-123";
      await weezAPI.approveAndPost(brandId, {
        image_url: poster.image_url,
        blob_name: poster.blob_name,
        caption: poster.caption,
        hashtags: poster.hashtags,
      });

      toast.success("Successfully published to Instagram!");
      fetchPosters();
    } catch (error) {
      toast.error("Deployment failed");
    } finally {
      setIsPublishing(null);
    }
  };

  if (loadingAuth || !currentSpace) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50 text-center">Architecting Space</p>
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
          <div className="max-w-[1400px] mx-auto space-y-16 pb-20">

            {/* Minimal Gallery Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/5 rounded-full border border-purple-500/10">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">Asset Management</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-foreground leading-[0.9]">
                  Creative Repository.
                </h1>
                <p className="text-base font-medium text-muted-foreground max-w-xl leading-relaxed">
                  Every AI-orchestrated artifact, preserved in high-fidelity permanent storage and ready for tactical deployment.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={fetchPosters}
                disabled={isLoading}
                className="h-14 px-8 rounded-2xl border-border bg-white text-xs font-black uppercase tracking-widest hover:bg-secondary transition-all gap-3 shadow-sm active:scale-95"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Sync Storage
              </Button>
            </div>

            {/* Gallery Grid - Pure Visual Focus */}
            {isLoading ? (
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square bg-white rounded-[2.5rem] border-2 border-dashed animate-pulse" />
                ))}
              </div>
            ) : posters.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-32 bg-white rounded-[4rem] border-none shadow-2xl shadow-black/[0.02] text-center gap-8">
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                  <Image className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-black tracking-tight uppercase">Null Storage.</h2>
                  <p className="text-muted-foreground max-w-xs font-medium">Your brand repository is currently empty. Generate content in the Campaign Hub to populate this space.</p>
                </div>
                <Button
                  onClick={() => navigate(`/one-click-post/${spaceId}`)}
                  className="h-14 px-10 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
                >
                  Return to Campaign Hub
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {posters.map((poster) => (
                  <Card
                    key={poster.id}
                    className="group border-none bg-white hover:shadow-[0_50px_100px_rgba(0,0,0,0.08)] transition-all duration-700 rounded-[3rem] overflow-hidden flex flex-col relative"
                  >
                    {/* Visual Container */}
                    <div className="aspect-square relative overflow-hidden bg-[#111]">
                      <img
                        src={poster.image_url}
                        alt={poster.angle}
                        className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-60 transition-all duration-1000"
                      />

                      {/* Floating Metadata */}
                      <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                        <Badge className="bg-black/60 backdrop-blur-xl border-white/10 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                          {poster.content_type}
                        </Badge>
                        {poster.is_published && (
                          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Hover Overlay Action */}
                      {!poster.is_published && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 p-8">
                          <Button
                            onClick={() => handlePublish(poster)}
                            disabled={isPublishing === poster.id}
                            className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] gap-3 shadow-2xl"
                          >
                            {isPublishing === poster.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap className="w-4 h-4" />}
                            {isPublishing === poster.id ? "Deploying..." : "Launch to Feed"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Detail Area */}
                    <CardContent className="p-8 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Artifact Context</div>
                        <p className="text-sm font-medium text-foreground/70 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
                          "{poster.caption}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-border/50">
                        {poster.is_published ? (
                          <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                            <Target className="w-3 h-3" />
                            Live Status
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/10">Staged</span>
                        )}
                        <span className="text-[10px] font-mono opacity-20 uppercase">#{poster.id.substring(poster.id.length - 4)}</span>
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
  );
};

export default Gallery;
