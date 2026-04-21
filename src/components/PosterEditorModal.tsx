import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Download, Save, Loader2, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import PosterEditor from "./PosterEditor";
import { weezAPI } from "@/services/weezAPI";
import { toast } from "sonner";

interface PosterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  onFinalized?: (assetUrl: string) => void;
}

const PosterEditorModal: React.FC<PosterEditorModalProps> = ({
  isOpen,
  onClose,
  jobId,
  onFinalized,
}) => {
  const [html, setHtml] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1350);
  const [posterIdea, setPosterIdea] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load HTML on open
  useEffect(() => {
    if (isOpen && jobId) {
      loadPosterHtml();
    }
  }, [isOpen, jobId]);

  const loadPosterHtml = async () => {
    setLoading(true);
    try {
      const data = await weezAPI.getPosterHtml(jobId);
      setHtml(data.html);
      setEditedHtml(data.html);
      setWidth(data.width);
      setHeight(data.height);
      setPosterIdea(data.poster_idea || "");
      setHasUnsavedChanges(false);
    } catch (err: any) {
      toast.error("Failed to load poster: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleHtmlChange = useCallback((newHtml: string) => {
    setEditedHtml(newHtml);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await weezAPI.savePosterHtml(jobId, editedHtml);
      setHtml(editedHtml);
      setHasUnsavedChanges(false);
      toast.success("Poster saved!");
    } catch (err) {
      toast.error("Failed to save poster");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      // 1. Save HTML state first if changed
      if (hasUnsavedChanges) {
        await weezAPI.savePosterHtml(jobId, editedHtml);
      }

      // 2. Capture using off-screen clone approach
      //    This avoids the createPattern error caused by CSS transforms on the live element.
      //    We create a hidden container at the poster's FULL pixel dimensions (no scaling),
      //    inject the clean HTML, and run html2canvas on that instead.
      const { default: html2canvas } = await import("html2canvas");

      // Get the current HTML from the live editor (includes user edits)
      const liveRoot = document.querySelector("[data-poster-root]") as HTMLElement;
      const captureHtml = liveRoot ? liveRoot.innerHTML : (editedHtml || html);

      // Create off-screen container at full poster dimensions
      const offscreen = document.createElement("div");
      offscreen.style.position = "fixed";
      offscreen.style.left = "-99999px";
      offscreen.style.top = "0";
      offscreen.style.width = `${width}px`;
      offscreen.style.height = `${height}px`;
      offscreen.style.overflow = "hidden";
      offscreen.style.zIndex = "-1";
      offscreen.innerHTML = captureHtml;

      // Remove any contenteditable attributes from the clone
      offscreen.querySelectorAll("[contenteditable]").forEach((el) => {
        el.removeAttribute("contenteditable");
      });

      document.body.appendChild(offscreen);

      // Wait for fonts/SVGs to render in the clone
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(offscreen, {
        width,
        height,
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      // Clean up the off-screen element
      document.body.removeChild(offscreen);

      const pngBase64 = canvas.toDataURL("image/png");

      // 3. Upload PNG to backend
      const result = await weezAPI.finalizePoster(jobId, pngBase64);
      toast.success("Design finalized and published!");
      onFinalized?.(result.asset_url);
      onClose();
    } catch (err: any) {
      console.error("Finalize failed:", err);
      toast.error("Failed to finalize: " + (err?.message || "Unknown error"));
    } finally {
      setFinalizing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(40px)",
      }}
    >
      {/* Header */}
      <div className="h-20 flex items-center justify-between px-8 z-10 border-b border-white/5"
        style={{
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/20 flex items-center justify-center border border-violet-500/30">
            <Palette className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-xs uppercase tracking-widest">Visual Studio</h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">{posterIdea || "Brand Asset Editor"}</p>
          </div>
          {hasUnsavedChanges && (
            <div className="ml-4 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
              Modified
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
              hasUnsavedChanges
                ? "bg-white/5 hover:bg-white/10 text-white border border-white/20"
                : "bg-white/5 text-white/20 cursor-not-allowed opacity-50"
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Progress
          </button>

          {/* Finalize & Publish Button */}
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 bg-gradient-to-r from-violet-600 to-indigo-600 hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] text-white disabled:opacity-50 disabled:scale-100"
          >
            {finalizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {finalizing ? "Processing..." : "Finalize & Sync"}
          </button>

          <div className="w-px h-6 bg-white/10 mx-2" />

          {/* Close */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all duration-300 group"
          >
            <X className="w-5 h-5 text-white/40 group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ padding: "40px" }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Calibrating Studio</p>
          </div>
        ) : html ? (
          <div className="w-full h-full flex items-center justify-center">
            <PosterEditor
              html={editedHtml || html}
              width={width}
              height={height}
              onHtmlChange={handleHtmlChange}
              editable={true}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 opacity-20">
             <Palette className="w-12 h-12 text-white" />
             <p className="text-white text-[10px] font-black uppercase tracking-widest">No Canvas Data</p>
          </div>
        )}
        
        {/* Subtle Hint */}
        {!loading && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/20 text-[9px] font-black uppercase tracking-[0.4em] pointer-events-none">
            Click text to edit · Full Fidelity
          </div>
        )}
      </div>
    </div>
  );
};

export default PosterEditorModal;
