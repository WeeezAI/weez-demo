// src/components/ProcessingDetailsModal.tsx

import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, Clock, AlertCircle, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  metadataAPI,
  ProcessingProgress,
  JobError,
  JobAsset,
  formatTimeRemaining,
  getStatusIcon,
} from "@/services/metadataAPI";

interface ProcessingDetailsModalProps {
  jobId: string;
  open: boolean;
  onClose: () => void;
}

const ProcessingDetailsModal: React.FC<ProcessingDetailsModalProps> = ({
  jobId,
  open,
  onClose,
}) => {
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [errors, setErrors] = useState<JobError[]>([]);
  const [assets, setAssets] = useState<JobAsset[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // -------------------------
  // FETCH DATA
  // -------------------------
  const fetchData = async () => {
    try {
      const [progressData, errorsData, assetsData] = await Promise.all([
        metadataAPI.getProcessingProgress(jobId),
        metadataAPI.getJobErrors(jobId, 100),
        metadataAPI.getJobAssets(jobId),
      ]);

      setProgress(progressData);
      setErrors(errorsData.errors);
      setAssets(assetsData.assets);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch job details:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && jobId) {
      fetchData();

      // Poll for updates if not complete
      const interval = setInterval(() => {
        if (progress && !progress.is_complete) {
          fetchData();
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [open, jobId, progress?.is_complete]);

  // -------------------------
  // EXPORT ERRORS AS CSV
  // -------------------------
  const exportErrors = () => {
    if (errors.length === 0) return;

    const csvContent = [
      ["File Name", "Error Type", "Error Message", "Occurred At"],
      ...errors.map((err) => [
        err.file_name,
        err.error_type,
        err.error_message,
        err.occurred_at,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId}-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !progress) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const successRate =
    progress.total_assets > 0
      ? ((progress.succeeded / progress.total_assets) * 100).toFixed(1)
      : "0.0";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        {/* HEADER */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span className="text-2xl">{getStatusIcon(progress.status)}</span>
              <div>
                <div>Processing Details</div>
                <div className="text-sm font-normal text-gray-500">
                  Job ID: {jobId.slice(0, 20)}...
                </div>
              </div>
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* PROGRESS SECTION */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="space-y-3">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">
                  {progress.processed} / {progress.total_assets} processed
                </span>
                <span className="font-bold text-gray-900">
                  {progress.progress_percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={progress.progress_percentage} className="h-3" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {progress.succeeded}
                    </div>
                    <div className="text-xs text-gray-600">Succeeded</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {progress.failed}
                    </div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      {progress.skipped}
                    </div>
                    <div className="text-xs text-gray-600">Skipped</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {successRate}%
                    </div>
                    <div className="text-xs text-gray-600">Success Rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current File & Time Remaining */}
            <div className="flex items-center justify-between text-sm">
              {progress.current_file && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-blue-600 font-medium">Processing:</span>
                  <span className="text-gray-700 truncate">
                    {progress.current_file}
                  </span>
                </div>
              )}
              {progress.estimated_time_remaining !== null &&
                !progress.is_complete && (
                  <div className="text-gray-600 flex-shrink-0">
                    ⏱️ {formatTimeRemaining(progress.estimated_time_remaining)}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 border-b">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assets">
                Assets ({assets.length})
              </TabsTrigger>
              <TabsTrigger value="errors">
                Errors ({errors.length})
                {errors.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                    {errors.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="px-6 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoCard label="Status" value={progress.status.toUpperCase()} />
                <InfoCard
                  label="Total Assets"
                  value={progress.total_assets.toString()}
                />
                <InfoCard
                  label="Processed"
                  value={`${progress.processed} (${progress.progress_percentage.toFixed(1)}%)`}
                />
                <InfoCard
                  label="Success Rate"
                  value={`${successRate}%`}
                />
              </div>

              {progress.is_complete && (
                <div
                  className={`p-4 rounded-lg text-center font-medium ${
                    progress.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : progress.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-orange-100 text-orange-800"
                  }`}
                >
                  {progress.status === "completed" && "🎉 Processing completed successfully!"}
                  {progress.status === "failed" && "❌ Processing failed"}
                  {progress.status === "partially_completed" &&
                    "⚠️ Processing completed with some errors"}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="p-0">
            <ScrollArea className="h-[400px] px-6">
              <div className="space-y-2 py-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className={`p-3 rounded-lg border ${getAssetStatusColor(
                      asset.status
                    )}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getAssetStatusIcon(asset.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {asset.file_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {asset.status.toUpperCase()}
                            {asset.indexed_to_pinecone && (
                              <span className="ml-2 text-green-600">• Indexed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {asset.error_message && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        {asset.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ERRORS TAB */}
          <TabsContent value="errors" className="p-0">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {errors.length} error{errors.length !== 1 ? "s" : ""} found
              </div>
              {errors.length > 0 && (
                <Button
                  onClick={exportErrors}
                  size="sm"
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px] px-6">
              <div className="space-y-3 py-4">
                {errors.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p>No errors found!</p>
                  </div>
                ) : (
                  errors.map((error) => (
                    <div
                      key={error.id}
                      className="p-4 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-red-800 mb-1">
                            {error.file_name}
                          </div>
                          <div className="text-xs text-red-600 mb-2">
                            {error.error_type}
                          </div>
                          <div className="text-sm text-gray-700 bg-white p-2 rounded">
                            {error.error_message}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(error.occurred_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Helper Components
const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="p-4 bg-gray-50 rounded-lg border">
    <div className="text-xs text-gray-600 mb-1">{label}</div>
    <div className="text-lg font-semibold text-gray-900">{value}</div>
  </div>
);

const getAssetStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200";
    case "failed":
      return "bg-red-50 border-red-200";
    case "processing":
      return "bg-blue-50 border-blue-200";
    case "skipped":
      return "bg-yellow-50 border-yellow-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
};

const getAssetStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-600" />;
    case "processing":
      return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
    case "skipped":
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    default:
      return <Clock className="w-5 h-5 text-gray-600" />;
  }
};

export default ProcessingDetailsModal;