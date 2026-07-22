"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { CircleHelp, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "../cn";

type NonEmptyGuideItems = readonly [string, ...string[]];

export type FeatureGuideContent = {
  featureKey: string;
  title: string;
  summary: string;
  audience: NonEmptyGuideItems;
  steps: NonEmptyGuideItems;
  permissions: NonEmptyGuideItems;
  cautions: NonEmptyGuideItems;
  version: string;
};

type FeatureGuideProps = {
  content: FeatureGuideContent;
  className?: string;
};

const triggerClass =
  "min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function GuideSections({ content }: { content: FeatureGuideContent }) {
  return (
    <div className="space-y-5 text-sm text-text">
      <p className="leading-6 text-muted">{content.summary}</p>
      <section>
        <h3 className="font-semibold">사용 대상</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {content.audience.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold">기본 사용순서</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          {content.steps.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </section>
      <section>
        <h3 className="font-semibold">필요한 권한</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {content.permissions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold">주의사항</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {content.cautions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <p className="text-xs text-muted">가이드 버전 {content.version}</p>
    </div>
  );
}

export function FeatureGuide({ content, className }: FeatureGuideProps) {
  const desktopTitleId = useId();
  const mobileDescriptionId = useId();
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const accessibleName = `${content.title} 도움말`;
  const changeDesktopOpen = (open: boolean) => {
    setDesktopOpen(open);
    if (!open) requestAnimationFrame(() => desktopTriggerRef.current?.focus());
  };

  return (
    <span className={cn("inline-flex shrink-0", className)} data-feature-key={content.featureKey}>
      <Popover.Root onOpenChange={changeDesktopOpen} open={desktopOpen}>
        <Popover.Trigger asChild>
          <button
            aria-label={accessibleName}
            className={cn(triggerClass, "hidden md:inline-flex")}
            ref={desktopTriggerRef}
            type="button"
          >
            <CircleHelp aria-hidden="true" className="size-5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            aria-labelledby={desktopTitleId}
            className="z-50 max-h-[min(70vh,38rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-panel border border-border bg-surface p-5 shadow-panel outline-none data-[state=open]:animate-in"
            sideOffset={8}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold" id={desktopTitleId}>{content.title} 도움말</h2>
              <Popover.Close
                aria-label={`${content.title} 도움말 닫기`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="size-5" />
              </Popover.Close>
            </div>
            <GuideSections content={content} />
            <Popover.Arrow className="fill-surface" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            aria-label={accessibleName}
            className={cn(triggerClass, "inline-flex md:hidden")}
            type="button"
          >
            <CircleHelp aria-hidden="true" className="size-5" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-50 bg-slate-950/40"
            data-testid="feature-guide-overlay"
          />
          <Dialog.Content
            aria-describedby={mobileDescriptionId}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-panel border border-border bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-panel outline-none md:hidden"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-semibold">{content.title} 도움말</Dialog.Title>
                <Dialog.Description className="sr-only" id={mobileDescriptionId}>
                  {content.summary}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={`${content.title} 도움말 닫기`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
            <GuideSections content={content} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </span>
  );
}
