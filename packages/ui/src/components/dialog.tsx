"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode, type RefObject } from "react";
import { cn } from "../cn";

export function Dialog({
  children,
  className,
  closeLabel = "대화상자 닫기",
  fallbackFocusRef,
  onOpenChange,
  open,
  restoreFocusRef,
  title,
}: {
  children: ReactNode;
  className?: string | undefined;
  closeLabel?: string;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  title: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-panel border border-border bg-surface p-5 shadow-panel outline-none md:left-1/2 md:top-1/2 md:bottom-auto md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-panel md:p-6",
            className,
          )}
          onOpenAutoFocus={(event) => {
            const target = contentRef.current?.querySelector<HTMLElement>(
              "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([aria-label])",
            );
            if (!target) return;
            event.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(event) => {
            const restoreTarget = restoreFocusRef?.current;
            const target = restoreTarget?.isConnected
              ? restoreTarget
              : fallbackFocusRef?.current;
            if (!target?.isConnected) return;
            event.preventDefault();
            target.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
