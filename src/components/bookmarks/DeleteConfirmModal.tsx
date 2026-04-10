"use client";

import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button }  from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn }      from "@/lib/utils/cn";
import type { Bookmark } from "@/types";

interface DeleteConfirmModalProps {
  /** null = modal closed, non-null = modal open with this bookmark pending */
  bookmark: Bookmark | null;
  isDeleting: boolean;
  /** Set when the delete API call fails — shows inline error in the modal */
  deleteError: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}


export function DeleteConfirmModal({
  bookmark,
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const isOpen = bookmark !== null;

  const domain = bookmark ? getDomain(bookmark.url) : "";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Block accidental dismissal while deletion is in progress
        if (!open && !isDeleting) onCancel();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        // Prevent keyboard Escape from closing during deletion
        onEscapeKeyDown={(e) => {
          if (isDeleting) e.preventDefault();
        }}
        // Prevent overlay click from closing during deletion
        onPointerDownOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Warning icon — reinforces destructive action */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base">
                Delete this bookmark?
              </DialogTitle>
              <DialogDescription className="text-sm">
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Bookmark preview ───────────────────────────────────────────── */}
        {bookmark && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium line-clamp-1">{bookmark.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {domain}
            </p>
          </div>
        )}

        {/* ── Delete error (shown if DB call fails) ──────────────────────── */}
        {deleteError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {deleteError}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {/* Cancel — disabled while deleting to prevent state confusion */}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>

          {/* Confirm delete — destructive style, spinner mid-flight */}
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(
              "flex-1 gap-2 sm:flex-none",
              isDeleting && "opacity-80"
            )}
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}