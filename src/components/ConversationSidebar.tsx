import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationSidebarProps {
  onNewChat: () => void;
}

const ConversationSidebar = ({ onNewChat }: ConversationSidebarProps) => {
  return (
    <div className="w-64 h-full bg-background border-r border-border flex flex-col">
      <div className="p-4">
        <Button 
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-sm">Recent Conversations</h3>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1 pb-4">
          <div className="text-sm text-muted-foreground py-8 text-center">
            Start a new conversation to see your chat history here
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Weez.AI Marketing & Creative Teammate
        </p>
      </div>
    </div>
  );
};

export default ConversationSidebar;