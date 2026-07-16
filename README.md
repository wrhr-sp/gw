# WEREHERE Hotel Operations Platform

위아히어 호텔 운영 프로그램을 우선 구축하고, 운영 안정화 이후 일반 그룹웨어로 확장하는 새 제품 개발선입니다.

## 현재 상태

- 호텔관리 초기 MVP PRD: 사용자 승인
- UI 디자인 시스템: 사용자 승인
- 기존 그룹웨어 구현: archive branch·tag·Git bundle로 별도 보존
- 신규 계약·UI·API·Web·PostgreSQL 기반: 구현 및 로컬 검증 진행 중
- Production 배포: 미진행

## 제품 원칙

1. 호텔관리 운영 흐름을 실제 Web UI → API → Service/Repository → PostgreSQL → 권한·감사까지 완성합니다.
2. 기존 그룹웨어 코드는 새 개발선에 자동 복사하지 않습니다. 향후 기능 확장 시 구조와 경험만 참고합니다.
3. mock, placeholder, in-memory 성공, 성공처럼 보이는 fallback을 만들지 않습니다.
4. 인증은 ZITADEL, 업무 사용자·회사·호텔·권한·자료는 PostgreSQL이 담당합니다.
5. 비공개 파일은 R2에 저장하고 서버 권한검사를 통과한 요청만 조회·다운로드합니다.
6. Preview에서 실제 저장·재조회·권한차단을 검증하기 전에는 Production에 배포하지 않습니다.

## 승인 문서

- [호텔관리 PRD](./docs/product/prd/hotel-management/README.md)
- [호텔관리 UI 디자인 시스템](./docs/design/hotel-ui/README.md)
- [호텔관리 플랫폼 기반 아키텍처](./docs/architecture/hotel-platform-foundation.md)

## 현재 구조

```text
apps/
  web/          호텔관리 Web
  api/          Hono API
packages/
  contracts/    API·도메인 계약
  ui/           위아히어 UI 시스템
  db/           PostgreSQL client·migration·실DB 테스트
docs/
  product/      승인 PRD
  design/       승인 UI 기준
  architecture/ 보안·데이터·배포 설계
```

`pnpm run check`, `pnpm run build`, `pnpm run test:integration`을 기본 로컬 게이트로 사용합니다.
