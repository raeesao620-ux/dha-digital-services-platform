import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Zap, 
  Database, 
  Server, 
  Shield, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Download,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Gauge,
  Brain,
  Bot,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Bar, BarChart } from "recharts";
import { apiRequest } from "@/lib/queryClient";

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'emergency';
  services: Record<string, {
    status: 'healthy' | 'warning' | 'critical';
    responseTime: number;
    errorRate: number;
    lastCheck: string;
  }>;
  resources: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  security: {
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    activeIncidents: number;
    fraudAlerts: number;
  };
  compliance: {
    score: number;
    violations: number;
    uptime: number;
  };
}

interface MonitoringEvent {
  id: string;
  type: 'health_check' | 'alert' | 'incident' | 'autonomous_action' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  service?: string;
  resolved?: boolean;
  autoResolved?: boolean;
}

interface AutonomousAction {
  id: string;
  type: string;
  service: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: any;
  impact?: any;
}

interface AlertRule {
  id: string;
  name: string;
  category: string;
  severity: string;
  enabled: boolean;
  triggered: boolean;
  lastTriggered?: string;
}

interface CircuitBreakerStatus {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successRate: number;
  lastFailure?: string;
}

export default function MonitoringDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  
  const ws = useRef<WebSocket | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<MonitoringEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/monitoring`;
      
      setConnectionStatus('connecting');
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('[MonitoringDashboard] WebSocket connected');
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // Subscribe to monitoring events
        ws.current?.send(JSON.stringify({
          type: 'subscribe',
          channels: ['health', 'alerts', 'autonomous_actions', 'incidents']
        }));
      };
      
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch (error) {
          console.error('[MonitoringDashboard] WebSocket message parse error:', error);
        }
      };
      
      ws.current.onclose = () => {
        console.log('[MonitoringDashboard] WebSocket disconnected');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
      ws.current.onerror = (error) => {
        console.error('[MonitoringDashboard] WebSocket error:', error);
        setConnectionStatus('disconnected');
        setIsConnected(false);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Handle real-time events from WebSocket
  const handleRealtimeEvent = (data: any) => {
    const event: MonitoringEvent = {
      id: data.id || Date.now().toString(),
      type: data.type,
      severity: data.severity || 'info',
      title: data.title || 'System Event',
      description: data.description || '',
      timestamp: data.timestamp || new Date().toISOString(),
      service: data.service,
      resolved: data.resolved,
      autoResolved: data.autoResolved
    };
    
    setRealtimeEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
    
    // Invalidate and refetch data for significant events
    if (['alert', 'incident', 'autonomous_action'].includes(data.type)) {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/health'] });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/autonomous-actions'] });
    }
    
    // Show browser notification for critical events
    if (alertsEnabled && data.severity === 'critical' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Critical Alert: ${event.title}`, {
          body: event.description,
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(`Critical Alert: ${event.title}`, {
              body: event.description,
              icon: '/favicon.ico'
            });
          }
        });
      }
    }
  };

  // Fetch system health data
  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true
  });

  // Fetch autonomous actions
  const { data: autonomousActions } = useQuery({
    queryKey: ['/api/monitoring/autonomous-actions'],
    refetchInterval: autoRefresh ? refreshInterval * 2 : false
  });

  // Fetch alert rules
  const { data: alertRules } = useQuery({
    queryKey: ['/api/monitoring/alert-rules'],
    refetchInterval: autoRefresh ? refreshInterval * 4 : false
  });

  // Fetch circuit breaker status
  const { data: circuitBreakers } = useQuery({
    queryKey: ['/api/monitoring/circuit-breakers'],
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch metrics history
  const { data: metricsHistory } = useQuery({
    queryKey: ['/api/monitoring/metrics-history', selectedTimeRange],
    refetchInterval: autoRefresh ? refreshInterval * 3 : false
  });

  // Control autonomous bot
  const controlBot = useMutation({
    mutationFn: async (action: 'start' | 'stop' | 'restart') => {
      return apiRequest(`/api/monitoring/autonomous-bot/${action}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/health'] });
    }
  });

  // Toggle alert rule
  const toggleAlertRule = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      return apiRequest(`/api/monitoring/alert-rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alert-rules'] });
    }
  });

  // Trigger manual healing
  const triggerHealing = useMutation({
    mutationFn: async ({ service, actionType }: { service: string; actionType?: string }) => {
      return apiRequest('/api/monitoring/trigger-healing', {
        method: 'POST',
        body: JSON.stringify({ service, actionType })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/autonomous-actions'] });
    }
  });

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'closed': case 'completed': return 'text-green-600 bg-green-50';
      case 'warning': case 'half_open': case 'executing': return 'text-yellow-600 bg-yellow-50';
      case 'critical': case 'open': case 'failed': return 'text-red-600 bg-red-50';
      case 'emergency': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': case 'closed': case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'warning': case 'half_open': case 'executing': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': case 'open': case 'failed': return <XCircle className="w-4 h-4" />;
      case 'emergency': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'critical': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Activity className="w-8 h-8 animate-spin mx-auto" />
          <p>Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="monitoring-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="dashboard-title">
            Autonomous Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time system health monitoring and autonomous error resolution
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {connectionStatus}
            </span>
          </div>
          
          {/* Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              data-testid="toggle-alerts"
            >
              {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            
            <Select value={refreshInterval.toString()} onValueChange={(value) => setRefreshInterval(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2000">2s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                data-testid="auto-refresh-toggle"
              />
              <span className="text-sm">Auto-refresh</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Overview */}
      <Card data-testid="system-overview">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle>System Overview</CardTitle>
              <Badge className={getStatusColor(systemHealth?.overall || 'unknown')}>
                {getStatusIcon(systemHealth?.overall || 'unknown')}
                <span className="ml-1">{systemHealth?.overall || 'Unknown'}</span>
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('overview')}
            >
              {expandedSections.has('overview') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        
        {expandedSections.has('overview') && (
          <CardContent className="space-y-6">
            {/* Resource Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm text-muted-foreground">{systemHealth?.resources.cpu.toFixed(1)}%</span>
                </div>
                <Progress value={systemHealth?.resources.cpu || 0} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-muted-foreground">{systemHealth?.resources.memory.toFixed(1)}%</span>
                </div>
                <Progress value={systemHealth?.resources.memory || 0} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Disk Usage</span>
                  <span className="text-sm text-muted-foreground">{systemHealth?.resources.disk.toFixed(1)}%</span>
                </div>
                <Progress value={systemHealth?.resources.disk || 0} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Network Latency</span>
                  <span className="text-sm text-muted-foreground">{systemHealth?.resources.network}ms</span>
                </div>
                <Progress value={Math.min((systemHealth?.resources.network || 0) / 10, 100)} className="h-2" />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Security Status</p>
                      <p className="text-2xl font-bold">{systemHealth?.security.threatLevel}</p>
                      <p className="text-xs text-muted-foreground">
                        {systemHealth?.security.activeIncidents} active incidents
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Compliance Score</p>
                      <p className="text-2xl font-bold">{systemHealth?.compliance.score}%</p>
                      <p className="text-xs text-muted-foreground">
                        {systemHealth?.compliance.violations} violations
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium">Uptime</p>
                      <p className="text-2xl font-bold">{systemHealth?.compliance.uptime.toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Last 24 hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
          <TabsTrigger value="autonomous" data-testid="tab-autonomous">Autonomous Actions</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts & Rules</TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Metrics</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">Live Events</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="w-5 h-5" />
                  <span>Service Health</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemHealth?.services && Object.entries(systemHealth.services).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(status.status)}
                        <div>
                          <p className="font-medium">{service}</p>
                          <p className="text-xs text-muted-foreground">
                            Response: {status.responseTime}ms | Error Rate: {status.errorRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(status.status)}>
                          {status.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerHealing.mutate({ service })}
                          disabled={triggerHealing.isPending}
                          data-testid={`heal-${service}`}
                        >
                          <Zap className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Circuit Breakers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Circuit Breakers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circuitBreakers && circuitBreakers.map((cb: CircuitBreakerStatus) => (
                    <div key={cb.service} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(cb.state)}
                        <div>
                          <p className="font-medium">{cb.service}</p>
                          <p className="text-xs text-muted-foreground">
                            Success Rate: {cb.successRate.toFixed(1)}% | Failures: {cb.failureCount}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(cb.state)}>
                        {cb.state}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Autonomous Actions Tab */}
        <TabsContent value="autonomous" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Autonomous Bot Control</h3>
              <p className="text-sm text-muted-foreground">Manage autonomous monitoring and healing operations</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => controlBot.mutate('start')}
                disabled={controlBot.isPending}
                data-testid="start-bot"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
              <Button
                variant="outline"
                onClick={() => controlBot.mutate('stop')}
                disabled={controlBot.isPending}
                data-testid="stop-bot"
              >
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </Button>
              <Button
                variant="outline"
                onClick={() => controlBot.mutate('restart')}
                disabled={controlBot.isPending}
                data-testid="restart-bot"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restart
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="w-5 h-5" />
                <span>Recent Autonomous Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {autonomousActions && autonomousActions.map((action: AutonomousAction) => (
                    <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(action.status)}
                        <div>
                          <p className="font-medium">{action.type}</p>
                          <p className="text-sm text-muted-foreground">{action.service}</p>
                          <p className="text-xs text-muted-foreground">
                            Started: {new Date(action.startTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(action.status)}>
                          {action.status}
                        </Badge>
                        {action.endTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Duration: {((new Date(action.endTime).getTime() - new Date(action.startTime).getTime()) / 1000).toFixed(1)}s
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts & Rules Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Alert Rules</span>
              </CardTitle>
              <CardDescription>
                Configure and manage intelligent alerting rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertRules && alertRules.map((rule: AlertRule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(enabled) => toggleAlertRule.mutate({ ruleId: rule.id, enabled })}
                          data-testid={`toggle-rule-${rule.id}`}
                        />
                        {rule.triggered && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                      </div>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">{rule.category}</p>
                        {rule.lastTriggered && (
                          <p className="text-xs text-muted-foreground">
                            Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className={getSeverityColor(rule.severity)}>
                      {rule.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Performance Metrics</h3>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="6h">6 Hours</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPU & Memory Chart */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricsHistory?.resources || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memory %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metricsHistory?.responseTime || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="average" stackId="1" stroke="#8884d8" fill="#8884d8" name="Avg Response (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Error Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsHistory?.errorRate || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="rate" fill="#ff7c7c" name="Error Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Chart */}
            <Card>
              <CardHeader>
                <CardTitle>System Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricsHistory?.throughput || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="requests" stroke="#82ca9d" name="Requests/min" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Live System Events</span>
                <Badge variant="outline" className="ml-auto">
                  {realtimeEvents.length} events
                </Badge>
              </CardTitle>
              <CardDescription>
                Real-time monitoring events and system notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {realtimeEvents.map((event) => (
                    <Alert key={event.id} className={`${getSeverityColor(event.severity)} border`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {getStatusIcon(event.severity)}
                          <div>
                            <AlertTitle className="text-sm">{event.title}</AlertTitle>
                            <AlertDescription className="text-xs mt-1">
                              {event.description}
                            </AlertDescription>
                            <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                              <span>{new Date(event.timestamp).toLocaleString()}</span>
                              {event.service && <span>• {event.service}</span>}
                              {event.autoResolved && <Badge variant="outline" className="text-xs">Auto-resolved</Badge>}
                            </div>
                          </div>
                        </div>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </div>
                    </Alert>
                  ))}
                  
                  {realtimeEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No recent events. System is running smoothly.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Dashboard Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Browser Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications for critical alerts</p>
                  </div>
                  <Switch
                    checked={alertsEnabled}
                    onCheckedChange={setAlertsEnabled}
                    data-testid="notifications-toggle"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-refresh</p>
                    <p className="text-sm text-muted-foreground">Automatically refresh data</p>
                  </div>
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="font-medium">Refresh Interval</p>
                  <Select value={refreshInterval.toString()} onValueChange={(value) => setRefreshInterval(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000">2 seconds</SelectItem>
                      <SelectItem value="5000">5 seconds</SelectItem>
                      <SelectItem value="10000">10 seconds</SelectItem>
                      <SelectItem value="30000">30 seconds</SelectItem>
                      <SelectItem value="60000">1 minute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}