import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Image, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";

// Import AI-generated posters
import launchPoster from "@/assets/posters/saas-launch-poster.jpg";
import analyticsPoster from "@/assets/posters/saas-analytics-poster.jpg";
import teamPoster from "@/assets/posters/saas-team-poster.jpg";
import producthuntPoster from "@/assets/posters/saas-producthunt-poster.jpg";
import growthPoster from "@/assets/posters/saas-growth-poster.jpg";
import apiPoster from "@/assets/posters/saas-api-poster.jpg";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  title: string;
  expectedOutcome: string;
  createdAt: string;
  prompt: string;
}

const Gallery = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();
  const [images, setImages] = useState<GeneratedImage[]>([]);

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

  // AI-generated SaaS startup posters
  useEffect(() => {
    setImages([
      {
        id: "1",
        imageUrl: launchPoster,
        title: "Product Launch Day",
        expectedOutcome: "Drive 200+ sign-ups with compelling launch visuals and clear value proposition.",
        createdAt: "2 hours ago",
        prompt: "Create a product launch announcement post with urgency and excitement. Highlight key features and include a strong call-to-action for sign-ups.",
      },
      {
        id: "2",
        imageUrl: analyticsPoster,
        title: "Data-Driven Analytics",
        expectedOutcome: "Increase feature adoption by 35% with intuitive dashboard showcase.",
        createdAt: "Yesterday",
        prompt: "Create an analytics dashboard promotional post showcasing data visualization capabilities and growth metrics.",
      },
      {
        id: "3",
        imageUrl: teamPoster,
        title: "Team Collaboration",
        expectedOutcome: "Build community trust with authentic team culture content.",
        createdAt: "2 days ago",
        prompt: "Create a team collaboration post highlighting how our product brings teams together and improves productivity.",
      },
      {
        id: "4",
        imageUrl: producthuntPoster,
        title: "Product Hunt Launch",
        expectedOutcome: "Secure top 5 Product Hunt ranking with engaging launch visuals.",
        createdAt: "3 days ago",
        prompt: "Create a Product Hunt launch day post asking for upvotes and highlighting our unique value proposition.",
      },
      {
        id: "5",
        imageUrl: growthPoster,
        title: "10X Growth Metrics",
        expectedOutcome: "Attract investor interest with impressive traction visualization.",
        createdAt: "1 week ago",
        prompt: "Create a growth metrics post showcasing our impressive growth numbers and trajectory.",
      },
      {
        id: "6",
        imageUrl: apiPoster,
        title: "Developer API Launch",
        expectedOutcome: "Boost developer adoption with clear technical documentation visuals.",
        createdAt: "1 week ago",
        prompt: "Create a developer-focused API announcement post highlighting ease of integration and documentation.",
      },
    ]);
  }, []);

  const handleOneClickPost = (prompt: string) => {
    navigate(`/chat/${spaceId}?prompt=${encodeURIComponent(prompt)}`);
  };

  if (loadingAuth || !currentSpace) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <div className="h-screen flex bg-background text-foreground w-full overflow-hidden">
      {/* Left Sidebar */}
      <ConversationSidebar 
        onNewChat={() => navigate(`/chat/${spaceId}`)}
        spaceId={spaceId || ""}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <WeezHeader spaceName={currentSpace.name} />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                Creative Gallery
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                AI-generated marketing posters ready for your campaigns
              </p>
            </div>

            {/* Empty State */}
            {images.length === 0 ? (
              <Card className="p-12 text-center">
                <Image className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No creatives yet</h2>
                <p className="text-muted-foreground mb-4">
                  Start generating content in the chat to see your creatives here.
                </p>
                <Button onClick={() => navigate(`/chat/${spaceId}`)}>
                  Go to Chat
                </Button>
              </Card>
            ) : (
              /* Gallery Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((image) => (
                  <Card key={image.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                    <div className="aspect-square relative">
                      <img
                        src={image.imageUrl}
                        alt={image.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-2">{image.title}</h3>
                      <div className="bg-muted/50 rounded-lg p-3 mb-3">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Expected Outcome</p>
                        <p className="text-sm text-foreground">{image.expectedOutcome}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{image.createdAt}</p>
                      
                      {/* One Click Post Button */}
                      <Button 
                        onClick={() => handleOneClickPost(image.prompt)}
                        className="w-full"
                        size="sm"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        One Click Post
                      </Button>
                    </div>
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
