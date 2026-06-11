# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 12 대시보드 운영 요약 1차

현재 체인:

1. 테스트/재검증: `t_5d8e77f7` — 해봄(`gwtester`) — 완료
2. 문서화: `t_2be82b19` — 다온(`gwdocs`) — 진행 중
3. GitHub PR/CI/merge/branch cleanup: `t_34d61956` — 지킴(`gwops`) — 대기
4. 최종 통합 보고: `t_0ffbfeff` — 싱드(`singde`) — 대기

현재 문서 기준 핵심 범위:

- `/dashboard` 를 오늘 할 일, 승인 대기, 근태/휴가 상태, 공지/문서 진입점, 운영 요약 5개 카드 묶음 중심으로 다시 정리한다.
- 일반 사용자에게 관리자 진입 CTA 를 기본 노출하지 않고, `/admin/*` 및 `/api/admin/*` 권한 guard 를 유지한다.
- 실제 개인정보 원문, production DB 실데이터, 실제 알림 발송, 외부 HR 연동은 이번 범위에 넣지 않는다.

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
