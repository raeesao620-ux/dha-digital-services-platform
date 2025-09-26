import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from "socket.io-client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bug, AlertTriangle, AlertCircle, Info, CheckCircle,
  RefreshCw, Search, Filter, Trash2, Activity, Cpu,
  HardDrive, Clock, TrendingUp, TrendingDown, Server
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ErrorLog {
  id: string;
  timestamp: Date | string;
  errorType: string;
  message: string;
  stack?: string | null;
  userId?: string | null;
  requestUrl?: string | null;
  requestMethod?: string | null;
  statusCode?: number | null;
  severity: string;
  context?: any;
  environment: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: Date | string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string | null;
  errorCount: number;
}

interface SystemMetrics {
  errors: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<string, number>;
  };
  performance: Record<string, {
    average: number;
    count: number;
    max: number;
    min: number;
  }>;
  timestamp: Date;
}

const severityColors = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500"
};

const severityIcons = {
  critical: <AlertCircle className="w-4 h-4" />,
  high: <AlertTriangle className="w-4 h-4" />,
  medium: <Info className="w-4 h-4" />,
  low: <Bug className="w-4 h-4" />
};

export function DebugDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [timeRange, setTimeRange] = useState(24); // hours
  const [realtimeErrors, setRealtimeErrors] = useState<ErrorLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const queryClient = useQueryClient();

  // Check if user is admin
  const userRole = localStorage.getItem("userRole");
  const isAdmin = userRole === "admin";

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card className="glass border-glass-border">
          <CardHeader>
            <CardTitle className="text-2xl text-red-500">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Admin privileges are required to access the Debug Dashboard.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => window.location.href = "/"}
              className="w-full"
              variant="outline"
              data-testid="button-back-home"
            >
              Return to Main Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch error logs
  const { data: errors = [], isLoading: errorsLoading, refetch: refetchErrors } = useQuery<ErrorLog[]>({
    queryKey: ["/api/debug/errors", filterSeverity, filterType, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterSeverity !== "all") params.append("severity", filterSeverity);
      if (filterType !== "all") params.append("errorType", filterType);
      params.append("limit", "100");

      const response = await apiRequest(`/api/debug/errors?${params}`, 'GET');
      return response as unknown as ErrorLog[];
    }
  });

  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ["/api/debug/metrics", timeRange],
    queryFn: async () => {
      const response = await apiRequest(`/api/debug/metrics?hours=${timeRange}`, 'GET');
      return response as unknown as SystemMetrics;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Mark error as resolved mutation
  const resolveErrorMutation = useMutation({
    mutationFn: async (errorId: string) => {
      return apiRequest(`/api/debug/errors/${errorId}`, "PATCH", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debug/errors"] });
      setSelectedError(null);
    }
  });

  // Toggle debug mode mutation
  const toggleDebugMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("/api/debug/toggle", "POST", { enabled });
    },
    onSuccess: (data: any) => {
      setDebugMode(data.debugMode);
    }
  });

  // Setup WebSocket connection with reconnection logic
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !isAdmin) return;

    let reconnectTimeout: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 10;
    const baseReconnectDelay = 1000; // 1 second

    const createSocketConnection = () => {
      const newSocket = io({
        path: "/ws",
        auth: {
          token: token
        },
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: baseReconnectDelay,
        reconnectionDelayMax: 30000, // Max 30 seconds
        timeout: 20000
      });

      newSocket.on("connect", () => {
        console.log("Debug dashboard connected to WebSocket");
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      });

      newSocket.on("disconnect", (reason: string) => {
        console.log("WebSocket disconnected:", reason);
        setConnectionStatus('disconnected');

        // Handle token expiration
        if (reason === "io server disconnect") {
          // Server forced disconnect, might be due to auth failure
          const currentToken = localStorage.getItem("token");
          if (currentToken !== token) {
            // Token changed, reconnect with new token
            newSocket.auth = { token: currentToken };
            newSocket.connect();
          }
        }
      });

      newSocket.on("connect_error", (error: Error) => {
        console.error("WebSocket connection error:", error);
        setConnectionStatus('error');

        // Implement exponential backoff for reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000);
          setReconnectAttempts(prev => prev + 1);

          reconnectTimeout = setTimeout(() => {
            console.log(`Attempting reconnection (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
            newSocket.connect();
          }, delay);
        }
      });

      newSocket.on("reconnect", (attemptNumber: number) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
      });

      newSocket.on("error:new", (error: ErrorLog) => {
        setRealtimeErrors(prev => [error, ...prev.slice(0, 49)]);
        queryClient.invalidateQueries({ queryKey: ["/api/debug/errors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/debug/metrics"] });
      });

      newSocket.on("error:resolved", (error: ErrorLog) => {
        queryClient.invalidateQueries({ queryKey: ["/api/debug/errors"] });
      });

      newSocket.on("metrics:update", (newMetrics: any) => {
        queryClient.setQueryData(["/api/debug/metrics", timeRange], newMetrics);
      });

      setSocket(newSocket);
      setConnectionStatus('connecting');

      return newSocket;
    };

    const socket = createSocketConnection();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      socket.disconnect();
    };
  }, [queryClient, timeRange, isAdmin, reconnectAttempts]);

  // Filter errors
  const filteredErrors = useMemo(() => {
    let filtered = [...errors, ...realtimeErrors];

    if (searchTerm) {
      filtered = filtered.filter(error =>
        error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        error.errorType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Remove duplicates
    const uniqueErrors = Array.from(new Map(filtered.map(e => [e.id, e])).values());
    return uniqueErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [errors, realtimeErrors, searchTerm]);

  // Prepare chart data
  const errorChartData = useMemo(() => {
    if (!metrics?.errors) return [];

    return Object.entries(metrics.errors.byType).map(([type, count]) => ({
      name: type,
      value: count
    }));
  }, [metrics]);

  const performanceChartData = useMemo(() => {
    if (!metrics?.performance) return [];

    return Object.entries(metrics.performance)
      .slice(0, 10)
      .map(([endpoint, stats]) => ({
        endpoint: endpoint.split(" ").pop()?.substring(0, 20) || endpoint,
        average: Math.round(stats.average),
        max: stats.max,
        min: stats.min
      }));
  }, [metrics]);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="debug-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          <p className="text-muted-foreground">Real-time error monitoring and system metrics</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={debugMode}
              onCheckedChange={(checked) => toggleDebugMutation.mutate(checked)}
              data-testid="toggle-debug-mode"
            />
            <Label>Debug Mode</Label>
          </div>
          <Button
            onClick={() => {
              refetchErrors();
              queryClient.invalidateQueries({ queryKey: ["/api/debug/metrics"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-glass-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.errors.total || 0}</div>
            <p className="text-xs text-muted-foreground">Last {timeRange} hours</p>
          </CardContent>
        </Card>

        <Card className="glass border-glass-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{metrics?.errors.critical || 0}</div>
            <Progress value={(metrics?.errors.critical || 0) / (metrics?.errors.total || 1) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="glass border-glass-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{metrics?.errors.high || 0}</div>
            <Progress value={(metrics?.errors.high || 0) / (metrics?.errors.total || 1) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="glass border-glass-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {filteredErrors.filter(e => e.isResolved).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredErrors.filter(e => !e.isResolved).length} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          {/* Filters */}
          <Card className="glass border-glass-border">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search errors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="w-[150px]">
                  <Label>Severity</Label>
                  <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[150px]">
                  <Label>Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="validation">Validation</SelectItem>
                      <SelectItem value="authentication">Authentication</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="network">Network</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[150px]">
                  <Label>Time Range</Label>
                  <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(Number(v))}>
                    <SelectTrigger data-testid="select-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last Hour</SelectItem>
                      <SelectItem value="6">Last 6 Hours</SelectItem>
                      <SelectItem value="24">Last 24 Hours</SelectItem>
                      <SelectItem value="168">Last Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass border-glass-border">
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {errorsLoading ? (
                    <div className="text-center py-4">Loading errors...</div>
                  ) : filteredErrors.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No errors found</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredErrors.map((error) => (
                        <div
                          key={error.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedError?.id === error.id
                              ? "bg-accent border-accent"
                              : "border-glass-border hover:bg-accent/50"
                          }`}
                          onClick={() => setSelectedError(error)}
                          data-testid={`error-item-${error.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    error.severity === "critical" ? "destructive" :
                                    error.severity === "high" ? "destructive" :
                                    error.severity === "medium" ? "default" : "secondary"
                                  }
                                  className={
                                    error.severity === "critical" ? "animate-pulse" : ""
                                  }
                                >
                                  {error.severity?.toUpperCase() || "UNKNOWN"}
                                </Badge>
                                <Badge variant="secondary">{error.errorType}</Badge>
                                {error.isResolved && (
                                  <Badge variant="outline" className="bg-green-500/20">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Resolved
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-sm font-medium line-clamp-2">{error.message}</p>
                              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{formatDistanceToNow(new Date(error.timestamp))} ago</span>
                                {error.errorCount > 1 && (
                                  <span className="text-orange-500">×{error.errorCount}</span>
                                )}
                                {error.requestUrl && (
                                  <span className="truncate max-w-[150px]">{error.requestUrl}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Error Details */}
            <Card className="glass border-glass-border">
              <CardHeader>
                <CardTitle>Error Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedError ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Message</Label>
                      <p className="mt-1 text-sm">{selectedError.message}</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label>Type</Label>
                        <p className="mt-1">{selectedError.errorType}</p>
                      </div>
                      <div>
                        <Label>Severity</Label>
                        <p className="mt-1">{selectedError.severity}</p>
                      </div>
                      <div>
                        <Label>Environment</Label>
                        <p className="mt-1">{selectedError.environment}</p>
                      </div>
                      <div>
                        <Label>Timestamp</Label>
                        <p className="mt-1">{format(new Date(selectedError.timestamp), "PPpp")}</p>
                      </div>
                      {selectedError.userId && (
                        <div>
                          <Label>User ID</Label>
                          <p className="mt-1">{selectedError.userId}</p>
                        </div>
                      )}
                      {selectedError.statusCode && (
                        <div>
                          <Label>Status Code</Label>
                          <p className="mt-1">{selectedError.statusCode}</p>
                        </div>
                      )}
                    </div>

                    {selectedError.stack && (
                      <>
                        <Separator />
                        <div>
                          <Label>Stack Trace</Label>
                          <ScrollArea className="h-[200px] mt-2">
                            <pre className="text-xs overflow-x-auto">{selectedError.stack}</pre>
                          </ScrollArea>
                        </div>
                      </>
                    )}

                    {selectedError.context && (
                      <>
                        <Separator />
                        <div>
                          <Label>Context</Label>
                          <ScrollArea className="h-[150px] mt-2">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(selectedError.context, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      </>
                    )}

                    {!selectedError.isResolved && (
                      <>
                        <Separator />
                        <Button
                          onClick={() => resolveErrorMutation.mutate(selectedError.id)}
                          disabled={resolveErrorMutation.isPending}
                          className="w-full"
                          data-testid="button-resolve"
                        >
                          {resolveErrorMutation.isPending ? "Resolving..." : "Mark as Resolved"}
                        </Button>
                      </>
                    )}

                    {selectedError.isResolved && selectedError.resolvedAt && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Resolved {formatDistanceToNow(new Date(selectedError.resolvedAt))} ago
                          {selectedError.resolvedBy && ` by ${selectedError.resolvedBy}`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select an error to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card className="glass border-glass-border">
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={performanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
                    <YAxis label={{ value: "Response Time (ms)", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="average" fill="#8884d8" name="Average" />
                    <Bar dataKey="max" fill="#ff7c7c" name="Max" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No performance data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass border-glass-border">
              <CardHeader>
                <CardTitle>Error Distribution by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {errorChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={errorChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {errorChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No error data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass border-glass-border">
              <CardHeader>
                <CardTitle>Error Severity Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${severityColors.critical}`} />
                      <span>Critical</span>
                    </div>
                    <span className="font-bold">{metrics?.errors.critical || 0}</span>
                  </div>
                  <Progress
                    value={(metrics?.errors.critical || 0) / (metrics?.errors.total || 1) * 100}
                    className="h-2"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${severityColors.high}`} />
                      <span>High</span>
                    </div>
                    <span className="font-bold">{metrics?.errors.high || 0}</span>
                  </div>
                  <Progress
                    value={(metrics?.errors.high || 0) / (metrics?.errors.total || 1) * 100}
                    className="h-2"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${severityColors.medium}`} />
                      <span>Medium</span>
                    </div>
                    <span className="font-bold">{metrics?.errors.medium || 0}</span>
                  </div>
                  <Progress
                    value={(metrics?.errors.medium || 0) / (metrics?.errors.total || 1) * 100}
                    className="h-2"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${severityColors.low}`} />
                      <span>Low</span>
                    </div>
                    <span className="font-bold">{metrics?.errors.low || 0}</span>
                  </div>
                  <Progress
                    value={(metrics?.errors.low || 0) / (metrics?.errors.total || 1) * 100}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}