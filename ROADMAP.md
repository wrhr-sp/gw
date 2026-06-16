# ROADMAP

## 현재 단계

현재 저장소는 Preview / MVP skeleton을 실사용 전환 가능한 UAT 단계로 끌어올리는 중이다. 실제 운영 데이터 연결보다 먼저, 대장이 배포 URL에서 로그인하고 주요 업무 흐름을 직접 눌러볼 수 있게 Web/API/shared contract/권한/문서 기준을 맞추는 것을 우선한다.
현재 문서화 기준 최신 범위는 Phase 41 게시판·공지·문서·결재 일상업무 도입완성 fit-gap 정리다. 직전 Phase 40에서 `/uat` 실행 패키지, 역할별 UAT 레인, blocker/major/minor/approval-needed 분류, 교육자료 초안, 최종 보고 형식을 먼저 정리했다. 이제는 그 위에서 `/dashboard` 기준 오늘 할 협업 업무, `/approvals` 승인 대기, `/boards` 공지/일반 게시판, `/posts/[postId]` 댓글/읽음/forged 차단, `/documents` 문서 metadata/읽음/space 권한 경계, `/admin/policies`·`/admin/audit-logs` 운영 검토 레인을 같은 일상업무 도입 언어로 다시 묶는 것이 다음 우선순위다.

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
- Phase 29: 법무 관리 1차
- Phase 30: 통합 대시보드·알림·감사 로그 강화
- Phase 31: 홈·로그인·경영업무·계정관리 실사용화
- Phase 32: 게시판·공지·댓글·문서함 실사용화
- Phase 33: 근태·휴가·전자결재 실사용화
- Phase 34: 인사·지점·알림·감사 운영흐름 실사용화
- Phase 35: 급여·세무·노무·법무·컴플라이언스 관리자흐름 UAT
- Phase 36: 운영자 설정·회사정책·권한관리 fit-gap
- Phase 37: 내부 운영 저장흐름·감사 연결 fit-gap
- Phase 38: 모바일·PC 현장 업무 사용성·알림·오프라인 fit-gap
- Phase 39: 운영 QA·보안·감사·권한 회귀 안정화 fit-gap
- Phase 40: 내부 도입 리허설·관리자/직원 UAT 패키지 fit-gap
- Phase 41: 게시판·공지·문서·결재 일상업무 도입완성 fit-gap

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
- 현재 기준 범위: `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`
- 현재 쉬운 handoff: `docs/guides/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-handoff.md`
- 직전 범위: `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`
- 직전 handoff: `docs/guides/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-handoff.md`
- 개발 파이프라인: `docs/workflow/development-pipeline.md`
