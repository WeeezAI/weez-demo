import { useNavigate } from "react-router-dom";
import { Sparkles, Folder, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Spaces = () => {
  const { user, spaces, selectSpace, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const handleSpaceClick = (space: typeof spaces[0]) => {
    selectSpace(space);
    navigate("/chat");
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Weez.AI</h1>
              <p className="text-xs text-muted-foreground">Future of Digital Marketing</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-foreground hidden sm:block">{user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Your Spaces</h2>
          <p className="text-muted-foreground">Select a space to start collaborating</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => handleSpaceClick(space)}
              className="group bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/50 hover:shadow-lg transition-all duration-200"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${space.color}20` }}
              >
                <Folder className="w-6 h-6" style={{ color: space.color }} />
              </div>
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                {space.name}
              </h3>
              <p className="text-sm text-muted-foreground">{space.description}</p>
            </button>
          ))}

          {/* Create New Space Button */}
          <button
            className="bg-card border-2 border-dashed border-border rounded-2xl p-6 text-left hover:border-primary/50 hover:bg-muted/50 transition-all duration-200 flex flex-col items-center justify-center min-h-[160px]"
            onClick={() => {
              // Demo: just show a toast or placeholder
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Create New Space</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Spaces;
