
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to monitoring service
    this.logError(error, errorInfo);
  }

  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  private async logError(error: Error, errorInfo: ErrorInfo) {
    const attemptLog = async () => {
      try {
        const userId = localStorage.getItem("userId");
        const token = localStorage.getItem("token");
        
        // Collect browser context with null checks
        const context = {
          viewport: {
            width: window.innerWidth || 0,
            height: window.innerHeight || 0
          },
          screen: {
            width: window.screen?.width || 0,
            height: window.screen?.height || 0
          },
          memory: (navigator as any)?.deviceMemory || 'unknown',
          cores: navigator?.hardwareConcurrency || 'unknown',
          language: navigator?.language || 'unknown',
          platform: navigator?.platform || 'unknown',
          cookieEnabled: navigator?.cookieEnabled || false,
          onLine: navigator?.onLine || false,
          referrer: document?.referrer || '',
          timestamp: new Date().toISOString()
        };

        const errorData = {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId,
          context
        };

        let response: Response;
        
        // Try authenticated endpoint first if token exists
        if (token) {
          try {
            response = await fetch("/api/debug/errors", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify(errorData)
            });
            
            if (response.ok) {
              console.log("Error logged successfully (authenticated)");
              this.retryCount = 0;
              return;
            } else if (response.status === 401 || response.status === 403) {
              // Token invalid or expired, try unauthenticated endpoint
              console.log("Authentication failed, trying unauthenticated endpoint");
            } else {
              throw new Error(`Authenticated endpoint failed with ${response.status}`);
            }
          } catch (authError) {
            console.warn("Authenticated error logging failed:", authError);
          }
        }
        
        // Fall back to unauthenticated endpoint
        response = await fetch("/api/debug/client-errors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(errorData)
        });

        if (!response.ok) {
          if (response.status === 429) {
            const data = await response.json();
            throw new Error(`Rate limited. Retry after ${data.retryAfter} seconds`);
          }
          throw new Error(`Unauthenticated endpoint failed with ${response.status}`);
        }

        // Reset retry count on success
        this.retryCount = 0;
        console.log("Error logged successfully (unauthenticated)");
      } catch (logError) {
        console.warn("Error logging failed:", logError);
        
        // Implement exponential backoff retry
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
          console.log(`Retrying error log in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
          setTimeout(() => attemptLog(), delay);
        } else {
          console.error("Failed to log error after maximum retries");
        }
      }
    };

    await attemptLog();
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="glass border-glass-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-alert">
              <span>⚠️</span>
              <span>Something went wrong</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-alert bg-alert/10">
              <AlertDescription>
                {this.state.error?.message || "An unexpected error occurred"}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
              
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
                variant="outline"
              >
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground overflow-auto">
                  {this.state.error?.stack}
                </pre>
                <pre className="mt-2 text-xs text-muted-foreground overflow-auto">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
