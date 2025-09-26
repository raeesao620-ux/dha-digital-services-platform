import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Shield, 
  Activity, 
  Database, 
  FileCheck, 
  HardDrive, 
  Network,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Cpu,
  TrendingUp,
  Users,
  Lock,
  Eye,
  FileText,
  Server,
  RefreshCw,
  Download,
  AlertCircle,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface GovernmentMetrics {
  security: {
    threatLevel: string;
    activeIncidents: number;
    blockedAttempts: number;
    encryptionStatus: string;
    complianceScore: number;
    zeroTrustActive: boolean;
  };
  monitoring: {
    systemHealth: string;
    activeAlerts: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
    slaCompliance: number;
  };
  disasterRecovery: {
    lastBackup: string;
    recoveryTimeObjective: number;
    recoveryPointObjective: number;
    backupStatus: string;
    replicationLag: number;
    drTestStatus: string;
  };
  compliance: {
    overallCompliance: number;
    criticalFindings: number;
    openFindings: number;
    lastAuditDate: string;
    nextAuditDate: string;
    dataBreaches: number;
    privacyRequests: number;
  };
  cache: any;
  highAvailability: {
    uptime: number;
    availability: number;
    failoverCount: number;
    averageFailoverTime: number;
    dataConsistency: number;
    replicationLag: number;
    activeNodes: number;
    totalNodes: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

export function GovernmentOperations() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch government operations metrics
  const { data: metrics, isLoading, error, refetch } = useQuery<GovernmentMetrics>({
    queryKey: ['/api/admin/government-operations/metrics'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch security incidents
  const { data: incidents } = useQuery({
    queryKey: ['/api/admin/government-operations/security/incidents'],
    refetchInterval: 60000
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Metrics Refreshed",
      description: "All government operations metrics have been updated",
    });
  };

  const handleBackup = async () => {
    try {
      const response = await apiRequest(
        'POST',
        '/api/admin/government-operations/disaster-recovery/backup',
        { description: 'Manual backup initiated from dashboard' }
      );
      const data = await response.json();
      
      toast({
        title: "Backup Initiated",
        description: `Backup ID: ${data.backupId}`,
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: "Failed to initiate backup. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleFailoverTest = async () => {
    try {
      const response = await apiRequest(
        'POST',
        '/api/admin/government-operations/high-availability/failover/test'
      );
      const data = await response.json();
      
      toast({
        title: data.success ? "Failover Test Successful" : "Failover Test Failed",
        description: data.success 
          ? "High availability failover test completed successfully"
          : "Failover test failed. Check system logs for details.",
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to initiate failover test.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading government operations data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load government operations data. Please check your permissions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            Government Operations Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Enterprise-grade monitoring and control for Department of Home Affairs
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          variant="outline"
          data-testid="button-refresh"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {metrics && metrics.compliance && metrics.compliance.criticalFindings > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Compliance Issues</AlertTitle>
          <AlertDescription>
            {metrics.compliance.criticalFindings} critical compliance findings require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="disaster" data-testid="tab-disaster">Disaster Recovery</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">High Availability</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Security Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Status</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-threat-level">
                  {metrics?.security.threatLevel || 'LOW'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.security.activeIncidents || 0} active incidents
                </p>
                <Progress 
                  value={metrics?.security.complianceScore || 0} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-system-health">
                  {metrics?.monitoring.systemHealth || 'HEALTHY'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.monitoring.uptime || 0}% uptime
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant={metrics?.monitoring?.errorRate && metrics.monitoring.errorRate < 1 ? "default" : "destructive"}>
                    {metrics?.monitoring?.errorRate || 0}% errors
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Score */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-compliance-score">
                  {metrics?.compliance.overallCompliance || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.compliance.openFindings || 0} open findings
                </p>
                <Progress 
                  value={metrics?.compliance.overallCompliance || 0} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>

            {/* High Availability */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Availability</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-availability">
                  {metrics?.highAvailability.availability?.toFixed(2) || 100}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.highAvailability.activeNodes || 0}/{metrics?.highAvailability.totalNodes || 0} nodes active
                </p>
                <Badge variant="outline" className="mt-2">
                  {metrics?.highAvailability.requestsPerSecond || 0} req/s
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Critical government operations controls</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={handleBackup} variant="outline" data-testid="button-backup">
                <Database className="h-4 w-4 mr-2" />
                Create Backup
              </Button>
              <Button onClick={handleFailoverTest} variant="outline" data-testid="button-failover">
                <Zap className="h-4 w-4 mr-2" />
                Test Failover
              </Button>
              <Button variant="outline" data-testid="button-compliance-report">
                <FileText className="h-4 w-4 mr-2" />
                Generate Compliance Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Threat Level</span>
                  <Badge variant={metrics?.security.threatLevel === 'LOW' ? 'default' : 'destructive'}>
                    {metrics?.security.threatLevel}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Active Incidents</span>
                  <span className="font-bold">{metrics?.security.activeIncidents}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Blocked Attempts</span>
                  <span className="font-bold">{metrics?.security.blockedAttempts}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Encryption Status</span>
                  <Badge variant="outline">
                    {metrics?.security.encryptionStatus || 'FIPS 140-2'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Zero Trust Active</span>
                  <Badge variant={metrics?.security.zeroTrustActive ? 'default' : 'secondary'}>
                    {metrics?.security.zeroTrustActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Security Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {incidents && Array.isArray(incidents) && incidents.length > 0 ? (
                    <div className="space-y-2">
                      {(incidents as any[]).slice(0, 5).map((incident: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{incident.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(incident.detectedAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={
                              incident.severity === 'critical' ? 'destructive' :
                              incident.severity === 'high' ? 'destructive' :
                              incident.severity === 'medium' ? 'secondary' : 'outline'
                            }>
                              {incident.severity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No recent incidents</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm font-bold">
                      {metrics?.monitoring.avgResponseTime?.toFixed(2) || 0}ms
                    </span>
                  </div>
                  <Progress value={Math.min((metrics?.monitoring.avgResponseTime || 0) / 10, 100)} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Error Rate</span>
                    <span className="text-sm font-bold">
                      {metrics?.monitoring.errorRate?.toFixed(2) || 0}%
                    </span>
                  </div>
                  <Progress value={metrics?.monitoring.errorRate || 0} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">SLA Compliance</span>
                    <span className="text-sm font-bold">
                      {metrics?.monitoring.slaCompliance || 100}%
                    </span>
                  </div>
                  <Progress value={metrics?.monitoring.slaCompliance || 100} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center py-4">
                  {metrics?.monitoring.activeAlerts || 0}
                </div>
                <p className="text-center text-muted-foreground">
                  alerts requiring attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center py-4">
                  {metrics?.monitoring.uptime || 100}%
                </div>
                <p className="text-center text-muted-foreground">
                  over the last 30 days
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Disaster Recovery Tab */}
        <TabsContent value="disaster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Recovery Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Last Backup</p>
                  <p className="font-bold">{metrics?.disasterRecovery.lastBackup || 'Never'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Backup Status</p>
                  <Badge variant={metrics?.disasterRecovery.backupStatus === 'success' ? 'default' : 'destructive'}>
                    {metrics?.disasterRecovery.backupStatus || 'Unknown'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RTO (Recovery Time Objective)</p>
                  <p className="font-bold">{metrics?.disasterRecovery.recoveryTimeObjective || 0} minutes</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RPO (Recovery Point Objective)</p>
                  <p className="font-bold">{metrics?.disasterRecovery.recoveryPointObjective || 0} minutes</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Replication Lag</p>
                  <p className="font-bold">{metrics?.disasterRecovery.replicationLag || 0}ms</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DR Test Status</p>
                  <Badge variant="outline">
                    {metrics?.disasterRecovery.drTestStatus || 'Not Tested'}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="flex gap-4">
                <Button onClick={handleBackup} data-testid="button-create-backup">
                  <Database className="h-4 w-4 mr-2" />
                  Create Backup Now
                </Button>
                <Button variant="outline" data-testid="button-restore">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restore from Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Overall Compliance</span>
                    <span className="font-bold">
                      {metrics?.compliance.overallCompliance || 0}%
                    </span>
                  </div>
                  <Progress value={metrics?.compliance.overallCompliance || 0} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical Findings</p>
                    <p className="text-2xl font-bold text-red-600">
                      {metrics?.compliance.criticalFindings || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Open Findings</p>
                    <p className="text-2xl font-bold">
                      {metrics?.compliance.openFindings || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data Breaches</p>
                    <p className="text-2xl font-bold">
                      {metrics?.compliance.dataBreaches || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Privacy Requests</p>
                    <p className="text-2xl font-bold">
                      {metrics?.compliance.privacyRequests || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Last Audit</p>
                  <p className="font-bold">
                    {metrics?.compliance.lastAuditDate ? 
                      new Date(metrics.compliance.lastAuditDate).toLocaleDateString() : 
                      'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Audit</p>
                  <p className="font-bold">
                    {metrics?.compliance.nextAuditDate ? 
                      new Date(metrics.compliance.nextAuditDate).toLocaleDateString() : 
                      'Not Scheduled'}
                  </p>
                </div>
                <Button variant="outline" className="w-full" data-testid="button-generate-report">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Compliance Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* High Availability Tab */}
        <TabsContent value="availability" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cluster Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Active Nodes</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.activeNodes || 0}/{metrics?.highAvailability.totalNodes || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Data Consistency</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.dataConsistency?.toFixed(2) || 100}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Replication Lag</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.replicationLag?.toFixed(0) || 0}ms
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Failover Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Failovers</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.failoverCount || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Failover Time</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.averageFailoverTime?.toFixed(0) || 0}ms
                  </span>
                </div>
                <Button 
                  onClick={handleFailoverTest} 
                  variant="outline" 
                  className="w-full mt-4"
                  data-testid="button-test-failover"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Test Failover
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Requests/Second</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.requestsPerSecond?.toFixed(0) || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.errorRate?.toFixed(2) || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Availability</span>
                  <span className="font-bold">
                    {metrics?.highAvailability.availability?.toFixed(3) || 100}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}