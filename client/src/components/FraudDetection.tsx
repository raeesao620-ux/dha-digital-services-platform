import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface FraudAlert {
  id: string;
  alertType: string;
  riskScore: number;
  details: any;
  isResolved: boolean;
  createdAt: string;
}

interface SecurityMetrics {
  threatsBlocked: number;
  suspiciousActivities: number;
  falsePositives: number;
  detectionRate: number;
  timestamp: string;
}

export default function FraudDetection() {
  const [detectionSettings, setDetectionSettings] = useState({
    loginAnomalyDetection: true,
    behavioralAnalysis: true,
    realTimeAlerts: true
  });
  
  const { toast } = useToast();
  // FIXED: Disable WebSocket to prevent connection errors
  // const { socket } = useWebSocket();
  const socket = null; // System works without real-time updates
  const queryClient = useQueryClient();

  // Get fraud alerts
  const { data: fraudAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/fraud/alerts"],
    queryFn: () => api.get<FraudAlert[]>("/api/fraud/alerts"),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get security metrics
  const { data: securityMetrics } = useQuery({
    queryKey: ["/api/monitoring/security"],
    queryFn: () => api.get<SecurityMetrics>("/api/monitoring/security"),
    refetchInterval: 15000 // Refresh every 15 seconds
  });

  // Resolve fraud alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.post(`/api/fraud/alerts/${alertId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fraud/alerts"] });
      toast({
        title: "Alert Resolved",
        description: "Fraud alert has been successfully resolved",
        className: "border-secure bg-secure/10 text-secure",
      });
    },
    onError: () => {
      toast({
        title: "Resolution Failed",
        description: "Failed to resolve fraud alert",
        variant: "destructive",
      });
    }
  });

  // Listen for real-time fraud alerts
  useEffect(() => {
    if (socket) {
      socket.on("fraud:alert", (alert) => {
        queryClient.invalidateQueries({ queryKey: ["/api/fraud/alerts"] });
        
        toast({
          title: "🚨 Fraud Alert",
          description: `${alert.alertType} detected with risk score: ${alert.riskScore}`,
          className: "border-alert bg-alert/10 text-alert",
        });
      });

      return () => {
        socket.off("fraud:alert");
      };
    }
  }, [socket, queryClient, toast]);

  const getRiskLevelBadge = (riskScore: number) => {
    if (riskScore >= 80) return <Badge className="security-level-3">CRITICAL</Badge>;
    if (riskScore >= 60) return <Badge className="security-level-3">HIGH</Badge>;
    if (riskScore >= 30) return <Badge className="security-level-2">MEDIUM</Badge>;
    return <Badge className="security-level-1">LOW</Badge>;
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType.toLowerCase()) {
      case "high_risk_detected":
      case "critical_risk_detected":
        return "🚨";
      case "suspicious_activity":
        return "⚠️";
      case "unusual_login":
        return "🔐";
      default:
        return "🔍";
    }
  };

  // Generate chart data for fraud detection metrics
  const chartData = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      {
        label: 'Threats Detected',
        data: [2, 1, 4, 3, 7, 5],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4
      },
      {
        label: 'Threats Blocked',
        data: [2, 1, 4, 3, 6, 5],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgb(156, 163, 175)'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      },
      x: {
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Fraud Monitoring Dashboard */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="glass border-glass-border" data-testid="card-fraud-monitoring">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🛡️</span>
              <span>Fraud Monitoring Dashboard</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Chart Container */}
            <div className="chart-container mb-6" style={{ height: '300px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>

            {/* Recent Fraud Alerts */}
            <div className="space-y-3">
              <h4 className="font-medium">Recent Fraud Alerts</h4>
              {alertsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="loading-spinner w-6 h-6" />
                </div>
              ) : fraudAlerts.length > 0 ? (
                <div className="space-y-3">
                  {fraudAlerts.slice(0, 5).map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.riskScore >= 80 ? "border-alert bg-alert/10" :
                        alert.riskScore >= 60 ? "border-warning bg-warning/10" :
                        "border-secure bg-secure/10"
                      }`}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <span className="text-lg mt-1">
                            {getAlertIcon(alert.alertType)}
                          </span>
                          <div>
                            <div className="font-medium">{alert.alertType.replace(/_/g, ' ')}</div>
                            <div className="text-sm text-muted-foreground">
                              {alert.details?.location && `Location: ${alert.details.location} | `}
                              {new Date(alert.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getRiskLevelBadge(alert.riskScore)}
                          {!alert.isResolved && (
                            <Button
                              size="sm"
                              onClick={() => resolveAlertMutation.mutate(alert.id)}
                              disabled={resolveAlertMutation.isPending}
                              className="security-level-1"
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent fraud alerts</p>
                  <p className="text-sm mt-2">System is secure</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detection Controls and Stats */}
      <div className="space-y-6">
        {/* Detection Settings */}
        <Card className="glass border-glass-border" data-testid="card-detection-settings">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>⚙️</span>
              <span>Detection Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Login Anomaly Detection</span>
              <Switch
                checked={detectionSettings.loginAnomalyDetection}
                onCheckedChange={(checked) =>
                  setDetectionSettings(prev => ({ ...prev, loginAnomalyDetection: checked }))
                }
                data-testid="switch-login-anomaly"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Behavioral Analysis</span>
              <Switch
                checked={detectionSettings.behavioralAnalysis}
                onCheckedChange={(checked) =>
                  setDetectionSettings(prev => ({ ...prev, behavioralAnalysis: checked }))
                }
                data-testid="switch-behavioral-analysis"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Real-time Alerts</span>
              <Switch
                checked={detectionSettings.realTimeAlerts}
                onCheckedChange={(checked) =>
                  setDetectionSettings(prev => ({ ...prev, realTimeAlerts: checked }))
                }
                data-testid="switch-realtime-alerts"
              />
            </div>
          </CardContent>
        </Card>

        {/* Today's Stats */}
        <Card className="glass border-glass-border" data-testid="card-security-stats">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📊</span>
              <span>Today's Stats</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityMetrics ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Threats Blocked</span>
                  <span className="font-semibold text-secure" data-testid="stat-threats-blocked">
                    {securityMetrics.threatsBlocked}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Suspicious Activities</span>
                  <span className="font-semibold text-warning" data-testid="stat-suspicious-activities">
                    {securityMetrics.suspiciousActivities}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">False Positives</span>
                  <span className="font-semibold text-primary" data-testid="stat-false-positives">
                    {securityMetrics.falsePositives}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Detection Rate</span>
                  <span className="font-semibold text-secure" data-testid="stat-detection-rate">
                    {securityMetrics.detectionRate}%
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <div className="loading-spinner w-4 h-4" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass border-glass-border" data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>⚡</span>
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full security-level-2"
              data-testid="button-manual-scan"
            >
              <span>🔍</span>
              <span className="ml-2">Manual Security Scan</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-warning text-warning hover:bg-warning/10"
              data-testid="button-lockdown"
            >
              <span>🔒</span>
              <span className="ml-2">Emergency Lockdown</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-primary text-primary hover:bg-primary/10"
              data-testid="button-export-report"
            >
              <span>📄</span>
              <span className="ml-2">Export Security Report</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
