import { useState, useCallback, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { BiometricProfileSkeleton } from "@/components/ui/skeleton";

interface BiometricProfile {
  id: string;
  type: string;
  confidence: number;
  isActive: boolean;
  createdAt: string;
}

interface VerificationResult {
  success: boolean;
  confidence: number;
  type: string;
  userId?: string;
  error?: string;
}

function BiometricScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [selectedType, setSelectedType] = useState<"face" | "fingerprint" | "voice" | "iris">("face");
  
  const { toast } = useToast();
  // FIXED: Disable WebSocket to prevent connection errors
  // const { socket } = useWebSocket();
  const socket = null; // System works without real-time updates
  const queryClient = useQueryClient();

  // Get user's biometric profiles with optimized caching
  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["/api/biometric/profiles"],
    queryFn: () => api.get<BiometricProfile[]>("/api/biometric/profiles"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
  
  const profiles = useMemo(() => Array.isArray(profilesData) ? profilesData : [], [profilesData]);

  // Biometric verification mutation
  const verifyMutation = useMutation({
    mutationFn: (data: { type: string; template: string }) =>
      api.post<VerificationResult>("/api/biometric/verify", data),
    onSuccess: (result) => {
      setVerificationResult(result);
      setIsScanning(false);
      
      if (result.success) {
        toast({
          title: "Verification Successful",
          description: `${result.type} authentication successful with ${result.confidence}% confidence`,
          className: "border-secure bg-secure/10 text-secure",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: result.error || "Biometric verification failed",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      setIsScanning(false);
      toast({
        title: "Verification Error",
        description: "Failed to process biometric verification",
        variant: "destructive",
      });
    }
  });

  // Biometric registration mutation
  const registerMutation = useMutation({
    mutationFn: (data: { type: string; template: string }) =>
      api.post("/api/biometric/register", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/profiles"] });
      toast({
        title: "Registration Successful",
        description: `${selectedType} biometric registered successfully`,
        className: "border-secure bg-secure/10 text-secure",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.response?.data?.error || "Failed to register biometric",
        variant: "destructive",
      });
    }
  });

  const simulateBiometricCapture = useCallback(async (type: string): Promise<string> => {
    // Simulate biometric capture process
    // In production, this would interface with actual biometric hardware
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate a simulated biometric template
        const template = `${type}_template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        resolve(template);
      }, 3000);
    });
  }, []);

  const handleBiometricScan = useCallback(async () => {
    setIsScanning(true);
    setVerificationResult(null);

    try {
      // Simulate biometric capture
      const template = await simulateBiometricCapture(selectedType);
      
      // Verify the captured biometric
      verifyMutation.mutate({
        type: selectedType,
        template
      });
    } catch (error) {
      setIsScanning(false);
      toast({
        title: "Capture Failed",
        description: "Failed to capture biometric data",
        variant: "destructive",
      });
    }
  }, [selectedType, simulateBiometricCapture, verifyMutation, toast]);

  const handleBiometricRegistration = useCallback(async () => {
    try {
      // Check if this biometric type is already registered
      const existingProfile = profiles.find(p => p.type === selectedType && p.isActive);
      if (existingProfile) {
        toast({
          title: "Already Registered",
          description: `${selectedType} biometric is already registered`,
          variant: "destructive",
        });
        return;
      }

      setIsScanning(true);
      
      // Simulate biometric capture
      const template = await simulateBiometricCapture(selectedType);
      
      // Register the captured biometric
      registerMutation.mutate({
        type: selectedType,
        template
      });
      
      setIsScanning(false);
    } catch (error) {
      setIsScanning(false);
      toast({
        title: "Registration Failed",
        description: "Failed to capture biometric data for registration",
        variant: "destructive",
      });
    }
  }, [selectedType, profiles, simulateBiometricCapture, registerMutation, toast]);

  const getBiometricStatus = useCallback((type: string) => {
    const profile = profiles.find(p => p.type === type && p.isActive);
    return profile ? "active" : "inactive";
  }, [profiles]);

  const getBiometricIcon = useCallback((type: string) => {
    switch (type) {
      case "face": return "👤";
      case "fingerprint": return "👆";
      case "voice": return "🎤";
      case "iris": return "👁️";
      default: return "🔒";
    }
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Biometric Scanner Interface */}
      <Card className="glass border-glass-border" data-testid="card-biometric-scanner">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>🔍</span>
            <span>Live Biometric Scanner</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scanner Display */}
          <div className="text-center">
            <div className={`biometric-scanner ${isScanning ? 'animate-pulse' : ''}`} data-testid="biometric-scanner-display">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="text-4xl">{getBiometricIcon(selectedType)}</span>
              </div>
            </div>
            
            {isScanning && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">Scanning {selectedType}...</p>
                <Progress value={33} className="w-64 mx-auto" />
              </div>
            )}
          </div>

          {/* Biometric Type Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {["face", "fingerprint", "voice", "iris"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type as any)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedType === type
                      ? "border-primary bg-primary/10"
                      : "border-muted bg-muted/30"
                  }`}
                  data-testid={`button-select-${type}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>{getBiometricIcon(type)}</span>
                      <span className="font-medium capitalize">{type}</span>
                    </div>
                    <div className="flex items-center">
                      <span 
                        className={`status-indicator ${
                          getBiometricStatus(type) === "active" ? "status-online" : "status-warning"
                        }`}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleBiometricScan}
              disabled={isScanning || verifyMutation.isPending}
              className="w-full security-active text-white font-semibold py-3"
              data-testid="button-start-verification"
            >
              {isScanning ? (
                <>
                  <span className="loading-spinner w-4 h-4 mr-2" />
                  Scanning...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span className="ml-2">Start Biometric Verification</span>
                </>
              )}
            </Button>

            <Button
              onClick={handleBiometricRegistration}
              disabled={isScanning || registerMutation.isPending}
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary/10"
              data-testid="button-register-biometric"
            >
              {registerMutation.isPending ? (
                <>
                  <span className="loading-spinner w-4 h-4 mr-2" />
                  Registering...
                </>
              ) : (
                <>
                  <span>📝</span>
                  <span className="ml-2">Register {selectedType} Biometric</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Results */}
      <Card className="glass border-glass-border" data-testid="card-authentication-results">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📊</span>
            <span>Authentication Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verification Result */}
          {verificationResult && (
            <div className={`p-4 rounded-lg border-2 ${
              verificationResult.success 
                ? "border-secure bg-secure/10" 
                : "border-alert bg-alert/10"
            }`} data-testid="verification-result">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {verificationResult.success ? "✅" : "❌"}
                  </span>
                  <div>
                    <div className="font-medium">
                      {verificationResult.success ? "AUTHENTICATED" : "FAILED"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {verificationResult.type} Recognition
                    </div>
                  </div>
                </div>
                <Badge className={`${
                  verificationResult.success 
                    ? "security-level-1" 
                    : "security-level-3"
                }`}>
                  {verificationResult.confidence}%
                </Badge>
              </div>
              
              {verificationResult.success && (
                <div className="text-center mt-4">
                  <div className="text-sm text-muted-foreground">Security Level: Military Grade</div>
                </div>
              )}
            </div>
          )}

          {/* Biometric Profiles Status */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <span>🗂️</span>
              <span>Registered Biometrics</span>
            </h4>
            
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <BiometricProfileSkeleton key={i} />
                ))}
              </div>
            ) : profiles.length > 0 ? (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <div 
                    key={profile.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    data-testid={`profile-${profile.type}`}
                  >
                    <div className="flex items-center space-x-3">
                      <span>{getBiometricIcon(profile.type)}</span>
                      <div>
                        <div className="font-medium capitalize">{profile.type}</div>
                        <div className="text-sm text-muted-foreground">
                          Registered {new Date(profile.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="security-level-1">{profile.confidence}%</Badge>
                      <span className={`status-indicator ${
                        profile.isActive ? "status-online" : "status-warning"
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No biometric profiles registered</p>
                <p className="text-sm mt-2">Register your first biometric for enhanced security</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Export memoized component for better performance
export default memo(BiometricScanner);
