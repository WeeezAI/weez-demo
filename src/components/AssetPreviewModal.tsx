import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AssetPreviewModal = ({ asset, onClose }: any) => {
  const navigate = useNavigate();

  const isImage = asset.file_type.includes("image");
  const isVideo = asset.file_type.includes("video");
  const isPDF = asset.file_type.includes("pdf");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[90%] max-w-2xl p-4 relative">
        {/* Close */}
        <button className="absolute right-4 top-4" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-4">{asset.name}</h2>

        <div className="border rounded-lg p-4 bg-muted max-h-[60vh] overflow-auto">
          {isImage && (
            <img src={asset.download_url} className="max-h-[50vh] mx-auto" />
          )}

          {isVideo && (
            <video controls className="w-full">
              <source src={asset.download_url} />
            </video>
          )}

          {isPDF && (
            <iframe
              src={asset.download_url}
              className="w-full h-[50vh]"
              title="PDF Preview"
            />
          )}

          {!isImage && !isVideo && !isPDF && (
            <div className="text-sm text-muted-foreground">
              Preview not supported — click below to open file.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => window.open(asset.download_url, "_blank")}
          >
            Open File
          </Button>

          <Button
            onClick={() => {
              navigate(`/chat?file_id=${asset.id}`);
            }}
          >
            Ask AI About This File
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssetPreviewModal;
