# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 자동화 보강분 정리: review-required gate / safe triage / recovery loop

현재 체인:

1. 기획: `t_3cc774a3` — 도담(`gwplanner`) — 완료
2. 구현 정리: `t_f54c6e19` — 이룸(`gwbuilder`) — 완료
3. 리뷰: `t_27995f12` — 바름(`gwreviewer`) — 완료
4. 테스트: `t_cda0641f` — 해봄(`gwtester`) — 진행 중 또는 최근 실행 대상
5. 문서화: `t_3539349e` — 다온(`gwdocs`) — 대기
6. GitHub PR/CI/merge/branch cleanup: `t_d7f30c03` — 지킴(`gwops`) — 대기
7. 최종 통합 보고: `t_3cc826c6` — 싱드(`singde`) — 대기

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
