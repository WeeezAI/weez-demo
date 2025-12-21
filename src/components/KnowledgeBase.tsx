import { useEffect, useState } from "react";
import { FileText, Image, Video, File, RefreshCcw, Play, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import AssetPreviewModal from "./AssetPreviewModal";
import ProcessingDetailsModal from "./ProcessingDetailsModal";
import { toast } from "sonner";
import { 
  metadataAPI, 
  ProcessingProgress,
  formatTimeRemaining,
  getStatusIcon 
} from "@/services/metadataAPI";

const PLATFORM_BACKEND = "https://dexraflow-platform-connection-hrd4akh9eqgeeqe9.canadacentral-01.azurewebsites.net";

interface Asset {
  id: string;
  file_name: string;
  mime_type: string;
  blob_url?: string;
  download_url?: string;
  size?: number;
  metadata?: any;
}

const KnowledgeBase = () => {
  const { currentSpace, token } = useAuth() as any;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------
  // PROCESSING STATE
  // -------------------------
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProgressCard, setShowProgressCard] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // -------------------------
  // ICON SELECTOR
  // -------------------------
  const getAssetIcon = (mime: string) => {
    if (!mime) return <File className="w-4 h-4 text-muted-foreground" />;

    if (mime.includes("image")) return <Image className="w-4 h-4 text-green-600" />;
    if (mime.includes("video")) return <Video className="w-4 h-4 text-purple-600" />;
    if (mime.includes("pdf") || mime.includes("text") || mime.includes("document"))
      return <FileText className="w-4 h-4 text-blue-600" />;

    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  // -------------------------
  // CARD COLOR STYLES
  // -------------------------
  const getAssetColor = (mime: string) => {
    if (!mime) return "bg-muted border-border";

    if (mime.includes("image")) return "bg-green-50 border-green-200";
    if (mime.includes("video")) return "bg-purple-50 border-purple-200";
    if (mime.includes("pdf") || mime.includes("document"))
      return "bg-blue-50 border-blue-200";

    return "bg-muted border-border";
  };

  // -------------------------
  // LOAD ASSETS FROM BACKEND
  // -------------------------
  const fetchAssets = async () => {
    if (!currentSpace || !token) return;

    setLoading(true);

    try {
      const res = await fetch(`${PLATFORM_BACKEND}/assets/${currentSpace.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setAssets(data.files || []);
    } catch (err) {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh button handler
  const refreshAssets = async () => {
    setRefreshing(true);
    await fetchAssets();
    setRefreshing(false);
    toast.success("Assets refreshed!");
  };

  // -------------------------
  // START PROCESSING ALL ASSETS
  // -------------------------
  const startProcessing = async () => {
    if (!currentSpace) {
      toast.error("No space selected");
      return;
    }

    try {
      setIsProcessing(true);
      setShowProgressCard(true);
      
      const result = await metadataAPI.processAll(currentSpace.id, true);
      
      setProcessingJobId(result.job_id);
      toast.success("Processing started!");
      
      // Start polling for progress
      pollProgress(result.job_id);
    } catch (err) {
      toast.error("Failed to start processing");
      console.error(err);
      setIsProcessing(false);
      setShowProgressCard(false);
    }
  };

  // -------------------------
  // POLL FOR PROGRESS
  // -------------------------
  const pollProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const progress = await metadataAPI.getProcessingProgress(jobId);
        setProcessingProgress(progress);

        // Check if complete
        if (progress.is_complete) {
          setIsProcessing(false);
          
          if (progress.status === "completed") {
            toast.success("🎉 Processing completed successfully!");
          } else if (progress.status === "failed") {
            toast.error("❌ Processing failed");
          } else if (progress.status === "partially_completed") {
            toast.warning("⚠️ Processing completed with some errors");
          }
          
          // Refresh assets after completion
          await fetchAssets();
          
          return; // Stop polling
        }

        // Continue polling if not complete
        setTimeout(poll, 2000);
      } catch (err) {
        console.error("Failed to fetch progress:", err);
        setIsProcessing(false);
        toast.error("Failed to track progress");
      }
    };

    poll();
  };

  // -------------------------
  // CHECK FOR ACTIVE JOBS ON MOUNT
  // -------------------------
  const checkActiveJobs = async () => {
    if (!currentSpace) return;

    try {
      const { jobs } = await metadataAPI.getSpaceJobs(currentSpace.id, 1);
      
      if (jobs.length > 0) {
        const latestJob = jobs[0];
        
        // If the latest job is still processing, resume tracking
        if (latestJob.status === "pending" || latestJob.status === "processing") {
          setProcessingJobId(latestJob.job_id);
          setShowProgressCard(true);
          setIsProcessing(true);
          pollProgress(latestJob.job_id);
        }
      }
    } catch (err) {
      console.error("Failed to check active jobs:", err);
    }
  };

  // -------------------------
  // LOAD ON MOUNT OR SPACE CHANGE
  // -------------------------
  useEffect(() => {
    fetchAssets();
    checkActiveJobs();
  }, [currentSpace]);

  // -------------------------
  // GET PROGRESS STATUS COLOR
  // -------------------------
  const getProgressColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500";
      case "pending":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      case "partially_completed":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  // -------------------------
  // EMPTY STATE / LOADING UI
  // -------------------------
  if (!currentSpace) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No space selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading assets...
      </div>
    );
  }

  return (
    <div className="pl-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-muted-foreground">
          {assets.length} assets
        </div>

        <div className="flex items-center gap-2">
          {/* START PROCESSING BUTTON */}
          <Button
            onClick={startProcessing}
            disabled={isProcessing || assets.length === 0}
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
          >
            <Play className="w-3 h-3 mr-1" />
            {isProcessing ? "Processing..." : "Process All"}
          </Button>

          {/* REFRESH BUTTON */}
          <button
            onClick={refreshAssets}
            className="text-xs flex items-center gap-1 px-2 py-1 border rounded hover:bg-accent transition h-7"
            disabled={refreshing}
          >
            <RefreshCcw className="w-3 h-3" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* PROCESSING PROGRESS CARD */}
      {showProgressCard && processingProgress && (
        <Card className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStatusIcon(processingProgress.status)}</span>
                <span className="text-xs font-semibold text-gray-700">
                  Processing Assets
                </span>
              </div>
              <button
                onClick={() => setShowProgressCard(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>
                  {processingProgress.processed} / {processingProgress.total_assets}
                </span>
                <span className="font-semibold">
                  {processingProgress.progress_percentage.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={processingProgress.progress_percentage} 
                className="h-2"
              />
            </div>

            {/* Current File */}
            {processingProgress.current_file && (
              <div className="bg-white/60 rounded px-2 py-1">
                <p className="text-[10px] text-blue-600 font-medium">
                  Currently Processing
                </p>
                <p className="text-xs text-gray-700 truncate">
                  {processingProgress.current_file}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/60 rounded px-2 py-1">
                <div className="text-sm font-bold text-green-600">
                  {processingProgress.succeeded}
                </div>
                <div className="text-[10px] text-gray-600">Succeeded</div>
              </div>
              <div className="bg-white/60 rounded px-2 py-1">
                <div className="text-sm font-bold text-red-600">
                  {processingProgress.failed}
                </div>
                <div className="text-[10px] text-gray-600">Failed</div>
              </div>
              <div className="bg-white/60 rounded px-2 py-1">
                <div className="text-sm font-bold text-yellow-600">
                  {processingProgress.skipped}
                </div>
                <div className="text-[10px] text-gray-600">Skipped</div>
              </div>
            </div>

            {/* Time Remaining */}
            {processingProgress.estimated_time_remaining !== null && 
             !processingProgress.is_complete && (
              <div className="text-center text-xs text-gray-600">
                ⏱️ Est. {formatTimeRemaining(processingProgress.estimated_time_remaining)}
              </div>
            )}

            {/* Completion Message */}
            {processingProgress.is_complete && (
              <div className={`text-center text-xs font-medium py-1 rounded ${
                processingProgress.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : processingProgress.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-orange-100 text-orange-800"
              }`}>
                {processingProgress.status === "completed" && "🎉 Complete!"}
                {processingProgress.status === "failed" && "❌ Failed"}
                {processingProgress.status === "partially_completed" && "⚠️ Completed with errors"}
              </div>
            )}

            {/* View Details Link */}
            <div className="text-center">
              <button
                onClick={() => setShowDetailsModal(true)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                View Details
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* WARNING FOR NO ASSETS */}
      {assets.length === 0 && (
        <Card className="mb-3 p-3 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <p className="font-medium mb-1">No assets found</p>
              <p className="text-[11px]">
                Connect a platform → choose folders → sync files to get started.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ASSET LIST */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-3">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className={`p-2 ${getAssetColor(
                asset.mime_type
              )} border cursor-pointer hover:shadow-sm transition-all`}
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-white rounded flex items-center justify-center border border-border">
                  {getAssetIcon(asset.mime_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {asset.file_name}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* PREVIEW MODAL */}
      {selectedAsset && (
        <AssetPreviewModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {/* PROCESSING DETAILS MODAL */}
      {processingJobId && (
        <ProcessingDetailsModal
          jobId={processingJobId}
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default KnowledgeBase;