import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  AlertTriangle, 
  Shield, 
  FileText, 
  Users, 
  X,
  CheckCircle
} from "lucide-react";
import { useAdminWebSocket } from "@/hooks/useAdminWebSocket";

interface AdminNotification {
  id: string;
  type: 'security' | 'fraud' | 'system' | 'document' | 'user' | 'error';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  isRead: boolean;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { lastMessage, connectionStatus } = useAdminWebSocket();

  useEffect(() => {
    if (lastMessage) {
      const notification: AdminNotification = {
        id: Date.now().toString(),
        type: getNotificationType(lastMessage.type),
        title: getNotificationTitle(lastMessage.type, lastMessage.data),
        message: getNotificationMessage(lastMessage.type, lastMessage.data),
        severity: lastMessage.data.severity || 'medium',
        timestamp: lastMessage.timestamp,
        isRead: false
      };

      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep latest 50
    }
  }, [lastMessage]);

  const getNotificationType = (messageType: string): AdminNotification['type'] => {
    if (messageType.startsWith('security:')) return 'security';
    if (messageType.startsWith('fraud:')) return 'fraud';
    if (messageType.startsWith('system:')) return 'system';
    if (messageType.startsWith('document:')) return 'document';
    if (messageType.startsWith('user:')) return 'user';
    if (messageType.startsWith('error:')) return 'error';
    return 'system';
  };

  const getNotificationTitle = (messageType: string, data: any): string => {
    switch (messageType) {
      case 'security:alert':
        return 'Security Alert';
      case 'fraud:alert':
        return 'Fraud Detection';
      case 'system:health':
        return 'System Health';
      case 'document:processed':
        return 'Document Processed';
      case 'user:activity':
        return 'User Activity';
      case 'error:critical':
        return 'Critical Error';
      case 'integration:status':
        return 'Integration Status';
      default:
        return 'System Notification';
    }
  };

  const getNotificationMessage = (messageType: string, data: any): string => {
    switch (messageType) {
      case 'security:alert':
        return `${data.severity} security event: ${data.eventType}`;
      case 'fraud:alert':
        return `${data.alertType} detected (Risk: ${data.riskScore}/100)`;
      case 'system:health':
        return `System status changed to ${data.status}`;
      case 'document:processed':
        return data.requiresReview ? 
          `Document "${data.filename}" requires verification` : 
          `Document "${data.filename}" processed successfully`;
      case 'user:activity':
        return `User ${data.username}: ${data.description}`;
      case 'error:critical':
        return `${data.errorType}: ${data.message}`;
      case 'integration:status':
        return `${data.integrationName} is ${data.status}`;
      default:
        return 'System notification received';
    }
  };

  const getNotificationIcon = (type: AdminNotification['type']) => {
    switch (type) {
      case 'security':
        return <Shield className="h-4 w-4" />;
      case 'fraud':
        return <AlertTriangle className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AdminNotification['severity']) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        data-testid="admin-notifications-trigger"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 hover:bg-red-600"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-h-[600px] z-50 shadow-lg border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Admin Notifications</CardTitle>
                <CardDescription className="flex items-center space-x-2">
                  <span>Real-time system alerts</span>
                  <Badge 
                    className={
                      connectionStatus === 'connected' ? 
                      'bg-green-100 text-green-800' : 
                      'bg-red-100 text-red-800'
                    }
                  >
                    {connectionStatus}
                  </Badge>
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                data-testid="close-notifications"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {notifications.length > 0 && (
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mark All Read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                >
                  Clear All
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              {notifications.length > 0 ? (
                <div className="space-y-2 p-4 pt-0">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        notification.isRead ? 'bg-muted/30' : 'bg-background'
                      } ${getSeverityColor(notification.severity)}`}
                      onClick={() => markAsRead(notification.id)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2 flex-1">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-sm truncate">
                                {notification.title}
                              </h4>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No notifications yet</p>
                  <p className="text-xs mt-1">System alerts will appear here</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}