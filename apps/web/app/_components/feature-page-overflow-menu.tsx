"use client";

import React, { useEffect, useRef, useState } from "react";

type FeaturePageOverflowMenuProps = {
  label: string;
};

const featurePageMenuItems = ["가이드", "통합설정"] as const;

export function FeaturePageOverflowMenu({ label }: FeaturePageOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="feature-page-overflow-menu" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${label} 더보기 메뉴 열기`}
        className="feature-page-overflow-menu__button"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true" className="feature-page-overflow-menu__dots">
          <span className="feature-page-overflow-menu__dot" />
          <span className="feature-page-overflow-menu__dot" />
          <span className="feature-page-overflow-menu__dot" />
        </span>
      </button>
      <div
        className="feature-page-overflow-menu__popover"
        hidden={!isOpen}
        role="menu"
        aria-label={`${label} 공통 메뉴`}
      >
        {featurePageMenuItems.map((item) => (
          <button
            aria-disabled="true"
            className="feature-page-overflow-menu__item"
            key={item}
            onClick={() => setIsOpen(false)}
            role="menuitem"
            title={`${item} 기능은 통합 화면/API 확정 후 연결합니다.`}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
