import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Image, Sparkles, Zap, Loader2, CheckCircle2, Activity, Target, ChevronLeft, ChevronRight, X, Layers, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface SlideItem {
  slide_number: number;
  image_url: string;
  blob_name: string;
  prompt_preview?: string;
}

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
  // Carousel fields
  template_type?: "poster" | "carousel";
  carousel_id?: string;
  carousel_folder?: string;
  slide_count?: number;
  slides?: SlideItem[];
}

const Gallery = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();

  const [posters, setPosters] = useState<PosterArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  // Carousel modal state
  const [carouselModal, setCarouselModal] = useState<{
    open: boolean;
    poster: PosterArtifact | null;
    currentSlide: number;
  }>({ open: false, poster: null, currentSlide: 0 });
  const [isModalPaused, setIsModalPaused] = useState(false);

  // Auto-play logic for carousel modal
  useEffect(() => {
    if (!carouselModal.open || isModalPaused || !carouselModal.poster?.slides) return;
    if (carouselModal.poster.slides.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 5000); // 5 second interval

    return () => clearInterval(interval);
  }, [carouselModal.open, isModalPaused, carouselModal.poster?.slides?.length, carouselModal.currentSlide]);

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

  const openCarouselModal = (poster: PosterArtifact) => {
    setIsModalPaused(false);
    setCarouselModal({ open: true, poster, currentSlide: 0 });
  };

  const closeCarouselModal = () => {
    setCarouselModal({ open: false, poster: null, currentSlide: 0 });
    setIsModalPaused(false);
  };

  const prevSlide = () => {
    setIsModalPaused(true);
    setCarouselModal((prev) => ({
      ...prev,
      currentSlide:
        prev.currentSlide > 0
          ? prev.currentSlide - 1
          : (prev.poster?.slides?.length ?? 1) - 1,
    }));
  };

  const nextSlide = () => {
    // If called from useEffect, we don't necessarily want to pause forever, 
    // but the manual buttons will trigger a pause.
    setCarouselModal((prev) => ({
      ...prev,
      currentSlide:
        prev.currentSlide < (prev.poster?.slides?.length ?? 1) - 1
          ? prev.currentSlide + 1
          : 0,
    }));
  };

  const handlePrevSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsModalPaused(true);
    prevSlide();
  };

  const handleNextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsModalPaused(true);
    nextSlide();
  };

  // Keyboard navigation for carousel modal
  useEffect(() => {
    if (!carouselModal.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevSlide();
      if (e.key === "ArrowRight") handleNextSlide();
      if (e.key === "Escape") closeCarouselModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [carouselModal.open]);

  if (loadingAuth || !currentSpace) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50 text-center">
            Architecting Space
          </p>
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

        <div className="flex-1 overflow-auto p-10 scrollbar-hide" data-tutorial-id="gallery-section">
          <div className="max-w-[1400px] mx-auto space-y-16 pb-20">

            {/* Gallery Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/5 rounded-full border border-purple-500/10">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">
                    Asset Management
                  </span>
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
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                Sync Storage
              </Button>
            </div>

            {/* Gallery Grid */}
            {isLoading ? (
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="aspect-square bg-white rounded-[2.5rem] border-2 border-dashed animate-pulse"
                  />
                ))}
              </div>
            ) : posters.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-32 bg-white rounded-[4rem] border-none shadow-2xl shadow-black/[0.02] text-center gap-8">
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                  <Image className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-black tracking-tight uppercase">Null Storage.</h2>
                  <p className="text-muted-foreground max-w-xs font-medium">
                    Your brand repository is currently empty. Generate content in the Campaign Hub to populate this space.
                  </p>
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
                {posters.map((poster) => {
                  const isCarousel =
                    poster.template_type === "carousel" &&
                    (poster.slides?.length ?? 0) > 1;

                  return (
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

                        {/* Floating Badges */}
                        <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-black/60 backdrop-blur-xl border-white/10 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                              {poster.content_type}
                            </Badge>
                            {isCarousel && (
                              <Badge className="bg-violet-600/80 backdrop-blur-xl border-white/10 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />
                                {poster.slide_count} slides
                              </Badge>
                            )}
                          </div>
                          {poster.is_published && (
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Hover Overlay Actions */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 p-8">
                          {isCarousel && (
                            <Button
                              onClick={() => openCarouselModal(poster)}
                              className="w-full h-12 rounded-2xl bg-violet-600 text-white font-black uppercase tracking-widest text-[10px] gap-2 shadow-2xl"
                            >
                              <Play className="w-3.5 h-3.5" />
                              View All Slides
                            </Button>
                          )}
                          {!poster.is_published && (
                            <Button
                              onClick={() => handlePublish(poster)}
                              disabled={isPublishing === poster.id}
                              className="w-full h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] gap-2 shadow-2xl"
                            >
                              {isPublishing === poster.id ? (
                                <Loader2 className="animate-spin w-4 h-4" />
                              ) : (
                                <Zap className="w-4 h-4" />
                              )}
                              {isPublishing === poster.id ? "Deploying..." : "Launch to Feed"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Detail Area */}
                      <CardContent className="p-8 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                            Artifact Context
                          </div>
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
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/10">
                              Staged
                            </span>
                          )}
                          <span className="text-[10px] font-mono opacity-20 uppercase">
                            #{poster.id.substring(poster.id.length - 4)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Carousel Slide Modal ── */}
      {carouselModal.open && carouselModal.poster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          onClick={closeCarouselModal}
        >
          <div
            className="relative w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeCarouselModal}
              className="absolute -top-14 right-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
              aria-label="Close carousel viewer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Slide counter */}
            <div className="absolute -top-14 left-0 text-white/60 text-sm font-mono">
              {carouselModal.currentSlide + 1} / {carouselModal.poster.slides?.length ?? 0}
            </div>

            {/* Main slide image */}
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-[#111] shadow-2xl">
              {carouselModal.poster.slides?.[carouselModal.currentSlide] && (
                <img
                  src={carouselModal.poster.slides[carouselModal.currentSlide].image_url}
                  alt={`Slide ${carouselModal.currentSlide + 1}`}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Prev arrow */}
              <button
                onClick={handlePrevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Next arrow */}
              <button
                onClick={handleNextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Dot progress indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {carouselModal.poster.slides?.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsModalPaused(true);
                    setCarouselModal((prev) => ({ ...prev, currentSlide: idx }));
                  }}
                  className={`transition-all duration-300 rounded-full ${
                    idx === carouselModal.currentSlide
                      ? "w-6 h-2 bg-white"
                      : "w-2 h-2 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Thumbnail strip */}
            {(carouselModal.poster.slides?.length ?? 0) > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide justify-center">
                {carouselModal.poster.slides?.map((slide, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      setCarouselModal((prev) => ({ ...prev, currentSlide: idx }))
                    }
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      idx === carouselModal.currentSlide
                        ? "border-white opacity-100 scale-105"
                        : "border-white/20 opacity-50 hover:opacity-75"
                    }`}
                  >
                    <img
                      src={slide.image_url}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
