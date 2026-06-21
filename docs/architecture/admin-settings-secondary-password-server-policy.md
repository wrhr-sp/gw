# 관리자설정 2차 비밀번호 서버 검증/운영 정책 초안

## 1. 이 문서의 목적

이 문서는 현재 프론트 화면 상태로만 동작하는 관리자설정 2차 비밀번호 미리보기를, 실제 운영 가능한 서버/API 기준 정책으로 바꾸기 전에 범위를 먼저 고정하기 위한 설계 초안입니다.

이번 문서에서 하는 일:
- 현재 미리보기의 한계 정리
- 실제 운영 시 필요한 요구사항 정리
- 권장 데이터 모델 초안 제안
- API 초안 제안
- 실패 횟수 제한, 재인증 유지 시간, 감사 로그, 분실/초기화 흐름 제안
- 구현 전에 꼭 따로 승인받아야 할 항목 분리
- 후속 구현 카드를 어떤 순서로 나눌지 제안

이번 문서에서 하지 않는 일:
- 실제 secret 생성/입력/교체
- production DB 변경
- migration 적용
- 실사용 사용자 데이터 변경
- 배포 실행

## 2. 현재 상태 요약

현재 웹 구현은 `apps/web/app/_components/mobile-app-shell.tsx` 안에서만 2차 비밀번호를 관리합니다.

확인한 현재 동작:
- `buildInitialSecondaryPasswordState()` 기본값은 `hasSecondaryPassword=false`, `secondaryPasswordValue=""` 입니다.
- `resolveSecondaryPasswordSave(...)` 는 현재 화면 state 안에서만 4자리 값을 검증하고 저장합니다.
- `handleAdminAccessSubmit()` 는 입력한 `adminAccessPin` 과 현재 화면 메모리의 `secondaryPasswordValue` 를 직접 비교합니다.
- 비밀번호가 없으면 "이번 미리보기에서는 서버 저장 없이 화면 상태로만 2차 비밀번호를 설정합니다." 라는 문구가 표시됩니다.
- 설정 관련 진입점은 `requiresSettingsGate && !isAdminSettingsUnlocked` 조건으로 같은 게이트를 씁니다.
- 게이트/설정/변경 팝업은 모두 같은 `PinField` 4칸 네모형 PIN UI를 씁니다.
- 통합설정은 인증 후에도 항상 `기본 설정` 탭부터 열리고, 2차 비밀번호 변경 버튼은 관리자설정 우상단이 아니라 `내정보 설정` 안에 있습니다.

즉, 지금은 아래 문제가 있습니다.
- 새로고침하면 상태가 사라집니다.
- 서버/API 기준 검증이 없습니다.
- 사용자별 영속 저장이 없습니다.
- 해시 저장, 실패 횟수 제한, 잠금, 감사 로그가 없습니다.
- 프론트 코드 안에 비교 로직이 남아 있어 운영 보안 경계로 보기 어렵습니다.

## 3. 설계 목표

### 3-1. 최종 목표

관리자설정 권한이 있는 사용자가 관리자설정에 들어가거나 고위험 설정 변경을 실행하기 전에, 서버가 관리하는 사용자별 2차 비밀번호를 다시 확인하게 만듭니다.

### 3-2. 이번 1차 운영 범위

이번 1차 운영 범위는 아래까지만 권장합니다.
- 사용자별 2차 비밀번호 등록
- 사용자별 2차 비밀번호 변경
- 관리자설정 진입 전 2차 비밀번호 검증
- 짧은 재인증 유지 시간 관리
- 실패 횟수 제한과 임시 잠금
- 감사 로그 남기기
- 관리자 또는 승인된 운영자에 의한 초기화

이번 1차에서 열지 않는 것이 안전한 항목:
- SMS/이메일/외부 본인인증 기반 자동 분실 복구
- 여러 기기/채널 연계 복구
- 실시간 푸시 기반 추가인증
- 2차 비밀번호를 다른 민감 기능 전체로 무제한 확대 적용

## 4. 권장 제품 규칙

### 4-1. 누가 대상인가

기본 대상:
- `COMPANY_ADMIN`
- `HR_ADMIN`
- 앞으로 `/admin/*` 또는 동급 운영 설정 변경 capability 를 가진 사용자

