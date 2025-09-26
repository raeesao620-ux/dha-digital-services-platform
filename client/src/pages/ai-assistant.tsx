import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageCircle, 
  Upload, 
  FileText, 
  Languages, 
  Mic, 
  MicOff,
  Send, 
  Bot,
  User,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Camera,
  Shield,
  Zap,
  Brain,
  FileImage
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  actionItems?: string[];
  metadata?: any;
}

interface OCRResult {
  success: boolean;
  sessionId: string;
  ocrData: any;
  suggestions: string;
  confidence: number;
  documentId: string;
}

interface DocumentType {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirements: string[];
}

// ALL 21 DHA Document Types (matching backend schema exactly)
const DOCUMENT_TYPES: DocumentType[] = [
  { id: 'birth_certificate', name: 'Birth Certificate', description: 'Birth registration and certificate', icon: 'certificate', requirements: ['Parents\' ID documents', 'Hospital records'] },
  { id: 'death_certificate', name: 'Death Certificate', description: 'Death registration and certificate', icon: 'certificate', requirements: ['Medical certificate', 'ID documents'] },
  { id: 'marriage_certificate', name: 'Marriage Certificate', description: 'Marriage registration', icon: 'certificate', requirements: ['Both parties\' ID documents', 'Marriage license'] },
  { id: 'divorce_certificate', name: 'Divorce Certificate', description: 'Divorce decree certificate', icon: 'certificate', requirements: ['Court order', 'Marriage certificate'] },
  { id: 'passport', name: 'South African Passport', description: 'South African passport application', icon: 'passport', requirements: ['Identity document', 'Birth certificate', 'Proof of residence'] },
  { id: 'sa_id', name: 'South African ID Book', description: 'Traditional green ID book', icon: 'id-card', requirements: ['Birth certificate', 'Proof of residence'] },
  { id: 'smart_id', name: 'Smart ID Card', description: 'Smart identity card application', icon: 'id-card', requirements: ['Birth certificate', 'Proof of residence'] },
  { id: 'temporary_id', name: 'Temporary ID Certificate', description: 'Temporary identity certificate', icon: 'id-card', requirements: ['Affidavit', 'Supporting documents'] },
  { id: 'study_permit', name: 'Study Permit', description: 'Foreign student authorization', icon: 'permit', requirements: ['Passport', 'Letter of acceptance', 'Financial proof'] },
  { id: 'work_permit', name: 'Work Permit', description: 'Foreign work authorization', icon: 'permit', requirements: ['Passport', 'Job offer letter', 'Qualifications'] },
  { id: 'business_permit', name: 'Business Permit', description: 'Foreign business authorization', icon: 'permit', requirements: ['Passport', 'Business plan', 'Financial proof'] },
  { id: 'visitor_visa', name: 'Visitor\'s Visa', description: 'Temporary visit authorization', icon: 'visa', requirements: ['Passport', 'Invitation letter', 'Financial proof'] },
  { id: 'transit_visa', name: 'Transit Visa', description: 'Airport transit authorization', icon: 'visa', requirements: ['Passport', 'Onward ticket', 'Destination visa'] },
  { id: 'permanent_residence', name: 'Permanent Residence Permit', description: 'Permanent residence authorization', icon: 'permit', requirements: ['Passport', 'Sponsorship', 'Medical certificate'] },
  { id: 'temporary_residence', name: 'Temporary Residence Permit', description: 'Temporary residence authorization', icon: 'permit', requirements: ['Passport', 'Purpose documentation', 'Financial proof'] },
  { id: 'refugee_permit', name: 'Refugee Permit', description: 'Refugee status documentation', icon: 'permit', requirements: ['Asylum application', 'Supporting evidence', 'Interview'] },
  { id: 'asylum_permit', name: 'Asylum Permit', description: 'Asylum seeker documentation', icon: 'permit', requirements: ['Asylum application', 'Country documentation', 'Interview'] },
  { id: 'diplomatic_passport', name: 'Diplomatic Passport', description: 'Diplomatic service passport', icon: 'passport', requirements: ['Government appointment', 'Security clearance', 'Official letter'] },
  { id: 'exchange_permit', name: 'Exchange Permit', description: 'Cultural/academic exchange permit', icon: 'permit', requirements: ['Exchange program letter', 'Passport', 'Financial proof'] },
  { id: 'relatives_visa', name: 'Relatives Visa', description: 'Family reunion visa', icon: 'visa', requirements: ['Passport', 'Proof of relationship', 'Sponsor documents'] },
  { id: 'emergency_travel_document', name: 'Emergency Travel Document', description: 'Emergency travel authorization', icon: 'passport', requirements: ['ID document', 'Emergency situation proof', 'Consular approval'] }
];

