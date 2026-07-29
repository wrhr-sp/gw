# 호텔 MVP 소실 확인 및 재구현 원장

- 판정일: 2026-07-29
- 기준 저장소: `wrhr-sp/gw`
- 기준 통합 브랜치: `feat/hotel-mvp-complete`
- 기준 커밋: `b82c6a518dbcf3175aae7de51016c389342e1f2d`
- 삭제된 작업공간: `/tmp/gw-mvp-complete`
- 판정: **Git·Hermes·편집기 Local History·일반 백업에서 exact source 사본을 찾지 못해 사양 기반 재구현 필요**

## 1. 판정 원칙

이 문서는 과거 완료 보고를 현재 artifact로 간주하지 않는다. 현재 Git tree와 실제 복구 매체를 정본으로 사용하고, 과거 세션 요약은 재구현 사양과 검증 항목을 복원하는 보조 근거로만 사용한다.

복구 상태는 다음과 같이 구분한다.

- `PRESERVED`: 현재 Git tree에 source와 검증 기반이 존재한다.
- `PARTIAL`: 일부 계층 또는 PRD만 남아 있다.
- `MISSING`: 현재 Git history와 복구 매체에 구현 source가 없다.
- `REBUILD_REQUIRED`: 승인 사양을 바탕으로 새 artifact를 만들고 검증해야 한다.

## 2. Git forensic 결과

### 2.1 원격과 기준 브랜치

- GitHub `main`과 `feat/hotel-mvp-complete`는 현재 `b82c6a518dbcf3175aae7de51016c389342e1f2d`를 가리킨다.
- 삭제 전 `feat/hotel-mvp-complete`는 `06654fcd8f40ffac179c89ea6035bee3bd05d555` 기준의 미커밋 worktree였다.
- 삭제된 후속 구현을 담은 원격 feature branch는 없었다.

### 2.2 stash·reflog·history

- stash 총 9개를 검사했다.
- 호텔 관련 메시지의 stash 1개는 과거 PRD stash였으며 소실 핵심 파일을 포함하지 않았다.
- 모든 stash tree에서 소실 핵심 파일 경로 일치: 0개.
- `hotel-mvp-complete`, `gw-mvp-complete`, lifecycle, inspection schedule 관련 복구 가능 reflog entry: 0개.
- `git log --all`에서 아래 소실 핵심 파일의 commit 이력: 0개.

검사 경로:

- `packages/db/migrations/0035_hotel_lifecycle_schedules.sql`
- `packages/db/src/inspection-schedules.ts`
- `packages/db/src/inspection-schedule-reconciliation.ts`
- `packages/db/src/daily-sales.ts`
- `packages/db/src/operational-issues.ts`
- `packages/db/src/owner-inquiries.ts`
- `packages/db/src/notifications.ts`
- `packages/db/src/inspections.ts`
- `packages/db/src/inquiry-settings.ts`
- `packages/db/src/hotel-work-policy.ts`

### 2.3 dangling Git object

- unreachable commit: 716개 검사.
- 소실 핵심 파일 경로를 포함한 unreachable commit: 0개.
- unreachable blob: 574개 검사.
- lifecycle·일정·무담당 알림의 고유 signature를 포함한 blob: 0개.

검사 signature:

- `hotel_inspection_schedule_runs_business_key`
- `createPostgresInspectionScheduleRepository`
- `claimInspectionScheduleRuns`
- `HOTEL_INSPECTION_UNASSIGNED_NOTIFY`
- `createPostgresInquirySettingsRepository`

### 2.4 `.git/worktrees`

`.git/worktrees`는 source mirror가 아니라 HEAD, index, gitdir, commondir, reflog 등의 관리 metadata다.

- 삭제된 과거 entry `gw-mvp-complete`: 현재 없음.
- 새 영구 entry `hotel-mvp-complete`: 기준 Git tree의 clean index이며 과거 source가 아님.
- 남은 `gw-*` stale worktree index의 staged 변경: 0개.

