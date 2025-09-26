import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Menu, 
  Bot, 
  Info, 
  Trash2, 
  Send, 
  Paperclip,
  Copy,
  ThumbsUp,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: any;
}

interface ChatAreaProps {
  conversationId: string | null;
  isConnected: boolean;
  onToggleSidebar: () => void;
  onToggleContext: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

export default function ChatArea({
  conversationId,
  isConnected,
  onToggleSidebar,
  onToggleContext,
  emit,
  on,
  off,
}: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Fetch messages for current conversation
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  // Sync fetched messages with local state
  useEffect(() => {
    if (messages && Array.isArray(messages)) {
      setLocalMessages(messages);
    } else {
      setLocalMessages([]);
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingContent]);

  // WebSocket event handlers
  useEffect(() => {
    const handleUserMessage = (msg: Message) => {
      setLocalMessages(prev => [...prev, msg]);
    };

    const handleStreamStart = () => {
      setIsStreaming(true);
      setStreamingContent("");
    };

    const handleStreamChunk = (data: { chunk: string }) => {
      setStreamingContent(prev => prev + data.chunk);
    };

    const handleStreamComplete = (data: { message: Message }) => {
      setIsStreaming(false);
      setStreamingContent("");
      setLocalMessages(prev => [...prev, data.message]);
    };

    const handleStreamError = (data: { error: string }) => {
      setIsStreaming(false);
      setStreamingContent("");
      toast({
        title: "Error",
        description: data.error,
        variant: "destructive",
      });
    };

    const handleChatError = (data: { error: string }) => {
      toast({
        title: "Chat Error",
        description: data.error,
        variant: "destructive",
      });
    };

    on("chat:userMessage", handleUserMessage);
    on("chat:streamStart", handleStreamStart);
    on("chat:streamChunk", handleStreamChunk);
    on("chat:streamComplete", handleStreamComplete);
    on("chat:streamError", handleStreamError);
    on("chat:error", handleChatError);

    return () => {
      off("chat:userMessage", handleUserMessage);
      off("chat:streamStart", handleStreamStart);
      off("chat:streamChunk", handleStreamChunk);
      off("chat:streamComplete", handleStreamComplete);
      off("chat:streamError", handleStreamError);
      off("chat:error", handleChatError);
    };
  }, [on, off, toast]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = () => {
    if (!message.trim() || !conversationId || !isConnected) return;

    emit("chat:stream", {
      message: message.trim(),
      conversationId,
      includeContext: true,
    });

    setMessage("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleQuickAction = (action: string) => {
    if (!conversationId || !isConnected) return;

    emit("chat:quickAction", {
      action,
      conversationId,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Welcome to AI Assistant
          </h2>
          <p className="text-muted-foreground">
            Select a conversation or start a new one to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" data-testid="area-chat">
      {/* Header */}
      <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="md:hidden"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </AvatarFallback>
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-assistant-title">
                AI Assistant
              </h1>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground" data-testid="text-connection-status">
                  {isConnected ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleContext}
            data-testid="button-toggle-context"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-clear-chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" data-testid="container-messages">
        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`message-${msg.id}`}
          >
            <div className="max-w-3xl">
              <div
                className={`rounded-lg px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br>') }} />
                  </div>
                ) : (
                  <p className="text-sm" data-testid={`text-message-content-${msg.id}`}>
                    {msg.content}
                  </p>
                )}
              </div>
              <div className={`flex items-center mt-2 space-x-2 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}>
                <span className="text-xs text-muted-foreground" data-testid={`text-message-time-${msg.id}`}>
                  {formatTime(msg.createdAt)}
                </span>
                {msg.role === "assistant" && (
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(msg.content)}
                      data-testid={`button-copy-${msg.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      data-testid={`button-like-${msg.id}`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming Message */}
        {isStreaming && (
          <div className="flex justify-start" data-testid="message-streaming">
            <div className="max-w-3xl">
              <div className="bg-card border border-border rounded-lg px-4 py-3">
                {streamingContent ? (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <div dangerouslySetInnerHTML={{ __html: streamingContent.replace(/\n/g, '<br>') }} />
                    <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full pulse-dot"></div>
                      <div className="w-2 h-2 bg-primary rounded-full pulse-dot"></div>
                      <div className="w-2 h-2 bg-primary rounded-full pulse-dot"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-border bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask about biometric data, quantum security, or system analysis..."
                  value={message}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  className="min-h-[60px] max-h-32 resize-none"
                  disabled={!isConnected || isStreaming}
                  data-testid="textarea-message-input"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={!isConnected}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || !isConnected || isStreaming}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleQuickAction("analyze-security-logs")}
                  disabled={!isConnected || isStreaming}
                  data-testid="button-quick-security-logs"
                >
                  Analyze Security Logs
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleQuickAction("review-biometrics")}
                  disabled={!isConnected || isStreaming}
                  data-testid="button-quick-biometrics"
                >
                  Review Biometrics
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleQuickAction("quantum-status")}
                  disabled={!isConnected || isStreaming}
                  data-testid="button-quick-quantum"
                >
                  Quantum Status
                </Button>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span>Press ⌘+Enter to send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
