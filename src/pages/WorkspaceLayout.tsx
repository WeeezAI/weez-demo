import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Database, Users, Plug, ChevronRight } from "lucide-react";

export default function WorkspaceLayout() {
  const { currentSpace, exitSpace } = useAuth();
  const navigate = useNavigate();

  if (!currentSpace) {
    navigate("/spaces");
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-border bg-card p-4 flex flex-col">
        <h1 className="text-xl font-semibold mb-4">
          {currentSpace.name}
        </h1>

        <nav className="space-y-2">
          <button
            className="flex items-center space-x-2 w-full p-2 rounded hover:bg-muted"
            onClick={() => navigate(`/workspace/${currentSpace.id}/chat`)}
          >
            <Home className="w-4 h-4" />
            <span>Chat</span>
          </button>

          <button
            className="flex items-center space-x-2 w-full p-2 rounded hover:bg-muted"
            onClick={() => navigate(`/workspace/${currentSpace.id}/knowledge`)}
          >
            <Database className="w-4 h-4" />
            <span>Knowledge Base</span>
          </button>

          <button
            className="flex items-center space-x-2 w-full p-2 rounded hover:bg-muted"
            onClick={() => navigate(`/workspace/${currentSpace.id}/connections`)}
          >
            <Plug className="w-4 h-4" />
            <span>Connections</span>
          </button>

          <button
            className="flex items-center space-x-2 w-full p-2 rounded hover:bg-muted"
            onClick={() => navigate(`/workspace/${currentSpace.id}/members`)}
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </button>
        </nav>

        <div className="mt-auto">
          <button
            className="flex items-center space-x-2 w-full p-2 rounded text-red-500 hover:bg-muted"
            onClick={() => {
              exitSpace();
              navigate("/spaces");
            }}
          >
            <ChevronRight className="w-4 h-4" />
            <span>Exit Space</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
