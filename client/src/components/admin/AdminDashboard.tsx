import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  FileText, 
  Shield, 
  Activity,
  TrendingUp,
  AlertCircle,
  XCircle,
  Bell,
  Settings,
  RefreshCw
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { NotificationCenter } from "@/components/NotificationCenter";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { LiveProgress } from "@/components/ui/live-progress";
import { CriticalAlertModal } from "@/components/ui/critical-alert-modal";
import { cn } from "@/lib/utils";

interface SystemMetrics {
  health: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  security: {
    activeSessions: number;
    failedLogins: number;
    securityEvents: number;
    riskScore: number;
  };
  errors: {
    total: number;
    critical: number;
    recent: number;
    errorRate: number;
  };
  timestamp: string;
}

interface AdminAlert {
  id: string;
  type: 'security' | 'fraud' | 'system' | 'document' | 'user';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata: Record<string, any>;
  isResolved: boolean;
  assignedToAdmin?: string;
  escalatedAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
}

interface DocumentStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  awaitingReview: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  suspiciousActivity: number;
}

export function AdminDashboard() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AdminAlert[]>([]);
  const [criticalAlert, setCriticalAlert] = useState<AdminAlert | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // WebSocket connection
  const { socket, isConnected, emit } = useWebSocket({
    enableToasts: false,
    enableEventHandlers: true, // FIXED: Enable event handlers for real-time status updates
    onConnect: () => {
      console.log("Admin dashboard WebSocket connected");
      setConnectionStatus('connected');
      // Subscribe to admin notifications
      emit("notification:subscribe");
      emit("admin:getActiveAlerts");
      emit("admin:getSystemMetrics");
    },
    onDisconnect: () => {
      console.log("Admin dashboard WebSocket disconnected");
      setConnectionStatus('disconnected');
    },
    onReconnect: () => {
      console.log("Admin dashboard WebSocket reconnecting");
      setConnectionStatus('reconnecting');
    }
  });

  // Query for initial dashboard data
  const { data: documentStats, refetch: refetchDocuments } = useQuery<DocumentStats>({
    queryKey: ["/api/admin/stats/documents"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: userStats, refetch: refetchUsers } = useQuery<UserStats>({
    queryKey: ["/api/admin/stats/users"],
    refetchInterval: 60000 // Refresh every minute
  });

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    // Admin-specific events
    const handleActiveAlerts = (data: { alerts: AdminAlert[] }) => {
      setActiveAlerts(data.alerts);
    };

    const handleSystemMetrics = (data: SystemMetrics) => {
      setSystemMetrics(data);
      setLastUpdated(new Date());
    };

    const handleCriticalAlert = (alert: AdminAlert) => {
      setCriticalAlert(alert);
      setActiveAlerts(prev => [alert, ...prev]);
    };

    const handleAlertResolved = (data: { alertId: string; resolvedBy: string }) => {
      setActiveAlerts(prev => prev.filter(alert => alert.id !== data.alertId));
      if (criticalAlert?.id === data.alertId) {
        setCriticalAlert(null);
      }
    };

    const handleMetricsUpdate = (data: SystemMetrics) => {
      setSystemMetrics(data);
      setLastUpdated(new Date());
    };

    // Error tracking events
    const handleNewError = (error: any) => {
      if (error.severity === 'critical') {
        setCriticalAlert({
          id: `error-${Date.now()}`,
          type: 'system',
          severity: 'critical',
          title: 'Critical System Error',
          message: `${error.errorType}: ${error.message}`,
          source: 'Error Tracking',
          metadata: error,
          isResolved: false,
          createdAt: new Date()
        });
      }
    };

    // Register event listeners
    socket.on("admin:activeAlerts", handleActiveAlerts);
    socket.on("admin:systemMetrics", handleSystemMetrics);
    socket.on("alert:critical", handleCriticalAlert);
    socket.on("alert:resolved", handleAlertResolved);
    socket.on("metrics:update", handleMetricsUpdate);
    socket.on("error:new", handleNewError);

    // Cleanup
    return () => {
      socket.off("admin:activeAlerts", handleActiveAlerts);
      socket.off("admin:systemMetrics", handleSystemMetrics);
      socket.off("alert:critical", handleCriticalAlert);
      socket.off("alert:resolved", handleAlertResolved);
      socket.off("metrics:update", handleMetricsUpdate);
      socket.off("error:new", handleNewError);
    };
  }, [socket, criticalAlert?.id]);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDocuments(),
        refetchUsers()
      ]);
      emit("admin:getSystemMetrics");
      emit("admin:getActiveAlerts");
    } finally {
      setIsRefreshing(false);
    }
  };

  const resolveAlert = (alertId: string, resolution?: string) => {
    emit("admin:resolveAlert", { alertId, resolution });
  };

  const assignAlert = (alertId: string, adminId: string) => {
    emit("admin:assignAlert", { alertId, adminId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return XCircle;
      default: return Activity;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time system monitoring and administration
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-sm text-muted-foreground">
              {connectionStatus}
            </span>
          </div>
          {lastUpdated && (
            <span className="text-sm text-muted-foreground" data-testid="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <NotificationCenter />
        </div>
      </div>

      {/* Critical Alert Modal */}
      {criticalAlert && (
        <CriticalAlertModal
          alert={{
            id: criticalAlert.id,
            title: criticalAlert.title,
            message: criticalAlert.message,
            category: (criticalAlert.type as 'system' | 'security' | 'fraud' | 'maintenance') || 'system',
            severity: criticalAlert.severity as 'low' | 'medium' | 'high' | 'critical',
            requiresAction: true,
            createdAt: criticalAlert.createdAt
          }}
          onClose={() => setCriticalAlert(null)}
          onAcknowledge={() => resolveAlert(criticalAlert.id, "Acknowledged via dashboard")}
        />
      )}

      {/* System Health Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-system-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {systemMetrics && (
              (() => {
                const StatusIcon = getStatusIcon(systemMetrics.health.status);
                return <StatusIcon className={cn("h-4 w-4", getStatusColor(systemMetrics.health.status))} />;
              })()
            )}
          </CardHeader>
          <CardContent>
            {systemMetrics ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold capitalize" data-testid="text-health-status">
                  {systemMetrics.health.status}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {formatUptime(systemMetrics.health.uptime)}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>CPU</span>
                    <span>{systemMetrics.health.cpuUsage}%</span>
                  </div>
                  <Progress value={systemMetrics.health.cpuUsage} className="h-1" />
                  <div className="flex justify-between text-xs">
                    <span>Memory</span>
                    <span>{systemMetrics.health.memoryUsage}%</span>
                  </div>
                  <Progress value={systemMetrics.health.memoryUsage} className="h-1" />
                </div>
              </div>
            ) : (
              <LiveProgress 
                status="processing" 
                description="Loading system health..." 
                value={0}
                showPercentage={false}
              />
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-security-metrics">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {systemMetrics ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold" data-testid="text-security-score">
                  {systemMetrics.security.riskScore}/100
                </div>
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium">{systemMetrics.security.activeSessions}</div>
                    <div className="text-muted-foreground">Active Sessions</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-600">{systemMetrics.security.failedLogins}</div>
                    <div className="text-muted-foreground">Failed Logins</div>
                  </div>
                </div>
              </div>
            ) : (
              <LiveProgress 
                status="processing" 
                description="Loading security metrics..." 
                value={0}
                showPercentage={false}
              />
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-document-stats">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {documentStats ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold" data-testid="text-documents-total">
                  {documentStats.total}
                </div>
                <p className="text-xs text-muted-foreground">Total Documents</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium text-yellow-600">{documentStats.awaitingReview}</div>
                    <div className="text-muted-foreground">Awaiting Review</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-600">{documentStats.processing}</div>
                    <div className="text-muted-foreground">Processing</div>
                  </div>
                </div>
              </div>
            ) : (
              <LiveProgress 
                status="processing" 
                description="Loading document stats..." 
                value={0}
                showPercentage={false}
              />
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-user-stats">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {userStats ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold" data-testid="text-users-active">
                  {userStats.activeUsers}
                </div>
                <p className="text-xs text-muted-foreground">Active Users</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium text-green-600">+{userStats.newUsersToday}</div>
                    <div className="text-muted-foreground">New Today</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-600">{userStats.suspiciousActivity}</div>
                    <div className="text-muted-foreground">Suspicious</div>
                  </div>
                </div>
              </div>
            ) : (
              <LiveProgress 
                status="processing" 
                description="Loading user stats..." 
                value={0}
                showPercentage={false}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card data-testid="card-active-alerts">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Active Alerts</span>
            <NotificationBadge 
              count={activeAlerts.filter(a => !a.isResolved).length}
              variant="destructive"
            />
          </CardTitle>
          <CardDescription>
            Critical system alerts requiring immediate attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <div className="text-center py-8" data-testid="no-alerts">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-muted-foreground">No active alerts</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="flex items-start justify-between p-3 border rounded-lg"
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <span className="text-sm font-medium">{alert.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Source: {alert.source}</span>
                        <span>{alert.createdAt.toLocaleString()}</span>
                        {alert.escalatedAt && (
                          <Badge variant="outline" className="text-red-600">
                            Escalated
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assignAlert(alert.id, 'current-admin')}
                        data-testid={`button-assign-${alert.id}`}
                      >
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                        data-testid={`button-resolve-${alert.id}`}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* System Errors */}
      {systemMetrics?.errors && (
        <Card data-testid="card-system-errors">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>System Errors</span>
            </CardTitle>
            <CardDescription>
              Error tracking and performance monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600" data-testid="text-errors-critical">
                  {systemMetrics.errors.critical}
                </div>
                <p className="text-sm text-muted-foreground">Critical Errors</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="text-errors-recent">
                  {systemMetrics.errors.recent}
                </div>
                <p className="text-sm text-muted-foreground">Recent Errors</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="text-error-rate">
                  {systemMetrics.errors.errorRate.toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}