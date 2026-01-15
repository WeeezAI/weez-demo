import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  title: string;
  expectedOutcome: string;
  createdAt: string;
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

  // Demo placeholder images
  useEffect(() => {
    setImages([
      {
        id: "1",
        imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop",
        title: "Flash Sale Campaign",
        expectedOutcome: "Boost engagement by 40% with urgency-driven messaging and eye-catching visuals.",
        createdAt: "2 hours ago",
      },
      {
        id: "2",
        imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop",
        title: "Product Launch Teaser",
        expectedOutcome: "Generate 500+ pre-orders through strategic reveal sequence.",
        createdAt: "Yesterday",
      },
      {
        id: "3",
        imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop",
        title: "Team Introduction Post",
        expectedOutcome: "Increase brand trust with authentic behind-the-scenes content.",
        createdAt: "2 days ago",
      },
      {
        id: "4",
        imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=400&fit=crop",
        title: "Hiring Announcement",
        expectedOutcome: "Attract top talent with compelling employer branding visuals.",
        createdAt: "3 days ago",
      },
      {
        id: "5",
        imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=400&fit=crop",
        title: "Customer Testimonial",
        expectedOutcome: "Build social proof and drive conversions with authentic reviews.",
        createdAt: "1 week ago",
      },
      {
        id: "6",
        imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=400&fit=crop",
        title: "Weekly Tips Series",
        expectedOutcome: "Position brand as industry thought leader with valuable content.",
        createdAt: "1 week ago",
      },
    ]);
  }, []);

  if (loadingAuth || !currentSpace) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/chat/${spaceId}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Creative Gallery
            </h1>
            <p className="text-sm text-muted-foreground">{currentSpace.name}</p>
          </div>
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
                  <p className="text-xs text-muted-foreground">{image.createdAt}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;