비대상:
- 일반 직원의 일반 업무 화면
- 단순 공지/알림 읽기
- 직원 본인용 읽기 중심 `내 정보` 조회

현재 미리보기 기준:
- 설정 관련 진입점은 먼저 같은 2차 비밀번호 게이트를 통과합니다.
- 통합설정 안에서는 `기본 설정` 탭이 첫 화면이고, 관리자 계정이어도 처음부터 `관리자설정` 탭을 열지 않습니다.
- 2차 비밀번호 변경 버튼은 관리자설정 우상단이 아니라 `내정보 설정` 안의 계정/보안 성격 위치에 둡니다.

운영 버전 권장 결정:
- 실제 서버/API/DB 기반 운영 버전에서는 "모든 개인 설정"과 "고위험 운영 설정"을 같은 강도로 잠글지 다시 좁혀서 결정하는 것이 자연스럽습니다.
- 즉, 현재 preview UX 는 설정 관련 진입점 공통 게이트로 맞추되, 운영 보안 범위는 관리자 권한/운영 설정 또는 2차 비밀번호 자체 변경 화면 중심으로 별도 승인 후 고정하는 쪽을 권장합니다.

이유:
- UX 원칙상 관리자 기능과 일반 사용자 기능을 섞지 않는 편이 맞습니다.
- 모든 프로필 설정을 같은 강도로 잠그면 사용성이 과하게 나빠질 수 있습니다.
- 실제 보안이 필요한 것은 운영 설정, 권한 변경, 정책 반영, 감사 관련 고위험 액션입니다.

### 4-2. 무엇을 보호할 것인가

1차 보호 대상 화면/액션 권장안:
- `/admin` 허브 안의 실제 변경 액션
- `/admin/users` 의 역할 변경, 비활성, 비밀번호 초기화 같은 고위험 변경
- `/admin/policies` 의 정책 저장/발행/우선순위 변경
- 향후 관리자설정 전용 화면에서의 운영 설정 변경
- 2차 비밀번호 등록/변경/초기화 실행

읽기 전용은 더 약하게 볼 수 있습니다.
- `/admin/audit-logs` 읽기만 있는 감사 화면은 역할/capability guard 를 기본 보안 경계로 유지
- 다만 CSV export, 외부 전달, 대량 다운로드가 붙는 순간 다시 2차 비밀번호 재확인을 권장

## 5. 권장 인증/세션 정책

### 5-1. 저장 방식

권장안:
- 원문 저장 금지
- `argon2id` 해시 저장 권장
- 레코드별 salt 사용
- 선택적으로 서버 측 pepper 사용

저장 금지:
- 프론트 코드 하드코딩
- localStorage/sessionStorage 영구 저장
- 평문 로그 출력
- 감사 로그에 원문/부분 원문 남기기

### 5-2. 검증 방식

권장안:
- 사용자가 4자리 숫자를 입력하면 서버에서 해시 비교
- 성공 시 짧은 수명의 "관리자설정 재인증 세션" 생성
- 이후 보호된 API 는 이 재인증 세션이 살아 있는지 서버에서 다시 확인

중요:
- UI 에서 한 번 풀렸다고 끝내지 말고, 실제 변경 API 도 다시 서버에서 확인해야 합니다.
- "버튼이 보인다"와 "변경이 허용된다"를 같은 뜻으로 취급하면 안 됩니다.

### 5-3. 재인증 유지 시간

권장 기본값:
- 관리자설정 진입 재인증 유지: 15분
- 고위험 변경 직전 재확인 필요 기준: 마지막 검증 후 5분 초과 시 재확인

고위험 변경 예시:
- 사용자 역할/권한 변경
- 사용자 비활성/초기화
- 정책 저장/배포
- 감사 로그 export
- 향후 secret 참조가 붙는 운영 액션

정리:
- 읽기/탐색은 15분 세션으로 묶되,
- 실제 영향이 큰 변경은 더 짧은 freshness 기준으로 한 번 더 확인하는 2단계 정책을 권장합니다.

## 6. 실패 횟수 제한/잠금 정책

