import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Search, 
  Edit, 
  Shield, 
  Eye,
  UserX,
  UserCheck,
  Activity,
  Clock
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  createdAt: string;
  details?: any;
  ipAddress?: string;
}

interface BiometricProfile {
  id: string;
  type: string;
  createdAt: string;
  lastVerified?: string;
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch users with search
  const { data: users, isLoading: usersLoading, refetch } = useQuery<User[]>({
    queryKey: ["/api/admin/users", { search: searchTerm }],
    enabled: true,
  });

  // Fetch security events for selected user
  const { data: userSecurityEvents, isLoading: eventsLoading } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security/events", { userId: selectedUser?.id }],
    enabled: !!selectedUser,
  });

  // Fetch biometric profiles for selected user
  const { data: userBiometrics, isLoading: biometricsLoading } = useQuery<BiometricProfile[]>({
    queryKey: ["/api/biometric/profiles", { userId: selectedUser?.id }],
    enabled: !!selectedUser,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: Partial<User> }) => {
      return api.patch(`/admin/users/${data.userId}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditDialogOpen(false);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user.",
        variant: "destructive",
      });
    },
  });

  const toggleUserStatus = async (user: User) => {
    updateUserMutation.mutate({
      userId: user.id,
      updates: { isActive: !user.isActive },
    });
  };

  const updateUserRole = async (user: User, newRole: string) => {
    updateUserMutation.mutate({
      userId: user.id,
      updates: { role: newRole },
    });
  };

  const filteredUsers = users?.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "user":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage user accounts, roles, and security settings
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="card-total-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Registered accounts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.isActive).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active accounts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-admin-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrators</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.role === "admin").length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Admin accounts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-inactive-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => !u.isActive).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Disabled accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "outline"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                            data-testid={`button-view-${user.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={user.isActive ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleUserStatus(user)}
                            data-testid={`button-toggle-${user.id}`}
                          >
                            {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* User Details */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>User Details: {selectedUser.username}</CardTitle>
              <CardDescription>
                Detailed information and activity for {selectedUser.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="info">
                <TabsList>
                  <TabsTrigger value="info">Information</TabsTrigger>
                  <TabsTrigger value="security">Security Events</TabsTrigger>
                  <TabsTrigger value="biometric">Biometric Profiles</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Username</label>
                      <p className="text-sm text-muted-foreground">{selectedUser.username}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <p className="text-sm text-muted-foreground">
                        {selectedUser.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Created</label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedUser.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="security">
                  {eventsLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : userSecurityEvents && userSecurityEvents.length > 0 ? (
                    <div className="space-y-3">
                      {userSecurityEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <Badge className={getSeverityColor(event.severity)}>
                              {event.severity}
                            </Badge>
                            <div>
                              <p className="font-medium">{event.eventType}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(event.createdAt).toLocaleString()}
                                {event.ipAddress && ` • ${event.ipAddress}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>No security events found</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="biometric">
                  {biometricsLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : userBiometrics && userBiometrics.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userBiometrics.map((profile) => (
                        <div key={profile.id} className="p-4 border rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline">{profile.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(profile.createdAt).toLocaleString()}
                          </p>
                          {profile.lastVerified && (
                            <p className="text-sm text-muted-foreground">
                              Last verified: {new Date(profile.lastVerified).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2" />
                      <p>No biometric profiles found</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user role and status
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    defaultValue={selectedUser.role}
                    onValueChange={(value) => updateUserRole(selectedUser, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Status:</label>
                  <Badge variant={selectedUser.isActive ? "secondary" : "outline"}>
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleUserStatus(selectedUser)}
                  >
                    Toggle Status
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}