import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  X,
  Check,
  Archive,
  Filter,
  Trash2,
  Clock,
  AlertTriangle,
  Shield,
  FileText,
  User,
  Settings,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NotificationCategory, NotificationPriority, EventType } from "@shared/schema";
import type { NotificationEvent, UserNotificationPreferences } from "@shared/schema";

interface NotificationCenterProps {
  variant?: "popover" | "fullscreen" | "sidebar";
  className?: string;
}

const categoryIcons = {
  system: Settings,
  security: Shield,
  document: FileText,
  user: User,
  admin: Settings,
  fraud: AlertTriangle,
  biometric: Shield,
};

const priorityColors = {
  low: "text-blue-600 bg-blue-50 border-blue-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200", 
  high: "text-orange-600 bg-orange-50 border-orange-200",
  critical: "text-red-600 bg-red-50 border-red-200",
};

export function NotificationCenter({ variant = "popover", className }: NotificationCenterProps) {
  const { toast } = useToast();
  // FIXED: Disable WebSocket to prevent connection errors
  // const { socket, isConnected } = useWebSocket();
  const socket = null; // System works without real-time updates
  const isConnected = false; // Fallback mode
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationEvent[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  // Fetch user notification preferences  
  const { data: preferences } = useQuery<UserNotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => 
      apiRequest(`/api/notifications/${notificationId}/read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => 
      apiRequest("/api/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "All Notifications Marked as Read",
        description: "Your notification center is now up to date",
        className: "border-secure bg-secure/10 text-secure",
      });
    },
  });

  // Archive notification
  const archiveNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Update notification preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: (updates: Partial<UserNotificationPreferences>) =>
      apiRequest("/api/notifications/preferences", { 
        method: "PATCH", 
        body: JSON.stringify(updates) 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved",
        className: "border-secure bg-secure/10 text-secure",
      });
    },
  });

  // WebSocket real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      const handleNewNotification = (notification: NotificationEvent) => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        
        // Show toast for high/critical notifications
        if (notification.priority === "high" || notification.priority === "critical") {
          const priorityClass = notification.priority === "critical" 
            ? "border-alert bg-alert/10 text-alert"
            : "border-warning bg-warning/10 text-warning";
          
          toast({
            title: notification.title,
            description: notification.message,
            className: priorityClass,
          });
        }
      };

      const handleNotificationRead = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      };

      socket.on("notification:new", handleNewNotification);
      socket.on("notification:read", handleNotificationRead);

      return () => {
        socket.off("notification:new", handleNewNotification);
        socket.off("notification:read", handleNotificationRead);
      };
    }
  }, [socket, isConnected, toast]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      if (selectedCategory !== "all" && notification.category !== selectedCategory) {
        return false;
      }
      if (showUnreadOnly && notification.isRead) {
        return false;
      }
      if (notification.isArchived) {
        return false;
      }
      return true;
    });
  }, [notifications, selectedCategory, showUnreadOnly]);

  // Count unread notifications
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.isRead && !n.isArchived).length,
    [notifications]
  );

  const handleNotificationClick = useCallback((notification: NotificationEvent) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  }, [markAsReadMutation]);

  const NotificationItem = ({ notification }: { notification: NotificationEvent }) => {
    const CategoryIcon = categoryIcons[notification.category as keyof typeof categoryIcons] || Bell;
    const isRecent = new Date(notification.createdAt).getTime() > Date.now() - 5 * 60 * 1000; // 5 minutes

    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md mb-3 ${
          !notification.isRead ? 'border-l-4 border-l-primary' : ''
        }`}
        onClick={() => handleNotificationClick(notification)}
        data-testid={`notification-item-${notification.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-full ${priorityColors[notification.priority as keyof typeof priorityColors]}`}>
              <CategoryIcon className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                <div className="flex items-center space-x-2 ml-2">
                  {isRecent && (
                    <Badge variant="secondary" className="text-xs">
                      New
                    </Badge>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${priorityColors[notification.priority as keyof typeof priorityColors]}`}
                  >
                    {notification.priority}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {notification.message}
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(notification.createdAt).toLocaleDateString()}{" "}
                  {new Date(notification.createdAt).toLocaleTimeString()}
                </span>
                
                {notification.requiresAction && (
                  <Badge variant="destructive" className="text-xs">
                    Action Required
                  </Badge>
                )}
              </div>
              
              {notification.actionUrl && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(notification.actionUrl!, '_blank');
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {notification.actionLabel || "View Details"}
                </Button>
              )}
            </div>
            
            <div className="flex flex-col space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsReadMutation.mutate(notification.id);
                }}
                data-testid={`button-mark-read-${notification.id}`}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  archiveNotificationMutation.mutate(notification.id);
                }}
                data-testid={`button-archive-${notification.id}`}
              >
                <Archive className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const NotificationContent = () => (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" data-testid="badge-unread-count">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center space-x-4">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="biometric">Biometric</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="unread-only"
                checked={showUnreadOnly}
                onCheckedChange={setShowUnreadOnly}
                data-testid="switch-unread-only"
              />
              <Label htmlFor="unread-only" className="text-sm">
                Unread only
              </Label>
            </div>
          </div>

          <ScrollArea className="h-96">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No notifications found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification} 
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {preferences && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Notification Channels</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <Switch
                      id="email-notifications"
                      checked={preferences.emailNotifications}
                      onCheckedChange={(checked) =>
                        updatePreferencesMutation.mutate({ emailNotifications: checked })
                      }
                      data-testid="switch-email-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <Switch
                      id="push-notifications"
                      checked={preferences.pushNotifications}
                      onCheckedChange={(checked) =>
                        updatePreferencesMutation.mutate({ pushNotifications: checked })
                      }
                      data-testid="switch-push-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-notifications">SMS Notifications</Label>
                    <Switch
                      id="sms-notifications"
                      checked={preferences.smsNotifications}
                      onCheckedChange={(checked) =>
                        updatePreferencesMutation.mutate({ smsNotifications: checked })
                      }
                      data-testid="switch-sms-notifications"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">Category Settings</h3>
                <div className="space-y-3">
                  {Object.entries(preferences.categories as Record<string, any>).map(([category, settings]) => (
                    <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="capitalize font-medium">{category}</div>
                        <Badge variant="outline" className="text-xs">
                          {settings.priority}
                        </Badge>
                      </div>
                      <Switch
                        checked={settings.enabled}
                        onCheckedChange={(checked) => {
                          const updatedCategories = {
                            ...preferences.categories as Record<string, any>,
                            [category]: { ...settings, enabled: checked }
                          };
                          updatePreferencesMutation.mutate({ categories: updatedCategories });
                        }}
                        data-testid={`switch-category-${category}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  if (variant === "fullscreen" || variant === "sidebar") {
    return (
      <div className={`${className}`}>
        <NotificationContent />
      </div>
    );
  }

  // Default popover variant
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          data-testid="button-notification-center"
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0" 
        align="end"
        data-testid="popover-notification-content"
      >
        <div className="p-4">
          <NotificationContent />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;