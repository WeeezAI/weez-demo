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
    navigate(`/one-click-post/${space.id}`);
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
      <header className="sticky top-0 z-50 backdrop-blur-3xl bg-white/60 border-b border-border/40">
        <div className="max-w-[1400px] mx-auto px-10 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src={logo} alt="Weez AI" className="h-10 w-auto" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 mt-1.5">The Autonomous Marketing Workforce</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-4 cursor-pointer group hover:opacity-80 transition-opacity">
                  {user && (
                    <div className="hidden md:flex items-center gap-4 pr-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40 leading-none">System User</span>
                        <span className="text-sm font-bold text-foreground mt-1">{user.name}</span>
                      </div>
                      <div className="w-10 h-10 rounded-[1.2rem] bg-secondary flex items-center justify-center border border-border/50 group-hover:border-primary/30 transition-colors">
                        <span className="text-xs font-black italic opacity-40">{user.name?.charAt(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 bg-white/80 backdrop-blur-xl border-border/50 shadow-xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2 py-1.5">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem className="cursor-pointer rounded-xl font-medium text-xs py-2.5 focus:bg-secondary" onClick={() => navigate("/plans")}>
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  Upgrade to Premium
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/30" />
                <DropdownMenuItem className="cursor-pointer rounded-xl font-medium text-xs py-2.5 focus:bg-red-500/10 focus:text-red-600 text-red-500" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="w-10 h-10 rounded-[1.2rem] bg-white border border-border/50 flex items-center justify-center cursor-pointer hover:bg-secondary transition-all shadow-sm">
                  <Menu className="w-5 h-5 text-foreground opacity-60" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 bg-white/80 backdrop-blur-xl border-border/50 shadow-xl mt-2">
                <DropdownMenuItem className="cursor-pointer rounded-xl font-medium text-xs py-2.5 focus:bg-secondary mb-1" onClick={() => navigate("/plans")}>
                  <Sparkles className="w-4 h-4 mr-3 text-primary" />
                  Upgrade to Premium
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/30 my-1" />
                <DropdownMenuItem className="cursor-pointer rounded-xl font-medium text-xs py-2.5 focus:bg-secondary" onClick={() => setIsHelpOpen(true)}>
                  <HelpCircle className="w-4 h-4 mr-3 text-muted-foreground" />
                  Help Center
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer rounded-xl font-medium text-xs py-2.5 focus:bg-secondary" onClick={() => setIsHelpOpen(true)}>
                  <LifeBuoy className="w-4 h-4 mr-3 text-muted-foreground" />
                  Support
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-[1400px] mx-auto px-10 pt-20 pb-32">
        <div className="mb-20 space-y-6">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest border-none px-3 py-1">Your Spaces</Badge>
            <div className="h-px w-20 bg-border/50" />
          </div>
          <h2 className="text-6xl font-black tracking-tighter leading-[0.85] text-foreground">
            Project <br />
            <span className="text-muted-foreground/30">Dashboard.</span>
          </h2>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
            <p className="text-lg font-medium text-muted-foreground max-w-xl leading-relaxed">
              Select or create a new project to start creating content for your brand.
            </p>
            <Button
              variant="outline"
              className="h-16 px-10 rounded-2xl border-border bg-white text-xs font-black uppercase tracking-[0.2em] gap-3 shadow-xl shadow-black/[0.02] hover:bg-secondary active:scale-95 transition-all"
              onClick={handleNewSpaceClick}
              disabled={isFetchingSpaces}
            >
              <Plus className="w-4 h-4" />
              New Space
            </Button>
          </div>
        </div>

        {/* Workspace Display with Cinematic Loading */}
        {isFetchingSpaces ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[1.4/1] bg-white rounded-[4rem] border-2 border-dashed border-accent/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent animate-scan" />
                <div className="h-full w-full flex flex-col items-center justify-center gap-6 opacity-30">
                  <div className="w-16 h-16 rounded-[2rem] bg-secondary flex items-center justify-center">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Loading 0{i}</span>
                </div>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 bg-white rounded-[5rem] text-center gap-10 shadow-2xl shadow-black/[0.01]">
            <div className="w-24 h-24 rounded-[3rem] bg-secondary flex items-center justify-center relative">
              <Globe className="w-10 h-10 text-muted-foreground opacity-20" />
              <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-[3rem] animate-spin duration-[10s]" />
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black tracking-tight uppercase">No Spaces found.</h3>
              <p className="text-muted-foreground max-w-sm font-medium leading-relaxed opacity-60">Create your first space to start your journey.</p>
            </div>
            <Button
              size="lg"
              onClick={handleNewSpaceClick}
              className="h-16 px-12 rounded-[2rem] bg-primary text-white font-black uppercase tracking-widest text-[11px] hover:bg-accent transition-all shadow-2xl shadow-primary/20"
            >
              New Space
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="group relative border-none bg-white hover:bg-white hover:shadow-[0_80px_120px_rgba(139,92,246,0.08)] rounded-[4rem] transition-all duration-700 overflow-hidden flex flex-col min-h-[400px] p-12 cursor-pointer"
                onClick={() => handleSpaceClick(space)}
              >
                {/* Visual Identity Block */}
                <div className="flex justify-between items-start mb-16">
                  <div className="w-24 h-24 rounded-[2.8rem] bg-secondary group-hover:bg-primary flex items-center justify-center transition-all duration-700 shadow-sm border border-border/50">
                    <BrainCircuit className="w-10 h-10 text-primary group-hover:text-white transition-all duration-700" />
                  </div>
                  <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:animate-ping" />
                    <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">Active</span>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30 leading-none">Space_0{spaces.indexOf(space) + 1}</div>
                  <h3 className="text-5xl font-black tracking-tighter leading-tight group-hover:text-primary transition-colors duration-500 uppercase">
                    {space.name}.
                  </h3>
                </div>

                {/* Tactical Actions */}
                <div className="mt-12 flex items-center justify-between pt-10 border-t border-border/40">
                  <div className="flex gap-4">
                    <button
                      className="w-12 h-12 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:border-primary group/action transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        const authUrl = weezAPI.getInstagramAuthUrl(space.id);
                        window.location.href = authUrl;
                      }}
                      title="Sync Signal"
                    >
                      <Database className="w-4 h-4 text-muted-foreground group-hover/action:text-white" />
                    </button>
                    <button
                      className="w-12 h-12 rounded-full border border-border flex items-center justify-center hover:bg-foreground hover:border-foreground group/action transition-all"
                      onClick={(e) => handleOpenSettings(e, space)}
                      title="Space Settings"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground group-hover/action:text-white" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 group/enter">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500">Open Space</span>
                    <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center transition-all group-hover:bg-primary shadow-sm border border-border/40">
                      <ChevronRight className="w-6 h-6 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 p-10 opacity-0 group-hover:opacity-5 transition-opacity">
                  <Zap className="w-48 h-48 rotate-12" />
                </div>
              </Card>
            ))}

            {canCreateSpace && (
              <button
                className="group relative bg-transparent border-2 border-dashed border-accent/20 hover:border-primary/40 rounded-[4rem] p-12 transition-all duration-700 flex flex-col items-center justify-center gap-14 min-h-[400px]"
                onClick={handleNewSpaceClick}
              >
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-all duration-500 border border-border/40">
                  <Plus className="w-10 h-10 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="text-center space-y-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-40">Assemble New project</span>
                  <h4 className="text-3xl font-black tracking-tight uppercase">New Space</h4>
                </div>
              </button>
            )}
          </div>
        )}

        {/* System Diagnostics Footer */}
        <div className="mt-40 pt-12 border-t border-border/40 flex items-center justify-between opacity-30 grayscale active:grayscale-0 transition-all cursor-crosshair">
          <div className="flex items-center gap-5">
            <Zap className="w-6 h-6 fill-primary text-primary" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black tracking-[0.3em]">WEEZ_AI_OS_GRID_STABLE</span>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">v2.4.0 // SECURE VAULT ACTIVE</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-14">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black tracking-[0.2em] text-emerald-500 uppercase">Vault Response</span>
              <span className="text-[11px] font-mono">AUTHORIZED 🟢</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black tracking-[0.2em] text-blue-500 uppercase">Node Throughput</span>
              <span className="text-[11px] font-mono">92% SYNC</span>
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
    </div>
  );
};

export default Spaces;