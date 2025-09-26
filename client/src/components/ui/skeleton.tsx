import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// Card skeleton for dashboard cards
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 border rounded-lg space-y-3", className)}>
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-8 w-[160px]" />
      <Skeleton className="h-3 w-[120px]" />
    </div>
  );
}

// Table skeleton for data tables
function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4">
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Document card skeleton
function DocumentCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-4", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-6 w-[80px] rounded-full" />
          <Skeleton className="h-6 w-[70px] rounded-full" />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-[100px]" />
          <Skeleton className="h-6 w-[50px] rounded-full" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-[120px]" />
          <Skeleton className="h-6 w-[60px] rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Biometric profile skeleton
function BiometricProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between p-3 border rounded-lg", className)}>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-6 w-6 rounded" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-3 w-[140px]" />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-6 w-[50px] rounded-full" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
    </div>
  );
}

// Chart skeleton
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-[200px] w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-[60px]" />
        </div>
      </div>
    </div>
  );
}

export { 
  Skeleton, 
  CardSkeleton, 
  TableSkeleton, 
  DocumentCardSkeleton,
  BiometricProfileSkeleton,
  ChartSkeleton
};