권장 기본값:
- 연속 실패 5회: 15분 잠금
- 같은 로그인 세션/같은 사용자 기준 반복 실패 누적 10회 이상: 24시간 내 운영자 검토 대상 audit 플래그
- 잠금 해제 후 첫 성공 검증 시 실패 카운터 초기화

추가 권장:
- verify API 에 사용자 단위 + 세션/IP 단위 rate limit
- 잠금 중에는 남은 잠금 시간만 안내하고, 비밀번호 값이 맞는지 틀린지 추가 힌트 금지
- 실패 메시지는 "일치하지 않습니다" 수준으로만 유지

## 7. 분실/초기화/등록/변경 흐름 제안

### 7-1. 첫 등록

권장 흐름:
1. 관리자설정 대상 사용자가 처음 보호 화면에 진입
2. 등록된 2차 비밀번호가 없으면 서버가 `enrollmentRequired=true` 반환
3. 사용자는 현재 로그인 세션 + 1차 비밀번호 재입력으로 본인 확인
4. 새 2차 비밀번호 4자리 입력 + 확인 입력
5. 서버가 해시 저장 후 감사 로그 기록
6. 즉시 재인증 세션 발급

권장 이유:
- 2차 비밀번호가 없는 상태에서 바로 관리자설정을 완전히 열어 주면 우회가 됩니다.
- 첫 등록도 최소한 1차 비밀번호 재입력 정도의 보조 확인이 필요합니다.

### 7-2. 변경

권장 흐름:
1. 유효한 로그인 세션 필요
2. 현재 2차 비밀번호 입력
3. 새 2차 비밀번호 + 확인 입력
4. 서버 저장
5. 기존 재인증 세션 전부 폐기 후 새 세션 재발급
6. 감사 로그 기록

### 7-3. 분실

권장 1차 운영안:
- 완전 자동 self-service 분실 복구는 열지 않음
- 대신 아래 두 경로만 허용
  1) 본인 요청 + 1차 비밀번호 재인증 + 운영자 승인 후 초기화
  2) 상위 관리자/지정 운영자가 강제 초기화

이유:
- 현재 프로젝트 범위에는 외부 본인확인 채널, SSO, SMS, 메일 인증이 정식 운영 범위로 고정되어 있지 않습니다.
- 약한 self-service 복구를 열면 2차 비밀번호의 의미가 크게 떨어집니다.

### 7-4. 초기화 후 상태

권장안:
- 초기화 직후 상태는 `reset_required`
- 해당 사용자는 다시 보호 화면에 들어갈 때 새 PIN 등록을 먼저 완료해야 함
- 이전 재인증 세션은 모두 무효화

## 8. 권장 데이터 모델 초안

주의:
- 아래는 설계 초안입니다.
- 실제 migration/table 생성은 별도 승인 게이트입니다.

### 8-1. `admin_secondary_password_credentials`

목적:
- 사용자별 2차 비밀번호 해시와 상태 저장

권장 필드:
- `id`
- `company_id`
- `user_id`
- `password_hash`
- `hash_algorithm` (`argon2id` 예상)
- `status` (`active`, `reset_required`, `disabled`)
- `failed_attempt_count`
- `last_failed_at`
- `locked_until`
- `last_verified_at`
- `created_at`
- `updated_at`
- `created_by_user_id`
- `reset_by_user_id` nullable
- `reset_reason` nullable

권장 제약:
- `(company_id, user_id)` unique
- 사용자 삭제 대신 soft disable 우선 검토

### 8-2. `admin_secondary_password_verifications`

목적:
- 관리자설정 재인증 세션 추적

권장 필드:
- `id`
- `company_id`
- `user_id`
- `session_id` 또는 auth session reference
- `verified_at`
- `expires_at`
- `last_high_risk_verified_at`
- `revoked_at` nullable
- `revoked_reason` nullable
- `ip_hash_or_masked_ip`
- `user_agent_summary`
- `created_at`

권장 이유:
- 단순 boolean 세션 플래그보다 만료/폐기/audit 추적이 쉽습니다.
- 고위험 변경 직전 freshness 관리도 쉬워집니다.

### 8-3. 감사 로그 이벤트 코드

