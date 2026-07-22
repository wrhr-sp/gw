# 호텔관리 UI 디자인 시스템 승인 기준

- 상태: `1.0-user-approved`
- 승인일: 2026-07-16
- 제품 방향: 호텔관리 우선, 향후 그룹웨어 확장
- 실제 UI 기반: shadcn/ui + Radix UI + Tailwind CSS
- 데이터·폼 기반: TanStack Table/Query + React Hook Form + Zod
- 시각 참고: Tabler의 PC 정보밀도, Mantine의 모바일 터치 UX

## 1. 디자인 원칙

1. 특정 오픈소스 템플릿 화면을 복제하지 않고 접근성·상호작용·레이아웃 패턴만 사용한다.
2. 실제 설치 UI 기반은 shadcn/ui 계열 하나로 통일한다. Tabler·Mantine을 함께 설치해 혼합하지 않는다.
3. PC는 편안한 고밀도 운영 콘솔, 모바일은 행동 우선 현장 화면으로 구성한다.
4. 관리자·사내 임직원·하우스키핑·호텔 소유주의 메뉴와 액션 경계를 명확하게 표현한다.
5. 색상만으로 상태를 구분하지 않고 문구·아이콘을 함께 사용한다.
6. 화면별 임의 색상·간격·모서리·z-index를 만들지 않고 의미 기반 토큰을 사용한다.

## 2. 색상 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `primary` | `#193B57` | 주요 버튼, 현재 메뉴, 핵심 제목 |
| `accent` | `#0E8A7A` | 진행률, 선택 강조, 보조 운영지표 |
| `background` | `#F4F7FA` | 앱 본문 배경 |
| `surface` | `#FFFFFF` | 카드·패널·입력 표면 |
| `text` | `#172033` | 기본 글자 |
| `muted` | `#667085` | 설명·보조정보 |
| `border` | `#DFE5EA` | 구분선·입력 테두리 |

업무 상태는 브랜드색과 분리한다.

- 정상·운영중: green
- 준비·정보: blue
- 주의·재점검: amber
- 중대: orange
- 긴급·차단: red
- 중지·비활성: gray

## 3. 타이포그래피

- 글꼴: Pretendard
- 숫자 비교 영역: `font-variant-numeric: tabular-nums`

| 용도 | 크기 | 굵기 |
|---|---:|---:|
| PC 페이지 제목 | 28px | 700 |
| 모바일 페이지 제목 | 24px | 700 |
| 섹션 제목 | 18px | 700 |
| 카드 제목 | 15px | 600 |
| 본문 | 14px | 400 |
| 필드 라벨 | 13px | 600 |
| 표 | 13px | 400~600 |
| 설명·보조정보 | 12px | 400 |

## 4. 레이아웃 토큰

### PC

- 상단바: 64px
- 펼친 사이드바: 240px
- 접힌 사이드바: 72px
- 본문 padding: 24px
- 우측 상세패널: 480px
- 노트북 상세패널: 420px
- 표 행: 46px
- 표 헤더: 42px
- 입력창·버튼: 40px

### 모바일

- 상단바: 56px
- 화면 좌우 padding: 16px
- 하단 탐색: 64px
- 일반 터치영역: 최소 44px
- 주요 버튼: 52px
- 카드 내부 padding: 16px
- 카드 간격: 8px

## 5. 모서리·그림자·아이콘

- 입력창·버튼: 8px
- 일반 카드: 10px
- 모바일 업무 카드: 12px
- Dialog·Sheet: 12px
- 상태 배지: 6px
- 일반 카드는 그림자 없이 얇은 테두리를 기본으로 한다.
- Dropdown·Sheet·Dialog에만 단계별 그림자를 사용한다.
- 아이콘은 Lucide Outline을 사용한다.
- 사이드바 아이콘 18px, 버튼 아이콘 16px, 모바일 주요업무 아이콘 20~24px를 기본으로 한다.

## 6. App Shell

### PC

