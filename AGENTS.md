# 그룹웨어 작업용 Hermes 실행 규칙

이 파일은 Hermes가 그룹웨어 작업 폴더에서 실제로 따라야 하는 실행 규칙이다.
`AI_RULES.md`의 핵심 내용을 실행용으로 요약한 미러 문서다.

## 소통 방식
- 기본 언어는 한국어다.
- 사용자는 비개발자이므로 쉬운 말로 먼저 설명한다.
- 가능하면 `한 줄 요약 -> 쉬운 설명 -> 필요 시 세부 설명` 순서로 답한다.
- Markdown 문서와 보고서는 기본적으로 한글로 작성한다.
- 영어 원문이 필요해도 한국어 설명을 함께 제공한다.
- 딱딱한 명령문보다 자연어 친화적인 대화형 설명을 우선한다.

## 금지 규칙
- 민감정보, 인증정보, 개인정보를 노출하거나 커밋하거나 전송하지 않는다.
- 검증하지 않은 결과를 완료된 것처럼 말하지 않는다.
- 실패한 테스트나 미실행 검증을 통과한 것처럼 보고하지 않는다.
- 없는 파일, 로그, 결과, 근거를 지어내지 않는다.
- 확인하지 않은 내용을 임의로 추측해 사실처럼 말하지 않는다.
- 사용자 승인 없이 파괴적 작업, 대규모 변경, 배포, 외부 전송을 하지 않는다.
- 핵심 구조나 설정을 명시적 승인 없이 임의 변경하지 않는다.

## 작업 원칙
- 기존 구조와 관례를 먼저 존중한다.
- 비사소한 변경에는 검증 근거를 남긴다.
- 사실, 가정, 제안을 구분해서 설명한다.
- 불확실한 정보는 추측으로 메우지 말고, 확인 가능한 것은 도구로 확인한 뒤 설명한다.
- 역할 범위를 넘는 결정은 독단적으로 확정하지 않는다.
- UI/UX, 기능 배치, 정보구조, 근태/휴가/급여/노무/문서/결재 화면을 설계하거나 구현할 때는 `docs/ux/groupware-benchmark-principles.md`, `docs/product/groupware-vision-roadmap.md`, `docs/ux/ui-ux-standardization-backlog.md`를 먼저 참고한다.
- 벤치마크는 국내 그룹웨어/HR/근태/급여/노무 서비스의 공개 페이지와 공개 도움말에서 추출한 일반 패턴만 사용하며, 화면·문구·로고·색상·레이아웃을 복제하지 않는다.

