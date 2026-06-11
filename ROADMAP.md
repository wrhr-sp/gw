# ROADMAP

## 현재 단계

현재 저장소는 Preview / MVP skeleton을 쌓는 단계다. 실제 운영 데이터 연결보다 다음 구현자가 이어가기 쉬운 Web/API/shared contract/DB migration/문서 기준을 맞추는 것을 우선한다.
현재 문서화 기준으로는 Phase 13 관리자 콘솔 실사용 1차가 최신 범위이며, Phase 12 대시보드 운영 요약 1차 위에 관리자 진입점과 `/admin/*` 실사용 흐름을 더 구체화하는 방향으로 다음 구현을 이어간다.

## Phase 흐름

- Phase 0: 로컬/저장소/봇 오케스트레이션 기반 정리
- Phase 1: Cloudflare-first monorepo skeleton
- Phase 2: 인증/조직 1차
- Phase 3: 근태/휴가 1차
- Phase 4: 전자결재 1차
- Phase 5: 게시판/문서 1차
- Phase 6: 모바일/PWA 1차
- Phase 7: same-origin API 연결
- Phase 8: R2 문서/첨부 저장소 연결 1차
- Phase 9: 관리자/운영 설정·감사 로그 1차
- Phase 10: 관리자/감사 로그 2차 고도화
- Phase 11: 조직/직원 일반 화면 1차
- Phase 12: 대시보드 운영 요약 1차
- Phase 13: 관리자 콘솔 실사용 1차
- 현재 후속: Phase 13 관리자 콘솔 실사용 1차

## MVP 성공 기준

- 핵심 route와 API skeleton이 같은 contract 기준으로 연결된다.
- 권한 경계와 회사 scope가 테스트로 확인된다.
- 관리자 기능과 일반 업무 기능이 UI/API 모두에서 분리된다.
- PR/CI/merge/Cloudflare 자동 배포 확인까지 Kanban 파이프라인으로 기록된다.

## 상세 로드맵

- 제품 로드맵: `docs/product/groupware-vision-roadmap.md`
- Phase별 범위: `docs/architecture/phase-*-scope.md`
- 현재 기준 범위: `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- 현재 쉬운 handoff: `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- 개발 파이프라인: `docs/workflow/development-pipeline.md`
