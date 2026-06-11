# VISION

## 한 줄 비전

한국형 중소·중견 조직이 출근, 휴가, 결재, 공지, 문서, 조직/직원 업무를 한 흐름에서 처리할 수 있는 Cloudflare-first 그룹웨어를 만든다.

## 제품 목적

- 일반 직원은 오늘 해야 할 일을 빠르게 끝낸다.
- 팀장/승인자는 승인 대기와 예외를 병목 없이 처리한다.
- 인사/총무/관리자는 조직, 권한, 정책, 감사 로그를 안전하게 관리한다.
- 대표/임원은 조직 운영 상태를 한눈에 본다.

## 핵심 원칙

- 기능 목록보다 업무 흐름을 먼저 설계한다.
- `/org`, `/employees` 일반 업무 화면과 `/admin/*` 관리자 화면을 분리한다.
- Web/PWA는 same-origin API 원칙을 우선한다.
- Cloudflare-first 구조를 유지한다: OpenNext on Cloudflare, Workers/Hono API, D1, R2, KV, Durable Objects, Queues, Cron.
- 국내 그룹웨어/HR/근태/급여/노무 공개 자료는 일반 패턴만 참고하고 화면, 문구, 로고, 색상, 레이아웃은 복제하지 않는다.
- secret, production DB 실데이터, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동은 별도 승인 전 진행하지 않는다.

## 상세 기준 문서

- 제품 비전/로드맵: `docs/product/groupware-vision-roadmap.md`
- UX 벤치마크 원칙: `docs/ux/groupware-benchmark-principles.md`
- Cloudflare 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`
