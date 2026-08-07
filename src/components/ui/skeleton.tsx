import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-luxe rounded-xl", className)} {...props} />;
}

export { Skeleton };
