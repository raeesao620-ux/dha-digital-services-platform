import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  Camera,
  Search,
  Clock,
  User,
  FileText,
  AlertTriangle,
  Hash,
  MapPin,
  Calendar,
  RefreshCw,
  Eye,
  Lock,
  Unlock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  isValid: boolean;
  documentType?: string;
  documentNumber?: string;
  issuedDate?: string;
  expiryDate?: string;
  holderName?: string;
  verificationCount: number;
  lastVerified?: string;
  issueOffice?: string;
  issuingOfficer?: string;
  hashtags?: string[];
  verificationHistory?: Array<{
    timestamp: string;
    ipAddress?: string;
    location?: string;
  }>;
  securityFeatures?: {
    brailleEncoded: boolean;
    holographicSeal: boolean;
    qrCodeValid: boolean;
    hashValid: boolean;
  };
  message?: string;
}

export default function DocumentVerificationPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);

  // Handle URL parameter for direct verification
  useEffect(() => {
    const urlCode = params?.code;
    if (urlCode) {
      setVerificationCode(urlCode);
      verifyDocument(urlCode);
    }
  }, [params]);

  // Load recent scans from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentVerificationScans");
    if (saved) {
      setRecentScans(JSON.parse(saved));
    }
  }, []);

  // Verify document mutation
  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("GET", `/api/verify/${code.toUpperCase()}`);
      return response.json();
    },
    onSuccess: (data: VerificationResult) => {
      setVerificationResult(data);
      
      // Save to recent scans
      const newRecentScans = [verificationCode, ...recentScans.filter(c => c !== verificationCode)].slice(0, 10);
      setRecentScans(newRecentScans);
      localStorage.setItem("recentVerificationScans", JSON.stringify(newRecentScans));
      
      // Show toast based on result
      if (data.isValid) {
        toast({
          title: "✅ Document Verified",
          description: "This is an authentic DHA document."
        });
      } else {
        toast({
          title: "❌ Verification Failed",
          description: data.message || "This document could not be verified.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification Error",
        description: error.message || "Failed to verify document",
        variant: "destructive"
      });
    }
  });

  // Log scan attempt mutation
  const scanMutation = useMutation({
    mutationFn: async (data: { code: string; location?: string; deviceInfo?: any }) => {
      const response = await apiRequest("POST", "/api/verification/scan", data);
      return response.json();
    }
  });

  const verifyDocument = async (code?: string) => {
    const codeToVerify = code || verificationCode;
    if (!codeToVerify) {
      toast({
        title: "Error",
        description: "Please enter a verification code",
        variant: "destructive"
      });
      return;
    }

    // Log the scan attempt
    scanMutation.mutate({
      code: codeToVerify,
      location: window.location.href,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    });

    // Perform verification
    verifyMutation.mutate(codeToVerify);
  };

  const handleQRScan = () => {
    setScannerActive(true);
    // In a real implementation, this would use a QR scanner library
    // For demo purposes, we'll simulate a scan
    setTimeout(() => {
      const simulatedCode = "DEMO123456AB";
      setVerificationCode(simulatedCode);
      setScannerActive(false);
      verifyDocument(simulatedCode);
    }, 2000);
  };

  const getStatusIcon = (isValid: boolean | undefined) => {
    if (isValid === undefined) return <QrCode className="h-12 w-12 text-gray-400" />;
    return isValid ? 
      <CheckCircle2 className="h-12 w-12 text-green-500" data-testid="icon-valid" /> : 
      <XCircle className="h-12 w-12 text-red-500" data-testid="icon-invalid" />;
  };

  const getDocumentTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      work_permit: "Work Permit",
      asylum_visa: "Asylum Visa",
      birth_certificate: "Birth Certificate",
      passport: "Passport",
      residence_permit: "Residence Permit",
      refugee_permit: "Refugee Permit",
      study_permit: "Study Permit"
    };
    return types[type] || type;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <Shield className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Document Verification Portal</h1>
        <p className="text-lg text-muted-foreground">
          Verify the authenticity of South African government documents
        </p>
      </div>

      {/* Main Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Verification Input */}
        <Card>
          <CardHeader>
            <CardTitle>Verify Document</CardTitle>
            <CardDescription>
              Scan QR code or enter verification code manually
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" data-testid="tab-manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="scan" data-testid="tab-scan">QR Scan</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    placeholder="Enter 12-character code (e.g., ABC123DEF456)"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="font-mono text-lg"
                    data-testid="input-verification-code"
                  />
                </div>
                <Button 
                  onClick={() => verifyDocument()} 
                  className="w-full"
                  disabled={verifyMutation.isPending || !verificationCode}
                  data-testid="button-verify"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Verify Document
                    </>
                  )}
                </Button>
              </TabsContent>
              
              <TabsContent value="scan" className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  {scannerActive ? (
                    <div className="space-y-4">
                      <Camera className="h-24 w-24 mx-auto text-primary animate-pulse" />
                      <p className="text-lg">Scanning QR Code...</p>
                      <p className="text-sm text-muted-foreground">
                        Position the QR code within the camera frame
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <QrCode className="h-24 w-24 mx-auto text-gray-400" />
                      <Button 
                        onClick={handleQRScan} 
                        size="lg"
                        data-testid="button-scan-qr"
                      >
                        <Camera className="mr-2 h-5 w-5" />
                        Start QR Scanner
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Recent Scans */}
            {recentScans.length > 0 && (
              <div className="mt-6">
                <Label>Recent Verifications</Label>
                <ScrollArea className="h-24 w-full rounded-md border p-2 mt-2">
                  <div className="space-y-1">
                    {recentScans.map((code, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start font-mono text-xs"
                        onClick={() => {
                          setVerificationCode(code);
                          verifyDocument(code);
                        }}
                        data-testid={`button-recent-${index}`}
                      >
                        <Clock className="mr-2 h-3 w-3" />
                        {code}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Result */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
            <CardDescription>
              Document authenticity status and details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verificationResult ? (
              <div className="space-y-4">
                {/* Status Icon and Message */}
                <div className="text-center py-4">
                  {getStatusIcon(verificationResult.isValid)}
                  <h3 className="text-2xl font-bold mt-2" data-testid="text-status">
                    {verificationResult.isValid ? "VERIFIED" : "NOT VERIFIED"}
                  </h3>
                  <p className="text-muted-foreground mt-1" data-testid="text-message">
                    {verificationResult.message}
                  </p>
                </div>

                <Separator />

                {/* Document Details */}
                {verificationResult.isValid && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Document Type</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-document-type">
                            {getDocumentTypeLabel(verificationResult.documentType || "")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Document Number</p>
                          <p className="text-sm text-muted-foreground font-mono" data-testid="text-document-number">
                            {verificationResult.documentNumber}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Holder Name</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-holder-name">
                            {verificationResult.holderName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Validity Period</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-validity">
                            {verificationResult.issuedDate && `Issued: ${new Date(verificationResult.issuedDate).toLocaleDateString()}`}
                            {verificationResult.expiryDate && ` | Expires: ${new Date(verificationResult.expiryDate).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Issuing Office</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-office">
                            {verificationResult.issueOffice}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Verification Count</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-verification-count">
                            This document has been verified {verificationResult.verificationCount} time(s)
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Security Features */}
                    <div>
                      <p className="text-sm font-medium mb-2">Security Features</p>
                      <div className="flex flex-wrap gap-2">
                        {verificationResult.securityFeatures?.brailleEncoded && (
                          <Badge variant="outline" className="text-xs" data-testid="badge-braille">
                            <Lock className="mr-1 h-3 w-3" />
                            Braille Encoded
                          </Badge>
                        )}
                        {verificationResult.securityFeatures?.holographicSeal && (
                          <Badge variant="outline" className="text-xs" data-testid="badge-holographic">
                            <Shield className="mr-1 h-3 w-3" />
                            Holographic Seal
                          </Badge>
                        )}
                        {verificationResult.securityFeatures?.qrCodeValid && (
                          <Badge variant="outline" className="text-xs" data-testid="badge-qr">
                            <QrCode className="mr-1 h-3 w-3" />
                            QR Valid
                          </Badge>
                        )}
                        {verificationResult.securityFeatures?.hashValid && (
                          <Badge variant="outline" className="text-xs" data-testid="badge-hash">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Hash Valid
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Hashtags */}
                    {verificationResult.hashtags && verificationResult.hashtags.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-2">Social Media Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {verificationResult.hashtags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs" data-testid={`badge-hashtag-${index}`}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Failed Verification Warning */}
                {!verificationResult.isValid && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      This document could not be verified. It may be invalid, expired, or revoked.
                      Please contact the Department of Home Affairs for assistance.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="h-24 w-24 mx-auto mb-4 text-gray-300" />
                <p>Enter a verification code to check document authenticity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>How Document Verification Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  1
                </div>
                <h4 className="font-medium">Scan or Enter Code</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Use the QR scanner or manually enter the 12-character verification code found on the document.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  2
                </div>
                <h4 className="font-medium">Instant Verification</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Our system instantly checks the document against the official DHA database for authenticity.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  3
                </div>
                <h4 className="font-medium">View Results</h4>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                See detailed verification results including document details, validity status, and security features.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            For assistance, contact: 0800 60 11 90 | info@dha.gov.za
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}