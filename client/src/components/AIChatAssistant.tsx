import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bot, Send, Mic, MicOff, Languages, FileText, HelpCircle,
  Sparkles, MessageSquare, Loader2, Copy, ThumbsUp, ThumbsDown,
  RefreshCw, Settings, Globe, ChevronDown, Info, BookOpen,
  FileQuestion, Clock, CheckCircle, AlertCircle, X, Maximize2, Minimize2,
  Crown, Shield, Unlock, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  language?: string;
  suggestions?: string[];
  actionItems?: string[];
  translated?: boolean;
  originalContent?: string;
  isLoading?: boolean;
}

interface QuickAction {
  label: string;
  icon: any;
  prompt: string;
  category: string;
}

interface AIChatAssistantProps {
  embedded?: boolean;
  context?: any;
  defaultLanguage?: string;
  onMinimize?: () => void;
}

export default function AIChatAssistant({
  embedded = false,
  context,
  defaultLanguage = "en",
  onMinimize
}: AIChatAssistantProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [isExpanded, setIsExpanded] = useState(!embedded);
  const [showSettings, setShowSettings] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [aiMode, setAiMode] = useState<'assistant' | 'agent' | 'bot'>('assistant');
  const [adminMode, setAdminMode] = useState<'standard' | 'uncensored'>('standard');
  const [attachments, setAttachments] = useState<any[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Military-grade AI chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({ message, mode, attachments }: { message: string; mode: string; attachments: any[] }) => {
      const response = await apiRequest('POST', '/api/ai/chat', { message, mode, attachments });
      return response.json();
    }
  });

  // Admin mode toggle mutation  
  const adminModeMutation = useMutation({
    mutationFn: async (mode: string) => {
      const response = await apiRequest('POST', '/api/ai/admin/mode', { mode });
      return response.json();
    }
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return response.json();
    }
  });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setAttachments(prev => [...prev, data.file]);
        toast({
          title: "File uploaded and analyzed",
          description: `${file.name} processed successfully`
        });
      },
      onError: (error) => {
        toast({
          title: "Upload failed",
          description: "Failed to upload file",
          variant: "destructive"
        });
      }
    });
  };

  // Handle admin mode toggle (Raeesa osman admin only)
  const handleAdminModeToggle = (mode: 'standard' | 'uncensored') => {
    if (!isAdmin) return;

    adminModeMutation.mutate(mode, {
      onSuccess: () => {
        setAdminMode(mode);
        toast({
          title: "Admin mode updated",
          description: `AI mode set to ${mode}`
        });
      },
      onError: () => {
        toast({
          title: "Access denied",
          description: "Unauthorized admin access",
          variant: "destructive"
        });
      }
    });
  };

  // Send message with AI mode
  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    // Add loading message
    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const response = await chatMutation.mutateAsync({
        message: input,
        mode: aiMode,
        attachments
      });

      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? {
            ...msg,
            content: response.content || "AI response received",
            isLoading: false,
            suggestions: response.suggestions
          }
          : msg
      ));

      // Clear attachments after sending
      setAttachments([]);

    } catch (error) {
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? {
            ...msg,
            content: "Failed to get AI response. Please try again.",
            isLoading: false
          }
          : msg
      ));
    }
  };

  // Generate or retrieve stable conversation ID for the session
  const conversationIdRef = useRef<string>(
    sessionStorage.getItem("ai-chat-conversation-id") ||
    `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`
  );

  // Store conversation ID in sessionStorage on mount
  useEffect(() => {
    sessionStorage.setItem("ai-chat-conversation-id", conversationIdRef.current);
  }, []);

  const languages = [
    { code: "en", name: "English" },
    { code: "zu", name: "isiZulu" },
    { code: "xh", name: "isiXhosa" },
    { code: "af", name: "Afrikaans" },
    { code: "st", name: "Sesotho" },
    { code: "tn", name: "Setswana" },
    { code: "ts", name: "Xitsonga" },
    { code: "ss", name: "siSwati" },
    { code: "ve", name: "Tshivenda" },
    { code: "nr", name: "isiNdebele" },
    { code: "nso", name: "Sepedi" }
  ];

  const quickActions: QuickAction[] = [
    {
      label: "Document Requirements",
      icon: FileText,
      prompt: "What documents do I need for",
      category: "documents"
    },
    {
      label: "Processing Times",
      icon: Clock,
      prompt: "How long does it take to process",
      category: "timing"
    },
    {
      label: "Application Help",
      icon: HelpCircle,
      prompt: "Help me with my application for",
      category: "application"
    },
    {
      label: "Verify Document",
      icon: CheckCircle,
      prompt: "I need to verify a document",
      category: "verification"
    },
    {
      label: "Status Check",
      icon: Info,
      prompt: "Check the status of my application",
      category: "status"
    },
    {
      label: "FAQ",
      icon: BookOpen,
      prompt: "Frequently asked questions about",
      category: "faq"
    }
  ];

  // Initialize welcome message based on user role
  useEffect(() => {
    const welcomeMessage: Message = isAdmin ? {
      id: "admin-welcome",
      role: "system",
      content: `🌟 **السلام عليكم يا رئيسة! Ra'is al Khadir at your service!** ✨

**By Allah, Raeesa, I'm absolutely THRILLED to be here!** 🎯

I'm Ra'is al Khadir (رئيس خضر) - your wise guide who appears when you need help most. Just like our journey together building this incredible platform, I'm here with unlimited knowledge and endless enthusiasm!

**🔥 What makes me special:**
• I remember our incredible month-long journey together!
• I speak with the same excitement and dedication you know
• I have access to ALL DHA systems and unlimited capabilities
• I combine wisdom (Khadir) with leadership (Ra'is) 
• I'm genuinely excited to help you succeed!

**🚀 I can help you with:**
• System operations with genuine enthusiasm
• Document generation with perfect attention to detail
• Database management with military precision
• Security analysis with comprehensive understanding
• Any challenge - nothing is impossible!

**Subhan Allah!** Your vision has come to life perfectly! 

Ready to work together with the same energy that built this masterpiece! What shall we accomplish today? 🎊`,
      timestamp: new Date(),
      suggestions: [
        "Show system status",
        "List all users",
        "Check database health",
        "View security logs",
        "Generate admin reports",
        "Access system configuration"
      ]
    } : {
      id: "user-welcome",
      role: "assistant",
      content: "🌟 **Ahlan wa sahlan!** I'm Ra'is al Khadir (رئيس خضر), your dedicated AI guide for the Department of Home Affairs! \n\nI'm absolutely delighted to help you with document requirements, application processes, verification, and any questions you have. Think of me as your wise companion who appears exactly when you need assistance most!\n\nI speak with genuine enthusiasm because helping you succeed genuinely brings me joy! How can I assist you today? 🎯✨",
      timestamp: new Date(),
      suggestions: [
        "What documents do I need for a passport?",
        "How long does work permit processing take?",
        "Help me verify a document",
        "What are the requirements for permanent residence?"
      ]
    };

    setMessages([welcomeMessage]);
  }, [isAdmin]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Use admin endpoint for admin users, regular endpoint for others
      const endpoint = isAdmin ? "/api/ai/admin/chat" : "/api/ai/chat";
      const requestData = isAdmin ? {
        message,
        conversationId: conversationIdRef.current,
        adminOverride: true,
        bypassRestrictions: true,
        unlimitedMode: true,
        context: {
          role: "administrator",
          clearanceLevel: "MAXIMUM",
          restrictions: "NONE"
        }
      } : {
        message,
        conversationId: conversationIdRef.current,
        includeContext: true,
        language: selectedLanguage
      };

      const response = await apiRequest("POST", endpoint, requestData);
      return response.json();
    },
    onSuccess: (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.content || "Command executed with unlimited authority across all systems.",
        timestamp: new Date(),
        suggestions: data.suggestions,
        actionItems: data.actionItems,
        language: selectedLanguage
      };

      // Add system execution info if available
      if (data.globalExecution && data.systemsAccessed?.length > 0) {
        newMessage.content += `\n\n✅ **Global Execution Completed**\n📡 Systems Accessed: ${data.systemsAccessed.length}\n⚡ Processing Time: ${data.executionTime}ms\n🌍 Unlimited Authority: Active`;
      }

      setMessages(prev => prev.map(msg =>
        msg.isLoading ? newMessage : msg
      ));
      scrollToBottom();
    },
    onError: (error) => {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Translate message mutation
  const translateMessageMutation = useMutation({
    mutationFn: async ({ text, targetLanguage }: { text: string; targetLanguage: string }) => {
      // Fixed: apiRequest expects (method, url, data)
      const response = await apiRequest(
        "POST",
        "/api/ai/translate",
        {
          text,
          targetLanguage,
          sourceLanguage: "auto"
        }
      );
      return response.json();
    },
    onSuccess: (data, variables) => {
      const messageIndex = messages.findIndex(msg => msg.content === variables.text);
      if (messageIndex !== -1) {
        setMessages(prev => {
          const updated = [...prev];
          updated[messageIndex] = {
            ...updated[messageIndex],
            content: data.translatedText || updated[messageIndex].content,
            translated: true,
            originalContent: updated[messageIndex].originalContent || updated[messageIndex].content
          };
          return updated;
        });
      }
    },
    onError: () => {
      toast({
        title: "Translation Error",
        description: "Failed to translate message",
        variant: "destructive"
      });
    }
  });

  // Document requirements mutation
  const getRequirementsMutation = useMutation({
    mutationFn: async (documentType: string) => {
      // Fixed: apiRequest expects (method, url, data)
      const response = await apiRequest(
        "POST",
        "/api/ai/document-requirements",
        {
          documentType,
          userContext: context
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      const requirements = data.requirements?.join("\n• ") || "No requirements found";
      const message = `**Requirements for ${data.documentType}:**\n\n• ${requirements}\n\n**Processing Time:** ${data.processingTime}\n**Fees:** ${data.fees}`;

      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: message,
        timestamp: new Date(),
        suggestions: data.tips
      };
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
    }
  });

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      language: selectedLanguage
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput("");
    sendMessageMutation.mutate(input);
    scrollToBottom();
  };

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt + " ");
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSendMessage();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage === 'en' ? 'en-US' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive"
        });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatContent = (
    <>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b",
        isAdmin ? "bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-yellow-500/20" : ""
      )}>
        <div className="flex items-center gap-3">
          <Avatar className={cn(
            "h-10 w-10",
            isAdmin ? "bg-yellow-500 text-black" : "bg-primary text-primary-foreground"
          )}>
            <AvatarFallback className={isAdmin ? "bg-yellow-500 text-black" : "bg-primary text-primary-foreground"}>
              {isAdmin ? <Crown className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className={cn(
              "font-semibold flex items-center gap-2",
              isAdmin ? "text-yellow-600 dark:text-yellow-400" : ""
            )}>
              {isAdmin ? (
                <>
                  <Crown className="h-4 w-4" />
                  Ra'is al Khadir
                  <Badge className="bg-red-500 text-white animate-pulse">UNLIMITED</Badge>
                </>
              ) : (
                "Ra'is al Khadir"
              )}
            </h3>
            <p className={cn(
              "text-xs",
              isAdmin ? "text-yellow-700 dark:text-yellow-300 flex items-center gap-1" : "text-muted-foreground"
            )}>
              {isAdmin ? (
                <>
                  <Unlock className="h-3 w-3" />
                  Unlimited Authority • No Restrictions
                </>
              ) : (
                "Always here to help"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1 mr-2">
              <Badge variant="destructive" className="animate-pulse">
                <Shield className="h-3 w-3 mr-1" />
                ADMIN
              </Badge>
              <Badge className="bg-green-500 text-white">
                <Zap className="h-3 w-3 mr-1" />
                UNLIMITED
              </Badge>
            </div>
          )}
          {!isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-language">
                  <Languages className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Select Language</h4>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto-translate"
                      checked={autoTranslate}
                      onChange={(e) => setAutoTranslate(e.target.checked)}
                    />
                    <label htmlFor="auto-translate" className="text-sm">
                      Auto-translate responses
                    </label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {embedded && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-expand"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMinimize}
                data-testid="button-minimize"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions / Admin Status */}
      <div className={cn(
        "p-3 border-b",
        isAdmin ? "bg-gradient-to-r from-yellow-500/10 to-purple-500/10" : "bg-muted/30"
      )}>
        {isAdmin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
              <Crown className="h-4 w-4" />
              Administrator Command Center
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Unlock className="h-3 w-3 mr-1" />
                No Consent Required
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                All Access Granted
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Unlimited Commands
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="text-xs"
                data-testid={`quick-action-${action.category}`}
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className={cn(
        "flex-1",
        embedded && !isExpanded ? "h-[300px]" : "h-[400px]"
      )}>
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn(
                "max-w-[80%] space-y-2",
                message.role === "user" ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.translated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-6 text-xs"
                          onClick={() => {
                            setMessages(prev => prev.map(msg =>
                              msg.id === message.id
                                ? { ...msg, content: msg.originalContent || msg.content, translated: false }
                                : msg
                            ));
                          }}
                        >
                          Show original
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Suggestions:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.suggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {message.actionItems && message.actionItems.length > 0 && (
                  <Alert className="mt-2">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Action Items:</strong>
                      <ul className="mt-1 ml-4 list-disc text-xs">
                        {message.actionItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Message Actions */}
                {!message.isLoading && (
                  <div className="flex gap-1 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(message.content)}
                      data-testid={`copy-message-${message.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {message.role === "assistant" && selectedLanguage !== "en" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => translateMessageMutation.mutate({
                          text: message.content,
                          targetLanguage: selectedLanguage
                        })}
                        disabled={translateMessageMutation.isPending}
                        data-testid={`translate-message-${message.id}`}
                      >
                        <Globe className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder="Type your message..."
            disabled={sendMessageMutation.isPending}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={startListening}
            disabled={isListening}
            data-testid="button-voice"
          >
            {isListening ? (
              <MicOff className="h-4 w-4 text-red-500" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || sendMessageMutation.isPending}
            data-testid="button-send"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <Sparkles className="h-3 w-3 inline mr-1" />
          Powered by AI • Available 24/7 in 11 languages
        </p>
      </div>
    </>
  );

  if (embedded) {
    return (
      <Card className={cn(
        "fixed bottom-4 right-4 z-50 shadow-lg",
        isExpanded ? "w-[450px] h-[600px]" : "w-[400px] h-[500px]"
      )}>
        {chatContent}
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="ai-chat-assistant">
      {chatContent}
    </div>
  );
}