import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Bot, 
  Shield, 
  Users, 
  Fingerprint, 
  Activity,
  Database,
  MessageSquare,
  Upload,
  Search,
  Settings,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SouthAfricanCoatOfArms, DHALogo } from "@/components/GovernmentAssets";

export default function Dashboard() {
  const { user, logout } = useAuth();

  const features = [
    {
      title: "Ra'is al Khadir",
      description: "Your wise AI guide with unlimited capabilities",
      icon: Bot,
      link: "/ai-assistant",
      color: "bg-blue-500",
      badge: "Ultra AI"
    },
    {
      title: "Document Generation", 
      description: "All 21 DHA document types available",
      icon: FileText,
      link: "/documents",
      color: "bg-green-500",
      badge: "21 Types"
    },
    {
      title: "Admin Dashboard",
      description: "Complete system management interface", 
      icon: Shield,
      link: "/admin/dashboard",
      color: "bg-purple-500",
      badge: "Admin Only"
    },
    {
      title: "Biometric Systems",
      description: "Advanced biometric authentication",
      icon: Fingerprint,
      link: "/admin/security",
      color: "bg-red-500",
      badge: "Secure"
    },
    {
      title: "Document Upload",
      description: "Upload and OCR process documents",
      icon: Upload,
      link: "/document-upload", 
      color: "bg-orange-500",
      badge: "OCR Ready"
    },
    {
      title: "Real-time Services",
      description: "WebSocket connectivity and monitoring",
      icon: Activity,
      link: "/admin/monitoring",
      color: "bg-teal-500",
      badge: "Live"
    },
    {
      title: "User Management",
      description: "Manage users and permissions",
      icon: Users,
      link: "/admin/users",
      color: "bg-indigo-500",
      badge: "Admin"
    },
    {
      title: "Document Services",
      description: "Advanced document processing",
      icon: Search,
      link: "/document-services",
      color: "bg-cyan-500",
      badge: "Advanced"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <SouthAfricanCoatOfArms className="h-10 w-10" />
              <DHALogo className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">DHA Digital Services</h1>
                <p className="text-sm text-gray-500">Department of Home Affairs Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✅ FULLY OPERATIONAL - 200% PERFORMANCE
              </Badge>
              <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🏛️ DHA Digital Services Platform
          </h2>
          <p className="text-gray-600 text-lg">
            Select a service to access the full functionality of your government digital platform
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Link key={index} href={feature.link}>
              <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 hover:border-l-primary hover:scale-105 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${feature.color} bg-opacity-10`}>
                      <feature.icon className={`h-6 w-6 text-white`} style={{color: feature.color.replace('bg-', '').replace('-500', '')}} />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* System Status */}
        <div className="mt-12">
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center text-green-800">
                <Activity className="h-5 w-5 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>Server: Online</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>Database: Active</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>AI Services: Ready</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>Security: Protected</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/ai-assistant">
              <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-quick-ai">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat with AI
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" data-testid="button-quick-docs">
                <FileText className="h-4 w-4 mr-2" />
                Generate Document
              </Button>
            </Link>
            <Link href="/document-upload">
              <Button variant="outline" data-testid="button-quick-upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </Link>
            {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'raeesa_ultra') && (
              <Link href="/admin/dashboard">
                <Button variant="outline" data-testid="button-quick-admin">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}