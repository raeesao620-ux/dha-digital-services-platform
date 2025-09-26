import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  FileText,
  Shield,
  Zap,
  Server,
  Activity,
  Upload,
  Download,
} from "lucide-react";

interface LiveProgressProps {
  value: number;
  max?: number;
  status?: 'idle' | 'processing' | 'completed' | 'failed' | 'warning';
  title?: string;
  description?: string;
  steps?: ProgressStep[];
  showPercentage?: boolean;
  showETA?: boolean;
  estimatedCompletion?: Date;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'circular' | 'detailed' | 'minimal';
  category?: 'document' | 'system' | 'security' | 'upload' | 'download';
  className?: string;
}

interface ProgressStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  duration?: number; // in milliseconds
}

const statusStyles = {
  idle: "bg-gray-200",
  processing: "bg-blue-500 animate-pulse",
  completed: "bg-green-500",
  failed: "bg-red-500",
  warning: "bg-yellow-500",
};

const statusIcons = {
  idle: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  warning: AlertTriangle,
};

const categoryIcons = {
  document: FileText,
  system: Server,
  security: Shield,
  upload: Upload,
  download: Download,
};

const sizeStyles = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export function LiveProgress({
  value,
  max = 100,
  status = 'processing',
  title,
  description,
  steps,
  showPercentage = true,
  showETA = false,
  estimatedCompletion,
  animate = true,
  size = 'md',
  variant = 'default',
  category = 'system',
  className,
}: LiveProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  const percentage = useMemo(() => Math.min((value / max) * 100, 100), [value, max]);
  const StatusIcon = statusIcons[status];
  const CategoryIcon = categoryIcons[category];

  // Animate progress value
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setAnimatedValue(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedValue(percentage);
    }
  }, [percentage, animate]);

  // Format ETA
  const formatETA = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) return "Complete";
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m remaining`;
    } else {
      return "Less than 1 minute";
    }
  };

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center space-x-2", className)} data-testid="live-progress-minimal">
        <StatusIcon className={cn(
          "h-4 w-4",
          status === 'processing' && animate && "animate-spin",
          status === 'completed' && "text-green-500",
          status === 'failed' && "text-red-500",
          status === 'warning' && "text-yellow-500"
        )} />
        <Progress 
          value={animatedValue} 
          className={cn("flex-1", sizeStyles[size])}
          data-testid="progress-bar-minimal"
        />
        {showPercentage && (
          <span className="text-sm font-medium min-w-12 text-right">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  }

  if (variant === 'circular') {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <svg className="w-20 h-20 transform -rotate-90" data-testid="circular-progress">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-all duration-300",
              statusStyles[status].replace('bg-', 'text-')
            )}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <CategoryIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-sm font-medium">
              {Math.round(percentage)}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detailed' && steps) {
    return (
      <Card className={cn("w-full", className)} data-testid="live-progress-detailed">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                {title && <h3 className="font-medium">{title}</h3>}
              </div>
              <div className="flex items-center space-x-2">
                <StatusIcon className={cn(
                  "h-4 w-4",
                  status === 'processing' && animate && "animate-spin",
                  status === 'completed' && "text-green-500",
                  status === 'failed' && "text-red-500",
                  status === 'warning' && "text-yellow-500"
                )} />
                <Badge variant={
                  status === 'completed' ? 'default' :
                  status === 'failed' ? 'destructive' :
                  status === 'warning' ? 'secondary' : 'outline'
                }>
                  {status}
                </Badge>
              </div>
            </div>

            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <Progress 
                value={animatedValue} 
                className={cn("w-full", sizeStyles[size])}
                data-testid="progress-bar-detailed"
              />
            </div>

            {showETA && estimatedCompletion && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Estimated completion:</span>
                <span>{formatETA(estimatedCompletion)}</span>
              </div>
            )}

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center space-x-3"
                  data-testid={`progress-step-${step.id}`}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-medium",
                    step.status === 'completed' && "bg-green-100 border-green-500 text-green-700",
                    step.status === 'processing' && "bg-blue-100 border-blue-500 text-blue-700",
                    step.status === 'failed' && "bg-red-100 border-red-500 text-red-700",
                    step.status === 'pending' && "bg-gray-100 border-gray-300 text-gray-500"
                  )}>
                    {step.status === 'completed' && <CheckCircle className="h-4 w-4" />}
                    {step.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {step.status === 'failed' && <XCircle className="h-4 w-4" />}
                    {step.status === 'pending' && <span>{index + 1}</span>}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-sm">{step.title}</div>
                    {step.description && (
                      <div className="text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    )}
                  </div>
                  
                  {step.duration && (
                    <div className="text-xs text-muted-foreground">
                      {Math.round(step.duration / 1000)}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-2", className)} data-testid="live-progress-default">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
          {title && <span className="font-medium text-sm">{title}</span>}
        </div>
        <div className="flex items-center space-x-2">
          <StatusIcon className={cn(
            "h-4 w-4",
            status === 'processing' && animate && "animate-spin",
            status === 'completed' && "text-green-500",
            status === 'failed' && "text-red-500",
            status === 'warning' && "text-yellow-500"
          )} />
          {showPercentage && (
            <span className="text-sm font-medium">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      </div>
      
      <Progress 
        value={animatedValue} 
        className={cn("w-full", sizeStyles[size])}
        data-testid="progress-bar-default"
      />
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      {showETA && estimatedCompletion && (
        <p className="text-xs text-muted-foreground">
          {formatETA(estimatedCompletion)}
        </p>
      )}
    </div>
  );
}

// Real-time status indicator component
interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  showLabel = true,
  size = 'md',
  animate = true,
  className,
}: StatusIndicatorProps) {
  const statusStyles = {
    online: "bg-green-500",
    offline: "bg-gray-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    maintenance: "bg-blue-500",
  };

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3", 
    lg: "h-4 w-4",
  };

  return (
    <div className={cn("flex items-center space-x-2", className)} data-testid={`status-indicator-${status}`}>
      <div className={cn(
        "rounded-full",
        statusStyles[status],
        sizeClasses[size],
        animate && status === 'online' && "animate-pulse"
      )} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">
          {label || status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      )}
    </div>
  );
}

export default LiveProgress;