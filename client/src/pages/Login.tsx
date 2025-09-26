import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, Lock, User } from "lucide-react";
import { SouthAfricanCoatOfArms, DHALogo } from "@/components/GovernmentAssets";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      // Use AuthContext login function to properly set auth state
      login(data.token, data.user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.username}!`,
      });
      
      // Redirect to admin dashboard for admin users
      setTimeout(() => {
        if (data.user.role === 'admin' || data.user.role === 'super_admin' || data.user.role === 'raeesa_ultra') {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/");
        }
      }, 500);
    },
    onError: (error: Error) => {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
      });
    }
  });

  const handleSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5Mjk4YzgiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItNnY0SDI0djZoMTJ2LTRzMTIgMS0xMiAxIDEyLTEgMTItMXYtNGgtMTJ2Ni0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
      
      <Card className="w-full max-w-md shadow-2xl relative bg-white/95 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center space-x-4 mb-2">
            <SouthAfricanCoatOfArms className="h-16 w-16" />
            <DHALogo className="h-14 w-14" />
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold">Department of Home Affairs</CardTitle>
            <CardDescription className="text-lg mt-2">Admin Portal Login</CardDescription>
          </div>
          
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span>Secure Government System</span>
          </div>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="Enter username"
                          className="pl-10"
                          autoComplete="username"
                          disabled={isLoading}
                          data-testid="input-username"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter password"
                          className="pl-10"
                          autoComplete="current-password"
                          disabled={isLoading}
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Form>
          
          {/* Preview Mode Notice */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800 space-y-2">
              <div className="font-semibold flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Preview Mode
              </div>
              <div className="text-xs">
                <div>Username: <span className="font-mono font-semibold">admin</span></div>
                <div>Password: <span className="font-mono font-semibold">admin123</span></div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-center text-xs text-muted-foreground">
            This is a secure government system. Unauthorized access is prohibited.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}