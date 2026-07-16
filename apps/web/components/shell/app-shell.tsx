import type { ReactNode } from "react";

export type AppShellNavigationItem = {
  href: string;
  icon: ReactNode;
  label: string;
};

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  hotelName: string;
  navigation: AppShellNavigationItem[];
  userDisplayName: string;
};

type NavigationLinksProps = Pick<AppShellProps, "currentPath" | "navigation"> & {
  variant: "desktop" | "mobile";
};

function NavigationLinks({ currentPath, navigation, variant }: NavigationLinksProps) {
  return navigation.map((item) => {
    const current = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    const focusClassName = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";
    const className = variant === "desktop"
      ? current
        ? `flex min-h-10 items-center justify-center gap-3 rounded-control bg-primary/10 px-3 py-2 text-sm font-semibold text-primary xl:justify-start ${focusClassName}`
        : `flex min-h-10 items-center justify-center gap-3 rounded-control px-3 py-2 text-sm font-medium text-muted hover:bg-background hover:text-text xl:justify-start ${focusClassName}`
      : current
        ? `flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-1 text-[11px] font-semibold text-primary ${focusClassName}`
        : `flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium text-muted ${focusClassName}`;

    return (
      <a
        aria-current={current ? "page" : undefined}
        aria-label={item.label}
        className={className}
        href={item.href}
        key={item.href}
      >
        <span
          aria-hidden="true"
          className={variant === "desktop"
            ? "flex size-[18px] items-center justify-center [&>svg]:size-[18px]"
            : "flex size-5 items-center justify-center [&>svg]:size-5"}
        >
          {item.icon}
        </span>
        <span className={variant === "desktop" ? "hidden xl:inline" : undefined}>{item.label}</span>
      </a>
    );
  });
}

export function AppShell({
  children,
  currentPath,
  hotelName,
  navigation,
  userDisplayName,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background text-text">
      <a
        className="fixed left-4 top-0 z-50 -translate-y-full rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white focus:translate-y-4"
        href="#main-content"
      >
        본문 바로가기
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar-collapsed border-r border-border bg-surface lg:flex lg:flex-col xl:w-sidebar">
        <div className="flex h-topbar items-center justify-center border-b border-border text-primary xl:justify-start xl:px-6">
          <span aria-hidden="true" className="text-lg font-bold xl:hidden">W</span>
          <span className="hidden flex-col xl:flex">
            <span className="text-lg font-bold leading-5">WE’REHERE</span>
            <span className="text-[10px] font-medium tracking-wide text-muted">HOTEL OPERATIONS</span>
          </span>
        </div>
        <nav aria-label="호텔 운영 주 메뉴" className="flex flex-1 flex-col gap-1 p-2 xl:p-4">
          <NavigationLinks currentPath={currentPath} navigation={navigation} variant="desktop" />
        </nav>
      </aside>

      <div className="lg:pl-sidebar-collapsed xl:pl-sidebar">
        <header className="sticky top-0 z-10 flex h-mobile-topbar items-center justify-between border-b border-border bg-surface px-4 lg:h-topbar lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted">현재 호텔</p>
            <p className="truncate text-sm font-semibold text-text">{hotelName}</p>
          </div>
          <p className="truncate text-sm font-medium text-muted">{userDisplayName}</p>
        </header>

        <main
          className="min-h-[calc(100dvh-3.5rem)] px-4 pt-4 pb-[calc(var(--spacing-mobile-nav)+env(safe-area-inset-bottom)+1rem)] lg:min-h-[calc(100dvh-4rem)] lg:p-6"
          id="main-content"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="모바일 호텔 운영 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(var(--spacing-mobile-nav)+env(safe-area-inset-bottom))] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden [&>a]:flex-1"
      >
        <NavigationLinks currentPath={currentPath} navigation={navigation} variant="mobile" />
      </nav>
    </div>
  );
}
