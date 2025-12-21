// Spaces.tsx — WITH CREATE SPACE + LOADING STATES

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Folder, LogOut, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Spaces = () => {
  const { user, spaces, selectSpace, logout, isAuthenticated, loadingAuth, createSpace } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const connected = params.get("connected");
  
  // Create Space Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Loading state for spaces
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);

  useEffect(() => {
    if (connected) {
      toast({
        title: "Connected!",
        description: `${connected} successfully linked to your workspace.`,
      });
    }
  }, [connected]);

  // Prevent redirect until AuthContext finishes loading
  useEffect(() => {
    if (loadingAuth) return;

    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [loadingAuth, isAuthenticated]);

  // Show loading when spaces are being fetched initially
  useEffect(() => {
    if (isAuthenticated && spaces.length === 0) {
      setIsLoadingSpaces(true);
      // Set a timeout to handle the loading state
      const timer = setTimeout(() => setIsLoadingSpaces(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, spaces]);

  // While AuthContext is still initializing
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading spaces...</p>
        </div>
      </div>
    );
  }

  const handleSpaceClick = (space: typeof spaces[0]) => {
    selectSpace(space);
    navigate(`/chat/${space.id}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a space name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const result = await createSpace(newSpaceName.trim());
    setIsCreating(false);

    if (result.success) {
      toast({
        title: "Success!",
        description: `Space "${newSpaceName}" created successfully.`,
      });
      setNewSpaceName("");
      setIsCreateDialogOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create space",
        variant: "destructive",
      });
    }
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
            {user && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-foreground hidden sm:block">{user.name}</span>
              </div>
            )}

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

        {/* Loading State */}
        {isLoadingSpaces && spaces.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your spaces...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => handleSpaceClick(space)}
                className="group bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/50 hover:shadow-lg transition-all duration-200"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${space.color || "#6366F1"}20` }}
                >
                  <Folder
                    className="w-6 h-6"
                    style={{ color: space.color || "#6366F1" }}
                  />
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
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Create New Space
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Create Space Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Space</DialogTitle>
            <DialogDescription>
              Create a new workspace for your team to collaborate.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="space-name">Space Name</Label>
              <Input
                id="space-name"
                placeholder="e.g., Marketing Team"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateSpace();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewSpaceName("");
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSpace} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Space"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Spaces;