import { FileText, Download, Eye, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FilePreviewCardProps {
  fileName: string;
  fileSize: string;
  fileType: "docx" | "pdf" | "pptx";
  onDownload?: () => void;
  onPreview?: () => void;
}

const FilePreviewCard = ({ fileName, fileSize, fileType, onDownload, onPreview }: FilePreviewCardProps) => {
  const getFileIcon = () => {
    switch (fileType) {
      case "docx":
        return <FileText className="w-6 h-6 text-blue-500" />;
      case "pdf":
        return <File className="w-6 h-6 text-red-500" />;
      case "pptx":
        return <FileText className="w-6 h-6 text-orange-500" />;
      default:
        return <File className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getFileColor = () => {
    switch (fileType) {
      case "docx":
        return "bg-blue-50 border-blue-200";
      case "pdf":
        return "bg-red-50 border-red-200";
      case "pptx":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-muted border-border";
    }
  };

  return (
    <Card className={`p-4 ${getFileColor()} border-2 transition-all hover:shadow-md`}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-border">
          {getFileIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground truncate mb-1">
            {fileName}
          </h4>
          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
            <span className="uppercase font-medium">{fileType}</span>
            <span>•</span>
            <span>{fileSize}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {onPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="h-8 px-3"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
          )}
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="h-8 px-3"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default FilePreviewCard;
