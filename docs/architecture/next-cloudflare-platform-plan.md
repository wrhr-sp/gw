# OpenNext + Cloudflare 기반 그룹웨어 플랫폼 계획

## 1. 문서 목적

이 문서는 그룹웨어 제품을 Next.js와 Cloudflare 기반으로 설계하기 위한 개발 기준 문서다.

목표는 다음과 같다.

- 프론트엔드, 백엔드, Web API, 웹앱, 모바일앱의 역할을 분리한다.
- Cloudflare 기반 배포/운영 구조를 정리한다.
- 초기 MVP와 확장 단계를 구분한다.
- 유료 리소스, 외부 공개, 비밀값 입력이 필요한 작업은 별도 승인 범위로 분리한다.

## 2. 확정 방향

사용자 승인 기준:

- Web / Frontend: OpenNext on Cloudflare 기반 Next.js Web/PWA
- Backend / API: Cloudflare Workers + Hono 기반 REST API
- DB: Cloudflare D1 우선
- File Storage: Cloudflare R2
- Cache / Session 보조: Workers KV
- 동시성 / 잠금: Durable Objects
- 비동기 작업: Cloudflare Queues
- 예약 작업: Cloudflare Cron Triggers
- Mobile: 1차 Next.js PWA, 2차 Expo / React Native, 같은 Workers API 사용

기본 구조:

```text
Next.js Web App / PWA
→ OpenNext on Cloudflare

Backend / Web API
→ Cloudflare Workers

Database
→ Cloudflare D1

File Storage
→ Cloudflare R2

Cache / Session 보조 / 설정
→ Workers KV

동시성 제어 / 실시간 상태 후보
→ Durable Objects

비동기 작업
→ Cloudflare Queues

예약 작업
→ Cron Triggers

Mobile App
→ 1차 Next.js PWA
→ 2차 Expo / React Native
```

## 3. 범위와 제외 범위

### 현재 저장소에서 완료된 범위

- 아키텍처 문서 작성
- 로컬 monorepo 구조 반영
- OpenNext 기반 Next.js Web/PWA skeleton 반영
- Workers + Hono API skeleton 반영
- shared route/schema 계약 반영
- D1 SQL migration skeleton 반영
- 로컬 개발/검증 명령 정리
- 사용자/운영/개발 가이드 추가
- Phase 5 게시판/문서 1차 범위 문서 추가

### 별도 승인 필요 범위

다음 작업은 실제 외부 리소스 또는 민감정보가 개입되므로 별도 승인을 받아야 한다.

- Cloudflare 계정 연결
- OpenNext/Workers 실제 배포
- D1 연결 생성
- D1 데이터베이스 생성
- R2 버킷 생성
- KV namespace 생성
- Queues 생성
- Durable Objects / Cron 실제 리소스 연결
- 도메인 연결
- 외부 공개 URL 오픈
- API 토큰, 세션, `.env`, 비밀값 입력
- 실사용자 데이터 또는 실급여/실근태 데이터 입력
- 승인된 오케스트레이션 범위 밖의 GitHub merge 또는 branch delete

## 4. 현재 저장소 구조

현재 저장소에는 아래 구조가 실제로 들어 있다.

```text
apps/
  web/                  # Next.js 프론트엔드/PWA 시작점
  api/                  # Cloudflare Workers API 시작점
packages/
  shared/               # 공통 타입, Zod schema, API 계약
db/
  migrations/           # D1 SQL migration
docs/
  architecture/
  guides/
```

현재 구조 기준 원칙:

- 웹과 API를 분리하되, 타입과 API 계약은 `packages/shared`에서 공유한다.
- D1 SQL migration은 코드와 함께 버전 관리한다.
- 실사용자 데이터나 비밀값은 저장소에 두지 않는다.
- Cloudflare 배포 설정은 예시 파일과 실제 파일을 분리한다.
- 다음 구현자는 현재 골격을 확장하되, 로컬 검증 명령을 깨뜨리지 않아야 한다.