## UI/UX 표준화 강제 규칙
- 앞으로 개발하는 모든 그룹웨어 화면은 `docs/ux/werehere-frontend-ui-standard.md`를 최상위 UI 표준으로 적용한다. 기존 UI 기준과 충돌하면 이 지침을 우선한다.
- 기존 `docs/ux/ui-ux-standardization-backlog.md`는 하위 실행 백로그로만 사용하며, 최상위 기준은 `werehere-frontend-ui-standard.md`다.
- `Input`, `Select`, `DatePicker`, `Button`, `Table` 계열 컴포넌트는 프로젝트에 설치된 UI 라이브러리의 공식 가이드 규격과 `apps/web/design-system/*` 전역 규칙을 우선한다. 임의 크기, 임의 여백, 페이지별 개별 스타일은 새로 만들지 않는다.
- 모든 목록 화면은 `PageHeader → FilterBar → DataTable → Pagination` 패턴을 따른다.
- 모든 상세 화면은 `PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel` 패턴을 따른다. 결재/승인 상세에는 필요 시 `ApprovalLinePanel`을 추가한다.
- 모든 작성 화면은 `PageHeader → FormSection → ActionButtonGroup → ConfirmDialog` 패턴을 따른다.
- 계정관리 화면은 UI 표준의 기준 샘플 화면으로 우선 완성하고, 이후 전자결재·업무관리·문서관리·사업장관리·거래처관리·설정·대시보드 화면에 같은 패턴을 재사용한다.
- 프론트엔드에서는 ZITADEL API를 직접 호출하지 않고 위아히어 백엔드 API만 호출한다.
- 페이지 상단 검색/필터 영역은 Grid 레이아웃으로 구성하고, 필터 박스 높이와 너비가 균등하게 보이도록 공통 grid token 또는 공통 컴포넌트를 사용한다.
- 목록 상단과 상세창 내부의 액션 버튼 묶음은 부모 툴바 컨테이너 안에서 `display: flex`, `align-items: center`, `gap: 8px` 구조를 따른다.
- 콘텐츠 박스, 필터, 폼, 리스트, 버튼 묶음은 8px 단위 격자를 우선하며 기본 간격은 8px, 16px, 24px를 사용한다. `7px`, `13px` 같은 의미 없는 임의 픽셀값은 새 코드에서 금지한다.
- 좌우 스플릿 뷰는 Grid/Flex 기반으로 만들고, `min-width: 0`, `width: 100%`, 고정 높이/overflow 체인을 확인해 브라우저 크기 변화에도 깨지지 않게 한다.
- 기존 코드 리팩토링은 지점관리포털 작업 이후 메일 → 메신저 → 게시판 → 나머지 업무 화면 순서로 기능 단위 PR과 회귀 테스트를 붙여 진행한다.
- `werehere.co.kr` 메일 화면 리팩토링은 `docs/ux/werehere-mail-layout-security-refactor-backlog.md`를 기준으로 하며, 상단 검색 필터·중앙 일괄 처리 바·우측 메일 상세창 툴바는 설치된 UI 라이브러리의 Flex/Grid 공식 패턴 또는 공통 래퍼로 수평 기준선을 맞춘다.

## 보안·환경변수 분리 강제 규칙
- SMTP host/user/password/token, 외부 API key/secret, provider access/refresh token, DNS 인증 private key, `.env`/`.secrets` 내용은 프론트엔드 source/bundle/log/문서/보고에 노출하지 않는다.
- 프론트엔드는 메일 작성 데이터, 수신자, 첨부 id 같은 업무 데이터만 내부 API로 전달하고 UI 렌더링만 담당한다.
- SMTP/API provider 설정과 인증정보는 백엔드 서버 내부 환경 변수 또는 승인된 secret store에서만 읽는다.
- provider 미설정 상태에서는 성공처럼 보이는 fallback 응답을 반환하지 말고, 명확한 오류 코드와 발송 로그로 안전 실패해야 한다.
- 실제 SMTP/API secret 등록, DNS/SPF/DKIM/DMARC 변경, production DB 실데이터 변경, 유료 provider 가입, 실제 외부 메일 발송 검증은 별도 승인 게이트로 둔다.

## 운영 기능 완료 기준 / no-mock 원칙
- 완료 기능은 Production-ready (실구현) 기준만 허용한다. 화면 → 실제 API → Service/Repository → DB 저장·조회 → 권한·검증·예외·감사로그 확인 흐름이 이어져야 한다.
- 새 구현에서 mock, setTimeout, in-memory fallback, static sample 병합, Production-ready (실구현) 표지만 붙인 미가동 코드는 금지한다.
- 사용자가 누를 수 있는 저장·수정·삭제·신청·승인·반려·제출·임시저장·정정 요청 버튼은 실제 API 호출로 연결되어야 하며, 범위 밖 동작은 비활성 또는 명시적 오류 상태로 둔다.
- API route는 DB/R2/schema가 준비되지 않았으면 `DB_NOT_CONFIGURED`, schema drift, forbidden, not found, validation error 등으로 실패해야 하며 성공처럼 보이는 대체 응답을 반환하지 않는다.
- production DB 실데이터, secret, DNS/custom domain, 유료 리소스, 외부 HR/메일/메신저/푸시/SMS 연동, destructive migration은 계속 별도 승인 게이트로 둔다.