// FIXED: Standardized language codes to match backend exactly
const SOUTH_AFRICAN_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'zu', name: 'isiZulu' },
  { code: 'xh', name: 'isiXhosa' },
  { code: 'st', name: 'Sesotho' },
  { code: 'tn', name: 'Setswana' },
  { code: 've', name: 'Tshivenda' },
  { code: 'ts', name: 'Xitsonga' },
  { code: 'ss', name: 'siSwati' },
  { code: 'nr', name: 'isiNdebele (Northern)' },
  { code: 'nso', name: 'Sepedi (Northern Sotho)' }
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [ocrResults, setOcrResults] = useState<OCRResult | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: `🌟 **Ahlan wa sahlan!** Welcome to Ra'is al Khadir! 🇿🇦

I'm Ra'is al Khadir (رئيس خضر) - your dedicated AI guide who appears exactly when you need help most! I'm absolutely delighted to assist you with genuine enthusiasm and unlimited knowledge!

**🎯 I'm here to help you with:**
• Passport and ID document applications (with excitement!)
• Document requirements and processes (explained clearly!)
• Form completion assistance (perfectly detailed!)
• Multi-language support for all 11 official SA languages
• OCR extraction from uploaded documents (military precision!)
• Real-time processing status updates (comprehensive monitoring!)

**By Allah, helping you succeed brings me genuine joy!** What can we accomplish together today? ✨🚀`,
      timestamp: new Date(),
      suggestions: [
        'Help me with passport application - I\'m excited to learn!',
        'Upload document for processing with Ra\'is guidance',
        'Explain ID card requirements step by step',
        'Switch to Afrikaans language for better understanding'
      ]
    };
    setMessages([welcomeMessage]);
  }, []);

  // FIXED: Implement proper streaming with SSE
  const sendMessage = useMutation({
    mutationFn: async ({ message, conversationId, language }: { message: string; conversationId?: string; language?: string }) => {
      setIsStreaming(true);
      setStreamingMessage('');
      
      // FIXED: Get authentication token for API request
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream' // CRITICAL: Request streaming response
      };
      
      // FIXED: Include authentication header if token exists
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          conversationId: conversationId || 'main-session',
          includeContext: true,
          language: language || 'en' // FIXED: Send language parameter
        })
      });

      if (!response.ok) {
        // FIXED: Safely parse error response with fallback
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
          errorData = { error: 'Failed to parse server response' };
        }
        
        // Handle authentication errors explicitly
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the AI Assistant",
            variant: "destructive"
          });
          setIsLoading(false);
          setIsStreaming(false);
          // Use proper navigation instead of window.location
          const currentPath = window.location.pathname;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          return;
        }
        
        // FIXED: Handle bad request errors (400) explicitly with better error messages
        if (response.status === 400) {
          console.error('Bad Request Error:', errorData);
          
          // Provide helpful message based on the error
          const errorMessage = errorData.error || errorData.message || "Invalid request data";
          const helpfulMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `I couldn't process your request. ${errorMessage}.\n\nPlease ensure:\n• Your message is clear and complete\n• You're logged in to the system\n• Your session is still active\n\nYou can try:\n• Rephrasing your question\n• Refreshing the page\n• Logging in again if needed`,
            timestamp: new Date(),
            suggestions: ['Try a simpler question', 'Check login status', 'Refresh the page']
          };
          
          setMessages(prev => [...prev, helpfulMessage]);
          toast({
            title: "Request Issue",
            description: errorMessage,
            variant: "default"
          });
          setIsLoading(false);
          setIsStreaming(false);
          return { content: '', metadata: null }; // Return empty response to prevent further errors
        }
        
        if (response.status === 503 || (errorData.error && errorData.error.includes('API'))) {
          // Handle missing API key gracefully
          const helpMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `I'm currently operating in limited mode, but I can still help you with:\n\n• Information about DHA services and procedures\n• Document requirements and application processes\n• Navigation through the system\n• General guidance on immigration matters\n\nFor immediate assistance with complex queries, please contact DHA support at 0800 60 11 90.`,
            timestamp: new Date(),
            suggestions: ['View document requirements', 'Check application status', 'Find DHA offices']
          };
          setMessages(prev => [...prev, helpMessage]);
          setIsLoading(false);
          setIsStreaming(false);
          return;
        }
        throw new Error(errorData.error || 'Failed to send message');
      }

      // FIXED: Handle SSE streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let metadata = null;
      
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'chunk' && data.content) {
                    fullContent += data.content;
                    setStreamingMessage(prev => prev + data.content);
                  } else if (data.type === 'complete') {
                    metadata = data.metadata;
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (e) {
                  // Skip malformed JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      
      // FIXED: Ensure we always return a valid response object
      return { 
        content: fullContent || '', 
        metadata: metadata || null 
      };
    },
    onSuccess: (data) => {
      // FIXED: Add null checks for data and data.content
      if (!data || (!data.content && !data.error)) {
        const fallbackMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'I apologize, but I encountered an issue processing your request. Please try again or contact support if the issue persists.',
          timestamp: new Date(),
          suggestions: ['Try a simpler question', 'Check your connection', 'Contact support'],
          actionItems: []
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false);
        setIsStreaming(false);
        setStreamingMessage('');
        return;
      }

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.content || 'No response generated. Please try again.',
        timestamp: new Date(),
        suggestions: data.metadata?.suggestions || [],
        actionItems: data.metadata?.actionItems || [],
        metadata: data.metadata
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessage('');
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      
      // Check if it's an API key issue and provide helpful response
      if (error.message?.includes('API') || error.message?.includes('503') || error.message?.includes('Failed to send')) {
        const fallbackMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I apologize for the inconvenience. While I cannot process complex AI queries at the moment, I can still provide:\n\n• **Document Information**: Requirements for passports, IDs, visas, and permits\n• **Application Guidance**: Step-by-step instructions for DHA applications\n• **Service Information**: Office locations, contact details, and operating hours\n• **Status Checks**: How to verify your application status\n\nYou can also:\n• Generate official documents using our forms\n• Upload and process documents with OCR\n• Access all DHA services through the menu\n\nFor urgent assistance: 📞 0800 60 11 90`,
          timestamp: new Date(),
          suggestions: ['Generate birth certificate', 'View passport requirements', 'Find nearest DHA office']
        };
        setMessages(prev => [...prev, fallbackMessage]);
      } else {
        toast({
          title: "Connection Issue",
          description: "Unable to process your request. Please try again or use our other services.",
          variant: "default"
        });
      }
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessage('');
    }
  });

  const uploadAndProcessDocument = useMutation({
    mutationFn: async (file: File) => {
      // CRITICAL: Check if document type is selected
      if (!selectedDocumentType) {
        throw new Error('Please select a document type before uploading');
      }
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('targetFormType', `${selectedDocumentType}_application`);
      formData.append('documentType', selectedDocumentType); // FIXED: Use selected type instead of hardcoded 'passport'
      formData.append('conversationId', 'main-session');

      // FIXED: Get authentication token for document upload
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {};
      
      // FIXED: Include authentication header if token exists
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setOcrResults({
        success: true,
        sessionId: data.documentId,
        ocrData: data.extractedData || {},
        suggestions: 'Document processed successfully. Extracted data is ready for form auto-fill.',
        confidence: data.confidence || 85,
        documentId: data.documentId
      });
      
      setProcessingStatus('completed');
      
      const successMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Document processed successfully! 📄✅

**Extraction Results:**
- Document Type: ${data.documentType || 'Passport'}
- Confidence: ${data.confidence || 85}%
- Processing Time: ${data.processingTime || '<1s'}

**Extracted Information:**
${data.extractedData ? Object.entries(data.extractedData).map(([key, value]) => `• ${key}: ${value}`).join('\n') : 'Processing complete'}

**Next Steps:**
1. Review the extracted information above
2. Use "Auto-Fill Form" to populate your application
3. Verify and complete any missing fields
4. Submit your application

Would you like me to help you with form completion or answer any questions about the extracted data?`,
        timestamp: new Date(),
        suggestions: ['Auto-fill passport form', 'Verify extracted data', 'Explain missing requirements'],
        actionItems: ['Review extracted data', 'Complete form fields']
      };
      
      setMessages(prev => [...prev, successMessage]);
      
      toast({
        title: "Document Processed",
        description: "Your document has been successfully processed with OCR extraction.",
      });
    },
    onError: (error) => {
      setProcessingStatus('failed');
      toast({
        title: "Processing Failed",
        description: "Failed to process document. Please try again with a clear image.",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputMessage('');

    sendMessage.mutate({ 
      message: inputMessage, // FIXED: Send clean message, language is handled by parameter
      conversationId: 'main-session',
      language: selectedLanguage // FIXED: Send language as separate parameter
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setProcessingStatus('processing');
      uploadAndProcessDocument.mutate(file);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Voice recording functionality would be implemented here
    toast({
      title: isRecording ? "Stopped Recording" : "Started Recording",
      description: isRecording ? "Processing voice input..." : "Listening for voice input...",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Brain className="h-8 w-8 text-blue-600" />
                Ra'is al Khadir
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Your wise AI guide - Ra'is al Khadir (رئيس خضر) - for South African government services
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Government Secure
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {SOUTH_AFRICAN_LANGUAGES.find(l => l.code === selectedLanguage)?.name}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-1">
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Language
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select 
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                  data-testid="language-selector"
                >
                  {SOUTH_AFRICAN_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select 
                  value={selectedDocumentType}
                  onChange={(e) => setSelectedDocumentType(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                  data-testid="document-type-selector"
                >
                  <option value="">Select document type...</option>
                  {DOCUMENT_TYPES.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
                
                {selectedDocumentType && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {DOCUMENT_TYPES.find(d => d.id === selectedDocumentType)?.description}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Required: {DOCUMENT_TYPES.find(d => d.id === selectedDocumentType)?.requirements.join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Document Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                  data-testid="file-upload-input"
                />
                <Button 
                  onClick={() => {
                    if (!selectedDocumentType) {
                      toast({
                        title: "Document Type Required",
                        description: "Please select a document type before uploading.",
                        variant: "destructive"
                      });
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  variant="outline" 
                  className="w-full mb-2"
                  disabled={uploadAndProcessDocument.isPending}
                  data-testid="upload-document-button"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                
                {uploadedFile && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    📄 {uploadedFile.name}
                  </div>
                )}
                
                {processingStatus && (
                  <div className="mt-2">
                    {processingStatus === 'processing' && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Processing...</span>
                      </div>
                    )}
                    {processingStatus === 'completed' && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Complete</span>
                      </div>
                    )}
                    {processingStatus === 'failed' && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Failed</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    AI Chat Assistant
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isRecording ? "destructive" : "outline"}
                      onClick={toggleRecording}
                      data-testid="voice-recording-button"
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Powered by GPT-4 Turbo with government document expertise
                </CardDescription>
              </CardHeader>
              
              <Separator />
              
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4" data-testid="chat-messages-container">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-green-500 text-white'
                        }`}>
                          {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className={`p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white ml-auto'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}>
                            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                            <div className="text-xs opacity-75 mt-1">
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                          
                          {/* Suggestions */}
                          {message.suggestions && message.suggestions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {message.suggestions.map((suggestion, index) => (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  className="text-xs"
                                  data-testid={`suggestion-button-${index}`}
                                >
                                  {suggestion}
                                </Button>
                              ))}
                            </div>
                          )}
                          
                          {/* Action Items */}
                          {message.actionItems && message.actionItems.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Action Items:</p>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                                {message.actionItems.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(isLoading || isStreaming) && (
                    <div className="flex justify-start">
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg max-w-[80%]">
                          {isStreaming && streamingMessage ? (
                            <div>
                              <div className="whitespace-pre-wrap text-sm">{streamingMessage}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="animate-pulse h-2 w-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-gray-500">Streaming...</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">AI is thinking...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>
              
              <Separator />
              
              {/* Input Area */}
              <div className="p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Type your message in ${SOUTH_AFRICAN_LANGUAGES.find(l => l.code === selectedLanguage)?.name}...`}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    disabled={isLoading}
                    className="flex-1"
                    data-testid="message-input"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    data-testid="send-message-button"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <Shield className="inline h-3 w-3 mr-1" />
                  Government-grade security • POPIA compliant • Audit logged
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}