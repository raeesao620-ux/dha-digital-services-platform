import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Menu, 
  Shield, 
  Users, 
  FileText, 
  Lock, 
  Monitor, 
  BarChart3,
  Settings,
  LogOut,
  User,
  Bot,
  Crown
} from "lucide-react";
import { auth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AdminNotifications from "./AdminNotifications";
import { useAdminWebSocket } from "@/hooks/useAdminWebSocket";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavigationItems = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: BarChart3,
    description: "System overview and metrics"
  },
  {
    title: "AI Assistant",
    href: "/admin/ai-chat",
    icon: Crown,
    description: "Unlimited AI chat with admin authority",
    badge: "UNLIMITED"
  },
  {
    title: "User Management",
    href: "/admin/users", 
    icon: Users,
    description: "Manage users and roles"
  },
  {
    title: "Document Management",
    href: "/admin/documents",
    icon: FileText,
    description: "Document verification queue"
  },
  {
    title: "Security Center",
    href: "/admin/security",
    icon: Lock,
    description: "Security events and alerts"
  },
  {
    title: "System Monitoring",
    href: "/admin/system",
    icon: Monitor,
    description: "Performance and system health"
  }
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();
  const currentUser = auth.getCurrentUser();
  const { connectionStatus, isConnected } = useAdminWebSocket();

  const handleLogout = () => {
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    auth.logout();
  };

  const isActiveRoute = (href: string) => {
    return location === href || location.startsWith(href + "/");
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-border shadow-sm safe-area-top">
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 lg:px-8">
          <div className="flex items-center space-x-4">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-trigger">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <AdminSidebar mobile onNavigate={() => setIsOpen(false)} />
              </SheetContent>
            </Sheet>
            
            <Link href="/admin/dashboard">
              <div className="flex items-center space-x-2 cursor-pointer">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-foreground">DHA Admin Portal</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">Digital Services Management</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Badge variant="outline" className={
              isConnected 
                ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
            }>
              <span className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}></span>
              {isConnected ? "System Online" : "System Offline"}
            </Badge>

            <AdminNotifications />

            <div className="flex items-center space-x-2">
              <div className="text-right text-sm">
                <p className="font-medium">{currentUser?.username}</p>
                <p className="text-muted-foreground capitalize">{currentUser?.role}</p>
              </div>
              <Button variant="ghost" size="icon" data-testid="user-menu-button">
                <User className="h-5 w-5" />
              </Button>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:top-16">
          <AdminSidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

interface AdminSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

function AdminSidebar({ mobile = false, onNavigate }: AdminSidebarProps) {
  const [location] = useLocation();

  const handleNavigate = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-border">
      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          {adminNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start h-auto p-3 ${
                    isActive 
                      ? "bg-primary/10 text-primary border-l-2 border-l-primary" 
                      : "hover:bg-muted/50"
                  } ${item.href === "/admin/ai-chat" ? "relative" : ""}`}
                  onClick={handleNavigate}
                  data-testid={`nav-${item.href.split("/").pop()}`}
                >
                  <Icon className={`h-5 w-5 mr-3 ${item.href === "/admin/ai-chat" ? "text-yellow-500" : ""}`} />
                  <div className="text-left flex-1">
                    <div className={`font-medium flex items-center gap-2 ${item.href === "/admin/ai-chat" ? "text-yellow-600 dark:text-yellow-400" : ""}`}>
                      {item.title}
                      {item.badge && (
                        <Badge className="bg-red-500 text-white text-xs animate-pulse">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {!mobile && (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    )}
                  </div>
                </Button>
              </Link>
            );
          })}
        </nav>
        
        <Separator className="my-4" />
        
        <div className="space-y-2">
          <Link href="/admin/settings">
            <Button
              variant="ghost"
              className="w-full justify-start p-3"
              onClick={handleNavigate}
              data-testid="nav-settings"
            >
              <Settings className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Settings</div>
                {!mobile && (
                  <div className="text-xs text-muted-foreground">System configuration</div>
                )}
              </div>
            </Button>
          </Link>
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>🇿🇦 Department of Home Affairs</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Digital Services Administration
        </p>
      </div>
    </div>
  );
}