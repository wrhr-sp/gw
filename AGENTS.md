# 호텔관리 우선 개발 실행 규칙

## 소통

- 기본 언어는 한국어입니다.
- 비개발자가 이해할 수 있도록 결론 → 쉬운 설명 → 세부 근거 순서로 보고합니다.
- 검증하지 않은 결과를 완료로 말하지 않습니다.

## 제품 경계

- 초기 제품은 호텔관리입니다.
- 초기 MVP 사용자유형은 사내 임직원, 하우스키핑, 호텔 소유주 세 종류입니다.
- 거래처 임직원, 근태, 휴가, 전자결재, 급여, 게시판, 메신저, PMS·OTA 연동은 승인된 후속 범위 전에는 구현·노출하지 않습니다.
- 호텔 지점 정본과 확장 구조는 승인 PRD를 따릅니다.

## 기존 코드

- 기존 그룹웨어 구현은 archive에서 참고만 합니다.
- 과거 파일을 통째로 복사하거나 기존 미완성 route를 다시 활성화하지 않습니다.
- 재사용 후보는 현재 PRD·보안·UI 기준과 테스트를 통과한 뒤 새 코드로 선별 반영합니다.

## 구현

- 모든 변경은 Red → Green → 사양검토 → 품질검토 순서로 진행합니다.
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
