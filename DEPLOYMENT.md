# DEPLOYMENT

## 배포 구조

그룹웨어 Web은 GitHub Actions `release-gate` workflow를 통해 Cloudflare Workers preview/production 배포를 분리한다.

Workflow 파일:

- `.github/workflows/release-gate.yml`

동작:

- PR: `baseline`, `cloudflare-build`, `cloudflare-preview-deploy` 실행
- main push/merge: `baseline`, `cloudflare-build`, `cloudflare-preview-deploy` 실행
- production 배포: `workflow_dispatch` 수동 실행 + `DEPLOY_PRODUCTION` 확인 입력 후 `cloudflare-production-deploy` 실행

배포 명령:

```bash
pnpm --filter @gw/web deploy:cf:preview
pnpm --filter @gw/web deploy:cf:production
```

## 현재 preview / production URL

```text
Preview: https://gw-web-preview.wereheresp.workers.dev
Production: https://werehere.co.kr
```

## Preview / production 도메인 정책

- `https://gw-web-preview.wereheresp.workers.dev` 는 preview/UAT 정책 적용 도메인이다.
- `https://werehere.co.kr` 는 production 정책 적용 도메인이다.
- Worker 런타임은 요청 Host 기준으로 DB secret을 분리한다.
  - `gw-web-preview.wereheresp.workers.dev` → `DATABASE_URL_PREVIEW`
  - `werehere.co.kr` / `www.werehere.co.kr` → `DATABASE_URL_PRODUCTION`
- production custom domain은 preview `DATABASE_URL`로 fallback하지 않아야 한다. production secret이 없으면 명시적으로 DB 미설정 오류가 나야 한다.
- production 코드 배포는 main merge만으로 자동 실행하지 않는다. preview 확인 후 대장 승인으로 수동 production dispatch를 실행한다.

운영 기준선 메모:

- 현재 공개 확인 기준은 preview URL + `/api/health` + `/api/db/health` + release-gate 기록이다.
- 별도 관제 dashboard, alerting, paging, backup automation 이 이미 있는 것으로 간주하지 않는다.
- `https://gw-web.werehere31.workers.dev` 는 과거 preview 흔적이므로 현재 smoke 대상 live URL 로 사용하지 않는다.

기본 smoke route:

- `/`
- `/login`
- `/dashboard`
- `/menu`
- `/admin/users`

이전 URL 메모:

- 이전 preview URL `https://gw-web.werehere31.workers.dev` 는 과거 계정/과거 주소이며 현재는 HTTP 404 입니다.

## 배포 승인 기준

- 현재 대장이 명시한 진행 작업은 preview 배포 확인까지 자동 진행한다.
- production 배포는 preview 확인 후 대장 명시 승인으로만 진행한다.
- 작업 완료 후 별도 수정/후속 변경은 production 배포 전 다시 승인받는다.
- secret 입력/교체, production DB 실데이터, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동은 항상 별도 승인 대상이다.

## 배포 전 확인

- PR 최신 head 기준 CI success
- `pnpm check` 또는 범위별 test/typecheck/build 통과
- secret/개인정보가 diff에 없음
- Cloudflare build success

## 배포 후 확인

```bash
gh run list --workflow release-gate --branch main --limit 5
curl -I https://gw-web-preview.wereheresp.workers.dev/
curl https://gw-web-preview.wereheresp.workers.dev/api/db/health
```

필요 시 route별 상태 코드를 확인한다.

## 롤백 원칙

- 우선 GitHub에서 이전 정상 commit/PR을 확인한다.
- 긴급 수정은 별도 hotfix 카드로 기획→수정→리뷰→테스트→PR/merge→배포 확인 순서를 따른다.
- production DB/실데이터 롤백은 현재 범위 밖이며 별도 승인 없이는 진행하지 않는다.

## no-mock 배포 전 확인

- 운영 기능이라고 표기한 변경에 mock/fake success/in-memory fallback/static sample 병합이 남아 있지 않은지 확인한다.
- 상태 변경 버튼은 실제 API 호출 또는 명확한 비활성/승인 필요 상태인지 확인한다.
- production DB 실데이터, secret, DNS/custom domain, 유료 리소스, 외부 연동, destructive migration은 자동 배포 승인 범위가 아니며 별도 승인 게이트로 둔다.