권장 코드 예시:
- `admin.secondary_password.enrollment_started`
- `admin.secondary_password.enrollment_completed`
- `admin.secondary_password.verify_succeeded`
- `admin.secondary_password.verify_failed`
- `admin.secondary_password.locked`
- `admin.secondary_password.changed`
- `admin.secondary_password.reset_requested`
- `admin.secondary_password.reset_completed`
- `admin.secondary_password.reauth_required`
- `admin.secondary_password.verification_revoked`

로그에 남길 것:
- actor user id
- target user id
- company id
- action code
- success/failure
- masked context (route, action type, reason)

로그에 남기면 안 되는 것:
- 원문 PIN
- 일부 자리수
- 복호화 가능한 값

## 9. API 초안

주의:
- route 이름은 초안입니다.
- 기존 same-origin `/api/*` 기준을 유지합니다.

### 9-1. 상태 조회

`GET /api/admin/secondary-password/status`

목적:
- 현재 사용자가 등록 대상인지, 이미 등록했는지, 재인증이 살아 있는지 확인

예시 응답:
```json
{
  "ok": true,
  "data": {
    "required": true,
    "enrollmentRequired": false,
    "hasSecondaryPassword": true,
    "verification": {
      "verified": true,
      "expiresAt": "<masked-timestamp>",
      "freshUntil": "<masked-timestamp>"
    },
    "lock": {
      "locked": false,
      "lockedUntil": null
    }
  }
}
```

### 9-2. 첫 등록

`POST /api/admin/secondary-password/enroll`

입력 초안:
```json
{
  "primaryPassword": "사용자 1차 비밀번호",
  "nextPin": "1234",
  "confirmPin": "1234"
}
```

비고:
- 실제 비밀번호 원문은 요청 시점에만 사용하고 저장 금지
- transport 외부 노출 금지

### 9-3. 검증

`POST /api/admin/secondary-password/verify`

입력 초안:
```json
{
  "pin": "1234",
  "scope": "admin_settings"
}
```

성공 결과:
- 짧은 재인증 세션 발급
- 만료 시각 반환 가능

### 9-4. 변경

`POST /api/admin/secondary-password/change`

입력 초안:
```json
{
  "currentPin": "1234",
  "nextPin": "5678",
  "confirmPin": "5678"
}
```

### 9-5. 분실 초기화 요청

`POST /api/admin/secondary-password/reset-request`

권장 목적:
- 본인 요청 기록만 남기고 자동 완료하지 않음
- 운영자 승인 큐 또는 audit candidate 생성

### 9-6. 운영자 강제 초기화

`POST /api/admin/users/:userId/secondary-password/reset`

권장 조건:
- 상위 capability 필요
- 실행자 자신에 대한 셀프 우회 금지 여부 별도 정책 필요
- 2차 비밀번호 재인증 freshness 필요

### 9-7. 보호된 변경 API 공통 규칙

아래 종류의 보호된 변경 API 는 공통으로 서버 체크를 권장합니다.
- `requireSecondaryPasswordVerification(scope, freshness)` 같은 guard 호출
- 세션/role/capability/company boundary 통과 후 추가로 2차 검증 확인

## 10. 서버/웹 구현 원칙

### 10-1. 프론트 변경 원칙

프론트에서 바꿔야 할 점:
- `secondaryPasswordValue` 같은 평문 state 저장 제거
- 현재 로컬 비교 로직 제거
- 상태 조회/검증/등록/변경을 모두 API 기반으로 변경
- 비밀번호 미등록 안내 문구에서 "이번 미리보기" 같은 문구 제거

### 10-2. 서버 변경 원칙

서버에서 반드시 가져갈 점:
- role/capability/company boundary 가 기본 1차 경계
- 2차 비밀번호는 추가 보호층
- 보호 화면 접근과 보호 API 변경 둘 다 서버 검증
- 실패/잠금/초기화/강제초기화 모두 audit 남김

### 10-3. UX 원칙

사용자 문구는 쉬워야 합니다.
권장 문구 예시:
- "관리자 설정에 들어가기 전에 2차 비밀번호를 확인해 주세요."
- "이 기능은 권한 변경이 포함되어 있어 다시 한 번 확인합니다."
- "비밀번호를 여러 번 틀려 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요."

