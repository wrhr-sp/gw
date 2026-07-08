export const spacingTokens = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;

export const layoutTokens = {
  pageMaxWidth: "100%",
  filterGridMin: "minmax(180px, 1fr)",
  actionGap: spacingTokens.sm,
  sectionGap: spacingTokens.md,
  contentGap: spacingTokens.lg,
} as const;

export const typographyTokens = {
  pageTitleSize: "var(--font-size-page-title)",
  sectionTitleSize: "var(--font-size-lg)",
  bodySize: "var(--font-size-md)",
  captionSize: "var(--font-size-sm)",
  fontFamily: "var(--font-family-sans)",
} as const;

export const componentTokens = {
  pageHeader: {
    gap: layoutTokens.sectionGap,
  },
  filterBar: {
    gap: spacingTokens.sm,
    gridTemplateColumns: `repeat(auto-fit, ${layoutTokens.filterGridMin})`,
  },
  dataTable: {
    width: layoutTokens.pageMaxWidth,
  },
  summaryCard: {
    gap: spacingTokens.sm,
  },
  detailSection: {
    gap: layoutTokens.sectionGap,
  },
  formSection: {
    gap: layoutTokens.sectionGap,
  },
} as const;

export const openSourceUiStack = [
  "shadcn-admin",
  "shadcn/ui",
  "Tailwind CSS",
  "TanStack Table",
  "TanStack Query",
  "React Hook Form",
  "Zod",
  "Tremor",
] as const;
