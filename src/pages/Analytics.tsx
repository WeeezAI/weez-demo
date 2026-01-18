import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, TrendingUp, Users, Eye, Heart, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";

const Analytics = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { loadingAuth, isAuthenticated, spaces, currentSpace, selectSpace } = useAuth();

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

  if (loadingAuth || !currentSpace) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  const stats = [
    { label: "Total Views", value: "12,847", icon: Eye, change: "+12.5%" },
    { label: "Engagement Rate", value: "4.8%", icon: Heart, change: "+2.1%" },
    { label: "Total Shares", value: "1,234", icon: Share2, change: "+8.3%" },
    { label: "Followers Gained", value: "567", icon: Users, change: "+15.2%" },
  ];

  const recentPosts = [
    { title: "Summer Sale Announcement", views: 2345, engagement: "5.2%", date: "2 days ago" },
    { title: "New Product Launch", views: 1890, engagement: "4.8%", date: "4 days ago" },
    { title: "Behind the Scenes", views: 1567, engagement: "6.1%", date: "1 week ago" },
    { title: "Customer Spotlight", views: 1234, engagement: "3.9%", date: "1 week ago" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <ConversationSidebar
        spaceId={spaceId || ""}
        onNewChat={() => navigate(`/chat/${spaceId}`)}
      />
      
      <div className="flex-1 flex flex-col">
        <WeezHeader spaceName={currentSpace.name} />
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Analytics
              </h1>
              <p className="text-sm text-muted-foreground">{currentSpace.name}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map((stat) => (
                <Card key={stat.label} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-green-600 font-medium">{stat.change}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              ))}
            </div>

            {/* Performance Chart Placeholder */}
            <Card className="p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Performance Over Time
              </h2>
              <div className="h-64 bg-muted/50 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Chart visualization coming soon</p>
              </div>
            </Card>

            {/* Recent Posts Table */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Top Performing Content</h2>
              <div className="space-y-4">
                {recentPosts.map((post, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{post.title}</div>
                      <div className="text-sm text-muted-foreground">{post.date}</div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{post.views.toLocaleString()}</div>
                        <div className="text-muted-foreground">Views</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{post.engagement}</div>
                        <div className="text-muted-foreground">Engagement</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
