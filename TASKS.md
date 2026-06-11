# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 13 관리자 콘솔 실사용 1차

현재 체인:

1. 테스트/재검증: `t_52705294` — 해봄(`gwtester`) — 완료
2. 문서화: `t_0132d8f4` — 다온(`gwdocs`) — 진행 중
3. GitHub PR/CI/merge/branch cleanup: `t_3ea4d00e` — 지킴(`gwops`) — 대기
4. 최종 통합 보고: `t_0ffbfeff` — 싱드(`singde`) — parent gate 이후 진행

현재 문서 기준 핵심 범위:

- 관리자 진입 CTA 는 권한 있는 role 에게만 보이고, 일반 사용자 기본 흐름에는 섞지 않는다.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 운영자 실사용 순서로 더 읽히게 정리한다.
- 감사 전용 사용자는 `/admin/audit-logs` 읽기 흐름만 유지하고, UI 숨김과 별개로 `/admin/*` 및 `/api/admin/*` guard 를 계속 유지한다.
- 실제 개인정보 원문, production DB 실데이터, 실제 운영 권한 저장/변경, 외부 HR 연동은 이번 범위에 넣지 않는다.

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
