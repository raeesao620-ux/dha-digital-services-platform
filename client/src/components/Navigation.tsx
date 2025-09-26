import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, Shield, User, FileText, Users, Globe, Phone, Clock, HelpCircle, LogOut, Settings, UserCircle } from "lucide-react";
import { SouthAfricanCoatOfArms, DHALogo, SecurityClassificationBanner } from "@/components/GovernmentAssets";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, token, logout } = useAuth();
  
  // WebSocket connection for real-time status
  const { isConnected, error } = useWebSocket({
    token: token, // Pass the auth token for authentication
    enableToasts: false,
    enableEventHandlers: true, // Enable event handlers to get proper status updates
    autoConnect: !!user // Only auto-connect if user is logged in
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const navigationLinks = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/document-services", label: "Document Services", icon: "📑", badge: "New" },
    { href: "/document-generation", label: "Generate Documents", icon: "📄" },
    { href: "/visa-management", label: "Visa Management", icon: "✈️" },
    { href: "/admin", label: "Admin", icon: "⚙️" },
  ];

  const isOfficeHours = () => {
    const hours = currentTime.getHours();
    const day = currentTime.getDay();
    return day >= 1 && day <= 5 && hours >= 8 && hours < 16;
  };

  return (
    <>
      <SecurityClassificationBanner level="OFFICIAL" />
      <nav className="sticky top-0 z-40 dha-header shadow-lg" data-testid="navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <SouthAfricanCoatOfArms className="h-14 w-14" />
              <DHALogo className="h-12 w-12" />
              <div>
                <span className="text-xl font-bold text-white block" data-testid="brand-title">
                  Department of Home Affairs
                </span>
                <span className="text-xs text-white/70">Republic of South Africa</span>
              </div>
              <div className="hidden lg:flex items-center space-x-3 ml-6 pl-6 border-l border-white/20">
                <Clock className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/70">
                  {currentTime.toLocaleDateString('en-ZA', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </span>
                {isOfficeHours() ? (
                  <Badge className="bg-green-500 text-white text-xs">Office Hours</Badge>
                ) : (
                  <Badge className="bg-orange-500 text-white text-xs">After Hours</Badge>
                )}
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-white hover:text-white/80 transition-colors duration-200 flex items-center space-x-1 ${
                    location === link.href ? 'border-b-2 border-yellow-400' : ''
                  }`}
                  data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                  {link.badge && (
                    <Badge className="ml-1 bg-yellow-400 text-black text-xs">
                      {link.badge}
                    </Badge>
                  )}
                </Link>
              ))}

              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white flex items-center space-x-1"
                  data-testid="helpline-button"
                >
                  <Phone className="h-4 w-4" />
                  <span className="text-xs">0800 60 11 90</span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white"
                  data-testid="help-button"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                
                <Badge className="dha-badge" data-testid="security-level-badge">
                  <span>🏛️</span>
                  <span className="ml-1">Government Portal</span>
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:text-white/80 transition-colors"
                      data-testid="user-menu-button"
                    >
                      <User className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center space-x-2">
                      <UserCircle className="h-4 w-4" />
                      <div>
                        <div className="font-semibold">{user?.username || "Admin"}</div>
                        <div className="text-xs text-muted-foreground">{user?.email || "admin@dha.gov.za"}</div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center space-x-2 text-destructive"
                      onClick={logout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

          {/* Mobile Navigation */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                data-testid="mobile-menu-trigger"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-white border-l border-border">
              <div className="flex flex-col space-y-4 mt-8">
                <div className="flex items-center space-x-2 mb-6">
                  <DHALogo className="h-10 w-10" />
                  <span className="text-lg font-bold text-primary">DHA Services</span>
                </div>

                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left ${
                      location === link.href ? 'bg-primary/10 border-l-4 border-primary' : ''
                    }`}
                    data-testid={`mobile-nav-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="text-xl">{link.icon}</span>
                    <span className="font-medium">{link.label}</span>
                    {link.badge && (
                      <Badge className="ml-auto bg-yellow-400 text-black text-xs">
                        {link.badge}
                      </Badge>
                    )}
                  </Link>
                ))}

                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Security Status</span>
                    <Badge className="dha-badge">
                      <span>🏛️</span>
                      <span className="ml-1">Official</span>
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`status-indicator ${isConnected ? 'status-online' : 'status-warning'}`}></span>
                    <span className="text-sm text-muted-foreground">
                      Government Services {isConnected ? 'Online' : (error ? 'Connection Error' : 'Connecting...')}
                    </span>
                  </div>
                  
                  <div className="mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Phone className="h-3 w-3" />
                      <span>Helpline: 0800 60 11 90</span>
                    </div>
                  </div>
                  
                  {user && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{user.username}</div>
                          <div className="text-xs text-muted-foreground">{user.role === 'admin' ? 'Administrator' : 'User'}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={logout}
                          className="flex items-center space-x-1"
                          data-testid="mobile-button-logout"
                        >
                          <LogOut className="h-3 w-3" />
                          <span>Logout</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
    </>
  );
}
