import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import io, { Socket } from "socket.io-client";

interface UseWebSocketOptions {
  token?: string;
  autoConnect?: boolean;
  enableToasts?: boolean;
  enableEventHandlers?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { 
    token: providedToken, 
    autoConnect = true, // FIXED: Enable auto-connect by default for status indicators
    enableToasts = false, // Keep toasts disabled to prevent noise
    enableEventHandlers = true, // FIXED: Enable event handlers for status updates
    onConnect, 
    onDisconnect, 
    onReconnect 
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Get authentication token from multiple sources
    const token = providedToken || 
                  localStorage.getItem("authToken") || 
                  localStorage.getItem("auth_token");
    
    // If no token, don't connect
    if (!token) {
      setError("Authentication token not found");
      return;
    }

    if (socketRef.current?.connected) {
      return; // Already connected
    }

    // Initialize socket connection with correct path
    const socketInstance = io(window.location.origin, {
      path: "/ws",
      auth: {
        token
      },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Connection event handlers
    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      if (enableToasts) {
        toast({
          title: "Connected",
          description: "Real-time monitoring active",
          className: "border-secure bg-secure/10 text-secure",
        });
      }
      
      onConnect?.();
    });

    socketInstance.on("disconnect", (reason: string) => {
      console.log("WebSocket disconnected:", reason);
      setIsConnected(false);
      
      if (reason === "io server disconnect") {
        // Server disconnected, reconnect manually
        socketInstance.connect();
      }
      
      if (enableToasts) {
        toast({
          title: "Connection Lost",
          description: "Attempting to reconnect...",
          className: "border-warning bg-warning/10 text-warning",
        });
      }
      
      onDisconnect?.();
    });

    socketInstance.on("connect_error", (error: Error) => {
      console.error("WebSocket connection error:", error);
      setError(error.message);
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts && enableToasts) {
        toast({
          title: "Connection Failed",
          description: "Unable to establish real-time connection",
          variant: "destructive",
        });
      }
    });

    socketInstance.on("reconnect", () => {
      console.log("WebSocket reconnected");
      onReconnect?.();
    });

    // Authentication error handler
    socketInstance.on("error", (error: string) => {
      console.error("WebSocket error:", error);
      setError(error);
      
      if (error === "Authentication failed" && enableToasts) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
      }
    });

    // Optional event handlers for backwards compatibility
    if (enableEventHandlers) {
      // System alert handlers
      socketInstance.on("system:alert", (alert: any) => {
        const severity = alert.severity || "info";
        const toastClass = severity === "high" ? "border-alert bg-alert/10 text-alert" :
                          severity === "medium" ? "border-warning bg-warning/10 text-warning" :
                          "border-primary bg-primary/10 text-primary";
        
        if (enableToasts) {
          toast({
            title: `System Alert: ${alert.type}`,
            description: alert.details?.message || "System alert detected",
            className: toastClass,
          });
        }
      });

      // Security event handlers
      socketInstance.on("security:event", (event: any) => {
        if (event.severity === "high" && enableToasts) {
          toast({
            title: "Security Event",
            description: `${event.eventType.replace(/_/g, ' ')}`,
            className: "border-alert bg-alert/10 text-alert",
          });
        }
      });

      // Fraud alert handlers
      socketInstance.on("fraud:alert", (alert: any) => {
        if (enableToasts) {
          toast({
            title: "🚨 Fraud Alert",
            description: `Risk Score: ${alert.riskScore} - ${alert.alertType}`,
            className: "border-alert bg-alert/10 text-alert",
          });
        }
      });

      // Biometric result handlers
      socketInstance.on("biometric:result", (result: any) => {
        if (result.type === "verification" && enableToasts) {
          const className = result.success 
            ? "border-secure bg-secure/10 text-secure"
            : "border-alert bg-alert/10 text-alert";
          
          toast({
            title: result.success ? "Biometric Verified" : "Verification Failed",
            description: `${result.biometricType || result.type} - ${result.confidence}% confidence`,
            className,
          });
        }
      });

      // Document processing handlers
      socketInstance.on("document:processed", (document: any) => {
        if (enableToasts) {
          toast({
            title: "Document Processed",
            description: "Document processing completed successfully",
            className: "border-secure bg-secure/10 text-secure",
          });
        }
      });
    }

    socketRef.current = socketInstance;
    socketInstance.connect();
  }, [providedToken, onConnect, onDisconnect, onReconnect, enableToasts, enableEventHandlers, toast]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event, handler);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
    off
  };
}