피해야 할 문구:
- "서버에 저장됩니다" 같은 기술 중심 문구 남발
- 틀린 자리수/부분 힌트 제공
- 잠금 정책을 지나치게 자세히 노출해 우회 힌트를 주는 문구

## 11. 승인 필요 항목

아래는 설계만으로 끝내지 말고 구현 전 별도 승인해야 합니다.

1. DB migration 생성/적용 여부
2. 해시 알고리즘 확정 (`argon2id` 권장, 런타임 제약 검토 필요)
3. pepper secret 운영 여부와 저장 위치
4. 기존 관리자 사용자 대상 최초 등록 전환 방식
   - 최초 진입 시 등록 강제
   - 점진 등록
   - 특정 역할만 우선 적용
5. 분실 복구 승인자 범위
   - COMPANY_ADMIN만 허용
   - HR_ADMIN 포함
   - 별도 helpdesk role 필요 여부
6. 실패 제한/잠금 시간 최종 수치
7. 고위험 변경 재확인 대상 액션 목록
8. 감사 로그 export 에 2차 재확인을 강제할지 여부
9. production DB/실데이터/migration 실제 적용 일정
10. 운영 안내 문서에서 사용자에게 보여 줄 분실 절차 문안

## 12. 후속 구현 카드 그래프 제안

권장 순서:

1. 승인 게이트 정리
   - 이 설계에서 승인 필요한 항목 확정

2. 서버 모델/API 구현
   - shared contract
   - API route
   - hash/verify/lock/audit 로직
   - 보호 API guard helper

3. 웹 게이트 연동 교체
   - 현재 로컬 state 비교 제거
   - API 기반 등록/검증/변경으로 교체
   - 일반 개인 설정과 관리자설정 게이트 범위 재분리

4. 보안/정책 리뷰
   - role/capability/company boundary 와 충돌 없는지 확인
   - self-reset/self-bypass 허점 확인
   - 감사 로그/잠금 메시지/민감정보 비노출 확인

5. 테스트
   - happy path
   - wrong PIN
   - lockout
   - reset_required
   - stale verification
   - high-risk reauth
   - forbidden/company boundary 회귀

6. 문서화
   - 관리자/운영자 안내
   - 분실/초기화 절차
   - 승인 게이트와 아직 안 여는 범위 정리

## 13. 작업 분해 제안

### 카드 A. 승인 정리
- 목적: 해시/복구/잠금/적용 대상/고위험 액션 범위 확정
- 산출물: 승인/미정 표

### 카드 B. 서버 구현
- 목적: 데이터 모델/contract/API/guard/audit 구현
- 핵심 acceptance:
  - 평문 저장 금지
  - verify session 만료/폐기 동작
  - 실패/잠금 동작
  - audit 코드 기록

### 카드 C. 웹 연동
- 목적: 현재 preview local state 제거, API 기반 UX 로 교체
- 핵심 acceptance:
  - 새로고침 후에도 상태 일관성 유지
  - 비등록/등록/변경/잠금 문구 분리
  - 관리자설정과 개인설정 범위 분리 반영

### 카드 D. 리뷰
- 목적: 보안 경계/우회 가능성 점검

### 카드 E. 테스트
- 목적: 회귀와 정책 검증

### 카드 F. 문서화
- 목적: 운영자/관리자용 쉬운 안내 정리

## 14. 이번 카드 기준 결론

권장 결론:
- 현재 2차 비밀번호 기능은 "프론트 프리뷰" 상태이므로 그대로 운영 보안 기능으로 간주하면 안 됩니다.
- 운영 버전은 반드시 서버 해시 저장 + 짧은 재인증 세션 + 보호 API 재검증 + 실패 제한 + 감사 로그 구조로 바꾸는 것이 맞습니다.
- 개인 프로필 설정 전체를 무조건 같은 게이트로 잠그기보다, 관리자설정과 고위험 변경에 범위를 좁혀 적용하는 쪽을 우선 권장합니다.
- 분실 복구는 외부 본인확인 채널이 없는 현재 범위에서는 자동 self-service 보다 운영자 승인형 초기화가 더 안전합니다.
