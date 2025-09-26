import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield, Zap, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface SystemContext {
  health?: {
    cpu: number;
    memory: number;
    network: number;
    storage: number;
  };
  security?: {
    threatsBlocked: number;
    suspiciousActivities: number;
    detectionRate: number;
    falsePositives: number;
  };
  quantum?: {
    activeKeys: number;
    algorithms: string[];
    averageEntropy: number;
    quantumReadiness: string;
    nextRotation: string;
  };
  alerts?: Array<{
    id: string;
    alertType: string;
    riskScore: number;
    createdAt: string;
    details: any;
  }>;
}

interface ContextPanelProps {
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

export default function ContextPanel({
  isConnected,
  emit,
  on,
  off,
}: ContextPanelProps) {
  const [context, setContext] = useState<SystemContext>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch initial context and set up real-time updates
  useEffect(() => {
    if (isConnected) {
      refreshContext();
    }

    const handleContextUpdate = (newContext: SystemContext) => {
      setContext(newContext);
      setIsRefreshing(false);
    };

    const handleContextError = () => {
      setIsRefreshing(false);
    };

    on("system:context", handleContextUpdate);
    on("system:contextError", handleContextError);

    return () => {
      off("system:context", handleContextUpdate);
      off("system:contextError", handleContextError);
    };
  }, [isConnected, emit, on, off]);

  const refreshContext = () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    emit("system:getContext");
  };

  const getStatusColor = (value: number, thresholds = { good: 80, warning: 60 }) => {
    if (value >= thresholds.good) return "text-green-400";
    if (value >= thresholds.warning) return "text-amber-400";
    return "text-red-400";
  };

  const getThreatLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low": return "bg-green-500";
      case "medium": return "bg-amber-500";
      case "high": return "bg-red-500";
      case "critical": return "bg-red-600";
      default: return "bg-gray-500";
    }
  };

  const formatTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  return (
    <div className="bg-card border-l border-border flex flex-col h-full" data-testid="panel-system-context">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground" data-testid="text-context-title">
            System Context
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshContext}
            disabled={!isConnected || isRefreshing}
            data-testid="button-refresh-context"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isConnected && (
          <div className="text-center text-muted-foreground">
            <p data-testid="text-disconnected">Disconnected</p>
          </div>
        )}

        {/* Biometric Status */}
        <div className="bg-muted rounded-lg p-4" data-testid="section-biometric">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Biometric Status</h3>
            <span className="w-2 h-2 bg-green-500 rounded-full" data-testid="indicator-biometric-status" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Users</span>
              <span className="text-foreground font-medium" data-testid="text-active-users">
                {context.biometric?.activeUsers || 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="text-green-400 font-medium" data-testid="text-success-rate">
                {context.biometric?.successRate || '0'}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Failed Attempts</span>
              <span className="text-red-400 font-medium" data-testid="text-failed-attempts">
                {context.biometric?.failedAttempts || 0}
              </span>
            </div>
            <Progress value={99.7} className="h-2 mt-3" data-testid="progress-biometric-success" />
          </div>
        </div>

        {/* Quantum Security */}
        {context.quantum && (
          <div className="bg-muted rounded-lg p-4" data-testid="section-quantum">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Quantum Security</h3>
              <span className="w-2 h-2 bg-blue-500 rounded-full" data-testid="indicator-quantum-status" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Keys</span>
                <span className="text-foreground font-medium" data-testid="text-quantum-active-keys">
                  {context.quantum.activeKeys}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Algorithms</span>
                <span className="text-blue-400 font-medium" data-testid="text-quantum-algorithms">
                  {context.quantum.algorithms?.length || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Readiness</span>
                <span className="text-green-400 font-medium" data-testid="text-quantum-readiness">
                  {context.quantum.quantumReadiness}
                </span>
              </div>
              <div className="bg-secondary rounded p-2 mt-3">
                <div className="text-xs text-muted-foreground">Next Rotation</div>
                <div className="text-xs text-foreground font-medium" data-testid="text-quantum-rotation">
                  {context.quantum.nextRotation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Alerts */}
        <div className="bg-muted rounded-lg p-4" data-testid="section-security-alerts">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Security Alerts</h3>
            <Badge variant="secondary" className="bg-amber-500 text-amber-900" data-testid="badge-active-alerts">
              {context.alerts?.length || 0} Active
            </Badge>
          </div>
          <div className="space-y-3">
            {context.alerts && context.alerts.length > 0 ? (
              context.alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="border border-amber-500/20 bg-amber-500/10 rounded p-3"
                  data-testid={`alert-item-${alert.id}`}
                >
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="text-amber-500 h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground" data-testid={`text-alert-title-${alert.id}`}>
                        {alert.alertType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Risk Score: {alert.riskScore}/100
                      </p>
                      <span className="text-xs text-amber-400" data-testid={`text-alert-time-${alert.id}`}>
                        {formatTime(alert.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm">No active alerts</p>
              </div>
            )}
          </div>
        </div>

        {/* System Performance */}
        {context.health && (
          <div className="bg-muted rounded-lg p-4" data-testid="section-system-performance">
            <h3 className="text-sm font-semibold text-foreground mb-3">System Performance</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">CPU Usage</span>
                  <span className={`font-medium ${getStatusColor(100 - context.health.cpu, { good: 70, warning: 50 })}`} data-testid="text-cpu-usage">
                    {context.health.cpu}%
                  </span>
                </div>
                <Progress value={context.health.cpu} className="h-2" data-testid="progress-cpu-usage" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Memory</span>
                  <span className={`font-medium ${getStatusColor(100 - context.health.memory, { good: 70, warning: 50 })}`} data-testid="text-memory-usage">
                    {context.health.memory}%
                  </span>
                </div>
                <Progress value={context.health.memory} className="h-2" data-testid="progress-memory-usage" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Network</span>
                  <span className={`font-medium ${getStatusColor(context.health.network)}`} data-testid="text-network-usage">
                    {context.health.network}%
                  </span>
                </div>
                <Progress value={context.health.network} className="h-2" data-testid="progress-network-usage" />
              </div>
            </div>
          </div>
        )}

        {/* Security Metrics */}
        {context.security && (
          <div className="bg-muted rounded-lg p-4" data-testid="section-security-metrics">
            <h3 className="text-sm font-semibold text-foreground mb-3">Security Metrics (24h)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Threats Blocked</span>
                <span className="text-green-400 font-medium" data-testid="text-threats-blocked">
                  {context.security.threatsBlocked}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suspicious Activities</span>
                <span className="text-amber-400 font-medium" data-testid="text-suspicious-activities">
                  {context.security.suspiciousActivities}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Detection Rate</span>
                <span className={`font-medium ${getStatusColor(context.security.detectionRate)}`} data-testid="text-detection-rate">
                  {context.security.detectionRate}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
