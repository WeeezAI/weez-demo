// Spaces.tsx — WITH VISIONARY ORCHESTRATION UPGRADE
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Folder, LogOut, Plus, Loader2, Rocket, Globe, Shield, Zap, ChevronRight, LayoutGrid, LayoutList, BrainCircuit, Activity, Database, Settings, Trash2, Menu, HelpCircle, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { weezAPI } from "@/services/weezAPI";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import HelpCenterModal from "@/components/HelpCenterModal";
import InstagramConnectModal from "@/components/InstagramConnectModal";
import logo from "@/assets/weez-logo.png";

const Spaces = () => {
  const { user, spaces, selectSpace, logout, isAuthenticated, loadingAuth, createSpace, isFetchingSpaces } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const connected = params.get("connected");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { renameSpace, deleteSpace: removeSpace } = useAuth();

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectSpaceId, setConnectSpaceId] = useState("");

  useEffect(() => {
    if (connected) {
      toast({
        title: "Integration Active",
        description: `${connected} successfully handshaked with your workspace.`,
      });
    }
  }, [connected]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!isAuthenticated) navigate("/auth");
  }, [loadingAuth, isAuthenticated]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin" />
        <p className="text-[10px] uppercase font-black tracking-[0.5em] text-muted-foreground opacity-30">Initializing Engine</p>
      </div>
    );
  }

  const handleSpaceClick = (space: any) => {
    selectSpace(space);
    navigate(`/autonomous-marketing/${space.id}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const maxSpaces = user?.plan_type === "free" ? 1 : 3;
  const canCreateSpace = spaces.length < maxSpaces;

  const handleNewSpaceClick = () => {
    if (!canCreateSpace) {
      toast({
        title: "Limit Reached",
        description: "Your free tier is limited to 1 brand workspace. Upgrade for absolute scale.",
        variant: "destructive"
      });
      navigate("/plans");
      return;
    }
    setIsCreateDialogOpen(true);
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    setIsCreating(true);
    const result = await createSpace(newSpaceName.trim());
    setIsCreating(false);
    if (result.success) {
      setNewSpaceName("");
      setIsCreateDialogOpen(false);
      toast({ title: "Space Created", description: `"${newSpaceName}" is ready.` });
    }
  };

  const handleOpenSettings = (e: React.MouseEvent, space: any) => {
    e.stopPropagation();
    setEditingSpace(space);
    setEditName(space.name);
    setIsSettingsOpen(true);
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === editingSpace?.name) return;
    setIsUpdating(true);
    const result = await renameSpace(editingSpace.id, editName.trim());
    setIsUpdating(false);
    if (result.success) {
      setIsSettingsOpen(false);
      toast({ title: "Space Renamed", description: `Updated to "${editName}".` });
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.error });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${editingSpace?.name}"? All associated data will be purged.`)) return;
    setIsDeleting(true);
    const result = await removeSpace(editingSpace.id);
    setIsDeleting(false);
    if (result.success) {
      setIsSettingsOpen(false);
      toast({ title: "Space Deleted", description: `"${editingSpace.name}" has been removed.` });
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBFF] text-foreground font-sans">


      {/* Zen Header */}
      <header className="sticky top-0 z-50 backdrop-blur-3xl bg-white/40 dark:bg-black/40 border-b border-border/30 transition-all duration-500">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate("/spaces")}>
            <img src={logo} alt="Weez AI" className="h-6 w-auto transition-transform group-hover:scale-105" />
            <div className="h-4 w-px bg-border/50 mx-2" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">Workspace Hub</span>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer group px-2 py-1.5 rounded-xl hover:bg-secondary/50 transition-all">
                  {user && (
                    <>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-foreground leading-none">{user.name}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-40 mt-1">PRO_USER</span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-600 font-bold text-xs">
                        {user.name?.charAt(0)}
                      </div>
                    </>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-card p-2 border-white/40 shadow-2xl">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-40 px-2 py-1.5">Account System</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem className="cursor-pointer rounded-lg font-bold text-xs py-2 fade-in" onClick={() => navigate("/plans")}>
                  <Sparkles className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                  Upgrade Engine
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem className="cursor-pointer rounded-lg font-bold text-xs py-2 text-destructive hover:bg-destructive/5" onClick={handleLogout}>
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Archive Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-[1400px] mx-auto px-6 pt-16 pb-24">
        <div className="mb-16 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-indigo-500/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600/60">Registry</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none text-foreground uppercase">
                Active <span className="text-muted-foreground/30 italic">Spaces.</span>
              </h2>
              <p className="text-sm font-medium text-muted-foreground max-w-md leading-relaxed opacity-60">
                Deploying marketing intelligence across your brand verticals.
              </p>
            </div>
            
            <Button
              data-tutorial-id="create-space-button"
              className="h-11 px-6 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all"
              onClick={handleNewSpaceClick}
              disabled={isFetchingSpaces}
            >
              <Plus className="w-3.5 h-3.5" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspace Display */}
        {isFetchingSpaces ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[1.6/1] glass-card rounded-2xl flex flex-col items-center justify-center gap-4 opacity-40">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">Connecting...</span>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 glass-card rounded-3xl text-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border/50">
              <Globe className="w-8 h-8 text-muted-foreground opacity-20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight">Empty Registry.</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] font-medium opacity-60">Initialize your first workspace to begin autonomous operations.</p>
            </div>
            <Button
              size="lg"
              onClick={handleNewSpaceClick}
              className="h-12 px-8 rounded-xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/10"
            >
              Initialize Space
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="glass-card rounded-2xl p-8 cursor-pointer relative group overflow-hidden flex flex-col justify-between min-h-[220px] transition-all hover:scale-[1.02] hover:bg-white/80 active:scale-95"
                onClick={() => handleSpaceClick(space)}
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/5 group-hover:bg-indigo-500 flex items-center justify-center transition-all duration-500 border border-indigo-500/10">
                    <BrainCircuit className="w-5 h-5 text-indigo-600 group-hover:text-white transition-all" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10 shrink-0">
                    <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">Active</span>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                   <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-30">Vertical_0{spaces.indexOf(space) + 1}</div>
                   <h3 className="text-2xl font-black tracking-tighter uppercase leading-none group-hover:text-indigo-600 transition-colors">
                    {space.name}.
                  </h3>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border/10">
                  <button
                    className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectSpaceId(space.id);
                      setIsConnectModalOpen(true);
                    }}
                  >
                    <Database className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center hover:bg-foreground hover:text-white transition-all text-muted-foreground"
                    onClick={(e) => handleOpenSettings(e, space)}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <div className="ml-auto flex items-center gap-2 group/enter opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600">Enter</span>
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-600 animate-bounce-x" />
                  </div>
                </div>
              </div>
            ))}

            {canCreateSpace && (
              <button
                className="group relative bg-transparent border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl p-8 transition-all duration-500 flex flex-col items-center justify-center gap-6 min-h-[220px]"
                onClick={handleNewSpaceClick}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-indigo-500" />
                </div>
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">Provisioning</span>
                  <h4 className="text-sm font-black uppercase tracking-tight">New Workspace</h4>
                </div>
              </button>
            )}
          </div>
        )}

        {/* System Diagnostics Footer */}
        <div className="mt-32 pt-8 border-t border-border/10 flex items-center justify-between opacity-30 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-glow" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase">Weez_AI_Core.stable</span>
              <span className="text-[8px] font-bold uppercase opacity-60">v2.4.0 // Session Authorized</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Node Status</span>
              <span className="text-[10px] font-mono">AUTHORIZED</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Latency</span>
              <span className="text-[10px] font-mono">12ms</span>
            </div>
          </div>
        </div>
      </main>

      {/* Strategic Hub Assembly Modal */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-xl p-12 border-none bg-white rounded-[4.5rem] shadow-[0_120px_240px_rgba(139,92,246,0.2)] overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <BrainCircuit className="w-64 h-64 -rotate-12" />
          </div>

          <DialogHeader className="space-y-6 relative z-10">
            <Badge className="w-fit bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] border-none px-6 py-2.5 rounded-full">New Space</Badge>
            <DialogTitle className="text-5xl font-black tracking-tighter leading-none uppercase">Setup.</DialogTitle>
            <DialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed opacity-80 pt-2 lg:max-w-sm text-left">
              Create a new space for your brand.
            </DialogDescription>
          </DialogHeader>

          <div className="py-16 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <Label htmlFor="space-name" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Space Name</Label>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono opacity-20 uppercase tracking-widest">Awaiting Input...</span>
                </div>
              </div>
              <Input
                id="space-name"
                placeholder="Brand Name..."
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                className="h-24 px-10 rounded-[2.5rem] bg-[#FDFBFF] border-2 border-transparent focus:border-primary/20 text-2xl font-black uppercase tracking-tight placeholder:text-muted-foreground/20 transition-all shadow-inner"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-6 relative z-10">
            <Button
              onClick={handleCreateSpace}
              disabled={isCreating || !newSpaceName.trim()}
              className="w-full h-20 rounded-[2rem] bg-primary text-white text-sm font-black uppercase tracking-[0.25em] hover:bg-accent transition-all active:scale-95 shadow-2xl shadow-primary/20 flex gap-5"
            >
              {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              {isCreating ? "Creating..." : "Create Space"}
            </Button>
            <button
              onClick={() => setIsCreateDialogOpen(false)}
              className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-red-500 transition-colors opacity-30 py-3"
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Space Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-xl p-12 border-none bg-white rounded-[4.5rem] shadow-[0_120px_240px_rgba(139,92,246,0.2)] overflow-hidden">
          <DialogHeader className="space-y-6 relative z-10">
            <Badge className="w-fit bg-secondary text-foreground text-[10px] font-black uppercase tracking-[0.3em] border-none px-6 py-2.5 rounded-full">Settings</Badge>
            <DialogTitle className="text-5xl font-black tracking-tighter leading-none uppercase">Manage.</DialogTitle>
            <DialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed opacity-80 pt-2 lg:max-w-sm text-left">
              Advanced control for your brand workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="py-12 relative z-10 space-y-12">
            {/* Rename Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <Label htmlFor="edit-name" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Rename Space</Label>
              </div>
              <div className="flex gap-4">
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-20 px-8 rounded-3xl bg-[#FDFBFF] border-2 border-transparent focus:border-primary/20 text-lg font-black uppercase tracking-tight transition-all shadow-inner flex-1"
                />
                <Button
                  onClick={handleRename}
                  disabled={isUpdating || !editName.trim() || editName === editingSpace?.name}
                  className="h-20 w-20 rounded-3xl bg-foreground text-white hover:bg-primary transition-all active:scale-95"
                >
                  {isUpdating ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
                </Button>
              </div>
            </div>

            <div className="h-px w-full bg-border/40" />

            {/* Destructive Section */}
            <div className="space-y-6">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-red-500/60 px-4">Danger Zone</Label>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full h-20 rounded-3xl border-red-500/10 bg-red-500/5 text-red-500 text-xs font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-95 flex gap-4"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                Delete Workspace
              </Button>
            </div>
          </div>

          <DialogFooter className="relative z-10">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-foreground transition-colors opacity-30 py-4"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpCenterModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <InstagramConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        spaceId={connectSpaceId}
      />
    </div>
  );
};

export default Spaces;