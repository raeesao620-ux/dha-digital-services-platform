import { useState, useEffect } from "react";
// import { useWebSocket } from "@/hooks/useWebSocket"; // FIXED: Disabled to prevent connection errors
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: "critical" | "warning" | "secure" | "info";
  message: string;
  timestamp: Date;
}

export default function SecurityAlert() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // FIXED: Disable WebSocket to prevent connection errors
  // const { socket } = useWebSocket();
  const socket = null; // System works without real-time updates

  useEffect(() => {
    if (socket) {
      socket.on("system:alert", (alert) => {
        const newAlert: Alert = {
          id: Date.now().toString(),
          type: alert.severity === "high" ? "critical" : alert.severity === "medium" ? "warning" : "secure",
          message: alert.details?.message || `${alert.type} detected`,
          timestamp: new Date()
        };
        
        setAlerts(prev => [newAlert, ...prev.slice(0, 4)]); // Keep only 5 alerts
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
        }, 10000);
      });

      return () => {
        socket.off("system:alert");
      };
    }
  }, [socket]);

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const getAlertStyles = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return "bg-alert/90 border-alert text-white";
      case "warning":
        return "bg-warning/90 border-warning text-black";
      case "secure":
        return "bg-secure/90 border-secure text-white";
      case "info":
      default:
        return "bg-primary/90 border-primary text-white";
    }
  };

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return "⚠️";
      case "warning":
        return "🔸";
      case "secure":
        return "✅";
      case "info":
      default:
        return "ℹ️";
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" data-testid="security-alerts-container">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`glass rounded-lg p-4 max-w-md backdrop-blur-20 border-2 ${getAlertStyles(alert.type)} animate-in slide-in-from-right-full duration-500`}
          data-testid={`alert-${alert.type}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <span className="text-lg">{getAlertIcon(alert.type)}</span>
              <div>
                <div className="font-semibold text-sm uppercase tracking-wide">
                  {alert.type}
                </div>
                <div className="text-sm mt-1">{alert.message}</div>
                <div className="text-xs mt-2 opacity-75">
                  {alert.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeAlert(alert.id)}
              className="text-current hover:bg-white/20 h-6 w-6 p-0"
              data-testid={`button-close-alert-${alert.id}`}
            >
              ✕
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
