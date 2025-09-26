import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Lock, 
  Activity,
  TrendingUp,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SecurityEvent {
  id: string;
  userId?: string;
  eventType: string;
  severity: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  createdAt: string;
}

interface FraudAlert {
  id: string;
  userId: string;
  alertType: string;
  riskScore: number;
  details?: any;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface SecurityMetrics {
  threatLevel: string;
  totalEvents: number;
  criticalEvents: number;
  fraudAlerts: number;
  blockedIps: number;
  authenticationsToday: number;
  failedLogins: number;
}

export default function SecurityCenter() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("24h");
  const { toast } = useToast();

  // Fetch security events
  const { data: securityEvents, isLoading: eventsLoading, refetch } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security/events", { limit: 50, severity: severityFilter, search: searchTerm }],
    refetchInterval: 30000,
  });

  // Fetch fraud alerts
  const { data: fraudAlerts, isLoading: fraudLoading } = useQuery<FraudAlert[]>({
    queryKey: ["/api/fraud/alerts"],
    refetchInterval: 30000,
  });

  // Fetch security metrics
  const { data: securityMetrics, isLoading: metricsLoading } = useQuery<SecurityMetrics>({
    queryKey: ["/api/monitoring/security"],
    refetchInterval: 60000,
  });

  // Resolve fraud alert mutation
  const resolveFraudMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return api.post(`/fraud/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      toast({
        title: "Alert Resolved",
        description: "Fraud alert has been marked as resolved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fraud/alerts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve alert.",
        variant: "destructive",
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getThreatLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return "text-red-600 bg-red-50";
    if (score >= 60) return "text-orange-600 bg-orange-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const filteredEvents = securityEvents?.filter(event => {
    const matchesSearch = !searchTerm || 
      event.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === "all" || event.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  }) || [];

  const unresolvedAlerts = fraudAlerts?.filter(alert => !alert.isResolved) || [];
  const resolvedAlerts = fraudAlerts?.filter(alert => alert.isResolved) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security Center</h1>
            <p className="text-muted-foreground mt-2">
              Monitor security events, fraud alerts, and system threats
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-events"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm"
              data-testid="select-severity-filter"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="card-threat-level">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Threat Level</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getThreatLevelColor(securityMetrics?.threatLevel || "low")}`}>
                {securityMetrics?.threatLevel || "LOW"}
              </div>
              <p className="text-xs text-muted-foreground">
                Current security status
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-security-events">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{securityMetrics?.totalEvents || 0}</div>
              <p className="text-xs text-muted-foreground">
                {securityMetrics?.criticalEvents || 0} critical events
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-fraud-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unresolvedAlerts.length}</div>
              <p className="text-xs text-muted-foreground">
                Active fraud alerts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-failed-logins">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{securityMetrics?.failedLogins || 0}</div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Authentication Metrics */}
        {securityMetrics && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Metrics</CardTitle>
              <CardDescription>Daily authentication success rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Successful Authentications
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {securityMetrics.authenticationsToday} total logins today
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {Math.round(((securityMetrics.authenticationsToday - securityMetrics.failedLogins) / Math.max(securityMetrics.authenticationsToday, 1)) * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Success rate</p>
                  </div>
                </div>
                <Progress
                  value={((securityMetrics.authenticationsToday - securityMetrics.failedLogins) / Math.max(securityMetrics.authenticationsToday, 1)) * 100}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Events and Alerts */}
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events" data-testid="tab-events">Security Events</TabsTrigger>
            <TabsTrigger value="fraud" data-testid="tab-fraud">Fraud Alerts</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Security Events</CardTitle>
                <CardDescription>
                  Recent security events and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-2">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => (
                        <TableRow key={event.id} data-testid={`event-row-${event.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{event.eventType}</div>
                              {event.details && (
                                <div className="text-sm text-muted-foreground">
                                  {typeof event.details === 'string' ? event.details : JSON.stringify(event.details).substring(0, 100)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getSeverityColor(event.severity)}>
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {event.ipAddress && <div>IP: {event.ipAddress}</div>}
                              {event.location && <div>Location: {event.location}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(event.createdAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" data-testid={`button-view-${event.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud">
            <div className="space-y-6">
              {/* Unresolved Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Fraud Alerts</CardTitle>
                  <CardDescription>
                    Fraud alerts requiring immediate attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {fraudLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : unresolvedAlerts.length > 0 ? (
                    <div className="space-y-4">
                      {unresolvedAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`fraud-alert-${alert.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <div>
                              <h4 className="font-medium">{alert.alertType}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge className={getRiskScoreColor(alert.riskScore)}>
                                  Risk: {alert.riskScore}/100
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(alert.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-view-alert-${alert.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => resolveFraudMutation.mutate(alert.id)}
                              disabled={resolveFraudMutation.isPending}
                              size="sm"
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No active fraud alerts</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resolved Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Resolved Fraud Alerts</CardTitle>
                  <CardDescription>
                    Recently resolved fraud alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resolvedAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {resolvedAlerts.slice(0, 10).map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center justify-between p-3 border rounded-lg opacity-75"
                        >
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <h5 className="font-medium">{alert.alertType}</h5>
                              <p className="text-sm text-muted-foreground">
                                Risk: {alert.riskScore}/100 • Resolved: {alert.resolvedAt && new Date(alert.resolvedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">Resolved</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>No resolved alerts</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>
                  System access and configuration changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2" />
                  <p>Audit trail functionality coming soon</p>
                  <p className="text-sm">Track administrative actions and system changes</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}