import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, AlertTriangle, Activity, Users, Lock, Radio, 
  FileText, Eye, Zap, AlertCircle, CheckCircle, XCircle,
  Wifi, Database, Server, Terminal, Target, Map,
  Phone, MessageSquare, Mail, Video, Globe, Layers
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

interface ThreatLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'IMMINENT';
  color: string;
  description: string;
}

interface SecurityMetrics {
  military: {
    activeOperations: number;
    deployedAssets: number;
    activeChannels: number;
    encryptedMessages: number;
    tempestCompliance: boolean;
    quantumReadiness: boolean;
  };
  classification: {
    topSecret: number;
    secret: number;
    confidential: number;
    unclassified: number;
    activeCompartments: number;
  };
  accessControl: {
    activePersonnel: number;
    clearanceEvaluations: number;
    accessViolations: number;
    insiderThreatScore: number;
  };
  cyberDefense: {
    activeThreats: number;
    honeypotInteractions: {
      deployed: number;
      interactions: number;
    };
    killChainAnalyses: number;
    mlModels: {
      count: number;
      averageAccuracy: number;
    };
  };
  compliance: {
    stig: { level: string; score: number };
    nist: { implementedControls: number; percentage: number };
    commonCriteria: { targetEAL: string; readiness: number };
  };
}

const DEFCON_LEVELS = [
  { level: 5, name: 'DEFCON 5', color: 'bg-blue-500', description: 'Normal readiness' },
  { level: 4, name: 'DEFCON 4', color: 'bg-green-500', description: 'Increased intelligence' },
  { level: 3, name: 'DEFCON 3', color: 'bg-yellow-500', description: 'Increase in force readiness' },
  { level: 2, name: 'DEFCON 2', color: 'bg-orange-500', description: 'Further increase in readiness' },
  { level: 1, name: 'DEFCON 1', color: 'bg-red-500', description: 'Maximum readiness' }
];

const THREAT_LEVELS: Record<string, ThreatLevel> = {
  LOW: { level: 'LOW', color: 'bg-green-500', description: 'Normal operations' },
  MEDIUM: { level: 'MEDIUM', color: 'bg-yellow-500', description: 'Elevated surveillance' },
  HIGH: { level: 'HIGH', color: 'bg-orange-500', description: 'Active threats detected' },
  CRITICAL: { level: 'CRITICAL', color: 'bg-red-500', description: 'Immediate action required' },
  IMMINENT: { level: 'IMMINENT', color: 'bg-red-700', description: 'Attack in progress' }
};

