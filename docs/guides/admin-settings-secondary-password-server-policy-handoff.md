# 관리자설정 2차 비밀번호 서버 검증 handoff

## 한 줄 요약

현재 프론트 미리보기용 2차 비밀번호를 실제 운영 기능으로 바꾸려면, 화면 state 비교를 버리고 서버 해시 저장 + 짧은 재인증 세션 + 보호 API 재검증 구조로 바꿔야 합니다.

## 먼저 볼 파일

1. `docs/architecture/admin-settings-secondary-password-server-policy.md`
2. `docs/guides/unified-settings-secondary-password-preview-flow.md`
3. `apps/web/app/_components/mobile-app-shell.tsx`
4. `apps/web/mobile-app-shell-admin-boundary.test.tsx`
5. `packages/shared/src/contracts.ts`
6. `apps/api/src/app.ts`
7. `apps/api/test/auth-org.spec.ts`

## 지금 확인한 현재 상태

- 현재 2차 비밀번호는 `mobile-app-shell.tsx` 내부 state 로만 관리됩니다.
- `secondaryPasswordValue` 평문이 화면 메모리에 남아 있습니다.
- `handleAdminAccessSubmit()` 가 로컬 값 비교로만 관리자설정 잠금을 풉니다.
- 설정 관련 진입점은 같은 2차 비밀번호 게이트를 먼저 쓰고, 통합설정은 인증 후에도 항상 `기본 설정` 탭부터 엽니다.
- 2차 비밀번호 변경 버튼은 관리자설정 우상단이 아니라 `내정보 설정` 안에 있습니다.
- 게이트/설정/변경 팝업은 모두 같은 4칸 네모형 PIN UI를 씁니다.
- 새로고침/다른 기기/다른 세션 기준 영속 저장이 없습니다.
- 실패 제한, 잠금, 감사 로그, 서버 verify session 이 없습니다.

## 이번 설계에서 이미 정리한 권장 결정

1. 대상 사용자
- 관리자설정 capability 가 있는 사용자만 우선 적용

2. 적용 범위
- 현재 preview UX 는 설정 관련 진입점 공통 게이트 기준
- 운영 버전 보안 범위는 관리자설정/고위험 변경 액션 중심으로 별도 승인 후 좁혀서 고정 권장

3. 저장/검증
- 평문 저장 금지
- `argon2id` 해시 저장 권장
- verify 성공 시 짧은 재인증 세션 발급
- 보호 API 도 서버에서 다시 확인

4. 잠금 정책
- 연속 실패 5회면 15분 잠금 권장

5. 분실 처리
- 자동 self-service 보다 운영자 승인형 초기화 우선 권장

## 구현자가 바로 가져갈 acceptance 초안

### 서버 구현 acceptance
- 사용자별 2차 비밀번호 해시 저장 가능
- verify 성공 시 재인증 세션 발급 가능
- verify 실패 시 실패 횟수 누적
- 잠금 중 verify 차단 가능
- reset_required 상태 지원
- 고위험 변경 API 에 freshness 체크 추가 가능
- 감사 로그 이벤트 코드 기록 가능

### 웹 구현 acceptance
- 새로고침 후에도 등록/미등록/잠금 상태가 서버 기준으로 일관됨
- 더 이상 평문 2차 비밀번호를 프론트 state 에 운영 기준 값으로 오래 들고 있지 않음
- 통합설정은 항상 `기본 설정` 탭부터 열리고, 관리자설정 우상단에는 변경 버튼이 남지 않음
- `내정보 설정` 안에 `2차 비밀번호 변경하기` 버튼이 자연스럽게 배치됨
- 게이트/설정/변경 팝업이 같은 4칸 PIN UI와 오류 문구 위치를 유지함
- 잠금/오류/재확인/미등록 상태 문구가 서로 다르게 보임

### 테스트 acceptance
- 등록 성공
- 검증 성공
- 잘못된 PIN 실패
- 5회 실패 잠금
- 잠금 해제 후 성공
- 변경 성공
- reset_required 상태에서 등록 강제
- 보호 API 재확인 실패 시 차단
- 역할/회사 범위 우회 불가

## 승인 안 나면 구현하지 말아야 할 것

- 실제 DB migration 생성/적용
- production DB 데이터 변경
- pepper secret 주입
- 운영자 강제 초기화 실제 사용
- 분실 복구 운영 프로세스 확정
- production rollout

## 추천 작업 순서

1. 승인 게이트 카드 처리
2. 서버 모델/API/guard 구현
3. 웹 게이트 연동 교체
4. 보안 리뷰
5. 테스트
6. 운영/사용자 문서화

## 후속 카드 연결 원칙

- 리뷰는 서버 구현 + 웹 연동 완료 후
- 테스트는 리뷰 완료 후
- 문서화는 테스트 근거 확인 후
- production migration/secret/배포는 별도 승인 카드로 분리