과거 entry를 forensic 보존 전에 제거한 절차상 오류가 있었으므로 예전 index 자체를 직접 재검사할 수는 없다. 다만 staged content가 있었다면 남을 수 있는 Git blob·commit·path·signature를 별도로 검사했으며 복구 후보는 발견되지 않았다.

## 3. Hermes 이력 결과

- 현재 session search 색인에서 `0035_hotel_lifecycle_schedules.sql`, `inspection-schedules.ts`, `gw-mvp-complete` 검색 결과: 0개.
- Hermes agent 로그에는 `/tmp/gw-mvp-complete`에서 typecheck·Preview integration을 실행한 결과와 오류가 남아 있다.
- agent 로그에는 전체 `write_file`·대형 patch 입력이 없으며 source mirror로 사용할 수 없다.
- 발견된 request dump 9개 중 최신 2개는 2026-07-25 객실관리 시점 자료다.
- 해당 dump의 온전한 patch는 객실관리 범위이며 현재 GitHub에 보존된 코드보다 이전이다.
- lifecycle·점검·매출·문의·지식·알림 후속 구현의 전체 source payload dump는 발견되지 않았다.
- subagent cache에는 검토 요약이 남아 있지만 전체 source 파일은 없다.

결론: Hermes 기록은 재구현 사양과 오류 재발 방지에는 사용할 수 있지만 exact source 복원에는 사용할 수 없다.

## 4. 편집기·백업 결과

### 4.1 VS Code Local History

확인 경로:

- WSL 사용자 Local History 후보: 없음.
- Windows 사용자 VS Code Local History: 존재.

Windows Local History의 `entries.json` 6개는 다음 범위뿐이었다.

- VS Code settings
- 별도 `E:/hotel_money` 프로젝트
- VS Code workspace metadata

`gw-mvp-complete`, lifecycle, 점검일정, 일매출, 문의 repository 관련 entry와 고유 signature는 없었다.

### 4.2 WSL·일반 백업

- `/home/wrhrgw`에서 `.tar`, `.patch` 복구 후보: 0개.
- Git bundle 1개는 `gw-pre-hotel-rebuild-20260716.bundle`이며 호텔 재구축 이전 archive다.
- Windows Desktop/Documents/Downloads의 일반 archive 후보에서 `gw`·WSL backup으로 식별되는 파일은 발견되지 않았다.
- 별도 WSL export tar 또는 snapshot VHDX 후보는 발견되지 않았다.

업무자료 archive는 개인정보·업무자료 보호를 위해 이름이 무관한 파일의 내용을 임의로 열지 않았다.

## 5. 소실 판정

다음 조건을 모두 만족하므로 삭제 worktree의 후속 구현은 **exact 복구 불가, 재구현 필요**로 판정한다.

1. 원격 branch·commit 없음.
2. stash·reflog·reachable history에 핵심 경로 없음.
3. dangling commit·blob에 핵심 경로·signature 없음.
4. stale index에 staged 변경 없음.
5. Hermes에 전체 source payload 없음.
6. VS Code Local History에 관련 resource 없음.
7. 식별 가능한 WSL export·patch·bundle 백업 없음.

## 6. 현재 보존 범위

현재 Git tree에서 확인된 기반:

- 플랫폼 foundation과 PostgreSQL 기반
- 인증·opaque session·tenant authority
- 계정관리와 ZITADEL backend 연동 기반
- 호텔 기본정보
- 호텔 관계·기간배정
- 객실관리
- Preview bootstrap session revocation 기반
- DB migration 0001~0024 계열 22개

이 항목도 복구 인벤토리에서 `source 존재`와 `현재 Green`을 구분한다. source가 있다는 이유만으로 과거 검증 결과를 재사용하지 않는다.

## 7. 재구현 후보 범위

과거 세션 기록과 현재 Git tree를 파일명과 source symbol로 직접 대조했다.

