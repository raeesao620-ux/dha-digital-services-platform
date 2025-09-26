import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Monitor, 
  Database, 
  Server, 
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Key,
  Activity
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

interface SystemHealth {
  status: string;
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  cpu: { percentage: number };
  database: { status: string; connectionCount: number };
  integrations: Record<string, { status: string; lastCheck: string }>;
}

interface SystemMetric {
  id: string;
  metricType: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  errorType: string;
  message: string;
  severity: string;
  userId?: string;
  isResolved: boolean;
}

interface QuantumKey {
  id: string;
  keyId: string;
  algorithm: string;
  entropy: number;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export default function SystemMonitoring() {
  const [timeRange, setTimeRange] = useState("24h");

  // Fetch system health
  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ["/api/monitoring/health"],
    refetchInterval: 30000,
  });

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetric[]>({
    queryKey: ["/api/monitoring/metrics", { hours: timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 1 }],
    refetchInterval: 60000,
  });

  // Fetch error logs
  const { data: errorLogs, isLoading: errorsLoading } = useQuery<ErrorLog[]>({
    queryKey: ["/api/admin/error-logs", { limit: 20 }],
    refetchInterval: 60000,
  });

  // Fetch quantum keys
  const { data: quantumKeys, isLoading: keysLoading } = useQuery<QuantumKey[]>({
    queryKey: ["/api/quantum/keys"],
    refetchInterval: 300000, // 5 minutes
  });

  // Fetch performance metrics
  const { data: performance, isLoading: performanceLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/production/performance"],
    refetchInterval: 60000,
  });

  const getStatusColor = (status: string) => {
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
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const criticalErrors = errorLogs?.filter(e => e.severity === "critical" && !e.isResolved).length || 0;
  const activeKeys = quantumKeys?.filter(k => k.isActive).length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Monitoring</h1>
            <p className="text-muted-foreground mt-2">
              Monitor system performance, errors, and infrastructure health
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm"
              data-testid="select-time-range"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="card-system-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth?.status || "Unknown"}
              </div>
              <Badge className={getStatusColor(systemHealth?.status || "unknown")}>
                {systemHealth?.status || "Unknown"}
              </Badge>
              {systemHealth && (
                <p className="text-xs text-muted-foreground mt-2">
                  Uptime: {formatUptime(systemHealth.uptime)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-database-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth?.database?.connectionCount || 0}
              </div>
              <Badge className={getStatusColor(systemHealth?.database?.status || "unknown")}>
                {systemHealth?.database?.status || "Unknown"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Active connections
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-critical-errors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalErrors}</div>
              <p className="text-xs text-muted-foreground">
                Unresolved issues
              </p>
              {criticalErrors > 0 && (
                <Badge variant="destructive" className="mt-2">
                  Attention Required
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-quantum-keys">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quantum Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeKeys}</div>
              <p className="text-xs text-muted-foreground">
                Active encryption keys
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resource Usage */}
        {systemHealth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-memory-usage">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MemoryStick className="h-5 w-5" />
                  <span>Memory Usage</span>
                </CardTitle>
                <CardDescription>System memory utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Used: {formatBytes(systemHealth.memory.used)}</span>
                    <span>Total: {formatBytes(systemHealth.memory.total)}</span>
                  </div>
                  <Progress value={systemHealth.memory.percentage} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{systemHealth.memory.percentage.toFixed(1)}% utilized</span>
                    <span className={systemHealth.memory.percentage > 80 ? "text-red-600" : "text-green-600"}>
                      {systemHealth.memory.percentage > 80 ? "High Usage" : "Normal"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-cpu-usage">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <span>CPU Usage</span>
                </CardTitle>
                <CardDescription>Processor utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>CPU Load</span>
                    <span>{systemHealth.cpu.percentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemHealth.cpu.percentage} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Current utilization</span>
                    <span className={systemHealth.cpu.percentage > 80 ? "text-red-600" : "text-green-600"}>
                      {systemHealth.cpu.percentage > 80 ? "High Load" : "Normal"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Metrics */}
        {performance && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Application performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{performance.responseTime}ms</div>
                  <p className="text-xs text-muted-foreground">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{performance.throughput}</div>
                  <p className="text-xs text-muted-foreground">Requests/sec</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{performance.errorRate.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground">Error Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{performance.availability.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Availability</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Monitoring */}
        <Tabs defaultValue="errors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="errors" data-testid="tab-errors">Error Logs</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="quantum" data-testid="tab-quantum">Quantum Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle>Error Logs</CardTitle>
                <CardDescription>Recent system errors and exceptions</CardDescription>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : errorLogs && errorLogs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorLogs.map((error) => (
                        <TableRow key={error.id} data-testid={`error-row-${error.id}`}>
                          <TableCell>
                            {new Date(error.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{error.errorType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate" title={error.message}>
                              {error.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={error.isResolved ? "secondary" : "destructive"}>
                              {error.isResolved ? "Resolved" : "Open"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No errors found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>Integration Status</CardTitle>
                <CardDescription>Status of external system integrations</CardDescription>
              </CardHeader>
              <CardContent>
                {systemHealth?.integrations ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(systemHealth.integrations).map(([name, integration]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`integration-${name}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Server className="h-6 w-6 text-muted-foreground" />
                          <div>
                            <h4 className="font-medium capitalize">{name.replace('_', ' ')}</h4>
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2" />
                    <p>Integration status unavailable</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quantum">
            <Card>
              <CardHeader>
                <CardTitle>Quantum Encryption Keys</CardTitle>
                <CardDescription>Quantum-resistant encryption key management</CardDescription>
              </CardHeader>
              <CardContent>
                {keysLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : quantumKeys && quantumKeys.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key ID</TableHead>
                        <TableHead>Algorithm</TableHead>
                        <TableHead>Entropy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quantumKeys.map((key) => (
                        <TableRow key={key.id} data-testid={`key-row-${key.id}`}>
                          <TableCell>
                            <code className="text-sm">{key.keyId}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{key.algorithm}</Badge>
                          </TableCell>
                          <TableCell>
                            {key.entropy} bits
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(key.isActive ? "active" : "inactive")}>
                              {key.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(key.expiresAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-8 w-8 mx-auto mb-2" />
                    <p>No quantum keys found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}