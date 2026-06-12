# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Admin host 분리 + PWA 웹앱 1차

현재 체인:

1. 기획: `t_d3dc8da1` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_7f54f610` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_cc1ee8db` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_9cf618ec` — 해봄(`gwtester`) — parent gate 대기
5. 문서화/GitHub/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 일반 사용자 웹과 관리자 웹은 `route` 뿐 아니라 `host + route` 기준으로 분리한다.
- production admin host 후보는 `admin.<승인된-domain>` 이지만 실제 DNS/custom domain 연결은 별도 승인 범위다.
- preview admin host 후보는 별도 `.workers.dev` admin host 이고, localhost/dev 에서는 `admin.localhost` 또는 host header override 를 허용한다.
- 일반 사용자 host 에서는 `/admin*` 를 그대로 렌더링하지 않고 숨김/redirect/차단 중 하나로 처리한다.
- 관리자 host 에서는 `/admin` 을 landing 으로 쓰고 관리자 전용 PWA manifest(`start_url: /admin`, `scope: /admin`)를 제공한다.
- secret, production DB 실데이터, DNS/custom domain, 유료 리소스, 실제 운영 사용자/권한 변경은 이번 범위에 넣지 않는다.

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
