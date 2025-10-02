import { FileText, Image, Video, File } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface Asset {
  id: string;
  name: string;
  type: "image" | "video" | "document";
  size: string;
  date: string;
}

const demoAssets: Asset[] = [
  { id: "1", name: "Brand_Guidelines_2024.pdf", type: "document", size: "4.2 MB", date: "2024-01-15" },
  { id: "2", name: "Q4_Campaign_Hero.jpg", type: "image", size: "2.1 MB", date: "2024-01-14" },
  { id: "3", name: "Product_Launch_Video.mp4", type: "video", size: "45 MB", date: "2024-01-13" },
  { id: "4", name: "Social_Media_Assets.zip", type: "document", size: "12 MB", date: "2024-01-12" },
  { id: "5", name: "Partnership_Deck.pptx", type: "document", size: "8.5 MB", date: "2024-01-11" },
  { id: "6", name: "Instagram_Story_Template.png", type: "image", size: "1.2 MB", date: "2024-01-10" },
  { id: "7", name: "Brand_Story_Video.mp4", type: "video", size: "38 MB", date: "2024-01-09" },
  { id: "8", name: "Campaign_Brief_Q1.docx", type: "document", size: "890 KB", date: "2024-01-08" },
];

const KnowledgeBase = () => {
  const getAssetIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="w-4 h-4 text-green-600" />;
      case "video":
        return <Video className="w-4 h-4 text-purple-600" />;
      case "document":
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAssetColor = (type: string) => {
    switch (type) {
      case "image":
        return "bg-green-50 border-green-200";
      case "video":
        return "bg-purple-50 border-purple-200";
      case "document":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-muted border-border";
    }
  };

  return (
    <div className="px-4 pb-4">
      <div className="mb-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          {demoAssets.length} assets
        </div>
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-3">
          {demoAssets.map((asset) => (
            <Card
              key={asset.id}
              className={`p-3 ${getAssetColor(asset.type)} border cursor-pointer hover:shadow-sm transition-all`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-white rounded flex items-center justify-center border border-border">
                  {getAssetIcon(asset.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {asset.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {asset.size}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default KnowledgeBase;
