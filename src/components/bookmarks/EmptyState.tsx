"use client";

import { Bookmark } from "lucide-react";



export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Bookmark className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No bookmarks yet</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add your first bookmark using the form above. It will appear here
        instantly — even across other open tabs.
      </p>
    </div>
  );
}
