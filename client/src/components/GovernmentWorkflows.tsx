import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, CheckCircle, Clock, FileText, Shield, User,
  AlertTriangle, Info, Package, Truck, Building2, Calendar,
  FileCheck, UserCheck, ShieldCheck, Fingerprint, Camera,
  XCircle, RefreshCw, ChevronRight, Timer, TrendingUp,
  Phone, Mail, MapPin, Users, Activity, Database
} from "lucide-react";
import { formatSADate, calculateWorkingDays } from "@/lib/validators";

// Types for different workflow states
type WorkflowStatus = 
  | "draft"
  | "submitted"
  | "initial_review"
  | "document_verification"
  | "security_clearance"
  | "biometric_validation"
  | "supervisor_review"
  | "quality_assurance"
  | "production"
  | "ready_for_collection"
  | "collected"
  | "rejected"
  | "appeal_pending"
  | "on_hold";

interface WorkflowState {
  status: WorkflowStatus;
  message: string;
  description: string;
  timestamp: Date;
  officer?: string;
  notes?: string;
  nextAction?: string;
  estimatedCompletion?: Date;
  severity: "info" | "warning" | "success" | "error";
  icon: React.ReactNode;
}

// Realistic workflow states with government language
const workflowStates: Record<WorkflowStatus, Omit<WorkflowState, 'timestamp'>> = {
  draft: {
    status: "draft",
    message: "Application Draft Saved",
    description: "Your application has been saved as a draft. Please complete all required sections before submission.",
    severity: "info",
    icon: <FileText className="h-4 w-4" />,
    nextAction: "Complete application and submit"
  },
  submitted: {
    status: "submitted",
    message: "Application Successfully Submitted",
    description: "Your application has been received by the Department of Home Affairs and assigned to the processing queue.",
    severity: "success",
    icon: <CheckCircle className="h-4 w-4" />,
    nextAction: "Awaiting initial review by Home Affairs officer"
  },
  initial_review: {
    status: "initial_review",
    message: "Initial Review in Progress",
    description: "A Home Affairs officer is conducting the initial assessment of your application for completeness and eligibility.",
    severity: "info",
    icon: <User className="h-4 w-4" />,
    nextAction: "Document verification pending"
  },
  document_verification: {
    status: "document_verification",
    message: "Document Verification Underway",
    description: "Supporting documents are being verified for authenticity and compliance with regulatory requirements.",
    severity: "info",
    icon: <FileCheck className="h-4 w-4" />,
    nextAction: "Security clearance verification required"
  },
  security_clearance: {
    status: "security_clearance",
    message: "Security Clearance Verification",
    description: "Background checks are being conducted with the South African Police Service (SAPS) and other security agencies.",
    severity: "warning",
    icon: <Shield className="h-4 w-4" />,
    nextAction: "Awaiting clearance from security services"
  },
  biometric_validation: {
    status: "biometric_validation",
    message: "Biometric Data Validation",
    description: "Your biometric information is being validated against the National Population Register (NPR) database.",
    severity: "info",
    icon: <Fingerprint className="h-4 w-4" />,
    nextAction: "Supervisor review pending"
  },
  supervisor_review: {
    status: "supervisor_review",
    message: "Pending Supervisor Approval",
    description: "Your application is awaiting review and authorization by a senior Home Affairs official.",
    severity: "info",
    icon: <UserCheck className="h-4 w-4" />,
    nextAction: "Quality assurance check required"
  },
  quality_assurance: {
    status: "quality_assurance",
    message: "Quality Assurance Check",
    description: "Final verification and quality control checks are being performed before document production.",
    severity: "info",
    icon: <ShieldCheck className="h-4 w-4" />,
    nextAction: "Document production queue"
  },
  production: {
    status: "production",
    message: "Document in Production",
    description: "Your document is being printed and prepared at the Government Printing Works facility.",
    severity: "success",
    icon: <Package className="h-4 w-4" />,
    nextAction: "Dispatch to collection office"
  },
  ready_for_collection: {
    status: "ready_for_collection",
    message: "Ready for Collection",
    description: "Your document is ready for collection at the selected Home Affairs office. Please bring your receipt and ID.",
    severity: "success",
    icon: <CheckCircle className="h-4 w-4" />,
    nextAction: "Visit office for collection"
  },
  collected: {
    status: "collected",
    message: "Document Collected",
    description: "Document has been successfully collected and issued to the applicant.",
    severity: "success",
    icon: <CheckCircle className="h-4 w-4" />,
    nextAction: "Process complete"
  },
  rejected: {
    status: "rejected",
    message: "Application Rejected",
    description: "Your application has been rejected. Please review the rejection reasons and submit an appeal if applicable.",
    severity: "error",
    icon: <XCircle className="h-4 w-4" />,
    nextAction: "Submit appeal within 30 days"
  },
  appeal_pending: {
    status: "appeal_pending",
    message: "Appeal Under Review",
    description: "Your appeal is being reviewed by the Appeals Board. You will be notified of the outcome.",
    severity: "warning",
    icon: <AlertTriangle className="h-4 w-4" />,
    nextAction: "Awaiting Appeals Board decision"
  },
  on_hold: {
    status: "on_hold",
    message: "Application On Hold",
    description: "Additional information or documentation is required. Please respond to the request to proceed.",
    severity: "warning",
    icon: <Clock className="h-4 w-4" />,
    nextAction: "Submit requested information"
  }
};

interface ApplicationWorkflowProps {
  currentStatus: WorkflowStatus;
  referenceNumber: string;
  submittedDate: Date;
  history?: {
    status: WorkflowStatus;
    timestamp: Date;
    officer?: string;
    notes?: string;
  }[];
}

