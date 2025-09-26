import { useState, useEffect } from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, AlertTriangle, Shield, FileText } from "lucide-react";

interface NotificationBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number;
  maxCount?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  showIcon?: boolean;
  animate?: boolean;
  category?: 'system' | 'security' | 'document' | 'fraud' | 'admin';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean; // Show as a dot instead of count
}

const priorityStyles = {
  low: "bg-blue-500 border-blue-600 text-white",
  medium: "bg-yellow-500 border-yellow-600 text-white",
  high: "bg-orange-500 border-orange-600 text-white",
  critical: "bg-red-500 border-red-600 text-white animate-pulse",
};

const sizeStyles = {
  sm: "h-4 w-4 text-xs min-w-4",
  md: "h-5 w-5 text-xs min-w-5", 
  lg: "h-6 w-6 text-sm min-w-6",
};

const categoryIcons = {
  system: Bell,
  security: Shield,
  document: FileText,
  fraud: AlertTriangle,
  admin: Bell,
};

export function NotificationBadge({
  count,
  maxCount = 99,
  priority = 'medium',
  showIcon = false,
  animate = false,
  category = 'system',
  size = 'md',
  dot = false,
  className,
  ...props
}: NotificationBadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (animate && count > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [count, animate]);

  if (count === 0 && !dot) {
    return null;
  }

  const displayCount = dot ? '' : count > maxCount ? `${maxCount}+` : count.toString();
  const CategoryIcon = categoryIcons[category];

  return (
    <Badge
      className={cn(
        "absolute -top-2 -right-2 rounded-full p-0 flex items-center justify-center border-2",
        priorityStyles[priority],
        sizeStyles[size],
        isAnimating && "animate-bounce",
        dot && "h-3 w-3 min-w-3",
        className
      )}
      data-testid={`notification-badge-${category}`}
      {...props}
    >
      {showIcon && !dot && (
        <CategoryIcon className="h-2.5 w-2.5 mr-1" />
      )}
      {!dot && displayCount}
    </Badge>
  );
}

// Compound component for multiple priority badges
interface NotificationBadgeGroupProps {
  badges: Array<{
    category: string;
    count: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  maxVisible?: number;
  className?: string;
}

export function NotificationBadgeGroup({
  badges,
  maxVisible = 3,
  className,
}: NotificationBadgeGroupProps) {
  const sortedBadges = badges
    .filter(badge => badge.count > 0)
    .sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  const visibleBadges = sortedBadges.slice(0, maxVisible);
  const remainingCount = sortedBadges.slice(maxVisible).reduce((sum, badge) => sum + badge.count, 0);

  return (
    <div className={cn("flex -space-x-1", className)}>
      {visibleBadges.map((badge, index) => (
        <NotificationBadge
          key={badge.category}
          count={badge.count}
          priority={badge.priority}
          category={badge.category as any}
          size="sm"
          style={{ zIndex: visibleBadges.length - index }}
          data-testid={`badge-group-${badge.category}`}
        />
      ))}
      {remainingCount > 0 && (
        <NotificationBadge
          count={remainingCount}
          priority="medium"
          size="sm"
          className="bg-gray-500 border-gray-600"
          data-testid="badge-group-remaining"
        />
      )}
    </div>
  );
}

export default NotificationBadge;