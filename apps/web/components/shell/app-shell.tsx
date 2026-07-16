import type { ReactNode } from "react";

export type AppShellNavigationItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  hotelName: string;
  navigation: AppShellNavigationItem[];
  userDisplayName: string;
};

function NavigationLinks({
  currentPath,
  navigation,
}: Pick<AppShellProps, "currentPath" | "navigation">) {
  return navigation.map((item) => {
    const current = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    return (
      <a
        aria-current={current ? "page" : undefined}
        className={current
          ? "rounded-control bg-primary px-3 py-2 text-sm font-semibold text-white"
          : "rounded-control px-3 py-2 text-sm font-medium text-muted hover:bg-background hover:text-text"}
        href={item.href}
        key={item.href}
      >
        {item.label}
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
    <div className="min-h-screen bg-background text-text">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-topbar items-center border-b border-border px-6 text-lg font-bold text-primary">
          We’reHere
        </div>
        <nav aria-label="호텔 운영 주 메뉴" className="flex flex-1 flex-col gap-1 p-4">
          <NavigationLinks currentPath={currentPath} navigation={navigation} />
        </nav>
      </aside>

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-10 flex h-mobile-topbar items-center justify-between border-b border-border bg-surface px-4 lg:h-topbar lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted">현재 호텔</p>
            <p className="truncate text-sm font-semibold text-text">{hotelName}</p>
          </div>
          <p className="truncate text-sm font-medium text-muted">{userDisplayName}</p>
        </header>

        <div className="min-h-screen pb-mobile-nav lg:pb-0">
          {children}
        </div>
      </div>

      <nav
        aria-label="모바일 호텔 운영 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 flex h-mobile-nav border-t border-border bg-surface lg:hidden [&>a]:flex-1 [&>a]:text-center"
      >
        <NavigationLinks currentPath={currentPath} navigation={navigation} />
      </nav>
    </div>
  );
}
