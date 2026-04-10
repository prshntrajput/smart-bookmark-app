import { cn } from "@/lib/utils/cn";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent max-width + padding wrapper for all dashboard pages.
 * Centralises layout tokens — change once, affects everywhere.
 */
export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <main
      className={cn(
        "container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8",
        className
      )}
    >
      {children}
    </main>
  );
}
