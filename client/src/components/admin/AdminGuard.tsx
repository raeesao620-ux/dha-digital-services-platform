import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { auth } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, ArrowLeft } from "lucide-react";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = () => {
    try {
      // Check if user is authenticated
      if (!auth.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      // Get current user
      const currentUser = auth.getCurrentUser();
      setUser(currentUser);

      // Check if user has admin role
      if (currentUser?.role === "admin") {
        setIsAuthorized(true);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Admin access check failed:", error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto animate-pulse mb-4" />
          <p className="text-muted-foreground">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You must be logged in to access the admin portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => navigate("/")}
              data-testid="button-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have sufficient permissions to access the admin portal. 
              Administrator privileges are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <div className="font-medium">Current User:</div>
              <div className="text-muted-foreground">
                {user?.username} ({user?.role})
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}