## 5. 프론트엔드: Next.js

### 역할

Next.js 앱은 다음 화면을 담당한다.

- 로그인
- 대시보드
- 직원 셀프서비스
- 관리자 콘솔
- 조직/직원 관리
- 근태/휴가
- 전자결재
- 게시판/공지
- 문서/첨부 관리
- 모바일 웹/PWA

### 권장 방식

초기에는 안정성을 위해 다음 방식으로 간다.

```text
Next.js App Router
TypeScript
Tailwind CSS
Server Components는 제한적으로 사용
주요 데이터 변경은 Workers API 호출
```

OpenNext on Cloudflare 배포를 고려해 Next.js 런타임 제약을 초기에 확인한다.

### 초기 라우트

```text
/
/login
/dashboard
/employees
/org
/attendance
/leave
/approvals
/boards
/documents
/admin
/admin/users
/admin/policies
/admin/audit-logs
```

### UX 원칙

- 홈은 “오늘 처리할 일” 중심으로 구성한다.
- 권한별로 메뉴를 다르게 보여준다.
- 모바일에서도 출퇴근, 휴가 신청, 결재 승인을 빠르게 처리할 수 있어야 한다.
- 국내 참고 서비스의 화면/문구/아이콘/색상/레이아웃을 복제하지 않고 자체 디자인 시스템을 사용한다.

## 6. 백엔드 / Web API: Cloudflare Workers

### 역할

Workers는 다음을 담당한다.

- 인증/세션
- 권한 검증
- 회사/사용자/직원 관리
- 조직도
- 근태
- 휴가
- 전자결재
- 게시판
- 파일 권한 검증
- 알림
- 감사 로그
- 관리자 설정

### API 형식

초기에는 REST API를 기본으로 한다.

```text
/api/auth/login
/api/auth/logout
/api/me

/api/companies
/api/employees
/api/departments
/api/roles

/api/attendance/check-in
/api/attendance/check-out
/api/attendance/records
/api/attendance/corrections

/api/leave/types
/api/leave/balances
/api/leave/requests
/api/leave/requests/:id/approve
/api/leave/requests/:id/reject

/api/approvals/forms
/api/approvals/documents
/api/approvals/documents/:id/submit
/api/approvals/documents/:id/approve
/api/approvals/documents/:id/reject

/api/boards
/api/posts
/api/comments

/api/files/upload
/api/files/:id/download

/api/admin/users
/api/admin/policies
/api/audit-logs
```

### API 응답 표준

성공:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

실패:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "권한이 없습니다."
  }
}
```

### API 원칙

- 모든 요청은 인증 상태를 확인한다.
- 모든 변경 요청은 권한을 확인한다.
- 모든 민감 데이터 접근은 감사 로그 후보로 본다.
- 삭제는 기본적으로 soft delete 또는 비활성화를 우선한다.
- 프론트엔드와 모바일앱이 같은 API를 사용하도록 설계한다.

## 7. 데이터베이스: Cloudflare D1

### 초기 후보 테이블

```text
companies
users
employees
departments
positions
roles
permissions
role_permissions
user_roles

attendance_records
attendance_corrections
work_policies

leave_types
leave_balances
leave_requests

approval_forms
approval_documents
approval_lines
approval_actions

boards
posts
comments

