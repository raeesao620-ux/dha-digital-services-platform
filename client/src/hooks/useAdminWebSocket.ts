import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { auth } from "@/lib/api";
import io, { Socket } from "socket.io-client";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface AdminWebSocketHook {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: WebSocketMessage | null;
  sendMessage: (type: string, data: any) => void;
}

export function useAdminWebSocket(): AdminWebSocketHook {
  // FIXED: Disable WebSocket to prevent connection errors
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    // FIXED: Re-enable WebSocket connection for real-time updates
    if (!auth.isAuthenticated()) {
      return;
    }

    const user = auth.getCurrentUser();
    if (user?.role !== 'admin') {
      return;
    }

    // Get authentication token securely
    const token = localStorage.getItem('authToken');
    if (!token) {
      setConnectionStatus('error');
      return;
    }

    try {
      setConnectionStatus('connecting');
      
      // Use Socket.IO with secure authentication instead of raw WebSocket
      const socketInstance = io(window.location.origin, {
        auth: {
          token
        },
        path: '/ws',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        console.log('Admin WebSocket connected');
        
        // Subscribe to admin-specific events
        socketInstance.emit('admin_subscribe', {
          events: [
            'security:alert',
            'fraud:alert', 
            'system:health',
            'document:processed',
            'user:activity',
            'error:critical',
            'integration:status'
          ]
        });
      });

      socketInstance.on('disconnect', (reason: string) => {
        setIsConnected(false);
        setSocket(null);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, reconnect manually
          socketInstance.connect();
        } else {
          setConnectionStatus('error');
          attemptReconnect();
        }
      });

      socketInstance.on('connect_error', (error: Error) => {
        console.error('Admin WebSocket connection error:', error);
        setConnectionStatus('error');
        reconnectAttemptsRef.current++;
        
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast({
            title: "Admin Connection Failed",
            description: "Unable to establish admin WebSocket connection",
            variant: "destructive",
          });
        }
      });

      socketInstance.on('error', (error: string) => {
        console.error('Admin WebSocket error:', error);
        setConnectionStatus('error');
        
        if (error === 'Authentication failed') {
          toast({
            title: "Admin Authentication Error",
            description: "Please log in again with admin privileges",
            variant: "destructive",
          });
        }
      });

      setSocket(socketInstance);
    } catch (error) {
      console.error('Failed to connect Admin WebSocket:', error);
      setConnectionStatus('error');
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current += 1;
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current})`);
      connect();
    }, delay);
  };

  const handleAdminMessage = (message: WebSocketMessage) => {
    console.log('Admin WebSocket message:', message);

    switch (message.type) {
      case 'security:alert':
        handleSecurityAlert(message.data);
        break;
      case 'fraud:alert':
        handleFraudAlert(message.data);
        break;
      case 'system:health':
        handleSystemHealth(message.data);
        break;
      case 'document:processed':
        handleDocumentProcessed(message.data);
        break;
      case 'user:activity':
        handleUserActivity(message.data);
        break;
      case 'error:critical':
        handleCriticalError(message.data);
        break;
      case 'integration:status':
        handleIntegrationStatus(message.data);
        break;
      default:
        console.log('Unknown admin message type:', message.type);
    }
  };

  const handleSecurityAlert = (data: any) => {
    toast({
      title: "Security Alert",
      description: `${data.severity} security event: ${data.eventType}`,
      variant: data.severity === 'high' ? 'destructive' : 'default',
    });
    
    // Refresh security-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/security/events'] });
    queryClient.invalidateQueries({ queryKey: ['/api/monitoring/security'] });
  };

  const handleFraudAlert = (data: any) => {
    toast({
      title: "Fraud Alert",
      description: `High risk activity detected: ${data.alertType} (Risk Score: ${data.riskScore})`,
      variant: "destructive",
    });
    
    // Refresh fraud-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/fraud/alerts'] });
  };

  const handleSystemHealth = (data: any) => {
    if (data.status === 'error' || data.status === 'critical') {
      toast({
        title: "System Health Alert",
        description: `System status: ${data.status}`,
        variant: "destructive",
      });
    }
    
    // Refresh health-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/monitoring/health'] });
    queryClient.invalidateQueries({ queryKey: ['/api/monitoring/metrics'] });
  };

  const handleDocumentProcessed = (data: any) => {
    if (data.requiresReview) {
      toast({
        title: "Document Review Required",
        description: `New document "${data.filename}" requires manual verification`,
      });
    }
    
    // Refresh document-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/document-verifications'] });
  };

  const handleUserActivity = (data: any) => {
    if (data.activityType === 'suspicious') {
      toast({
        title: "Suspicious User Activity",
        description: `User ${data.username}: ${data.description}`,
        variant: "destructive",
      });
    }
    
    // Refresh user-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
  };

  const handleCriticalError = (data: any) => {
    toast({
      title: "Critical System Error",
      description: `${data.errorType}: ${data.message}`,
      variant: "destructive",
    });
    
    // Refresh error-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/admin/error-logs'] });
  };

  const handleIntegrationStatus = (data: any) => {
    if (data.status === 'offline' || data.status === 'error') {
      toast({
        title: "Integration Status Alert",
        description: `${data.integrationName} is ${data.status}`,
        variant: "destructive",
      });
    }
    
    // Refresh integration-related queries
    queryClient.invalidateQueries({ queryKey: ['/api/monitoring/health'] });
  };

  const sendMessage = (type: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(type, data);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.disconnect();
    }
    
    setSocket(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (auth.isAuthenticated() && user?.role === 'admin') {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []);

  // Reconnect when authentication status changes
  useEffect(() => {
    const user = auth.getCurrentUser();
    if (auth.isAuthenticated() && user?.role === 'admin' && !isConnected) {
      connect();
    } else if (!auth.isAuthenticated() && isConnected) {
      disconnect();
    }
  }, [isConnected]);

  return {
    socket,
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage
  };
}