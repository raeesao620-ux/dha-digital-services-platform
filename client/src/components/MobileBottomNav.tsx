
import { Home, FileText, MessageSquare, User, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  className?: string;
}

export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const [location] = useLocation();

  const navItems = [
    {
      icon: Home,
      label: "Home",
      href: "/",
      active: location === "/"
    },
    {
      icon: FileText,
      label: "Documents",
      href: "/documents",
      active: location.startsWith("/document")
    },
    {
      icon: MessageSquare,
      label: "AI Chat",
      href: "/ai-assistant",
      active: location === "/ai-assistant"
    },
    {
      icon: Settings,
      label: "Admin",
      href: "/admin/dashboard",
      active: location.startsWith("/admin")
    }
  ];

  return (
    <nav className={cn("mobile-nav", className)}>
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-h-[48px] min-w-[48px]",
                  item.active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
