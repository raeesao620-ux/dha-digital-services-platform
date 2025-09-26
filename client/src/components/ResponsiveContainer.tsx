
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export function ResponsiveContainer({ 
  children, 
  className, 
  maxWidth = "lg" 
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
    full: "max-w-full"
  };

  return (
    <div className={cn(
      "mx-auto px-4 sm:px-6 lg:px-8 w-full",
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}
