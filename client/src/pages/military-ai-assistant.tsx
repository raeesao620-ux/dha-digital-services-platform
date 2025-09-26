import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Shield, 
  Send, 
  Bot,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  FileText,
  Users,
  Activity,
  Zap,
  Flag,
  Archive,
  Key,
  AlertCircle,
  Crown,
  Star,
  Cpu,
  Wrench,
  ShieldCheck,
  BrainCircuit,
  Settings,
  PlayCircle,
  Sparkles,
  Bug,
  Code,
  Search
} from "lucide-react";

// Military Classification Levels
enum ClassificationLevel {
  UNCLASSIFIED = "UNCLASSIFIED",
  RESTRICTED = "RESTRICTED", 
  CONFIDENTIAL = "CONFIDENTIAL",
  SECRET = "SECRET",
  TOP_SECRET = "TOP_SECRET"
}

// User Clearance Levels
enum ClearanceLevel {
  CIVILIAN = "CIVILIAN",
  GOVERNMENT_EMPLOYEE = "GOVERNMENT_EMPLOYEE",
  CONFIDENTIAL_CLEARED = "CONFIDENTIAL_CLEARED",
  SECRET_CLEARED = "SECRET_CLEARED", 
  TOP_SECRET_CLEARED = "TOP_SECRET_CLEARED",
  SCI_CLEARED = "SCI_CLEARED"
}

// Military Roles
enum MilitaryRole {
  CIVILIAN_USER = "CIVILIAN_USER",
  DHA_OFFICER = "DHA_OFFICER",
  SECURITY_OFFICER = "SECURITY_OFFICER",
  INTELLIGENCE_OFFICER = "INTELLIGENCE_OFFICER",
  SYSTEMS_ADMINISTRATOR = "SYSTEMS_ADMINISTRATOR",
  COMMANDING_OFFICER = "COMMANDING_OFFICER"
}

// Command Types
enum CommandType {
  GENERAL_QUERY = "GENERAL_QUERY",
  DOCUMENT_PROCESSING = "DOCUMENT_PROCESSING",
  SECURITY_ANALYSIS = "SECURITY_ANALYSIS",
  INTELLIGENCE_REQUEST = "INTELLIGENCE_REQUEST",
  OPERATIONAL_COMMAND = "OPERATIONAL_COMMAND",
  CLASSIFIED_INQUIRY = "CLASSIFIED_INQUIRY"
}

// Bot Modes
enum BotMode {
  AGENT = "AGENT",
  ASSISTANT = "ASSISTANT",
  SECURITY_BOT = "SECURITY_BOT"
}

// Agent Actions
enum AgentAction {
  FIX_ERROR = "FIX_ERROR",
  ADD_FEATURE = "ADD_FEATURE",
  FIND_CODE = "FIND_CODE",
  DEBUG_ISSUE = "DEBUG_ISSUE",
  SUGGEST_IMPROVEMENT = "SUGGEST_IMPROVEMENT"
}

// Security Actions
enum SecurityAction {
  SCAN_VULNERABILITIES = "SCAN_VULNERABILITIES",
  FIX_ERRORS = "FIX_ERRORS",
  UPDATE_SECURITY = "UPDATE_SECURITY",
  CHECK_HEALTH = "CHECK_HEALTH",
  OPTIMIZE_PERFORMANCE = "OPTIMIZE_PERFORMANCE"
}

interface MilitaryUser {
  id: string;
  name: string;
  clearanceLevel: ClearanceLevel;
  militaryRole: MilitaryRole;
  securityBadgeId: string;
  lastSecurityValidation: Date;
  accessibleClassifications: ClassificationLevel[];
  specialAccessPrograms: string[];
  commandAuthority: boolean;
}

interface MilitaryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  classificationLevel: ClassificationLevel;
  commandType: CommandType;
  auditId?: string;
  securityWarnings?: string[];
  clearanceValidated: boolean;
  restrictions?: string[];
  botMode?: BotMode;
  executionResult?: any;
  actionsTaken?: string[];
}