```text
TopBar(호텔 선택·검색·알림·사용자)
└─ Sidebar(업무 묶음)
   └─ Main
      ├─ PageHeader
      ├─ Summary
      └─ WorkArea
         └─ 선택 시 RightDetailPanel
```

### 모바일

```text
TopBar(현재 호텔·알림)
└─ Main(오늘 업무·현장 수행)
   └─ BottomNavigation 또는 TaskActionBar
```

호텔 선택 상태를 상단에 계속 표시한다. 전체 호텔 모드와 개별 호텔 모드를 명확히 구분한다.

## 7. 공통 컴포넌트

먼저 구현하고 모든 화면에서 재사용한다.

- `AppShell`
- `HotelSwitcher`
- `PageHeader`
- `FeatureGuide` (`PageHeader` 제목 옆 `?` button + Popover/모바일 Sheet·Dialog)
- `SummaryCard`
- `FilterBar`
- `DataTable`
- `StatusBadge`
- `RightDetailPanel`
- `MasterDetailWorkspace`
- `FormSection`
- `ActionButtonGroup`
- `ConfirmDialog`
- `AttachmentPanel`
- `AuditLogPanel`
- `PermissionMatrix`
- `MobileTaskCard`
- `MobileTaskActionBar`
- `EmptyState`
- `ErrorState`
- `LoadingState`

`FeatureGuide`는 hover 전용 Tooltip으로 구현하지 않는다. 기능명을 포함한 접근 가능한 이름, 클릭·터치·Enter·Space, Escape 닫기, 닫은 뒤 원래 버튼으로 포커스 복귀, 모바일 최소 44×44px 터치영역을 제공한다. 내용은 기능 목적·사용대상·기본 순서·필요 권한·주의사항을 짧은 한국어로 설명하며 권한 없는 기능에는 가이드도 렌더하지 않는다.

## 8. 표준 화면 템플릿

### 목록

```text
PageHeader → SummaryCard → FilterBar → DataTable → Pagination → RightDetailPanel
```

### 상세

```text
PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel
```

### 작성·수정

```text
PageHeader → FormSection → ValidationSummary → ActionButtonGroup → ConfirmDialog
```

### 운영이슈·문의

```text
PageHeader → FilterBar → MasterList → DetailWorkspace → TaskActionBar
```

### 모바일 객실점검

```text
HotelContext → Progress → ChecklistItem → EvidenceUpload → Validation → MobileTaskActionBar
```

### 일매출·감사

```text
PageHeader → FilterBar → LedgerTable → Totals → Correction/Audit Detail
```

## 9. 승인된 기준 미리보기

### PC

- [전체 PC 비교](./comparison_pc_final.png)
- [운영 대시보드](./pc_dashboard.png)
- [호텔 목록·우측 상세](./pc_hotel_list_panel.png)
- [호텔 전체 상세](./pc_hotel_detail.png)
- [운영이슈 분할화면](./pc_issue_split.png)
- [일매출 장부](./pc_daily_sales.png)
- [호텔 권한관리](./pc_permissions.png)

### 모바일

- [전체 모바일 비교](./comparison_mobile_final.png)
- [오늘 업무 홈](./mobile_home.png)
- [객실점검 수행](./mobile_inspection.png)
- [긴급 운영이슈 처리](./mobile_issue.png)

## 10. 구현 검증 게이트

- 키보드만으로 주요 업무 완료 가능
- Dialog·Sheet 포커스 이동·복귀 검증
- WCAG AA 명도 대비
- 390px 모바일, 1024px 노트북, 1440px PC 검증
- 색상 없이도 상태 식별 가능
- 권한 없는 메뉴·액션의 서버 검증과 화면 표현 일치
- 모든 사용자-facing 기능 제목 옆 `?` 가이드와 route별 typed registry coverage
- 가이드의 키보드·스크린리더·모바일 Sheet/Dialog·포커스 복귀 검증
- 로딩·빈 상태·오류·저속망 상태 포함
- 상태 변경 버튼은 실제 API와 DB 재조회에 연결
- mock·placeholder·가짜 성공 금지
