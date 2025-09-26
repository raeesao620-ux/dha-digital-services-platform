import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  XCircle,
  Shield,
  Clock,
  ExternalLink,
  Bell,
  Zap,
} from "lucide-react";

interface CriticalAlert {
  id: string;
  title: string;
  message: string;
  category: 'system' | 'security' | 'fraud' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority?: 'high' | 'critical'; // Keep for backwards compatibility
  requiresAction: boolean;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: Date;
  details?: Record<string, any>;
  createdAt: Date;
}

interface CriticalAlertModalProps {
  alert: CriticalAlert | null;
  onClose: () => void;
  onAction?: (alert: CriticalAlert) => void;
  onAcknowledge?: (alert: CriticalAlert) => void;
  autoCloseAfter?: number; // milliseconds
}

const categoryIcons = {
  system: Zap,
  security: Shield,
  fraud: AlertTriangle,
  maintenance: Bell,
};

const categoryColors = {
  system: "border-blue-500 bg-blue-50 text-blue-900",
  security: "border-red-500 bg-red-50 text-red-900",
  fraud: "border-orange-500 bg-orange-50 text-orange-900",
  maintenance: "border-yellow-500 bg-yellow-50 text-yellow-900",
};

const severityStyles = {
  low: "border-blue-500 bg-blue-50",
  medium: "border-yellow-500 bg-yellow-50",
  high: "border-orange-500 bg-orange-50",
  critical: "border-red-500 bg-red-50 animate-pulse",
};

// Keep backwards compatibility
const priorityStyles = severityStyles;

export function CriticalAlertModal({
  alert,
  onClose,
  onAction,
  onAcknowledge,
  autoCloseAfter,
}: CriticalAlertModalProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!alert?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const timeLeft = alert.expiresAt!.getTime() - now.getTime();
      
      if (timeLeft <= 0) {
        setIsExpired(true);
        setTimeRemaining("Expired");
        return;
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeRemaining(`${seconds}s remaining`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [alert?.expiresAt]);

  useEffect(() => {
    if (autoCloseAfter && alert) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseAfter);
      return () => clearTimeout(timer);
    }
  }, [alert, autoCloseAfter, onClose]);

  if (!alert) return null;

  const CategoryIcon = categoryIcons[alert.category];
  // Use severity if available, otherwise fall back to priority for backwards compatibility
  const effectiveSeverity = alert.severity || alert.priority || 'medium';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleAction = () => {
    if (alert.actionUrl) {
      window.open(alert.actionUrl, '_blank');
    }
    if (onAction) {
      onAction(alert);
    }
  };

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge(alert);
    }
    onClose();
  };

  return (
    <AlertDialog open={!!alert} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent 
        className={cn(
          "max-w-md border-2",
          severityStyles[effectiveSeverity]
        )}
        data-testid={`critical-alert-modal-${alert.id}`}
      >
        <AlertDialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className={cn(
              "p-2 rounded-full",
              categoryColors[alert.category]
            )}>
              <CategoryIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={effectiveSeverity === 'critical' ? 'destructive' : 'default'}
                  className="uppercase text-xs"
                >
                  {effectiveSeverity}
                </Badge>
                <Badge variant="outline" className="capitalize text-xs">
                  {alert.category}
                </Badge>
              </div>
            </div>
            {effectiveSeverity === 'critical' && (
              <XCircle className="h-5 w-5 text-red-500 animate-pulse" />
            )}
          </div>

          <AlertDialogTitle className="text-left text-lg font-semibold">
            {alert.title}
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-left text-sm">
            {alert.message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Alert Details */}
        {alert.details && Object.keys(alert.details).length > 0 && (
          <div className="space-y-3">
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Details:</h4>
              <div className="space-y-1">
                {Object.entries(alert.details).map(([key, value]) => (
                  <div 
                    key={key}
                    className="flex justify-between text-xs"
                    data-testid={`alert-detail-${key}`}
                  >
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="font-medium text-right max-w-40 truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Time Information */}
        <div className="space-y-2">
          <Separator />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Created: {formatTime(alert.createdAt)}</span>
            </div>
            {alert.expiresAt && (
              <div className={cn(
                "flex items-center space-x-1",
                isExpired && "text-red-500 font-medium"
              )}>
                <Clock className="h-3 w-3" />
                <span>{timeRemaining}</span>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          {alert.requiresAction && alert.actionUrl && (
            <AlertDialogAction
              onClick={handleAction}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              data-testid="button-alert-action"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              {alert.actionLabel || "Take Action"}
            </AlertDialogAction>
          )}
          
          {alert.requiresAction && !alert.actionUrl && onAction && (
            <AlertDialogAction
              onClick={handleAction}
              className="w-full sm:w-auto"
              data-testid="button-alert-action"
            >
              {alert.actionLabel || "Take Action"}
            </AlertDialogAction>
          )}

          <AlertDialogCancel
            onClick={handleAcknowledge}
            className="w-full sm:w-auto"
            data-testid="button-alert-acknowledge"
          >
            {alert.requiresAction ? "Acknowledge" : "Close"}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for managing multiple critical alerts
export function useCriticalAlerts() {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<CriticalAlert | null>(null);

  const addAlert = (alert: CriticalAlert) => {
    setAlerts(prev => {
      const exists = prev.some(a => a.id === alert.id);
      if (exists) return prev;
      
      const updated = [...prev, alert].sort((a, b) => {
        // Sort by severity and creation time
        const getSeverity = (alert: CriticalAlert) => alert.severity || alert.priority || 'medium';
        const aSeverity = getSeverity(a);
        const bSeverity = getSeverity(b);
        
        if (aSeverity !== bSeverity) {
          return aSeverity === 'critical' ? -1 : 1;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      
      // Show the highest priority alert if none is currently shown
      if (!currentAlert && updated.length > 0) {
        setCurrentAlert(updated[0]);
      }
      
      return updated;
    });
  };

  const removeAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setCurrentAlert(prev => prev?.id === alertId ? null : prev);
  };

  const acknowledgeAlert = (alertId: string) => {
    removeAlert(alertId);
    
    // Show next alert in queue
    setAlerts(prev => {
      const remaining = prev.filter(a => a.id !== alertId);
      if (remaining.length > 0 && (!currentAlert || currentAlert.id === alertId)) {
        setCurrentAlert(remaining[0]);
      } else if (remaining.length === 0) {
        setCurrentAlert(null);
      }
      return remaining;
    });
  };

  const closeCurrentAlert = () => {
    if (currentAlert) {
      const nextAlert = alerts.find(a => a.id !== currentAlert.id);
      setCurrentAlert(nextAlert || null);
    }
  };

  return {
    alerts,
    currentAlert,
    addAlert,
    removeAlert,
    acknowledgeAlert,
    closeCurrentAlert,
    hasAlerts: alerts.length > 0,
    criticalCount: alerts.filter(a => (a.severity || a.priority) === 'critical').length,
  };
}

export default CriticalAlertModal;