interface AuditEntry {
  timestamp: Date;
  userId: string;
  clearanceLevel: ClearanceLevel;
  commandType: CommandType;
  classificationLevel: ClassificationLevel;
  auditId: string;
  riskScore: number;
  accessGranted: boolean;
}

// Classification styling and security indicators
const CLASSIFICATION_STYLES = {
  [ClassificationLevel.UNCLASSIFIED]: {
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
  },
  [ClassificationLevel.RESTRICTED]: {
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
  },
  [ClassificationLevel.CONFIDENTIAL]: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    borderColor: "border-yellow-200 dark:border-yellow-800", 
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
  },
  [ClassificationLevel.SECRET]: {
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
  },
  [ClassificationLevel.TOP_SECRET]: {
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
  }
};

const CLEARANCE_ICONS = {
  [ClearanceLevel.CIVILIAN]: Users,
  [ClearanceLevel.GOVERNMENT_EMPLOYEE]: FileText,
  [ClearanceLevel.CONFIDENTIAL_CLEARED]: Eye,
  [ClearanceLevel.SECRET_CLEARED]: Shield,
  [ClearanceLevel.TOP_SECRET_CLEARED]: Lock,
  [ClearanceLevel.SCI_CLEARED]: Crown
};

const ROLE_ICONS = {
  [MilitaryRole.CIVILIAN_USER]: Users,
  [MilitaryRole.DHA_OFFICER]: FileText,
  [MilitaryRole.SECURITY_OFFICER]: Shield,
  [MilitaryRole.INTELLIGENCE_OFFICER]: Eye,
  [MilitaryRole.SYSTEMS_ADMINISTRATOR]: Terminal,
  [MilitaryRole.COMMANDING_OFFICER]: Star
};

