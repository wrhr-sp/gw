# Cloudflare-first 스켈레톤 사용자 안내

이 문서는 지금 저장소에서 무엇을 볼 수 있는지 빠르게 설명합니다.

## 지금 바로 확인할 수 있는 것

이 스켈레톤에는 아래 항목이 들어 있습니다.

- Web/PWA 시작 화면
- 로그인, 대시보드, 직원, 조직도, 근태, 휴가, 전자결재, 관리자 화면의 기본 경로
- 게시판/문서 1차용 API/shared 계약과 범위 문서
- `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/me` 기본 API
- 회사/직원/부서/역할/권한 조회 API 골격
- Web/API가 같이 보는 공통 계약(`packages/shared`)
- D1 SQL migration 골격(`db/migrations/0001_initial_schema.sql`, `0002_auth_org_phase2.sql`, `0003_attendance_leave_phase3.sql`, `0004_approvals_phase4.sql`)
- 근태/휴가 placeholder API와 승인 경계 검증 흐름
- 전자결재 양식/결재선/기안/문서함/승인함 placeholder API와 `/approvals` 화면
- 게시판/문서 1차 범위를 정리한 `docs/architecture/phase-5-boards-documents-scope.md`

지금 단계의 화면은 실제 업무 데이터를 보여주는 완성본이 아닙니다.
먼저 정보구조와 경로를 고정해 두기 위한 골격입니다.

## 아직 없는 것

아래 항목은 아직 구현하지 않았습니다.

- 실제 로그인 연동
- 실제 회사/직원 데이터 연결
- 근태, 휴가, 결재의 실데이터 저장/정책 계산/실승인 처리
- 파일 업로드
- `/boards`, `/posts/[postId]`, `/documents` 실제 Web 화면
- 게시판/문서용 DB migration (`0005_*`)
- Cloudflare 실배포
- 운영용 D1, R2, KV, Queues 같은 실리소스 연결
- 실제 메일 초대 발송

즉, 지금은 "화면과 계약의 시작점"을 보는 단계라고 이해하면 됩니다.

## 로컬에서 확인하는 방법

먼저 루트 디렉터리에서 패키지를 설치합니다.

```bash
pnpm install
```

화면 골격을 빠르게 보려면:

```bash
pnpm --filter @gw/web dev
```

Cloudflare 호환 프리뷰까지 같이 보려면:

```bash
pnpm --filter @gw/web preview:cf
```

API 헬스 체크와 placeholder 인증 흐름을 보려면 다른 터미널에서:

```bash
pnpm --filter @gw/api dev
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"email":"admin@example.com","password":"placeholder-password"}'
```

정상 응답 예시는 아래와 같습니다.

```json
{
  "ok": true,
  "data": {
    "service": "gw-api",
    "status": "ok",
    "version": "0.1.0"
  },
  "error": null
}
```

## 화면 경로 한눈에 보기

현재 Web 앱에는 아래 경로가 준비되어 있습니다.

- `/`
- `/login`
- `/dashboard`
- `/employees`
- `/org`
- `/attendance`
- `/leave`
- `/approvals`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

## 인증/조직 화면에서 보게 되는 것

지금 단계의 인증/조직 화면은 아래 정도까지만 보여 줍니다.

- `/login`: 예시 이메일/비밀번호와 placeholder 로그인 설명
- `/dashboard`: 세션 상태, 현재 회사, 역할/권한 표시 자리
- `/employees`: 직원 기본 컬럼 예시와 조회 API 연결
- `/org`: 부서/역할/권한 조회 API 연결
- `/admin`: 관리자 초대 payload 와 권한 체크 위치 설명

중요한 점:

- 화면이 있다고 해서 실제 기능이 끝난 것은 아닙니다.
- 메뉴가 보여도 실제 접근 권한은 API에서 다시 검사합니다.
- 예를 들어 `EMPLOYEE` 역할은 현재 placeholder 기준으로 회사 정보만 볼 수 있고, 직원/부서/역할/권한 조회는 403 으로 막혀야 정상입니다.

## 다음 단계에서 기대할 것

다음 구현 단계에서는 보통 아래 순서로 확장합니다.

1. 실제 인증 공급자 연결 검토
2. 회사/직원/조직 데이터 실제 저장소 연결
3. 근태/휴가 API 안정화
4. 전자결재와 게시판/문서 접근 경계 검증 보강
5. 게시판/문서 DB/Web skeleton 추가
6. 파일 저장과 알림 처리 연결
7. Cloudflare 실리소스 연결과 배포 검토

근태/휴가 1차에서 사용자가 보게 될 기본 흐름은 아래입니다.

- `/attendance`: 오늘 출근/퇴근 상태, 근태 기록 목록, 정정 요청 입력 자리
- `/leave`: 휴가 유형, 잔여, 신청 상태, 승인 대기 목록 자리
- 권한이 없는 사용자는 승인 버튼 대신 안내 문구를 보게 됨
- `EMPLOYEE` 는 자기 근태/휴가 흐름만 보는 것이 기본이며, 다른 직원 `employeeId` 나 임의 휴가 request id 를 넣어도 처리되지 않아야 정상입니다.
- `HR_ADMIN`/`MANAGER` 같은 승인자는 팀 대기 요청(`leave_request_team_pending`)만 승인할 수 있고, 자기 own 요청(`leave_request_demo`)은 승인할 수 없습니다.
- 현재 단계에서는 실제 연차 차감/급여 반영이 아니라 placeholder 상태만 확인함

게시판/문서 1차의 현재 상태는 아래처럼 이해하면 됩니다.

- 사용자가 바로 열어볼 `/boards`, `/posts/[postId]`, `/documents` 화면은 아직 없습니다.
- 대신 API 쪽에는 `/api/notices`, `/api/boards`, `/api/boards/:id/posts`, `/api/documents/spaces`, `/api/documents/files`, `/api/read-receipts` 같은 placeholder endpoint 가 먼저 들어와 있습니다.
- 즉, 지금은 "사용자 기능 오픈 전 단계에서 계약과 권한 경계를 맞추는 중" 입니다.
- 다만 최근 검증에서 공지형 게시판 쓰기, 존재하지 않는 문서함 metadata 생성, 임의 게시글 read receipt 생성이 아직 막히지 않는 문제가 확인됐습니다.
- 실제 R2 업로드, production 문서 데이터 반입, 외부 공유 링크, OCR/전자서명 연동은 별도 승인 전까지 하지 않습니다.

전자결재 1차에서 사용자가 보게 될 기본 흐름은 다음과 같습니다.

- `/approvals`: 내 기안함/승인함/참조 문서함 구조를 미리 보는 placeholder 화면
- 결재 양식/결재선/참조자 후보를 불러오는 API 골격은 이미 있지만, 실제 운영 문서를 저장하는 완성 흐름은 아직 아님
- 기안자는 문서 제목, 양식, 결재선, 요약 내용을 입력하는 skeleton 폼을 보게 됨
- 승인자는 승인/반려 버튼과 결재선 상태를 보되, 실제 법적 효력이나 외부 서명 연동은 아직 없음
- 권한이 없는 사용자는 문서 접근 자체가 제한되거나 안내 상태만 보게 됨
- 즉, 지금 단계에서는 실문서 저장·전자서명·외부 알림이 아니라 정보구조와 권한 경계만 먼저 확인함

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/cloudflare-first-phase-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