export function ApplicationWorkflow({ 
  currentStatus, 
  referenceNumber, 
  submittedDate,
  history = []
}: ApplicationWorkflowProps) {
  const currentState = workflowStates[currentStatus];
  const estimatedDays = Math.floor(Math.random() * 15) + 5;
  const estimatedCompletion = calculateWorkingDays(new Date(), estimatedDays);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "success":
        return "border-green-200 bg-green-50";
      case "warning":
        return "border-amber-200 bg-amber-50";
      case "error":
        return "border-red-200 bg-red-50";
      default:
        return "border-blue-200 bg-blue-50";
    }
  };

  const getSeverityIconColor = (severity: string) => {
    switch (severity) {
      case "success":
        return "text-green-600";
      case "warning":
        return "text-amber-600";
      case "error":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  return (
    <Card className="government-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Application Status</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {referenceNumber}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className={getSeverityStyles(currentState.severity)}>
          <div className={getSeverityIconColor(currentState.severity)}>
            {currentState.icon}
          </div>
          <AlertTitle className="font-semibold">
            {currentState.message}
          </AlertTitle>
          <AlertDescription className="mt-2">
            {currentState.description}
          </AlertDescription>
          {currentState.nextAction && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">Next Step:</span>
                <span>{currentState.nextAction}</span>
              </div>
            </div>
          )}
        </Alert>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Submitted Date</div>
            <div className="font-medium mt-1">{formatSADate(submittedDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Est. Completion</div>
            <div className="font-medium mt-1">{formatSADate(estimatedCompletion)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Working Days</div>
            <div className="font-medium mt-1">{estimatedDays} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current Stage</div>
            <div className="font-medium mt-1 capitalize">
              {currentStatus.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Processing History</h4>
              <ScrollArea className="h-48">
                <div className="space-y-3">
                  {history.map((item, index) => {
                    const state = workflowStates[item.status];
                    return (
                      <div 
                        key={index} 
                        className="border-l-2 border-muted pl-4 pb-3"
                        data-testid={`history-item-${index}`}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <div className={getSeverityIconColor(state.severity)}>
                            {state.icon}
                          </div>
                          <span className="font-medium">{state.message}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatSADate(item.timestamp)} at {item.timestamp.toLocaleTimeString('en-ZA')}
                        </div>
                        {item.officer && (
                          <div className="text-xs text-muted-foreground">
                            Processed by: {item.officer}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs mt-1 p-2 bg-muted rounded">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface SystemNotificationProps {
  type: "maintenance" | "holiday" | "system_update" | "office_closure" | "service_disruption";
  message: string;
  startDate?: Date;
  endDate?: Date;
  affectedServices?: string[];
}

export function SystemNotification({ 
  type, 
  message, 
  startDate, 
  endDate,
  affectedServices = []
}: SystemNotificationProps) {
  const getNotificationStyle = () => {
    switch (type) {
      case "maintenance":
        return { 
          bg: "bg-blue-50 border-blue-200", 
          icon: <RefreshCw className="h-4 w-4 text-blue-600" />,
          title: "Scheduled Maintenance"
        };
      case "holiday":
        return { 
          bg: "bg-green-50 border-green-200", 
          icon: <Calendar className="h-4 w-4 text-green-600" />,
          title: "Public Holiday Notice"
        };
      case "system_update":
        return { 
          bg: "bg-purple-50 border-purple-200", 
          icon: <Database className="h-4 w-4 text-purple-600" />,
          title: "System Update"
        };
      case "office_closure":
        return { 
          bg: "bg-orange-50 border-orange-200", 
          icon: <Building2 className="h-4 w-4 text-orange-600" />,
          title: "Office Closure"
        };
      case "service_disruption":
        return { 
          bg: "bg-red-50 border-red-200", 
          icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
          title: "Service Disruption"
        };
    }
  };

  const style = getNotificationStyle();

  return (
    <Alert className={`${style.bg} border`}>
      {style.icon}
      <AlertTitle>{style.title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{message}</p>
          
          {(startDate || endDate) && (
            <div className="text-sm">
              {startDate && (
                <span>From: {formatSADate(startDate)}</span>
              )}
              {startDate && endDate && <span className="mx-2">|</span>}
              {endDate && (
                <span>Until: {formatSADate(endDate)}</span>
              )}
            </div>
          )}
          
          {affectedServices.length > 0 && (
            <div className="text-sm">
              <span className="font-medium">Affected Services:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {affectedServices.map((service, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function GovernmentServiceHours() {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isOfficeHours = () => {
    const hours = currentTime.getHours();
    const day = currentTime.getDay();
    return day >= 1 && day <= 5 && hours >= 8 && hours < 15.5; // 8:00 - 15:30
  };

  const nextOpenTime = () => {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    
    // Skip to Monday if it's weekend
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    
    return tomorrow;
  };

  return (
    <Card className="government-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Service Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Current Status</span>
            {isOfficeHours() ? (
              <Badge className="bg-green-500 text-white">
                OPEN - Office Hours
              </Badge>
            ) : (
              <Badge className="bg-orange-500 text-white">
                CLOSED - After Hours
              </Badge>
            )}
          </div>
          
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monday - Friday</span>
              <span className="font-medium">08:00 - 15:30</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saturday</span>
              <span className="font-medium">Closed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sunday & Public Holidays</span>
              <span className="font-medium">Closed</span>
            </div>
          </div>
          
          {!isOfficeHours() && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Online services available 24/7. Office reopens {formatSADate(nextOpenTime())} at 08:00
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}