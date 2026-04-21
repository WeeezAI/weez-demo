import React, { useRef, useEffect, useState, useCallback } from "react";

interface PosterEditorProps {
  html: string;
  width: number;
  height: number;
  onHtmlChange?: (html: string) => void;
  onCapture?: (pngBase64: string) => void;
  editable?: boolean;
}

const PosterEditor: React.FC<PosterEditorProps> = ({
  html,
  width,
  height,
  onHtmlChange,
  onCapture,
  editable = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const posterRootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Track the HTML we actually rendered to prevent focus-losing re-renders
  const lastProcessedHtml = useRef<string>("");

  // Calculate scale to fit the poster in the available container
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const maxW = parent.clientWidth - 80;
          const maxH = parent.clientHeight - 80;
          const s = Math.min(maxW / width, maxH / height, 1);
          setScale(Math.max(s, 0.1)); // Never go to 0
        }
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const timer = setTimeout(updateScale, 150);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timer);
    };
  }, [width, height]);

  // Handle HTML rendering with focus preservation
  useEffect(() => {
    if (posterRootRef.current) {
      const targetHtml = editable
        ? html.replace(
            /data-field="([^"]+)"/g,
            'data-field="$1" contenteditable="true" style="outline: none; cursor: text;"'
          )
        : html;

      if (targetHtml !== lastProcessedHtml.current) {
        posterRootRef.current.innerHTML = targetHtml;
        lastProcessedHtml.current = targetHtml;
      }
    }
  }, [html, editable]);

  // Capture edits from the rendered HTML
  const handleInput = useCallback((e: React.FormEvent) => {
    if (posterRootRef.current && onHtmlChange) {
      const currentHtml = posterRootRef.current.innerHTML;
      
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = currentHtml;
      
      tempDiv.querySelectorAll("[contenteditable]").forEach((el) => {
        el.removeAttribute("contenteditable");
        const style = (el as HTMLElement).getAttribute("style") || "";
        (el as HTMLElement).setAttribute(
          "style",
          style.replace(/outline:\s*none;\s*/g, "").replace(/cursor:\s*text;\s*/g, "")
        );
      });

      const cleanedHtml = tempDiv.innerHTML;
      lastProcessedHtml.current = currentHtml;
      onHtmlChange(cleanedHtml);
    }
  }, [onHtmlChange]);

  // Expose capture function via ref — this is used by PosterEditorModal's finalize
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__captureAsPng = async () => {
        // Not used directly anymore — modal does its own capture
      };
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="poster-editor-container"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          borderRadius: "4px",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.1)",
          flexShrink: 0,
        }}
      >
        {/* The poster itself — rendered directly to DOM to preserve focus */}
        <div
          ref={posterRootRef}
          data-poster-root=""
          onInput={handleInput}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            position: "absolute",
            top: 0,
            left: 0,
            overflow: "hidden",
          }}
        />
      </div>

      {isCapturing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            zIndex: 50,
          }}
        >
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <div style={{ color: "#fff", fontSize: "16px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Finalizing Design
          </div>
        </div>
      )}
    </div>
  );
};

export default PosterEditor;
export { PosterEditor };
export type { PosterEditorProps };
