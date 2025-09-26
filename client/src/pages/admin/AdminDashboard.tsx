import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  Users, 
  FileText, 
  Shield, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Server,
  Zap,
  Globe,
  UserCheck,
  Plane,
  Printer,
  Download,
  Eye,
  RefreshCw
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { CardSkeleton, TableSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { pdfService } from "@/services/pdf-service";

interface SystemMetric {
  metricType: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  createdAt: string;
  details?: any;
}

interface FraudAlert {
  id: string;
  alertType: string;
  riskScore: number;
  isResolved: boolean;
  createdAt: string;
}

interface SystemHealth {
  // Original expected structure
  status?: string;
  uptime?: number;
  memory?: { used: number; total: number; percentage: number } | number; // Can be object or number
  cpu?: { percentage: number } | number; // Can be object or number
  database?: { status: string; connectionCount: number };
  integrations?: Record<string, { status: string; lastCheck: string }>;
  // Alternative structure from /api/monitoring/health
  overall?: string;
  resources?: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  security?: {
    threatLevel: string;
    activeIncidents: number;
    fraudAlerts: number;
  };
  compliance?: {
    score: number;
    violations: number;
    uptime: number;
  };
  // Simple response structure
  network?: number;
  storage?: number;
  timestamp?: string;
}

function AdminDashboard() {
  const { toast } = useToast();
  // Re-enable WebSocket with proper error handling
  const { socket, isConnected } = useWebSocket();
  const [showPDFGenerateDialog, setShowPDFGenerateDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDocumentType, setPdfDocumentType] = useState<string>("");

  // Fetch system health with optimized caching
  const { data: systemHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/monitoring/health"],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // 15 seconds stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Transform the API response to match the expected structure with safe coercion
  const normalizedSystemHealth = useMemo(() => {
    if (!systemHealth) return null;
    
    const defaultTotalMemory = 8 * 1024 * 1024 * 1024; // 8GB in bytes
    
    // Safe coercion function for numeric values
    const safeNumber = (value: any): number => {
      const num = Number(value ?? 0);
      return isNaN(num) ? 0 : num;
    };
    
    // Handle simple response structure {cpu, memory, network, storage, timestamp}
    if (typeof systemHealth.memory === 'number') {
      const memoryPercentage = safeNumber(systemHealth.memory);
      const memoryUsed = (memoryPercentage / 100) * defaultTotalMemory;
      
      return {
        status: 'healthy',
        uptime: safeNumber(systemHealth.uptime),
        memory: {
          used: memoryUsed,
          total: defaultTotalMemory,
          percentage: memoryPercentage
        },
        cpu: {
          percentage: safeNumber(systemHealth.cpu)
        },
        database: systemHealth.database || { status: 'unknown', connectionCount: 0 },
        integrations: systemHealth.integrations || {}
      };
    }
    
    // Handle autonomous monitoring bot response structure (resources instead of memory/cpu)
    if (systemHealth.resources && !systemHealth.memory) {
      const memoryPercentage = safeNumber(systemHealth.resources.memory);
      const memoryUsed = (memoryPercentage / 100) * defaultTotalMemory;
      
      return {
        status: systemHealth.overall || systemHealth.status || 'unknown',
        uptime: safeNumber(systemHealth.compliance?.uptime || systemHealth.uptime),
        memory: {
          used: memoryUsed,
          total: defaultTotalMemory,
          percentage: memoryPercentage
        },
        cpu: {
          percentage: safeNumber(systemHealth.resources.cpu)
        },
        database: systemHealth.database || { status: 'unknown', connectionCount: 0 },
        integrations: systemHealth.integrations || {}
      };
    }
    
    // Handle object structure with memory/cpu as objects
    if (systemHealth.memory && typeof systemHealth.memory === 'object') {
      return {
        status: systemHealth.status || 'unknown',
        uptime: safeNumber(systemHealth.uptime),
        memory: {
          used: safeNumber(systemHealth.memory.used),
          total: safeNumber(systemHealth.memory.total) || defaultTotalMemory,
          percentage: safeNumber(systemHealth.memory.percentage)
        },
        cpu: {
          percentage: safeNumber(
            typeof systemHealth.cpu === 'object' ? systemHealth.cpu.percentage : systemHealth.cpu
          )
        },
        database: systemHealth.database || { status: 'unknown', connectionCount: 0 },
        integrations: systemHealth.integrations || {}
      };
    }
    
    // Fallback for any other structure
    return {
      status: systemHealth.status || systemHealth.overall || 'unknown',
      uptime: safeNumber(systemHealth.uptime),
      memory: {
        used: 0,
        total: defaultTotalMemory,
        percentage: 0
      },
      cpu: {
        percentage: 0
      },
      database: systemHealth.database || { status: 'unknown', connectionCount: 0 },
      integrations: systemHealth.integrations || {}
    };
  }, [systemHealth]);

  // Fetch system metrics with optimized caching
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetric[]>({
    queryKey: ["/api/monitoring/metrics"],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // 30 seconds stale time
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Fetch security events with optimized caching
  const { data: securityEvents, isLoading: eventsLoading } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security/events", { limit: 10 }],
    refetchInterval: 30000,
    staleTime: 15000, // 15 seconds stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch fraud alerts with optimized caching
  const { data: fraudAlerts, isLoading: fraudLoading } = useQuery<FraudAlert[]>({
    queryKey: ["/api/fraud/alerts", { resolved: false }],
    refetchInterval: 30000,
    staleTime: 15000, // 15 seconds stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Optimized WebSocket event handlers with useCallback
  const handleSystemHealth = useCallback(() => {
    refetchHealth();
  }, [refetchHealth]);

  const handleSecurityAlert = useCallback((data: any) => {
    toast({
      title: "Security Alert",
      description: `New ${data.severity} security event detected`,
      variant: data.severity === "high" ? "destructive" : "default",
    });
  }, [toast]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on("system:health", handleSystemHealth);
      socket.on("security:alert", handleSecurityAlert);

      return () => {
        if (socket) {
          socket.off("system:health", handleSystemHealth);
          socket.off("security:alert", handleSecurityAlert);
        }
      };
    }
  }, [socket, isConnected, handleSystemHealth, handleSecurityAlert]);

  const getStatusColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "online":
      case "active":
        return "text-green-600 bg-green-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      case "error":
      case "offline":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }, []);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }, []);

  const formatUptime = useCallback((seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }, []);

  // PDF Generation handlers
  const generateApprovedDocumentPDF = useCallback(async () => {
    if (!selectedApplication || !pdfDocumentType) {
      toast({
        title: "Error",
        description: "Please select a document type",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const documentData = {
        ...selectedApplication,
        approvalDate: new Date().toISOString(),
        approvedBy: "Admin Officer",
        referenceNumber: `DHA-${Date.now()}`,
      };

      const result = await pdfService.generateDocument(pdfDocumentType, documentData);

      if (result.success) {
        toast({
          title: "PDF Generated Successfully",
          description: `${pdfDocumentType.replace(/_/g, " ")} has been generated and downloaded.`,
          className: "bg-green-50 border-green-200",
        });
        
        // Log the generation in audit trail
        await apiRequest("/api/audit/log", "POST", {
          action: "pdf_generated",
          entityType: "application",
          entityId: selectedApplication.id,
          details: {
            documentType: pdfDocumentType,
            applicationId: selectedApplication.id,
            timestamp: new Date().toISOString(),
          },
        });
        
        setShowPDFGenerateDialog(false);
      } else {
        toast({
          title: "PDF Generation Failed",
          description: result.error || "Failed to generate PDF",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [selectedApplication, pdfDocumentType, toast]);

  const handleGeneratePDF = useCallback((application: any) => {
    setSelectedApplication(application);
    setPdfDocumentType("");
    setShowPDFGenerateDialog(true);
  }, []);

  // Memoized calculations for performance
  const unresolvedAlertsCount = useMemo(() => 
    fraudAlerts?.filter(alert => !alert.isResolved).length || 0, 
    [fraudAlerts]
  );
  
  const criticalEventsCount = useMemo(() => 
    securityEvents?.filter(event => event.severity === "high").length || 0, 
    [securityEvents]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            System overview and real-time monitoring for DHA Digital Services
          </p>
        </div>

        {/* Status Cards - Memoized for performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="card-system-health">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthLoading ? "..." : (normalizedSystemHealth?.status || systemHealth?.overall || "Unknown")}
              </div>
              <Badge className={getStatusColor(normalizedSystemHealth?.status || systemHealth?.overall || "unknown")}>
                {normalizedSystemHealth?.status || systemHealth?.overall || "Unknown"}
              </Badge>
              {(normalizedSystemHealth?.uptime !== undefined || systemHealth?.compliance?.uptime !== undefined) && (
                <p className="text-xs text-muted-foreground mt-2">
                  Uptime: {formatUptime(normalizedSystemHealth?.uptime || systemHealth?.compliance?.uptime || 0)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-security-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalEventsCount}</div>
              <p className="text-xs text-muted-foreground">
                Critical events requiring attention
              </p>
              {criticalEventsCount > 0 && (
                <Badge variant="destructive" className="mt-2">
                  Action Required
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-fraud-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unresolvedAlertsCount}</div>
              <p className="text-xs text-muted-foreground">
                Unresolved fraud alerts
              </p>
              {unresolvedAlertsCount > 0 && (
                <Badge variant="destructive" className="mt-2">
                  Review Needed
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-database">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {normalizedSystemHealth?.database?.connectionCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active connections
              </p>
              <Badge className={getStatusColor(normalizedSystemHealth?.database?.status || "unknown")}>
                {normalizedSystemHealth?.database?.status || "Unknown"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* System Performance */}
        {normalizedSystemHealth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-memory-usage">
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>
                  Current system memory utilization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {Math.round((normalizedSystemHealth.memory.used || 0) / 1024 / 1024)}MB</span>
                    <span>Total: {Math.round((normalizedSystemHealth.memory.total || 0) / 1024 / 1024)}MB</span>
                  </div>
                  <Progress value={normalizedSystemHealth.memory.percentage || 0} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {Number(normalizedSystemHealth.memory.percentage || 0).toFixed(1)}% utilized
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-cpu-usage">
              <CardHeader>
                <CardTitle>CPU Usage</CardTitle>
                <CardDescription>
                  Current processor utilization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Load</span>
                    <span>{Number(normalizedSystemHealth.cpu.percentage || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={normalizedSystemHealth.cpu.percentage || 0} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    System performance optimal
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Activity */}
        <Tabs defaultValue="security" className="space-y-4">
          <TabsList>
            <TabsTrigger value="security" data-testid="tab-security">Security Events</TabsTrigger>
            <TabsTrigger value="fraud" data-testid="tab-fraud">Fraud Alerts</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Recent Security Events</CardTitle>
                <CardDescription>
                  Latest security events and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <TableSkeleton rows={5} />
                ) : securityEvents && securityEvents.length > 0 ? (
                  <div className="space-y-3">
                    {securityEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`security-event-${event.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity}
                          </Badge>
                          <div>
                            <p className="font-medium">{event.eventType}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2" />
                    <p>No recent security events</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud">
            <Card>
              <CardHeader>
                <CardTitle>Fraud Alerts</CardTitle>
                <CardDescription>
                  Active fraud detection alerts requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fraudLoading ? (
                  <TableSkeleton rows={3} />
                ) : fraudAlerts && fraudAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {fraudAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`fraud-alert-${alert.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          <div>
                            <p className="font-medium">{alert.alertType}</p>
                            <p className="text-sm text-muted-foreground">
                              Risk Score: {alert.riskScore}/100 • {new Date(alert.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={alert.isResolved ? "secondary" : "destructive"}>
                          {alert.isResolved ? "Resolved" : "Active"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No active fraud alerts</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>Integration Status</CardTitle>
                <CardDescription>
                  Status of external system integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {normalizedSystemHealth?.integrations && Object.keys(normalizedSystemHealth.integrations).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(normalizedSystemHealth.integrations).map(([name, integration]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`integration-${name}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Server className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium capitalize">{name}</p>
                            <p className="text-sm text-muted-foreground">
                              Last check: {new Date(integration.lastCheck).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(integration.status)}>
                          {integration.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2" />
                    <p>Integration status unavailable</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Applications Section with PDF Generation */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>
              Approved applications ready for document generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Sample approved applications */}
              <div className="flex items-center justify-between p-4 border rounded-lg" data-testid="application-item">
                <div className="flex-1">
                  <p className="font-medium">Passport Application - John Doe</p>
                  <p className="text-sm text-muted-foreground">Approved on {new Date().toLocaleDateString()}</p>
                  <Badge className="mt-1 bg-green-50 text-green-600">Approved</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGeneratePDF({ 
                    id: "1", 
                    type: "passport", 
                    fullName: "John Doe",
                    status: "approved" 
                  })}
                  data-testid="button-generate-pdf-application"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Generate PDF
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg" data-testid="application-item">
                <div className="flex-1">
                  <p className="font-medium">Work Permit - Jane Smith</p>
                  <p className="text-sm text-muted-foreground">Approved on {new Date().toLocaleDateString()}</p>
                  <Badge className="mt-1 bg-green-50 text-green-600">Approved</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGeneratePDF({ 
                    id: "2", 
                    type: "work_permit", 
                    fullName: "Jane Smith",
                    status: "approved" 
                  })}
                  data-testid="button-generate-pdf-application"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Generate PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF Generation Dialog */}
        <Dialog open={showPDFGenerateDialog} onOpenChange={setShowPDFGenerateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Official Document</DialogTitle>
              <DialogDescription>
                Select the document type to generate for this approved application
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-medium mb-2">Application Details:</p>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p>Name: {selectedApplication?.fullName}</p>
                  <p>Type: {selectedApplication?.type?.replace(/_/g, " ")}</p>
                  <p>Status: {selectedApplication?.status}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Document Type</label>
                <Select value={pdfDocumentType} onValueChange={setPdfDocumentType}>
                  <SelectTrigger className="mt-2" data-testid="select-pdf-type">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="work_permit">Work Permit</SelectItem>
                    <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                    <SelectItem value="refugee_permit">Refugee Permit</SelectItem>
                    <SelectItem value="asylum_visa">Asylum Visa</SelectItem>
                    <SelectItem value="study_permit">Study Permit</SelectItem>
                    <SelectItem value="diplomatic_passport">Diplomatic Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPDFGenerateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={generateApprovedDocumentPDF}
                disabled={isGeneratingPDF || !pdfDocumentType}
                className="government-button"
                data-testid="button-confirm-generate-pdf"
              >
                {isGeneratingPDF ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate & Download
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

// Memoized admin dashboard for better performance
export default memo(AdminDashboard);