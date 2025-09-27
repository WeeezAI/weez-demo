import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, File, Presentation, ExternalLink } from "lucide-react";

interface DocumentCardProps {
  title: string;
  type: string;
  date: string;
  snippet: string;
  onOpen?: () => void;
  onSummarize?: () => void;
  onCite?: () => void;
}

const getFileIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "presentation":
    case "slides":
      return <Presentation className="w-4 h-4 text-weez-blue" />;
    case "report":
    case "whitepaper":
      return <FileText className="w-4 h-4 text-weez-blue" />;
    default:
      return <File className="w-4 h-4 text-weez-blue" />;
  }
};

const DocumentCard = ({ title, type, date, snippet, onOpen, onSummarize, onCite }: DocumentCardProps) => {
  return (
    <Card className="p-4 bg-weez-card border-weez-blue/20 hover:border-weez-blue/40 transition-colors">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {getFileIcon(type)}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-weez-text text-sm leading-tight">{title}</h4>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                <span className="bg-weez-blue/10 text-weez-blue px-2 py-1 rounded">{type}</span>
                <span>{date}</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-weez-text/80 leading-relaxed line-clamp-2">
          {snippet}
        </p>
        
        <div className="flex items-center space-x-2 pt-2 border-t border-weez-blue/10">
          {onOpen && (
            <Button variant="ghost" size="sm" onClick={onOpen} className="text-weez-blue hover:bg-weez-blue/10">
              <ExternalLink className="w-3 h-3 mr-1" />
              Open
            </Button>
          )}
          {onSummarize && (
            <Button variant="ghost" size="sm" onClick={onSummarize} className="text-weez-blue hover:bg-weez-blue/10">
              Summarize
            </Button>
          )}
          {onCite && (
            <Button variant="ghost" size="sm" onClick={onCite} className="text-weez-blue hover:bg-weez-blue/10">
              Cite
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DocumentCard;