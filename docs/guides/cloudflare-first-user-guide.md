# Cloudflare-first 스켈레톤 사용자 안내

이 문서는 지금 저장소에서 무엇을 볼 수 있는지 빠르게 설명합니다.

## 지금 바로 확인할 수 있는 것

이 스켈레톤에는 아래 항목이 들어 있습니다.

- Web/PWA 시작 화면
- 로그인, 대시보드, 직원, 조직도, 근태, 휴가, 전자결재, 게시판, 문서, 관리자 화면의 기본 경로
- `/api/health` 헬스 체크 API
- Web/API가 같이 보는 공통 계약(`packages/shared`)
- D1 SQL migration 골격(`db/migrations/0001_initial_schema.sql`)

지금 단계의 화면은 실제 업무 데이터를 보여주는 완성본이 아닙니다.
먼저 정보구조와 경로를 고정해 두기 위한 골격입니다.

## 아직 없는 것

아래 항목은 아직 구현하지 않았습니다.

- 실제 로그인
- 실제 회사/직원 데이터 조회
- 근태, 휴가, 결재의 저장/승인 처리
- 파일 업로드
- Cloudflare 실배포
- 운영용 D1, R2, KV, Queues 같은 실리소스 연결

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

API 헬스 체크를 보려면 다른 터미널에서:

```bash
pnpm --filter @gw/api dev
curl http://127.0.0.1:8787/api/health
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
- `/boards`
- `/documents`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

## 다음 단계에서 기대할 것

다음 구현 단계에서는 보통 아래 순서로 확장합니다.

1. 인증과 세션 연결
2. 회사/직원/조직 데이터 모델 확장
3. 근태/휴가/결재 API 추가
4. 파일 저장과 알림 처리 연결
5. Cloudflare 실리소스 연결과 배포 검토

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/cloudflare-first-phase-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
