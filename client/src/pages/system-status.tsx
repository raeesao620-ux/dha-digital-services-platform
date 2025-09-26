import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Activity, Shield, Database, Cpu } from "lucide-react";

interface HealthData {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
}

interface MonitoringData {
  autonomousBot: any;
  selfHealing: any;
  errorDetection: any;
  proactiveMaintenance: any;
  intelligentAlerting: any;
  webSocketService: any;
  timestamp: string;
}

export default function SystemStatus() {
  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery<HealthData>({
    queryKey: ['/api/health'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: monitoringData, isLoading: monitoringLoading } = useQuery<MonitoringData>({
    queryKey: ['/api/monitoring/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const isSystemHealthy = healthData?.status === 'healthy';
  const isMonitoringActive = monitoringData?.autonomousBot !== undefined;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          🏛️ DHA Digital Services Platform
        </h1>
        <p className="text-xl text-muted-foreground">
          South African Department of Home Affairs - System Status
        </p>
        {healthData && (
          <div className="flex items-center justify-center gap-2">
            {isSystemHealthy && isMonitoringActive ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <Badge variant={isSystemHealthy && isMonitoringActive ? "default" : "destructive"}>
              {isSystemHealthy && isMonitoringActive ? "OPERATIONAL" : "CHECKING SYSTEMS"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(healthData.timestamp).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Health Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ) : healthError ? (
              <div className="text-red-500">
                <p className="text-sm">Connection Error</p>
                <p className="text-xs text-muted-foreground">Unable to reach backend</p>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold">
                  {healthData?.status?.toUpperCase() || "UNKNOWN"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Service: {healthData?.service}
                </p>
                <p className="text-xs text-muted-foreground">
                  Environment: {healthData?.environment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Status</CardTitle>
            <Shield className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {monitoringLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold">
                  {monitoringData ? "ACTIVE" : "LOADING"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Services: {monitoringData ? Object.keys(monitoringData).length - 1 : 0} Active
                </p>
                <p className="text-xs text-muted-foreground">
                  Platform: DHA Digital Services
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Connection</CardTitle>
            <Database className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div>
              <div className="text-2xl font-bold">
                {healthError ? "OFFLINE" : "ONLINE"}
              </div>
              <p className="text-xs text-muted-foreground">
                Backend: {healthError ? "Disconnected" : "Connected"}
              </p>
              <p className="text-xs text-muted-foreground">
                Auto-refresh: 5s intervals
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Grid */}
      {monitoringData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Available Features
            </CardTitle>
            <CardDescription>
              Core capabilities of the DHA Digital Services Platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(monitoringData).filter(([key]) => key !== 'timestamp').map(([service, status], index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50"
                >
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{service}: {typeof status === 'object' ? status?.status || 'Active' : status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      {(healthData || monitoringData) && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>
              Raw API responses for development and troubleshooting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthData && (
                <div>
                  <h4 className="font-medium mb-2">Health Check Response:</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                    {JSON.stringify(healthData, null, 2)}
                  </pre>
                </div>
              )}
              {monitoringData && (
                <div>
                  <h4 className="font-medium mb-2">Monitoring Response:</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                    {JSON.stringify(monitoringData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}