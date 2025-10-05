import { useState } from "react";
import { MessageCircle, Plus, ChevronDown, ChevronRight, Folder, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import KnowledgeBase from "./KnowledgeBase";

interface ConversationSidebarProps {
  onNewChat: () => void;
}

const ConversationSidebar = ({ onNewChat }: ConversationSidebarProps) => {
  const [spaceOpen, setSpaceOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  return (
    <div className="w-full md:w-64 lg:w-72 max-w-[280px] bg-background border-r border-border flex flex-col h-screen">
      <div className="p-4 border-b border-border flex-shrink-0">
        <Button 
          onClick={onNewChat}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 py-4 space-y-4">
          {/* Spaces Section */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Folder className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-foreground text-sm">Spaces</h3>
            </div>
            
            <Collapsible open={spaceOpen} onOpenChange={setSpaceOpen}>
              <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                {spaceOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <Folder className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Dexra Client Space</span>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pl-6 mt-2 space-y-1">
                <Collapsible open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
                  <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                    {knowledgeOpen ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Knowledge Base</span>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-2">
                    <KnowledgeBase />
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Recent Conversations */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-foreground text-sm">Recent Conversations</h3>
            </div>
            <div className="text-sm text-muted-foreground py-8 text-center">
              Start a new conversation to see your chat history here
            </div>
          </div>
        </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          Weez.AI Marketing & Creative Teammate
        </p>
      </div>
    </div>
  );
};

export default ConversationSidebar;