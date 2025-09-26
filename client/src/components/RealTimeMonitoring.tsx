
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Activity, AlertTriangle, CheckCircle, XCircle, Users, Zap, Database, HardDrive } from 'lucide-react';

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  activeUsers: number;
  requestsPerMinute: number;
  errorRate: number;
}

interface SystemAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export function RealTimeMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [isConnected, setIsConnected] = useState(false);

  const { socket, isConnected: wsConnected } = useWebSocket();

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time metrics
    socket.on('system_metrics', (data: SystemMetrics) => {
      setMetrics(data);
    });

    // Listen for system alerts
    socket.on('system_alert', (alert: SystemAlert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    });

    // Listen for alert resolutions
    socket.on('alert_resolved', ({ alertId }: { alertId: string }) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ));
    });

    // Fetch initial data
    fetchInitialData();

    return () => {
      socket.off('system_metrics');
      socket.off('system_alert');
      socket.off('alert_resolved');
    };
  }, [socket]);

  const fetchInitialData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch('/api/monitoring/real-time/metrics'),
        fetch('/api/monitoring/real-time/alerts?active=true')
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData.latest) {
          setMetrics(metricsData.latest);
        }
        setSystemHealth(metricsData.systemHealth);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch initial monitoring data:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/real-time/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getHealthColor = () => {
    switch (systemHealth) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getHealthIcon = () => {
    switch (systemHealth) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getProgressColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'bg-red-500';
    if (value >= thresholds.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card className="glass border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getHealthIcon()}
            System Health
            <Badge 
              variant={systemHealth === 'healthy' ? 'default' : 'destructive'}
              className={`ml-auto ${getHealthColor()}`}
            >
              {systemHealth.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span>Real-time Monitoring</span>
            <span className={`flex items-center gap-1 ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass border-glass-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{metrics.cpu.toFixed(1)}%</span>
                  <span className="text-muted-foreground">/ 100%</span>
                </div>
                <Progress 
                  value={metrics.cpu} 
                  className="h-2"
                  style={{
                    background: getProgressColor(metrics.cpu, { warning: 70, critical: 85 })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-glass-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{metrics.memory.toFixed(1)}%</span>
                  <span className="text-muted-foreground">/ 100%</span>
                </div>
                <Progress 
                  value={metrics.memory} 
                  className="h-2"
                  style={{
                    background: getProgressColor(metrics.memory, { warning: 75, critical: 90 })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-glass-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Disk Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{metrics.disk.toFixed(1)}%</span>
                  <span className="text-muted-foreground">/ 100%</span>
                </div>
                <Progress 
                  value={metrics.disk} 
                  className="h-2"
                  style={{
                    background: getProgressColor(metrics.disk, { warning: 80, critical: 95 })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-glass-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">{metrics.activeUsers}</div>
                <div className="text-xs text-muted-foreground">
                  {metrics.requestsPerMinute} req/min • {metrics.errorRate}% errors
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="glass border-glass-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
              <Badge variant="destructive" className="ml-auto">
                {alerts.filter(a => !a.resolved).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <Alert 
                key={alert.id} 
                className={`${alert.resolved ? 'opacity-50' : ''} ${
                  alert.type === 'critical' ? 'border-red-500' :
                  alert.type === 'warning' ? 'border-yellow-500' :
                  'border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={alert.type === 'critical' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {alert.type.toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm">{alert.title}</span>
                      {alert.resolved && <Badge variant="outline" className="text-xs">RESOLVED</Badge>}
                    </div>
                    <AlertDescription className="text-xs">
                      {alert.message}
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {!alert.resolved && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => resolveAlert(alert.id)}
                      className="ml-2"
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
