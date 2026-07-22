# 호텔관리 초기 MVP PRD 승인본

> 상태: `user_approved`<br>
> 작성일: 2026-07-15<br>
> 사용자 승인: 2026-07-15<br>
> 구현 승인: 별도 필요

## 문서 목적

지금까지 사용자가 직접 확정·정정한 정책과 HDRAFT-001~019 승인결과를 반영한 호텔관리 초기 MVP PRD 승인본이다. PRD 승인은 구현 기준을 확정한 것이며 코드·DB·PR·배포 실행은 별도 오케스트레이션 승인이 필요하다.

## 읽는 순서

1. [상위 PRD](00-hotel-management-initial-mvp-prd.md)
2. [호텔 지점·사용자 배정](01-hotel-branch-and-assignment-prd.md)
3. [객실·체크리스트·객실점검](02-room-and-inspection-prd.md)
4. [운영이슈](03-operational-issue-prd.md)
5. [호텔 일매출](04-daily-sales-prd.md)
6. [호텔 소유주 문의](05-owner-inquiry-prd.md)
7. [권한·파일·알림·감사 공통기반](06-platform-security-prd.md)
8. [사용자 검토표](07-user-review-checklist.md)
9. [API·데이터 계약 초안](08-api-data-contract-draft.md)
10. [수용·테스트 매트릭스](09-acceptance-test-matrix.md)
11. [계정·사용자 관리](10-account-administration-prd.md)
12. [호텔 운영 지식뱅크·기능 가이드](11-knowledge-bank-and-contextual-guidance-prd.md)

## 결정 상태 표시

| 표시 | 의미 |
|---|---|
| `사용자 확정` | 사용자가 직접 선택·정정한 현행 기준 |
| `사용자 예외` | 권장점수와 관계없이 사용자가 명시적으로 선택한 기준 |
| `사용자 승인` | HDRAFT-001~019를 포함해 사용자가 승인한 현행정책 |
| `후속 단계` | 초기 MVP에서 구현하지 않음 |
| `별도 승인` | Production, secret, DNS, 유료자원, 외부실연동 등 별도 게이트 |

## 추적 원천

- 구조화 인터뷰: `../interviews/common/product-common-policy.interview.yaml`
- 제품 범위: `../../../../PRD.md`
- 제작 규칙: `../prd-production-rules.md`
- 삭제된 `00-policy-decision-ledger.md`는 복원하거나 근거로 사용하지 않는다.