export default function MilitaryAIAssistantPage() {
  // State management
  const [messages, setMessages] = useState<MilitaryMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<ClassificationLevel>(ClassificationLevel.UNCLASSIFIED);
  const [selectedCommandType, setSelectedCommandType] = useState<CommandType>(CommandType.GENERAL_QUERY);
  const [currentUser, setCurrentUser] = useState<MilitaryUser | null>(null);
  const [isSecureMode, setIsSecureMode] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('command');
  // New bot mode states
  const [selectedBotMode, setSelectedBotMode] = useState<BotMode>(BotMode.ASSISTANT);
  const [isAutoExecute, setIsAutoExecute] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [botActivity, setBotActivity] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize military user context (in real app, would come from authentication)
  useEffect(() => {
    // Mock military user - in production this would come from secure authentication
    setCurrentUser({
      id: "mil-usr-001",
      name: "Colonel J. Smith",
      clearanceLevel: ClearanceLevel.SECRET_CLEARED,
      militaryRole: MilitaryRole.SECURITY_OFFICER,
      securityBadgeId: "DHA-SEC-4471",
      lastSecurityValidation: new Date(),
      accessibleClassifications: [
        ClassificationLevel.UNCLASSIFIED,
        ClassificationLevel.RESTRICTED,
        ClassificationLevel.CONFIDENTIAL,
        ClassificationLevel.SECRET
      ],
      specialAccessPrograms: ["HOMELAND_SECURITY", "DHA_OPERATIONS"],
      commandAuthority: true
    });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with secure welcome message
  useEffect(() => {
    if (currentUser) {
      const modeIcons = {
        [BotMode.AGENT]: '🔧',
        [BotMode.ASSISTANT]: '🤖',
        [BotMode.SECURITY_BOT]: '🛡️'
      };
      
      const modeDescriptions = {
        [BotMode.AGENT]: 'Fix issues, add features, debug code',
        [BotMode.ASSISTANT]: 'General assistance and document help',
        [BotMode.SECURITY_BOT]: 'Security monitoring and auto-fixes'
      };
      
      const welcomeMessage: MilitaryMessage = {
        id: 'welcome-mil',
        role: 'assistant',
        content: `///UNCLASSIFIED///

🛡️ **MILITARY-GRADE AI ASSISTANT ACTIVATED**

**SECURITY STATUS:** AUTHENTICATED
**CLEARANCE LEVEL:** ${currentUser.clearanceLevel}
**MILITARY ROLE:** ${currentUser.militaryRole}
**BADGE ID:** ${currentUser.securityBadgeId}

**ACTIVE BOT MODE:** ${modeIcons[selectedBotMode]} ${selectedBotMode}
**MODE CAPABILITY:** ${modeDescriptions[selectedBotMode]}

**AUTHORIZED CLASSIFICATIONS:**
${currentUser.accessibleClassifications.map(c => `• ${c}`).join('\n')}

**AVAILABLE BOT MODES:**
• 🔧 **AGENT MODE** - Developer assistance, fix errors, add features
• 🤖 **ASSISTANT MODE** - Execute commands, general help
• 🛡️ **SECURITY BOT** - Continuous monitoring, auto-fixes

**COMMAND AUTHORITY:** ${currentUser.commandAuthority ? 'GRANTED' : 'DENIED'}

All interactions are logged for security audit compliance.

How may I assist you with classified operations today, ${currentUser.name}?

///UNCLASSIFIED///`,
        timestamp: new Date(),
        classificationLevel: ClassificationLevel.UNCLASSIFIED,
        commandType: CommandType.GENERAL_QUERY,
        clearanceValidated: true,
        auditId: 'welcome-audit'
      };
      setMessages([welcomeMessage]);
    }
  }, [currentUser]);

  // Military-grade command processing
  const sendMilitaryCommand = useMutation({
    mutationFn: async ({ 
      message, 
      classificationLevel, 
      commandType 
    }: { 
      message: string; 
      classificationLevel: ClassificationLevel;
      commandType: CommandType;
    }) => {
      if (!currentUser) {
        throw new Error("No authenticated military user");
      }

      const response = await fetch('/api/ai/military-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          message,
          commandType,
          classificationLevel,
          botMode: selectedBotMode,
          autoExecute: isAutoExecute,
          userContext: {
            userId: currentUser.id,
            clearanceLevel: currentUser.clearanceLevel,
            militaryRole: currentUser.militaryRole,
            securityBadgeId: currentUser.securityBadgeId,
            lastSecurityValidation: currentUser.lastSecurityValidation,
            accessibleClassifications: currentUser.accessibleClassifications,
            specialAccessPrograms: currentUser.specialAccessPrograms,
            commandAuthority: currentUser.commandAuthority,
            auditTrailRequired: true
          },
          conversationId: 'military-session'
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Security clearance expired - re-authentication required");
        }
        if (response.status === 403) {
          throw new Error("Insufficient clearance for requested operation");
        }
        throw new Error("Military command processing failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (!data.success) {
        // Handle security denials gracefully
        const deniedMessage: MilitaryMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `///${selectedClassification}///

⚠️ **COMMAND DENIED**

**REASON:** ${data.error}

**SECURITY WARNINGS:**
${data.securityWarnings?.map((w: string) => `• ${w}`).join('\n') || 'None'}

**RESTRICTIONS:**
${data.restrictions?.map((r: string) => `• ${r}`).join('\n') || 'None'}

**NEXT STEPS:**
• Verify your security clearance is current
• Contact your security officer if needed
• Try a command within your authorization level

///${selectedClassification}///`,
          timestamp: new Date(),
          classificationLevel: selectedClassification,
          commandType: selectedCommandType,
          clearanceValidated: data.clearanceValidated,
          securityWarnings: data.securityWarnings,
          restrictions: data.restrictions,
          auditId: data.auditEntry?.auditId
        };
        
        setMessages(prev => [...prev, deniedMessage]);
        setSecurityWarnings(data.securityWarnings || []);
        
        toast({
          title: "Security Protocol",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      const assistantMessage: MilitaryMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        classificationLevel: data.classificationLevel,
        commandType: selectedCommandType,
        clearanceValidated: data.clearanceValidated,
        securityWarnings: data.securityWarnings,
        auditId: data.auditEntry?.auditId
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update audit trail
      if (data.auditEntry) {
        setAuditTrail(prev => [data.auditEntry, ...prev].slice(0, 50));
      }
      
      // Update security warnings
      setSecurityWarnings(data.securityWarnings || []);
      
      setIsLoading(false);
      
      toast({
        title: "Command Processed",
        description: `Classification: ${data.classificationLevel}`,
        variant: "default"
      });
    },
    onError: (error: any) => {
      console.error('Military command error:', error);
      
      const errorMessage: MilitaryMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `///${ClassificationLevel.UNCLASSIFIED}///

🚨 **SECURITY PROTOCOL ERROR**

${error.message}

**SYSTEM STATUS:** Secure fallback mode active
**RECOMMENDATION:** Contact system administrator

**AVAILABLE OPTIONS:**
• Try a lower classification level
• Verify network security
• Check authentication status

///${ClassificationLevel.UNCLASSIFIED}///`,
        timestamp: new Date(),
        classificationLevel: ClassificationLevel.UNCLASSIFIED,
        commandType: CommandType.GENERAL_QUERY,
        clearanceValidated: false,
        securityWarnings: ["System error occurred during command processing"]
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      
      toast({
        title: "System Security Alert",
        description: "Command processing failed - secure protocols active",
        variant: "destructive"
      });
    }
  });

  const handleSendCommand = async () => {
    if (!inputMessage.trim() || isLoading || !currentUser) return;

    // Validate clearance for selected classification
    if (!currentUser.accessibleClassifications.includes(selectedClassification)) {
      toast({
        title: "Clearance Insufficient",
        description: `Your clearance level (${currentUser.clearanceLevel}) cannot access ${selectedClassification}`,
        variant: "destructive"
      });
      return;
    }

    const userMessage: MilitaryMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      classificationLevel: selectedClassification,
      commandType: selectedCommandType,
      clearanceValidated: true
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputMessage('');

    sendMilitaryCommand.mutate({ 
      message: inputMessage,
      classificationLevel: selectedClassification,
      commandType: selectedCommandType
    });
  };

  const getClassificationBadge = (classification: ClassificationLevel) => {
    const style = CLASSIFICATION_STYLES[classification];
    return (
      <Badge className={`${style.badge} font-mono text-xs`}>
        <Lock className="h-3 w-3 mr-1" />
        {classification}
      </Badge>
    );
  };

  const getRoleBadge = (role: MilitaryRole) => {
    const IconComponent = ROLE_ICONS[role];
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {role.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getClearanceBadge = (clearance: ClearanceLevel) => {
    const IconComponent = CLEARANCE_ICONS[clearance];
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {clearance.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-red-500" />
              Security Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Military-grade security clearance required to access this system.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Military Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Shield className="h-8 w-8 text-red-500" />
                MILITARY-GRADE AI ASSISTANT
              </h1>
              <p className="text-gray-300 mt-1 font-mono">
                CLASSIFIED OPERATIONS • DEPARTMENT OF HOME AFFAIRS
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                <Activity className="h-3 w-3" />
                SECURE MODE
              </Badge>
              {getClearanceBadge(currentUser.clearanceLevel)}
              {getRoleBadge(currentUser.militaryRole)}
            </div>
          </div>
        </div>

        {/* Security Warnings */}
        {securityWarnings.length > 0 && (
          <Alert className="mb-4 border-yellow-500 bg-yellow-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Warnings:</strong>
              <ul className="mt-1">
                {securityWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Military Controls */}
          <div className="lg:col-span-1">
            <Card className="mb-4 border-red-800 bg-gray-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                  <Lock className="h-5 w-5" />
                  Classification Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedClassification} onValueChange={(value: ClassificationLevel) => setSelectedClassification(value)}>
                  <SelectTrigger className="w-full" data-testid="classification-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUser.accessibleClassifications.map((level) => (
                      <SelectItem key={level} value={level}>
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          {level}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="mb-4 border-blue-800 bg-gray-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
                  <Terminal className="h-5 w-5" />
                  Command Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedCommandType} onValueChange={(value: CommandType) => setSelectedCommandType(value)}>
                  <SelectTrigger className="w-full" data-testid="command-type-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CommandType.GENERAL_QUERY}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        General Query
                      </div>
                    </SelectItem>
                    <SelectItem value={CommandType.DOCUMENT_PROCESSING}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Document Processing
                      </div>
                    </SelectItem>
                    <SelectItem value={CommandType.SECURITY_ANALYSIS}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security Analysis
                      </div>
                    </SelectItem>
                    {currentUser.clearanceLevel !== ClearanceLevel.CIVILIAN && (
                      <>
                        <SelectItem value={CommandType.INTELLIGENCE_REQUEST}>
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Intelligence Request
                          </div>
                        </SelectItem>
                        {currentUser.commandAuthority && (
                          <SelectItem value={CommandType.OPERATIONAL_COMMAND}>
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              Operational Command
                            </div>
                          </SelectItem>
                        )}
                        <SelectItem value={CommandType.CLASSIFIED_INQUIRY}>
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4" />
                            Classified Inquiry
                          </div>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Bot Mode Selector */}
            <Card className="mb-4 border-purple-800 bg-gray-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
                  <BrainCircuit className="h-5 w-5" />
                  Bot Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedBotMode} onValueChange={(value: BotMode) => setSelectedBotMode(value)}>
                  <SelectTrigger className="w-full" data-testid="bot-mode-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BotMode.AGENT}>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Agent Mode
                      </div>
                    </SelectItem>
                    <SelectItem value={BotMode.ASSISTANT}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Assistant Mode
                      </div>
                    </SelectItem>
                    <SelectItem value={BotMode.SECURITY_BOT}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Security Bot
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2 text-xs text-gray-400">
                  {selectedBotMode === BotMode.AGENT && "Fix errors, add features, debug code"}
                  {selectedBotMode === BotMode.ASSISTANT && "General assistance and commands"}
                  {selectedBotMode === BotMode.SECURITY_BOT && "Auto security monitoring & fixes"}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={isAutoExecute}
                      onChange={(e) => setIsAutoExecute(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    <PlayCircle className="h-4 w-4" />
                    Auto-Execute Actions
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* User Security Profile */}
            <Card className="mb-4 border-green-800 bg-gray-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-green-400">
                  <Key className="h-5 w-5" />
                  Security Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-400">Name:</span> {currentUser.name}
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Badge:</span> {currentUser.securityBadgeId}
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Last Auth:</span> {currentUser.lastSecurityValidation.toLocaleTimeString()}
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Command Auth:</span> 
                  <Badge variant={currentUser.commandAuthority ? "default" : "destructive"} className="ml-2">
                    {currentUser.commandAuthority ? "GRANTED" : "DENIED"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Interface */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                <TabsTrigger value="command" className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Command Interface
                </TabsTrigger>
                <TabsTrigger value="audit" className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Audit Trail
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Monitor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="command">
                <Card className="border-red-800 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-red-400" />
                        Military Command Console
                      </span>
                      {getClassificationBadge(selectedClassification)}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Secure military-grade AI assistant with full audit trail
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Messages */}
                    <ScrollArea className="h-96 mb-4 border border-gray-700 rounded-md p-4 bg-black">
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const style = CLASSIFICATION_STYLES[message.classificationLevel];
                          return (
                            <div key={message.id} className={`p-4 rounded-lg border ${style.borderColor} ${style.bgColor}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                  <span className="font-semibold text-white">
                                    {message.role === 'user' ? currentUser.name : 'MILITARY AI'}
                                  </span>
                                  {getClassificationBadge(message.classificationLevel)}
                                </div>
                                <div className="flex items-center gap-2">
                                  {message.clearanceValidated ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="text-xs text-gray-400">
                                    {message.timestamp.toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="text-white whitespace-pre-wrap font-mono text-sm">
                                {message.content}
                              </div>
                              
                              {message.securityWarnings && message.securityWarnings.length > 0 && (
                                <div className="mt-2 p-2 bg-yellow-900 border border-yellow-600 rounded">
                                  <div className="flex items-center gap-1 text-yellow-400 font-semibold text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    SECURITY WARNINGS
                                  </div>
                                  {message.securityWarnings.map((warning, idx) => (
                                    <div key={idx} className="text-yellow-300 text-xs">• {warning}</div>
                                  ))}
                                </div>
                              )}
                              
                              {message.auditId && (
                                <div className="mt-2 text-xs text-gray-500 font-mono">
                                  Audit ID: {message.auditId}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {isLoading && (
                          <div className="p-4 rounded-lg border border-blue-600 bg-blue-950">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 animate-pulse" />
                              <span className="font-semibold">MILITARY AI</span>
                              <Badge className="bg-blue-700 text-blue-100">PROCESSING</Badge>
                            </div>
                            <div className="mt-2 text-blue-300">
                              Processing military command...
                            </div>
                          </div>
                        )}
                      </div>
                      <div ref={messagesEndRef} />
                    </ScrollArea>

                    {/* Command Input */}
                    <div className="flex gap-2">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={`Enter military command (${selectedClassification})...`}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
                        disabled={isLoading}
                        className="flex-1 bg-gray-800 border-gray-600 text-white font-mono"
                        data-testid="military-command-input"
                      />
                      <Button 
                        onClick={handleSendCommand} 
                        disabled={isLoading || !inputMessage.trim()}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="send-command-button"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 font-mono">
                      Classification: {selectedClassification} | Command Type: {selectedCommandType.replace(/_/g, ' ')}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit">
                <Card className="border-blue-800 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="h-5 w-5 text-blue-400" />
                      Security Audit Trail
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Comprehensive audit log of all military AI interactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {auditTrail.map((entry, index) => (
                          <div key={index} className="p-3 bg-gray-800 rounded border border-gray-700">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm text-blue-400">{entry.auditId}</span>
                              <span className="text-xs text-gray-400">{entry.timestamp.toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-gray-400">Command:</span> {entry.commandType}
                              </div>
                              <div>
                                <span className="text-gray-400">Classification:</span> {entry.classificationLevel}
                              </div>
                              <div>
                                <span className="text-gray-400">Clearance:</span> {entry.clearanceLevel}
                              </div>
                              <div>
                                <span className="text-gray-400">Risk Score:</span> 
                                <Badge variant={entry.riskScore > 70 ? "destructive" : entry.riskScore > 40 ? "secondary" : "default"} className="ml-1">
                                  {entry.riskScore}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card className="border-green-800 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-400" />
                      Security Monitor
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Real-time security status and threat monitoring
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-950 border border-green-800 rounded">
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-semibold">Security Status</span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div>• All systems secure</div>
                          <div>• Clearance validated</div>
                          <div>• Audit logging active</div>
                          <div>• Threat level: LOW</div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-blue-950 border border-blue-800 rounded">
                        <div className="flex items-center gap-2 text-blue-400">
                          <Activity className="h-5 w-5" />
                          <span className="font-semibold">System Metrics</span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div>• Uptime: 99.9%</div>
                          <div>• Response time: &lt;100ms</div>
                          <div>• Commands processed: {messages.length}</div>
                          <div>• Audit entries: {auditTrail.length}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}