files
notifications
audit_logs
settings
```

### 설계 기준

- 모든 핵심 테이블은 `company_id`를 고려한다.
- 직원 기준 데이터 모델을 중심으로 한다.
- 인사/근태/결재/급여 후보 데이터는 이력 보존을 우선한다.
- 수정자, 수정일, 사유, 승인자 정보를 남긴다.
- 급여/노무 확장 영역은 별도 권한과 감사 로그를 필수로 본다.

공통 컬럼 후보:

```text
id
company_id
created_at
updated_at
deleted_at
created_by
updated_by
```

### D1 연결 원칙

- Workers는 D1 바인딩을 통해 Cloudflare D1 데이터베이스에 접근한다.
- 로컬 skeleton 단계에서는 실제 접속정보 없이 `D1_DATABASE_ID`, `D1_DATABASE_NAME` 같은 환경변수 이름만 정의한다.
- 운영 DB 생성, 접속정보 입력, 실제 migration 실행은 별도 승인 범위다.

## 8. 파일 저장: Cloudflare R2

### 사용처

- 게시판 첨부파일
- 전자결재 첨부파일
- 직원 문서
- 계약서/동의서 후보
- 증빙자료

### 원칙

- R2 버킷은 공개하지 않는다.
- 파일 메타데이터는 D1에 저장한다.
- 다운로드는 Workers가 권한을 확인한 뒤 처리한다.
- 민감 문서는 접근 로그를 남긴다.
- 파일 삭제는 보존 정책과 법적 요구를 고려한다.

## 9. KV / Durable Objects / Queues / Cron

### Workers KV

후보 용도:

- 설정 캐시
- 초대 코드
- rate limit 보조 데이터
- 짧은 수명의 UI 설정 캐시

### Durable Objects

후보 용도:

- 회사별 동시성 제어
- 출퇴근 중복 처리 방지
- 실시간 알림/채팅 확장
- 특정 워크플로우 lock 관리

### Queues

후보 용도:

- 이메일/알림 발송
- 파일 후처리
- 월별 리포트 생성
- 급여명세서 생성 후보 작업
- 감사 로그 후처리

### Cron Triggers

후보 용도:

- 매일 근태 마감
- 휴가 잔여 계산
- 월별 리포트 생성
- 예약 알림 발송

## 10. 인증과 권한

### 인증

초기 권장:

```text
이메일 + 비밀번호
HttpOnly Cookie 기반 세션
```

확장 후보:

```text
SSO
OAuth
2FA
모바일 생체 인증
```

### 권한 모델

초기 역할:

```text
SUPER_ADMIN
COMPANY_ADMIN
HR_ADMIN
MANAGER
EMPLOYEE
AUDITOR
```

권한 예시:

```text
employee.read
employee.write
attendance.read
attendance.manage
leave.request
leave.approve
approval.create
approval.approve
board.manage
file.read
audit.read
admin.manage
```

### 보안 원칙

- 프론트엔드 메뉴 숨김만으로 권한을 처리하지 않는다.
- Workers API에서 반드시 서버 측 권한 검증을 수행한다.
- 관리자/인사/급여/감사 로그 화면은 접근권한을 강하게 분리한다.
- 비밀번호, 세션, 토큰, 개인정보는 로그에 남기지 않는다.

## 11. 모바일앱 / 앱 전략

### 1단계: PWA

초기에는 Next.js 앱을 PWA로 확장한다.

주요 기능:

- 모바일 로그인
- 출근/퇴근
- 휴가 신청
- 결재 승인/반려
- 공지 확인
- 알림 확인
- 조직도/직원 검색

장점:

- OpenNext on Cloudflare와 궁합이 좋다.
- 초기 개발 속도가 빠르다.
- 앱스토어 심사 없이 검증할 수 있다.
- 웹과 모바일 UX를 같은 코드 기반으로 관리할 수 있다.

### 2단계: 모바일앱

서비스 안정화 후 다음 방향으로 확장한다.

```text
Expo / React Native
```

선택 기준:

- React/Next.js 개발 자산을 활용하고 같은 Workers API 계약을 재사용하는 방향을 우선한다.
- 1차 목표는 별도 네이티브 기능 확장보다 운영 기능의 모바일 사용성 확보다.

모바일앱은 같은 Workers API를 사용한다.

## 12. 개발 단계

### Phase 1. 기반

- monorepo 구조
- OpenNext 기반 Next.js 앱 skeleton
- Workers + Hono API skeleton
- shared type/schema
- D1 SQL migration skeleton
- 로컬 개발 명령
- health check API

### Phase 2. 인증/조직

상세 범위는 `docs/architecture/phase-2-auth-org-scope.md` 를 기준으로 한다.

- 로그인/로그아웃
- 내 정보
- 회사/부서/직원
- 역할/권한
- 관리자 초대

### Phase 3. 근태/휴가

상세 범위는 `docs/architecture/phase-3-attendance-leave-scope.md` 를 기준으로 한다.

- 출근/퇴근
- 근태 기록
- 근태 수정 요청
- 휴가 유형
- 휴가 신청
- 휴가 승인
- 연차 잔여

### Phase 4. 전자결재

상세 범위는 `docs/architecture/phase-4-approvals-scope.md` 를 기준으로 한다.

- 결재 양식
- 결재선
- 기안
- 승인/반려
- 문서함
- 참조/합의 후보
- 문서 접근 경계
- approval 보고/감시 스크립트 release gate 검토

### Phase 5. 게시판/문서

상세 범위는 `docs/architecture/phase-5-boards-documents-scope.md` 를 기준으로 한다.

- 공지
- 게시판
- 게시글 작성/목록/상세
- 댓글
- 문서함/첨부 metadata
- 읽음 확인
- 회사 scope / 접근 경계 / metadata 보안
- 보고/감시 스크립트 release gate 검토

### Phase 6. 모바일/PWA

- 모바일 최적화
- PWA manifest
- 오프라인 안내
- 모바일 출퇴근 UX
- 모바일 결재 UX

### Phase 7. 급여/노무 확장

초기에는 자동 계산보다 데이터 준비에 집중한다.

- 근태 집계 export
- 급여 기초항목
- 급여 계산용 데이터 검토 화면
- 근로계약/동의서 문서 보관
- 노무 체크리스트

주의:

- 급여, 세금, 4대보험, 퇴직금, 연차 자동 계산은 전문가 검수 전까지 확정 기능으로 다루지 않는다.
- 실제 계산 결과를 법정 신고나 지급에 사용하려면 노무/세무 검수가 필요하다.

## 13. 파이프라인 상태

문서와 로컬 skeleton 기준으로 현재 상태를 정리하면 아래와 같다.

```text
완료
- 아키텍처 방향 확정
- Phase 범위 문서 작성
- Phase 2~4 Web/API/shared/db skeleton 반영
- Phase 5 shared/API 계약 시작점 반영
- 로컬 검증 명령 정리
- 사용자/운영/개발 가이드 정리

보완 필요
- notice-only 게시판 쓰기 차단
- 존재하지 않는 문서함 metadata 생성 차단
- 임의/접근 불가 게시글 read receipt 생성 차단
- Phase 5 DB migration 과 Web placeholder 화면 추가

다음 단계
- Phase 5 guardrail 테스트와 API 보강
- `db/migrations/0005_*` 추가
- `apps/web/app/boards`, `app/posts`, `app/documents` 추가
- Cloudflare 실리소스 연결 검토(승인 후)
```

## 14. 다음 산출물

문서 단계 다음에는 실제 기능 확장이 이어진다.

우선순위는 아래 순서를 권장한다.

```text
1. packages/shared 에 인증/조직 계약 추가
2. apps/api 에 인증/조직/직원 API 추가
3. apps/web 각 섹션을 mock 화면에서 실제 API 호출 구조로 전환
4. db/migrations 에 후속 도메인 테이블 추가
5. 승인 후 Cloudflare 실리소스와 배포 절차 연결
```

현재 즉시 검증 가능한 기준은 아래와 같다.

```text
pnpm check
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
curl http://127.0.0.1:8787/api/health
```

단, Cloudflare 실제 리소스 생성과 배포는 별도 승인 후 진행한다.
