import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Clock, Users, TrendingUp, Calendar, AlertCircle, CheckCircle,
  FileText, Loader2, Timer, Building2, MapPin, Phone, Mail,
  RefreshCw, Info, ChevronRight, Package, Truck, User
} from "lucide-react";
import { 
  generateQueueNumber, 
  calculateWorkingDays, 
  generateDHAReferenceNumber,
  getProcessingStatus,
  formatSADate
} from "@/lib/validators";

interface QueueStatusProps {
  documentType: string;
  applicationId?: string;
}

export function QueueStatus({ documentType, applicationId }: QueueStatusProps) {
  const [queueData, setQueueData] = useState(() => generateQueueNumber());
  const [timeRemaining, setTimeRemaining] = useState(queueData.estimatedWaitTime);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}, ${hours % 24} hours`;
    }
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    
    return `${mins} minutes`;
  };

  return (
    <Card className="government-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Queue Management System
          </CardTitle>
          <Badge className="dha-badge">
            Live Queue
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-3xl font-bold text-primary">
              {queueData.queueNumber}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Your Queue Number
            </div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {queueData.position.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Position in Queue
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Applications</span>
            <span className="font-medium">{queueData.total.toLocaleString()}</span>
          </div>
          
          <Progress 
            value={(1 - queueData.position / queueData.total) * 100} 
            className="h-2"
          />
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4" />
          <AlertTitle>Estimated Wait Time</AlertTitle>
          <AlertDescription>
            Approximately {formatTime(timeRemaining)} remaining
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>Auto-refresh enabled</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ProcessingStagesProps {
  currentStage: number;
  referenceNumber?: string;
  documentType: string;
}

export function ProcessingStages({ currentStage, referenceNumber, documentType }: ProcessingStagesProps) {
  const [reference] = useState(referenceNumber || generateDHAReferenceNumber(documentType));
  const stages = [
    "Application Received",
    "Document Verification", 
    "Security Clearance",
    "Biometric Validation",
    "Supervisor Review",
    "Quality Assurance",
    "Document Production",
    "Ready for Collection"
  ];

  const currentStatus = getProcessingStatus(currentStage);
  const completionDate = calculateWorkingDays(new Date(), currentStatus.estimatedDays);

  return (
    <Card className="government-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Application Processing Status
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {reference}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">
            {currentStatus.message}
          </AlertTitle>
          <AlertDescription className="text-green-800">
            {currentStatus.description}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const status = index < currentStage ? "completed" : 
                         index === currentStage ? "in_progress" : "pending";
            
            return (
              <div 
                key={index}
                className={`flex items-start gap-3 ${
                  status === "pending" ? "opacity-50" : ""
                }`}
                data-testid={`processing-stage-${index}`}
              >
                <div className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center ${
                  status === "completed" ? "bg-green-500 text-white" :
                  status === "in_progress" ? "bg-blue-500 text-white" :
                  "bg-gray-200"
                }`}>
                  {status === "completed" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : status === "in_progress" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="font-medium text-sm">{stage}</div>
                  {status === "in_progress" && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Processing... Please check back later
                    </div>
                  )}
                  {status === "completed" && (
                    <div className="text-xs text-green-600 mt-1">
                      Completed
                    </div>
                  )}
                </div>
                
                {index < stages.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Estimated Completion
            </span>
            <span className="font-medium">
              {formatSADate(completionDate)}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Working Days Remaining
            </span>
            <span className="font-medium">
              {currentStatus.estimatedDays} days
            </span>
          </div>
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Processing times are estimates based on current workload. 
            Actual times may vary. Excludes weekends and public holidays.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

interface ApplicationSummaryProps {
  applicationData: {
    type: string;
    submittedDate: Date;
    referenceNumber?: string;
    status: "pending" | "processing" | "completed" | "rejected";
    collectionOffice?: string;
    urgentProcessing?: boolean;
  };
}

export function ApplicationSummary({ applicationData }: ApplicationSummaryProps) {
  const reference = applicationData.referenceNumber || generateDHAReferenceNumber(applicationData.type);
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200"
  };

  return (
    <Card className="certificate-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Application Summary</CardTitle>
          {applicationData.urgentProcessing && (
            <Badge className="bg-red-500 text-white">
              URGENT
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Reference Number</div>
            <div className="font-mono font-medium mt-1">{reference}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Application Type</div>
            <div className="font-medium mt-1 capitalize">
              {applicationData.type.replace(/_/g, ' ')}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Submitted Date</div>
            <div className="font-medium mt-1">
              {formatSADate(applicationData.submittedDate)}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Status</div>
            <Badge 
              className={`mt-1 ${statusColors[applicationData.status]}`}
              variant="outline"
            >
              {applicationData.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {applicationData.collectionOffice && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Collection Office
              </div>
              <div className="text-sm text-muted-foreground pl-6">
                {applicationData.collectionOffice}
              </div>
            </div>
          </>
        )}

        <Separator />
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <FileText className="h-4 w-4 mr-1" />
            View Details
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Truck className="h-4 w-4 mr-1" />
            Track Delivery
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DHAOfficeInfoProps {
  officeName: string;
  address: string;
  phone: string;
  email: string;
  workingHours: string;
  services: string[];
}

export function DHAOfficeInfo({ 
  officeName, 
  address, 
  phone, 
  email, 
  workingHours,
  services 
}: DHAOfficeInfoProps) {
  return (
    <Card className="government-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {officeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Address</div>
              <div className="text-muted-foreground">{address}</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Phone</div>
              <div className="text-muted-foreground">{phone}</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Email</div>
              <div className="text-muted-foreground">{email}</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">Working Hours</div>
              <div className="text-muted-foreground">{workingHours}</div>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <div className="text-sm font-medium mb-2">Services Available</div>
          <div className="flex flex-wrap gap-1">
            {services.map((service, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs"
              >
                {service}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}