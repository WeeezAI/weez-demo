import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Plus, ChevronDown, ChevronRight, BookOpen, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import KnowledgeBase from "./KnowledgeBase";
import { useAuth } from "@/contexts/AuthContext";

interface ConversationSidebarProps {
  onNewChat: () => void;
}

const ConversationSidebar = ({ onNewChat }: ConversationSidebarProps) => {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const { exitSpace } = useAuth();
  const navigate = useNavigate();

  const demoUsers = [
    { id: "1", name: "Sarah Johnson", role: "Marketing Lead", avatar: "SJ" },
    { id: "2", name: "Mike Chen", role: "Creative Director", avatar: "MC" },
    { id: "3", name: "Emily Davis", role: "Content Manager", avatar: "ED" },
    { id: "4", name: "James Wilson", role: "Designer", avatar: "JW" },
  ];

  const handleBackToSpaces = () => {
    exitSpace();
    navigate("/spaces");
  };

  return (
    <div className="w-full md:w-64 lg:w-72 bg-background border-r border-border flex flex-col h-screen flex-shrink-0">
      <div className="p-4 border-b border-border flex-shrink-0 space-y-3">
        <Button 
          variant="ghost"
          onClick={handleBackToSpaces}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Spaces
        </Button>
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
            {/* Knowledge Base Section */}
            <Collapsible open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
              <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                {knowledgeOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Knowledge Base</span>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2 pl-6">
                <KnowledgeBase />
              </CollapsibleContent>
            </Collapsible>

            {/* Users Section */}
            <Collapsible open={usersOpen} onOpenChange={setUsersOpen}>
              <CollapsibleTrigger className="flex items-center space-x-2 w-full p-2 hover:bg-muted rounded-md transition-colors">
                {usersOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Users</span>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="pl-6">
                  <div className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {demoUsers.length} members
                    </div>
                  </div>
                  <div className="space-y-2">
                    {demoUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md transition-colors cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-medium text-primary">{user.avatar}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {user.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Recent Conversations */}
            <div>
              <div className="flex items-center space-x-2 mb-2 p-2">
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
          Weez.AI - Future of Digital Marketing
        </p>
      </div>
    </div>
  );
};

export default ConversationSidebar;
