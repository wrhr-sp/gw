# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 출퇴근 등록 방식 정책 선택 1차

현재 체인:

1. 기획: `t_a198ff98` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_a00c79c7` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_0ce5e5b5` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: 후속 tester 카드 예정
5. 문서화/GitHub/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 출퇴근 등록 방식 정책 enum 은 `mobile`, `pc`, `tag` 3가지로 고정한다.
- 회사 기본 정책에서 허용한 방식만 admin 정책 화면, 직원 근태 화면, 출근/퇴근 API 에서 같은 기준으로 사용한다.
- 태그 등록은 실제 장비 연동이 아니라 skeleton/안내/검증 지점만 먼저 잡는다.
- GPS/위치정보 강제 수집, 실제 NFC/RFID/QR 장비 연동, production DB 실데이터 변경, 외부 HR 연동은 이번 범위에 넣지 않는다.

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