- 점검: PRD 1개와 디자인 이미지 1개만 존재하며 Contracts·DB·API source는 없다.
- 일매출: PRD 1개와 디자인 이미지 1개만 존재하며 Contracts·DB·API source는 없다.
- 운영이슈: PRD 1개와 디자인 이미지 2개만 존재하며 Contracts·DB·API source는 없다.
- 호텔 소유주 문의: PRD 1개만 존재하며 Contracts·DB·API source는 없다.
- 지식뱅크: PRD 1개만 존재하며 Contracts·DB·API source는 없다.
- 인앱 알림·Web Push: 관련 구현 파일과 source symbol이 없다. Playwright shell의 `알림` navigation label은 기능 구현 증거가 아니다.
- lifecycle: `activateHotelRequestSchema`, 활성화 route/service/repository, readiness UI가 부분 보존돼 있다. `suspend`·`reactivate` route 문자열은 있으나 요청 계약·handler·repository는 없고, 일정·문의 설정·공통 SUSPENDED 정책도 없다.

| 기능 | 확정 판정 | 재구현 계층 |
|---|---|---|
| 점검표 | MISSING / REBUILD_REQUIRED | Contracts, DB, API, Web, 권한, 테스트 |
| 점검 생성·결과 | MISSING / REBUILD_REQUIRED | Contracts, immutable snapshot/result, API, Web, 테스트 |
| 일매출 | MISSING / REBUILD_REQUIRED | 원장, 증빙, 확정·정정, API, Web, 테스트 |
| 운영이슈 | MISSING / REBUILD_REQUIRED | 원장, 상태전이, 감사, 알림 outbox, API, Web |
| 호텔 소유주 문의 | MISSING / REBUILD_REQUIRED | OWNER/STAFF projection, 첨부, 상태전이, API, Web |
| 지식뱅크 | MISSING / REBUILD_REQUIRED | immutable version, 검토·게시, 첨부 검역, 검색 |
| 인앱 알림·Web Push | MISSING / REBUILD_REQUIRED | outbox, 구독 암호화, delivery, Reconciler, PWA |
| 호텔 lifecycle | PARTIAL / REBUILD_REQUIRED | 기존 활성화 readiness 검증, 상태이력, 중지·재활성화, 일정, routing |
| 일정 Reconciler | MISSING / REBUILD_REQUIRED | materialize, claim, lease, fence, retry, dead-letter |
| SUSPENDED 정책 | MISSING / REBUILD_REQUIRED | 공통 DB/service policy와 domain 회귀 |
| lifecycle readiness | MISSING / REBUILD_REQUIRED | exact schema·RLS·ACL·damage probe |

## 8. 재구현 순서

1. 현재 tree와 승인 PRD의 기능별 gap 확정.
2. 점검 세로기능 복구.
3. 일매출 복구.
4. 운영이슈·문의 복구.
5. 지식뱅크 복구.
6. 인앱 알림·Web Push 복구.
7. lifecycle·점검일정·문의 routing·SUSPENDED 정책 복구.
8. readiness·Preview 최소권한·damage probe 복구.
9. exact snapshot 동결.
10. 세로 통합검토·Preview E2E·전체 회귀·보안·릴리스 검토.

각 사이클은 Red → Green → 사양검토 → 품질검토 → 테스트/build → mutation seal 후 commit → push → PR → CI → `feat/hotel-mvp-complete` merge → 작업 branch 정리까지 자동 수행한다. 전체 MVP와 exact snapshot 검토가 끝나기 전에는 `main`으로 병합하지 않는다.

## 9. 금지사항

- 과거 PASS 보고를 현재 검증 결과로 재사용하지 않는다.
- 세션 요약만 보고 대형 파일을 추측 복원하지 않는다.
- mock·placeholder·static sample·in-memory 성공으로 Green을 가장하지 않는다.
- `/tmp`에 유일한 mutable worktree를 두지 않는다.
- mutation manifest를 source backup으로 간주하지 않는다.
- 검증 실패·unsealed 변경을 완료 commit·merge하지 않는다.
- Production 실데이터·secret·DNS·유료·파괴 작업은 별도 승인 없이 수행하지 않는다.
