import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ConversationSidebar from "@/components/ConversationSidebar";
import WeezHeader from "@/components/WeezHeader";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

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
    return <div className="p-10 text-center">Loading Intelligence Layer...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden h-screen">
      <ConversationSidebar
        spaceId={spaceId || ""}
        onNewChat={() => navigate(`/chat/${spaceId}`)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <WeezHeader spaceName={currentSpace.name} />

        <div className="flex-1 p-6 overflow-y-auto bg-muted/20">
          <div className="max-w-6xl mx-auto">
            <AnalyticsDashboard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
