export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-muted/20 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-panel-white rounded-lg p-4 shadow-sm">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-panel-white rounded-lg p-4 shadow-sm ${className}`} aria-hidden="true">
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
