import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Download, Server, Cloud, Settings, Database, Shield, FileText, Package } from "lucide-react";

interface PackageItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  size?: string;
}

export default function DeploymentPackage() {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  
  const { toast } = useToast();

  const packageContents: PackageItem[] = [
    {
      name: "Source Code",
      description: "Complete application source with all modules",
      icon: <FileText className="w-5 h-5 text-primary" />,
      size: "45 MB"
    },
    {
      name: "Database Schemas",
      description: "Production-ready database migration scripts",
      icon: <Database className="w-5 h-5 text-secure" />,
      size: "2 MB"
    },
    {
      name: "Configuration Files",
      description: "Environment configs for dev, staging, production",
      icon: <Settings className="w-5 h-5 text-warning" />,
      size: "1 MB"
    },
    {
      name: "Documentation",
      description: "Complete setup and deployment guides",
      icon: <FileText className="w-5 h-5 text-quantum" />,
      size: "15 MB"
    },
    {
      name: "Docker Containers",
      description: "Pre-configured containerized services",
      icon: <Package className="w-5 h-5 text-primary" />,
      size: "180 MB"
    },
    {
      name: "Security Certificates",
      description: "SSL/TLS certificates and security configs",
      icon: <Shield className="w-5 h-5 text-secure" />,
      size: "4 MB"
    }
  ];

  const deploymentOptions = [
    {
      id: "cloud",
      name: "Cloud Deployment",
      description: "Deploy to AWS, Azure, or Google Cloud with auto-scaling and managed security",
      icon: <Cloud className="w-6 h-6 text-primary" />,
      badge: "Recommended",
      badgeClass: "security-level-1"
    },
    {
      id: "onprem",
      name: "On-Premises",
      description: "Deploy to your own infrastructure with complete control and security",
      icon: <Server className="w-6 h-6 text-secure" />,
      badge: "Secure",
      badgeClass: "security-level-1"
    },
    {
      id: "hybrid",
      name: "Hybrid Solution",
      description: "Combine cloud services with on-premises security for optimal performance",
      icon: <Settings className="w-6 h-6 text-warning" />,
      badge: "Advanced",
      badgeClass: "security-level-2"
    }
  ];

  const systemRequirements = [
    { label: "CPU", value: "4 cores, 2.5 GHz" },
    { label: "RAM", value: "16 GB minimum" },
    { label: "Storage", value: "100 GB SSD" },
    { label: "OS", value: "Linux/Windows Server" }
  ];

  const simulateDownload = async (packageType: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);

    // Simulate download progress
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsDownloading(false);
          
          toast({
            title: "Download Complete",
            description: `${packageType} package downloaded successfully`,
            className: "border-secure bg-secure/10 text-secure",
          });
          
          // Reset progress after a delay
          setTimeout(() => setDownloadProgress(0), 2000);
          
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 300);
  };

  const handleDeploymentAction = (deploymentId: string, action: string) => {
    switch (action) {
      case "deploy-cloud":
        toast({
          title: "Cloud Deployment Initiated",
          description: "Setting up cloud infrastructure...",
          className: "border-primary bg-primary/10 text-primary",
        });
        break;
      case "deploy-onprem":
        simulateDownload("On-Premises Deployment");
        break;
      case "configure-hybrid":
        toast({
          title: "Hybrid Configuration",
          description: "Opening hybrid deployment wizard...",
          className: "border-warning bg-warning/10 text-warning",
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Package Contents */}
      <Card className="glass border-glass-border" data-testid="card-package-contents">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-primary" />
            <span>Package Contents</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {packageContents.map((item, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              data-testid={`package-item-${index}`}
            >
              {item.icon}
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              {item.size && (
                <Badge variant="outline" className="text-xs">
                  {item.size}
                </Badge>
              )}
            </div>
          ))}

          <Separator />

          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
            <div>
              <div className="font-medium">Total Package Size</div>
              <div className="text-sm text-muted-foreground">Complete deployment package</div>
            </div>
            <Badge className="security-level-1">247 MB</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Options */}
      <Card className="glass border-glass-border" data-testid="card-deployment-options">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-secure" />
            <span>Deployment Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {deploymentOptions.map((option) => (
            <div
              key={option.id}
              className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              data-testid={`deployment-option-${option.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {option.icon}
                  <span className="font-medium">{option.name}</span>
                </div>
                <Badge className={option.badgeClass}>{option.badge}</Badge>
              </div>
              
              <div className="text-sm text-muted-foreground mb-4">
                {option.description}
              </div>
              
              <Button
                onClick={() => {
                  setSelectedDeployment(option.id);
                  handleDeploymentAction(option.id, `deploy-${option.id}`);
                }}
                disabled={isDownloading}
                className={`w-full ${
                  option.id === "cloud" ? "bg-primary hover:bg-primary/90" :
                  option.id === "onprem" ? "bg-secure hover:bg-secure/90" :
                  "bg-warning hover:bg-warning/90 text-black"
                } text-white font-semibold`}
                data-testid={`button-deploy-${option.id}`}
              >
                {option.id === "cloud" && <Cloud className="w-4 h-4 mr-2" />}
                {option.id === "onprem" && <Download className="w-4 h-4 mr-2" />}
                {option.id === "hybrid" && <Settings className="w-4 h-4 mr-2" />}
                
                {option.id === "cloud" && "Deploy to Cloud"}
                {option.id === "onprem" && "Download Package"}
                {option.id === "hybrid" && "Configure Hybrid"}
              </Button>
            </div>
          ))}

          {/* System Requirements */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium mb-3">Minimum System Requirements</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              {systemRequirements.map((req, index) => (
                <div
                  key={index}
                  className="flex justify-between"
                  data-testid={`requirement-${req.label.toLowerCase()}`}
                >
                  <span>{req.label}:</span>
                  <span>{req.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Section */}
      <div className="lg:col-span-2">
        <Card className="glass border-glass-border" data-testid="card-download-section">
          <CardHeader>
            <CardTitle className="text-center">Ready to Deploy?</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Download the complete DHA Security Platform package with everything you need for production deployment.
            </p>

            {/* Download Progress */}
            {downloadProgress > 0 && (
              <div className="space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between text-sm">
                  <span>Downloading package...</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <Progress value={downloadProgress} className="w-full" />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
              <Button
                onClick={() => simulateDownload("Full Package")}
                disabled={isDownloading}
                className="bg-secure hover:bg-secure/90 text-white px-8 py-4 font-semibold flex items-center justify-center"
                data-testid="button-download-full-package"
              >
                {isDownloading ? (
                  <>
                    <div className="loading-spinner w-4 h-4 mr-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Full Package (247 MB)
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 px-8 py-4 font-semibold flex items-center justify-center"
                data-testid="button-view-documentation"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
            </div>

            <div className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Package includes: Source code, database schemas, Docker configs, SSL certificates, and comprehensive documentation
            </div>

            {/* Security Notice */}
            <div className="bg-secure/10 border border-secure/30 rounded-lg p-4 max-w-2xl mx-auto">
              <div className="flex items-start space-x-2">
                <Shield className="w-5 h-5 text-secure mt-0.5" />
                <div className="text-left">
                  <div className="font-medium text-secure">Security Notice</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    This package contains military-grade security components. Ensure proper handling 
                    and deployment in accordance with your organization's security protocols.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
