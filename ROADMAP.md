# ROADMAP

## 현재 단계

현재 저장소는 Preview / MVP skeleton을 쌓는 단계다. 실제 운영 데이터 연결보다 다음 구현자가 이어가기 쉬운 Web/API/shared contract/DB migration/문서 기준을 맞추는 것을 우선한다.
현재 문서화 기준으로는 Phase 28 세무 관리 1차가 최신 범위이며, Phase 25 공통 업무 엔진 위에 지점별 세무 증빙 요청·제출·마감·검토 skeleton 을 `tax` 모듈로 얹는 작업을 이어간다. 바로 앞 선행 Phase 28A에서는 급여를 독립 `payroll` 모듈로 분리했고, 이번 Phase 28은 다시 공통 `work item` 기반 세무 흐름을 확장하는 단계다.

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
- Phase 14: 실사용 MVP 통합 1차
- Phase 15: 운영 데이터·정책·감사 로그 연결 1차
- Phase 16: 파일·문서·공지·검증 안정화 및 파일럿 초안
- Phase 17: 네이티브 모바일앱 전환 준비
- Phase 18: 네이티브 모바일앱 핵심 업무 연결 1차
- Phase 19: 네이티브 모바일앱 내부 시범 운영 초안
- Phase 20: 운영 전 정리 1차
- Phase 21: 실제 회사 설정 모델 1차
- Phase 22: 실제 업무 흐름 통합 1차
- Phase 23: 관리자 운영 콘솔 실사용 1차
- Phase 24: 회사 파일럿 운영 1차
- Phase 25: 공통 업무·문서·마감·권한 엔진 1차
- Phase 26: HR·미팅 관리 1차
- Phase 27: 노무 관리 1차
- Phase 28A: 급여 foundation / payslip 1차
- Phase 28: 세무 관리 1차

## MVP 성공 기준

- 핵심 route와 API skeleton이 같은 contract 기준으로 연결된다.
- 권한 경계와 회사 scope가 테스트로 확인된다.
- 관리자 기능과 일반 업무 기능이 UI/API 모두에서 분리된다.
- PR/CI/merge/Cloudflare 자동 배포 확인까지 Kanban 파이프라인으로 기록된다.
- 모바일/PWA 이후 네이티브 앱으로 넘어갈 때도 shared contract, auth/session 경계, 승인 게이트가 흔들리지 않는다.
- 네이티브 모바일앱 초안에서도 로그인 이후 핵심 업무 흐름과 상태 안내가 한 번에 따라가진다.
- 운영 전 점검 기준에서 되는 것 / 아직 skeleton 인 것 / 별도 승인 필요 항목이 한 번에 구분된다.

## 상세 로드맵

- 제품 로드맵: `docs/product/groupware-vision-roadmap.md`
- Phase별 범위: `docs/architecture/phase-*-scope.md`
- 현재 기준 범위: `docs/architecture/phase-28-tax-management-pass-1-scope.md`
- 현재 쉬운 handoff: `docs/guides/phase-28-tax-management-pass-1-handoff.md`
- 개발 파이프라인: `docs/workflow/development-pipeline.md`
