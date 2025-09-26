import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, Search, User, Settings } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export default function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return `${Math.floor(diffInHours / 24)} days ago`;
    }
  };

  return (
    <div className="bg-card border-r border-border flex flex-col h-full" data-testid="sidebar-conversation">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground" data-testid="text-conversations-title">
            Conversations
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewConversation}
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2" data-testid="list-conversations">
        {filteredConversations.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p data-testid="text-no-conversations">No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 rounded-md cursor-pointer mb-2 transition-colors group hover:bg-accent ${
                currentConversationId === conversation.id ? "bg-accent" : ""
              }`}
              onClick={() => onSelectConversation(conversation.id)}
              data-testid={`conversation-item-${conversation.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground truncate" data-testid={`text-conversation-title-${conversation.id}`}>
                    {conversation.title}
                  </h3>
                  <span className="text-xs text-muted-foreground" data-testid={`text-conversation-time-${conversation.id}`}>
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="ml-2 flex items-center space-x-1">
                  {currentConversationId === conversation.id && (
                    <span className="w-2 h-2 bg-primary rounded-full" data-testid={`indicator-active-${conversation.id}`} />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    data-testid={`button-delete-conversation-${conversation.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </AvatarFallback>
            <AvatarFallback>AU</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
              Admin User
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-user-role">
              Security Engineer
            </p>
          </div>
          <Button variant="ghost" size="icon" data-testid="button-user-settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
