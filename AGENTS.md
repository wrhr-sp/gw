# 호텔관리 우선 개발 실행 규칙

## 최상위 실행순서

아래 순서가 유일한 단계 정본입니다. 이 순서와 충돌하는 과거의 기능별 전체검토·전체통합검증·fresh review 단계 배치는 폐기합니다.

```text
[기능 구현 → focused 검증 → commit/push → PR·GitHub checks·merge/정리] 반복
→ 승인된 MVP 전체 구현 완료
→ 세로 기능 하나씩 검토·수정·GitHub 반영
→ 전체 통합 검증
→ immutable artifact
→ 동일 artifact 대상 fresh 사양·보안·품질 3-way review
→ finding 수정 시 새 artifact·fresh review 반복
→ GitHub 최종 확인
→ staging
→ production 별도 gate
```

- 구현 중 검증은 변경 기능의 Red→Green, 관련 typecheck/build, 변경한 고위험 DB·권한의 최소 실제 검증, mutation seal과 CI 기본 gate로 제한합니다.
- 기능별 전체 세로 E2E, 전체 회귀, immutable artifact, fresh 3-way review를 MVP 전체 구현 전에 반복하지 않습니다.
- mutation seal은 구현 범위 무결성 증거이며 최종 immutable artifact가 아닙니다.
- staging은 fresh 3-way review와 GitHub 최종 확인 뒤에만 진행합니다.
- Production 실데이터·secret·DNS/custom domain·유료·파괴 작업·Production 배포는 항상 별도 승인 gate입니다.

## 소통

- 기본 언어는 한국어입니다.
- 비개발자가 이해할 수 있도록 결론 → 쉬운 설명 → 세부 근거 순서로 보고합니다.
- 검증하지 않은 결과를 완료로 말하지 않습니다.

## GitHub 자동 후속작업

- 착수 승인된 구현 사이클이 focused Green·관련 테스트/build·mutation seal까지 완료되면, 기능별 전체검토나 fresh review를 추가하지 않고 해당 branch의 commit, push, PR 생성, GitHub checks 확인, PR merge, 원격·로컬 branch와 worktree 정리까지 연속 실행합니다.
- CI·리뷰가 실패하면 merge하지 않고 같은 승인 사이클 안에서 원인을 수정하고 다시 검증합니다. 검증 실패·미완료·unsealed 상태를 백업 명목으로 완료 commit하거나 merge하지 않습니다.
- 카드·승인범위에 release/deploy/배포가 명시된 사이클은 해당 배포와 read-back·smoke까지 자동 후속작업에 포함합니다. 명시되지 않은 배포는 자동으로 추가하지 않습니다.
- Production 실데이터 변경, secret 입력·교체, DNS/custom domain, 유료 리소스, 파괴 작업, 승인 제품범위·구현방식의 실질 변경은 자동 후속작업에 포함하지 않고 별도 승인을 받습니다.
- commit·push는 GitHub 원격 백업으로 간주하며, 장기 미커밋 상태나 `/tmp` 단독 worktree를 허용하지 않습니다. 외부 장애로 push가 막히면 저장소 밖 durable patch bundle을 만들고 read-back한 뒤 차단사항을 보고합니다.

## 제품 경계

- 초기 제품은 호텔관리입니다.
- 초기 MVP 사용자유형은 사내 임직원, 하우스키핑, 호텔 소유주 세 종류입니다.
- 거래처 임직원, 근태, 휴가, 전자결재, 급여, 게시판, 메신저, PMS·OTA 연동은 승인된 후속 범위 전에는 구현·노출하지 않습니다.
- 호텔 지점 정본과 확장 구조는 승인 PRD를 따릅니다.

## 기존 코드

- 기존 그룹웨어 구현은 archive에서 참고만 합니다.
- 과거 파일을 통째로 복사하거나 기존 미완성 route를 다시 활성화하지 않습니다.
- 재사용 후보는 현재 PRD·보안·UI 기준과 테스트를 통과한 뒤 새 코드로 선별 반영합니다.

## 오픈소스·공개 API 선택 게이트

- 새 기능 또는 실질적으로 확장되는 기능은 외부 패키지·API를 추가하지 않더라도 기능별 후보 선정 게이트를 적용합니다.
- 후보 선정은 승인된 기능·사용자 흐름·완료 기준을 그대로 실현하는 **구현 방식**을 비교하는 절차입니다. 무엇을 제공할지, 기능을 추가·제거할지 또는 제품 범위를 바꿀지는 후보 선정이 아니라 PRD 승인에서 결정합니다.
- 후보는 같은 기능 결과를 만드는 아키텍처, 자체 구현, 라이브러리, 공개 API, 데이터·운영 방식을 비교해야 합니다. 후보 자체가 새 기능·외부 PMS·제품 범위 확장을 요구하면 구현 후보에서 제외하고 별도 PRD 변경 게이트로 보냅니다.
- 구현 전에 각 기능 상태를 다음 중 하나로 분류하고 기록합니다.
  - `approved`: 대장이 후보를 명시적으로 선택한 상태
  - `researched-but-unselected`: 후보 조사는 끝났지만 대장이 선택하지 않은 상태
  - `unresearched`: 후보 조사가 끝나지 않은 상태
