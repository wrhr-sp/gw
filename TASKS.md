# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 출퇴근 정책 적용대상/우선순위 2차

현재 체인:

1. 기획: `t_8fc803c6` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_7f611516` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_9db99154` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_cdfb2bf5` — 해봄(`gwtester`) — parent gate 대기
5. 문서화/GitHub/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 출퇴근 등록 방식 enum 은 계속 `mobile`, `pc`, `tag` 3가지로 고정한다.
- 정책 적용대상 level 은 `company_default`, `workplace`, `department`, `job_type` 4단계만 공식 지원한다.
- 우선순위는 `회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할` 로 고정한다.
- 각 단계는 allowed methods 를 부분 병합하지 않고 전체 override 로 덮는다.
- 직원 화면과 출근/퇴근 API 는 같은 `effective policy` 계산 기준을 사용한다.
- 개인 override, GPS/위치정보 강제 수집, 실제 NFC/RFID/QR 장비 연동, production DB 실데이터 변경, 외부 HR 연동은 이번 범위에 넣지 않는다.

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