export default function MilitaryOperations() {
  const [currentDefcon, setCurrentDefcon] = useState(5);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>(THREAT_LEVELS.LOW);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);

  // Fetch security metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SecurityMetrics>({
    queryKey: ['/api/military/metrics'],
    refetchInterval: liveUpdates ? 5000 : false // Update every 5 seconds if live
  });

  // Fetch active incidents
  const { data: incidents } = useQuery({
    queryKey: ['/api/military/incidents'],
    refetchInterval: liveUpdates ? 10000 : false
  });

  // Fetch threat intelligence
  const { data: threatIntel } = useQuery({
    queryKey: ['/api/military/threat-intel'],
    refetchInterval: liveUpdates ? 30000 : false
  });

  // Emergency protocol activation
  const activateEmergency = useMutation({
    mutationFn: async (protocol: string) => {
      const response = await fetch('/api/military/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol })
      });
      return response.json();
    },
    onSuccess: () => {
      setEmergencyMode(true);
      queryClient.invalidateQueries({ queryKey: ['/api/military'] });
    }
  });

  // Update DEFCON level
  const updateDefcon = useMutation({
    mutationFn: async (level: number) => {
      const response = await fetch('/api/military/defcon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentDefcon(data.level);
    }
  });

  // Calculate overall threat level based on metrics
  useEffect(() => {
    if (metrics) {
      const threats = metrics.cyberDefense.activeThreats;
      const violations = metrics.accessControl.accessViolations;
      const insiderScore = metrics.accessControl.insiderThreatScore;
      
      if (threats > 10 || violations > 5 || insiderScore > 80) {
        setThreatLevel(THREAT_LEVELS.CRITICAL);
      } else if (threats > 5 || violations > 2 || insiderScore > 60) {
        setThreatLevel(THREAT_LEVELS.HIGH);
      } else if (threats > 2 || violations > 0 || insiderScore > 40) {
        setThreatLevel(THREAT_LEVELS.MEDIUM);
      } else {
        setThreatLevel(THREAT_LEVELS.LOW);
      }
    }
  }, [metrics]);

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <p>Initializing Military Operations Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="military-operations-dashboard">
      {/* Header with DEFCON and Threat Level */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold">Military Operations Center</h1>
            <p className="text-gray-600">Real-time security monitoring and threat response</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">DEFCON Level</p>
              <div className={`px-4 py-2 rounded ${DEFCON_LEVELS[5 - currentDefcon].color} text-white font-bold`}>
                {DEFCON_LEVELS[5 - currentDefcon].name}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Threat Level</p>
              <div className={`px-4 py-2 rounded ${threatLevel.color} text-white font-bold`}>
                {threatLevel.level}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Alert */}
        {emergencyMode && (
          <Alert className="border-red-500 bg-red-50 mb-4" data-testid="emergency-alert">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">
              <strong>EMERGENCY PROTOCOL ACTIVATED</strong> - All security systems on maximum alert. 
              Restricted access enforced. Monitoring all channels.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <Button 
            variant={emergencyMode ? "destructive" : "outline"}
            onClick={() => activateEmergency.mutate('LOCKDOWN')}
            disabled={emergencyMode}
            data-testid="button-lockdown"
          >
            <Lock className="h-4 w-4 mr-2" />
            Initiate Lockdown
          </Button>
          <Button 
            variant="outline"
            onClick={() => activateEmergency.mutate('SCRAMBLE')}
            data-testid="button-scramble"
          >
            <Radio className="h-4 w-4 mr-2" />
            Scramble Communications
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLiveUpdates(!liveUpdates)}
            data-testid="button-toggle-live"
          >
            <Activity className={`h-4 w-4 mr-2 ${liveUpdates ? 'animate-pulse' : ''}`} />
            {liveUpdates ? 'Pause' : 'Resume'} Live Updates
          </Button>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="comms">Communications</TabsTrigger>
          <TabsTrigger value="intel">Intelligence</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Military Operations */}
            <Card data-testid="card-operations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Operations</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.military.activeOperations || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.military.deployedAssets || 0} assets deployed
                </p>
              </CardContent>
            </Card>

            {/* Cyber Threats */}
            <Card data-testid="card-threats">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {metrics?.cyberDefense.activeThreats || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.cyberDefense.killChainAnalyses || 0} kill chains analyzed
                </p>
              </CardContent>
            </Card>

            {/* Secure Channels */}
            <Card data-testid="card-channels">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Secure Channels</CardTitle>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.military.activeChannels || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.military.encryptedMessages || 0} encrypted messages
                </p>
              </CardContent>
            </Card>

            {/* Personnel Security */}
            <Card data-testid="card-personnel">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cleared Personnel</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.accessControl.activePersonnel || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.accessControl.clearanceEvaluations || 0} evaluations pending
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Classification Distribution */}
          <Card data-testid="card-classification">
            <CardHeader>
              <CardTitle>Information Classification</CardTitle>
              <CardDescription>Distribution of classified materials</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">TOP SECRET</span>
                  <Badge variant="destructive">{metrics?.classification.topSecret || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">SECRET</span>
                  <Badge variant="destructive">{metrics?.classification.secret || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">CONFIDENTIAL</span>
                  <Badge>{metrics?.classification.confidential || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">UNCLASSIFIED</span>
                  <Badge variant="secondary">{metrics?.classification.unclassified || 0}</Badge>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Compartments</span>
                  <Badge variant="outline">{metrics?.classification.activeCompartments || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cyber Defense Status */}
            <Card data-testid="card-cyber-defense">
              <CardHeader>
                <CardTitle>Cyber Defense Systems</CardTitle>
                <CardDescription>Advanced threat detection and response</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Honeypot Coverage</span>
                      <span className="text-sm font-medium">
                        {metrics?.cyberDefense.honeypotInteractions.deployed || 0} deployed
                      </span>
                    </div>
                    <Progress 
                      value={(metrics?.cyberDefense.honeypotInteractions.interactions || 0) * 10} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics?.cyberDefense.honeypotInteractions.interactions || 0} interactions detected
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">ML Model Accuracy</span>
                      <span className="text-sm font-medium">
                        {((metrics?.cyberDefense.mlModels.averageAccuracy || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(metrics?.cyberDefense.mlModels.averageAccuracy || 0) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics?.cyberDefense.mlModels.count || 0} ML models active
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Insider Threat Score</span>
                      <span className="text-sm font-medium">
                        {metrics?.accessControl.insiderThreatScore || 0}/100
                      </span>
                    </div>
                    <Progress 
                      value={metrics?.accessControl.insiderThreatScore || 0} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Incidents */}
            <Card data-testid="card-incidents">
              <CardHeader>
                <CardTitle>Active Security Incidents</CardTitle>
                <CardDescription>Real-time incident tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {incidents && Array.isArray(incidents) && incidents.length > 0 ? (
                    <div className="space-y-2">
                      {incidents.map((incident: any) => (
                        <div 
                          key={incident.id}
                          className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedOperation(incident.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{incident.type}</p>
                              <p className="text-xs text-gray-600">{incident.description}</p>
                            </div>
                            <Badge 
                              variant={incident.severity === 'CRITICAL' ? 'destructive' : 'default'}
                            >
                              {incident.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(incident.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No active incidents</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Kill Chain Analysis */}
          <Card data-testid="card-kill-chain">
            <CardHeader>
              <CardTitle>Kill Chain Analysis</CardTitle>
              <CardDescription>Cyber attack progression tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center space-x-2">
                {['Recon', 'Weaponization', 'Delivery', 'Exploitation', 'Installation', 'C2', 'Actions'].map((phase, index) => (
                  <div key={phase} className="flex-1 text-center">
                    <div className={`h-2 ${index < 3 ? 'bg-red-500' : 'bg-gray-200'} rounded`} />
                    <p className="text-xs mt-1">{phase}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Security Clearance Status */}
            <Card data-testid="card-clearance">
              <CardHeader>
                <CardTitle>Security Clearance Distribution</CardTitle>
                <CardDescription>Personnel clearance levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">TOP SECRET/SCI</span>
                    <div className="flex items-center gap-2">
                      <Progress value={25} className="w-24 h-2" />
                      <span className="text-sm font-medium">25%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">TOP SECRET</span>
                    <div className="flex items-center gap-2">
                      <Progress value={35} className="w-24 h-2" />
                      <span className="text-sm font-medium">35%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">SECRET</span>
                    <div className="flex items-center gap-2">
                      <Progress value={60} className="w-24 h-2" />
                      <span className="text-sm font-medium">60%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">CONFIDENTIAL</span>
                    <div className="flex items-center gap-2">
                      <Progress value={80} className="w-24 h-2" />
                      <span className="text-sm font-medium">80%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Access Violations */}
            <Card data-testid="card-violations">
              <CardHeader>
                <CardTitle>Access Control Violations</CardTitle>
                <CardDescription>Unauthorized access attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-red-600">
                    {metrics?.accessControl.accessViolations || 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">violations in the last 24 hours</p>
                </div>
                {(metrics?.accessControl.accessViolations ?? 0) > 0 && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Elevated access violations detected. Review security logs immediately.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="comms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Secure Channels */}
            <Card data-testid="card-secure-comms">
              <CardHeader>
                <CardTitle>Secure Communication Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-voice">
                    <Phone className="h-4 w-4 mr-2" />
                    Secure Voice (STE)
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-video">
                    <Video className="h-4 w-4 mr-2" />
                    Secure Video (VTC)
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Tactical Chat
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-email">
                    <Mail className="h-4 w-4 mr-2" />
                    Classified Email
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Network Status */}
            <Card data-testid="card-network">
              <CardHeader>
                <CardTitle>Network Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">NIPRNET</span>
                    </div>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span className="text-sm">SIPRNET</span>
                    </div>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span className="text-sm">JWICS</span>
                    </div>
                    <Badge variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />
                      Restricted
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Encryption Status */}
            <Card data-testid="card-encryption">
              <CardHeader>
                <CardTitle>Encryption Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suite B Cryptography</span>
                    <Badge variant="secondary">
                      {metrics?.military.tempestCompliance ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Quantum Resistant</span>
                    <Badge variant="secondary">
                      {metrics?.military.quantumReadiness ? 'Ready' : 'Not Ready'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">TEMPEST Compliant</span>
                    <Badge variant="secondary">
                      {metrics?.military.tempestCompliance ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intel" className="space-y-4">
          <Card data-testid="card-threat-intel">
            <CardHeader>
              <CardTitle>Threat Intelligence Feed</CardTitle>
              <CardDescription>Real-time intelligence from multiple sources</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {threatIntel && Array.isArray(threatIntel) && threatIntel.length > 0 ? (
                  <div className="space-y-3">
                    {threatIntel.map((intel: any) => (
                      <div key={intel.id} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{intel.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{intel.description}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{intel.source}</Badge>
                              <Badge variant="outline">{intel.confidence}% confidence</Badge>
                            </div>
                          </div>
                          <Badge variant={intel.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                            {intel.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No threat intelligence available</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* STIG Compliance */}
            <Card data-testid="card-stig">
              <CardHeader>
                <CardTitle>DISA STIG Compliance</CardTitle>
                <CardDescription>Defense Information Systems Agency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-3xl font-bold">{metrics?.compliance.stig.score}%</div>
                  <p className="text-sm text-gray-600 mt-2">Compliance Score</p>
                </div>
                <Progress value={metrics?.compliance.stig.score || 0} className="mt-4" />
                <Badge className="mt-4 w-full justify-center">
                  {metrics?.compliance.stig.level} Security
                </Badge>
              </CardContent>
            </Card>

            {/* NIST Compliance */}
            <Card data-testid="card-nist">
              <CardHeader>
                <CardTitle>NIST 800-53 Controls</CardTitle>
                <CardDescription>Security and Privacy Controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-3xl font-bold">
                    {metrics?.compliance.nist.implementedControls}/{metrics?.compliance.nist.implementedControls ? 300 : 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Controls Implemented</p>
                </div>
                <Progress value={metrics?.compliance.nist.percentage || 0} className="mt-4" />
                <p className="text-center text-sm text-gray-600 mt-2">
                  {metrics?.compliance.nist.percentage}% Complete
                </p>
              </CardContent>
            </Card>

            {/* Common Criteria */}
            <Card data-testid="card-common-criteria">
              <CardHeader>
                <CardTitle>Common Criteria</CardTitle>
                <CardDescription>International Security Certification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-3xl font-bold">{metrics?.compliance.commonCriteria.targetEAL}</div>
                  <p className="text-sm text-gray-600 mt-2">Target Assurance Level</p>
                </div>
                <Progress value={metrics?.compliance.commonCriteria.readiness || 0} className="mt-4" />
                <p className="text-center text-sm text-gray-600 mt-2">
                  {metrics?.compliance.commonCriteria.readiness}% Ready
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Operation Modal */}
      {selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Operation Details</CardTitle>
              <CardDescription>ID: {selectedOperation}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Detailed operation information would be displayed here.</p>
            </CardContent>
            <div className="p-6 pt-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedOperation(null)}>
                Close
              </Button>
              <Button variant="destructive">
                Terminate Operation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}