- `approved`가 아닌 기능은 구현 계획 확정, Red 테스트, 구현 코드 작성, 기능 확장, 서비스 연동을 금지합니다.
- 미선택 기능에 재사용 가능한 기존 조사 후보가 있으면 검증된 후보 3개를 제시하고, 기존 후보가 없거나 현재 조건에 유효하지 않으면 정확히 3개를 새로 조사합니다.
- 기존 스택을 사용한 자체 구현도 후보 중 하나일 뿐이며 자동 선택하지 않습니다. 공통 UI 스택이나 기존 라이브러리의 승인은 기능별 후보 승인을 대신하지 않습니다.
- 후보마다 기능 연관성, 기술·UX와 PC·모바일 적합성, 비용, 라이선스·상업 이용 조건, 인증·보안·회사·호텔 데이터 격리, 운영 부담, 유지보수 상태, 확장성을 비교합니다.
- 추천 후보와 추천 이유뿐 아니라 추천이 무효가 되는 조건을 명시하고, 필요한 PoC·법률·보안·성능·배포 승인 게이트를 설명합니다.
- 대장의 명시적 선택 전에는 후보의 코드·화면·API를 복제하거나 추측해 구현하지 않습니다.
- 단순 결함 수정과 기존 보안 회귀 수정은 후보를 다시 선정하지 않습니다. 다만 새 UI, 새 API, 새 저장 구조 또는 새 운영 시스템이 생기면 실질적 기능 확장으로 보고 후보 선정부터 다시 수행합니다.
- 후보 선정 게이트 누락을 발견하면 작업을 즉시 중단하고 해당 코드를 `unselected/unapproved`로 분류합니다. commit·PR·merge·배포를 금지하고 후보 조사·비교·대장 선택 단계로 복귀합니다.

## 구현

- 구현 정본 순서는 PRD → 기능 명세 → 화면·사용자 흐름 → 데이터·권한·API 설계 → 기능별 오픈소스·공개 API 후보 비교와 사용자 선택 → 테스트·완료 기준 → 구현 계획 → Red → Green → focused 검증 → GitHub 후속작업입니다. 세로검토·전체 통합검증·immutable artifact·fresh 3-way review는 승인된 MVP 전체 구현 뒤에 수행합니다.
- 새 기능은 Web UI → 실제 API → Service/Repository → PostgreSQL 저장·재조회 → 권한·감사 흐름을 완성합니다.
- mock, placeholder, static sample 성공, in-memory fallback, 가짜 성공을 금지합니다.
- DB·R2·schema가 없으면 안정 오류코드로 안전 실패합니다.
- 변경 API는 version, 멱등, transaction, 감사 정책을 따릅니다.

## 인증·보안

- Base64 JSON claim 쿠키를 인증으로 사용하지 않습니다.
- 운영 세션은 고엔트로피 opaque token의 hash만 서버 DB에 저장합니다.
- 요청마다 활성 세션·사용자·회사·사용자유형·역할·권한을 서버에서 검증합니다.
- DB 권한을 정본으로 사용하며 정적 역할 기본권한으로 회수된 권한을 복원하지 않습니다.
- 회사·호텔·사용자유형·기간배정·기능권한·자료상태를 서버에서 검증합니다.
- 민감정보를 소스·로그·문서·보고·커밋에 남기지 않습니다.

## UI

- `docs/design/hotel-ui/README.md`를 최상위 UI 기준으로 사용합니다.
- 실제 UI 기반은 shadcn/ui + Radix UI + Tailwind CSS로 통일합니다.
- TanStack Table/Query, React Hook Form, Zod를 공통 기반으로 사용합니다.
- Tabler와 Mantine은 시각·상호작용 참고만 하며 런타임 UI 시스템을 혼합하지 않습니다.
- 모바일은 PC 표를 축소하지 않고 현장 행동 우선으로 재배치합니다.

## 검증

- 파일 수정 전에 저장소 밖 manifest로 `pnpm verify:mutations --capture <manifest> --expect <수정하기로 한 파일> ...`를 실행하고 출력된 seal을 별도로 보존합니다.
- 수정 직후 `pnpm verify:mutations --baseline <manifest> --seal <capture에서 받은 seal>`을 실행하고 manifest를 삭제합니다.
- expected file 미변경, 예상 밖 변경, 기존 dirty 비대상 변경 또는 동시 writer가 감지되면 수정 완료로 보고하지 않고 실패 원인을 해결합니다.
- verifier 성공 후에도 `read_file`, 관련 테스트, `git diff --check`로 내용과 문법을 별도 검증합니다.
- 변경 전 관련 PRD·계약·구조를 먼저 확인합니다.
- API·DB·권한·동시성·E2E·접근성 검증을 수행합니다.
- Production DB·R2·secret·DNS·유료 리소스는 별도 승인 전 건드리지 않습니다.
- Preview 저장·재조회·권한차단 smoke 통과 전 Production 배포를 금지합니다.
