"use client";

import { Search, X } from "lucide-react";
import { Input }     from "@/components/ui/input";
import { Button }    from "@/components/ui/button";
import { cn }        from "@/lib/utils/cn";

interface SearchBarProps {
  value:        string;
  onChange:     (value: string) => void;
  resultCount?: number;
  totalCount?:  number;
  className?:   string;
}

export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  className,
}: SearchBarProps) {
  const isFiltering    = value.trim().length > 0;
  const showResultInfo =
    isFiltering &&
    resultCount !== undefined &&
    totalCount  !== undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search bookmarks by title, URL or category…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search bookmarks"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Live result count — only shown while a query is active */}
      {showResultInfo && (
        <p className="pl-1 text-xs text-muted-foreground">
          {resultCount === totalCount
            ? `${totalCount} bookmark${totalCount !== 1 ? "s" : ""}`
            : `${resultCount} of ${totalCount} bookmark${totalCount !== 1 ? "s" : ""} match`}
        </p>
      )}
    </div>
  );
}