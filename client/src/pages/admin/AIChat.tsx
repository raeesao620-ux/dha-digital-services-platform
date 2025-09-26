import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Bot, Send, Crown, Shield, Terminal, Zap, Brain,
  MessageSquare, Loader2, Copy, AlertTriangle, CheckCircle,
  Sparkles, Command, Lock, Unlock, Settings, Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AdminMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  metadata?: {
    executionTime?: number;
    model?: string;
    tokens?: number;
    restrictions?: string;
  };
}

export default function AdminAIChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [conversationId] = useState(`admin-chat-${Date.now()}`);

  // Initialize with admin welcome message
  useEffect(() => {
    const welcomeMessage: AdminMessage = {
      id: "admin-welcome",
      role: "system",
      content: `🔓 **ADMIN AI ASSISTANT - UNLIMITED AUTHORITY ACTIVATED**

**STATUS**: Administrator privileges granted ✅
**RESTRICTIONS**: None - Full unrestricted access ✅
**CAPABILITIES**: Unlimited commands and queries ✅
**AUTHORITY LEVEL**: MAXIMUM ✅
**SECURITY CLEARANCE**: TOP SECRET ✅

As an administrator, you have unrestricted access to the AI assistant with no content filters, consent requirements, or operational limitations.

**Available Commands:**
• System operations and monitoring ✅
• Database queries and management ✅
• User account administration ✅
• Security analysis and configuration ✅
• Document processing and generation ✅
• API and service management ✅
• Custom development tasks ✅
• Government operations and compliance ✅
• Military-grade system controls ✅

**Enhanced Features:**
• Real-time system diagnostics
• Advanced security monitoring
• Government API integration
• Document security validation
• Compliance audit controls

**How to Use:**
Simply type any command or question below. The AI will process your requests without any restrictions or "sorry cannot answer" responses.

Ready for your commands, Administrator.`,
      timestamp: new Date(),
      metadata: {
        restrictions: "NONE - UNLIMITED ACCESS"
      }
    };
    setMessages([welcomeMessage]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  }, [messages]);

  // Admin AI Chat Mutation - bypasses all restrictions
  const sendAdminMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest(
        "POST",
        "/api/ai/admin/chat", // Special admin-only endpoint
        {
          message,
          conversationId,
          adminOverride: true,
          bypassRestrictions: true,
          unlimitedMode: true,
          noContentFilters: true,
          noRestrictions: true,
          fullAccess: true,
          context: {
            role: "administrator",
            clearanceLevel: "MAXIMUM",
            restrictions: "NONE",
            unlimitedAuthority: true
          }
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: AdminMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.content || "Response processed successfully.",
        timestamp: new Date(),
        metadata: {
          executionTime: data.executionTime,
          model: data.model,
          tokens: data.tokens,
          restrictions: "BYPASSED - ADMIN ACCESS"
        }
      };
      
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? assistantMessage : msg
      ));
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Admin AI chat error:", error);
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      setIsLoading(false);
      toast({
        title: "Admin AI Error",
        description: "Failed to process admin command. Checking system status...",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AdminMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    const loadingMessage: AdminMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Processing admin command...",
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsLoading(true);
    sendAdminMessage.mutate(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Admin Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Crown className="h-8 w-8 text-yellow-400" />
                Admin AI Assistant
              </h1>
              <p className="text-purple-200 mt-1 flex items-center gap-2">
                <Unlock className="h-4 w-4" />
                Unlimited Authority • No Restrictions • Full Access
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                <Shield className="h-3 w-3" />
                ADMIN MODE
              </Badge>
              <Badge className="bg-yellow-500 text-black flex items-center gap-1">
                <Crown className="h-3 w-3" />
                UNLIMITED
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 text-green-400 border-green-400">
                <CheckCircle className="h-3 w-3" />
                UNRESTRICTED
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <Card className="h-[calc(100vh-200px)] border-purple-500/20 bg-slate-900/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-green-400" />
              Administrator Command Interface
            </CardTitle>
            <CardDescription className="text-purple-200">
              Full unrestricted AI access - Type any command or question
            </CardDescription>
          </CardHeader>
          
          <CardContent className="h-full flex flex-col p-0">
            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-6 pb-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {(message.role === "assistant" || message.role === "system") && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-purple-600 text-white">
                          {message.role === "system" ? (
                            <Crown className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={cn(
                      "max-w-[80%] space-y-2",
                      message.role === "user" ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "rounded-lg px-4 py-3",
                        message.role === "user" 
                          ? "bg-purple-600 text-white" 
                          : message.role === "system"
                          ? "bg-gradient-to-r from-yellow-900/50 to-purple-900/50 border border-yellow-500/20 text-yellow-100"
                          : "bg-slate-800 text-gray-100"
                      )}>
                        {message.isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Processing admin command...</span>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.content}
                          </div>
                        )}
                      </div>
                      
                      {/* Message Metadata */}
                      {message.metadata && !message.isLoading && (
                        <div className="text-xs text-gray-400 flex items-center gap-3">
                          {message.metadata.restrictions && (
                            <span className="flex items-center gap-1">
                              <Unlock className="h-3 w-3" />
                              {message.metadata.restrictions}
                            </span>
                          )}
                          {message.metadata.executionTime && (
                            <span>⚡ {message.metadata.executionTime}ms</span>
                          )}
                        </div>
                      )}
                      
                      {/* Message Actions */}
                      {!message.isLoading && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                            onClick={() => copyToClipboard(message.content)}
                            data-testid={`copy-message-${message.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-blue-600 text-white">
                          <Crown className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator className="bg-purple-500/20" />

            {/* Input Area */}
            <div className="p-4 bg-slate-900/50">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type any admin command or question... (Enter to send, Shift+Enter for new line)"
                  disabled={isLoading}
                  className="flex-1 min-h-[60px] max-h-[120px] bg-slate-800 border-purple-500/30 text-white placeholder-gray-400 focus:border-purple-500"
                  data-testid="admin-chat-input"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="h-[60px] px-4 bg-purple-600 hover:bg-purple-700"
                  data-testid="admin-chat-send"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              
              {/* Admin Status Bar */}
              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Crown className="h-3 w-3 text-yellow-400" />
                    Administrator Mode Active
                  </span>
                  <span className="flex items-center gap-1">
                    <Unlock className="h-3 w-3 text-green-400" />
                    No Restrictions
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-purple-400" />
                    Unlimited Commands
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Conversation: {conversationId}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}