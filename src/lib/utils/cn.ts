import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility: merge Tailwind CSS classes safely.
 *
 * Uses clsx for conditional logic + tailwind-merge to resolve conflicts.
 * Example: cn("px-4 py-2", isActive && "bg-primary", "px-6")
 *          → "py-2 bg-primary px-6"  (px-4 is overridden by px-6)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
