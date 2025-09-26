import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Login from "@/pages/Login";
import Dashboard from "./pages/Dashboard";
import AIAssistantPage from "./pages/ai-assistant";
import DocumentGenerationPage from "./pages/document-generation";
import DocumentServices from "./pages/DocumentServices";
import DocumentUploadPage from "./pages/DocumentUploadPage";
import PDFTestPage from "./pages/pdf-test";
import DocumentVerificationPage from "./pages/verify";
import NotFoundPage from "./pages/not-found";
import SystemStatus from "./pages/system-status";
import { DebugDashboard } from "./components/debug/DebugDashboard";
import AdminGuard from "./components/admin/AdminGuard";
import AIChatAssistant from "./components/AIChatAssistant";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import BiometricInitialSetup from "@/components/BiometricInitialSetup";
import { UltraAI } from "./pages/UltraAI";
import QueenDashboard from "./pages/QueenDashboard";

// Lazy load admin components for better code splitting
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const DocumentManagement = lazy(() => import("./pages/admin/DocumentManagement"));
const SecurityCenter = lazy(() => import("./pages/admin/SecurityCenter"));
const SystemMonitoring = lazy(() => import("./pages/admin/SystemMonitoring"));
const AIAnalytics = lazy(() => import("./pages/admin/AIAnalytics"));
const AdminAIChat = lazy(() => import("./pages/admin/AIChat"));
const GovernmentOperations = lazy(() => 
  import("./pages/admin/GovernmentOperations").then(module => ({ default: module.GovernmentOperations }))
);
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));

// Loading fallback component for admin routes
function AdminLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-lg font-medium text-foreground">Loading Admin Panel...</div>
        <div className="text-sm text-muted-foreground">Please wait while we load the admin interface</div>
      </div>
    </div>
  );
}

function App() {
  const [showAIChat, setShowAIChat] = useState(false);
  const isMobile = useIsMobile();
  const [isBiometricSetupComplete, setIsBiometricSetupComplete] = useState(false);

  useEffect(() => {
    // Check if biometric setup has already been completed
    const setupComplete = localStorage.getItem("biometricSetupComplete");
    if (setupComplete === "true") {
      setIsBiometricSetupComplete(true);
    }
  }, []);

  const handleBiometricSetupSuccess = () => {
    localStorage.setItem("biometricSetupComplete", "true");
    setIsBiometricSetupComplete(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-background safe-area-top safe-area-left safe-area-right">
          <Switch>
            {/* Biometric Setup Route */}
            {!isBiometricSetupComplete && (
              <Route path="/biometric-setup">
                <BiometricInitialSetup onSetupComplete={handleBiometricSetupSuccess} />
              </Route>
            )}

            <Route path="/login" component={Login} />

            {/* Protected Routes */}
            <Route path="/">
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            </Route>
            <Route path="/ai-assistant">
              <AuthGuard>
                <AIAssistantPage />
              </AuthGuard>
            </Route>
            <Route path="/documents">
              <AuthGuard>
                <DocumentGenerationPage />
              </AuthGuard>
            </Route>
            <Route path="/document-services">
              <AuthGuard>
                <DocumentServices />
              </AuthGuard>
            </Route>
            <Route path="/document-upload">
              <AuthGuard>
                <DocumentUploadPage />
              </AuthGuard>
            </Route>
            <Route path="/document-generation">
              <AuthGuard>
                <DocumentGenerationPage />
              </AuthGuard>
            </Route>
            <Route path="/pdf-test">
              <AuthGuard>
                <PDFTestPage />
              </AuthGuard>
            </Route>
            <Route path="/verify">
              <AuthGuard>
                <DocumentVerificationPage />
              </AuthGuard>
            </Route>
            <Route path="/verify/:code">
              <AuthGuard>
                <DocumentVerificationPage />
              </AuthGuard>
            </Route>
            <Route path="/debug">
              <AuthGuard>
                <DebugDashboard />
              </AuthGuard>
            </Route>
            <Route path="/system-status">
              <SystemStatus />
            </Route>

            {/* Admin Routes - Protected with code splitting */}
            <Route path="/admin/dashboard">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminDashboard />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/users">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <UserManagement />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/documents">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <DocumentManagement />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/security">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <SecurityCenter />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/system">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <SystemMonitoring />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/ai-analytics">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AIAnalytics />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/government-operations">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <GovernmentOperations />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/monitoring">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <MonitoringDashboard />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>
            <Route path="/admin/ai-chat">
              <AuthGuard>
                <AdminGuard>
                  <Suspense fallback={<AdminLoadingFallback />}>
                    <AdminAIChat />
                  </Suspense>
                </AdminGuard>
              </AuthGuard>
            </Route>

            {/* Ultra AI Route - Admin Only */}
            <Route path="/ultra-ai">
              <AuthGuard>
                <AdminGuard>
                  <UltraAI />
                </AdminGuard>
              </AuthGuard>
            </Route>

            {/* Queen Dashboard - Live System Test */}
            <Route path="/queen-dashboard">
              <QueenDashboard />
            </Route>

            <Route component={NotFoundPage} />
          </Switch>
        </div>

        {/* Floating AI Chat Assistant */}
        {showAIChat && (
          <AIChatAssistant
            embedded={true}
            onMinimize={() => setShowAIChat(false)}
          />
        )}

        {/* Floating AI Chat Button */}
        {!showAIChat && (
          <Button
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-lg z-40 touch-manipulation safe-area-bottom"
            onClick={() => setShowAIChat(true)}
            data-testid="button-open-ai-chat"
          >
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNav className="pb-safe" />}

        <Toaster />
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;