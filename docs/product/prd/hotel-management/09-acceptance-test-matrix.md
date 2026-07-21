# 호텔관리 초기 MVP 수용·테스트 매트릭스

> 상태: `user_approved`

## 권한 매트릭스

| 시나리오 | 기대 결과 |
|---|---|
| 같은 법인·배정 호텔·기능권한 있음 | 허용 |
| 같은 법인·다른 호텔 | 존재·건수·검색결과·파일 모두 비노출 |
| 다른 법인 | 하드 차단 |
| 배정은 있으나 추가권한 없음 | 점검·이슈등록 기본범위만 허용 |
| 추가권한은 있으나 호텔배정 종료 | 즉시 차단 |
| 하우스키핑이 매출·문의·설정 API 호출 | 차단 |
| 호텔 소유주가 내부메모·감사원문 호출 | 필드 자체 비노출 |
| 거래처 임직원이 호텔 route/API 호출 | 초기 MVP에서 미노출·차단 |

## 통합 수용 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| `HOT-E2E-001` | 준비중 호텔에 필수조건이 누락됨 | 활성화 요청 | 항목별 오류, 상태 불변, 감사 실패기록 |
| `HOT-E2E-002` | 필수조건 모두 충족 | 활성화 요청 | `ACTIVE`, DB 재조회 일치 |
| `HOT-E2E-003` | 호텔상태관리 권한 없음 | 운영중지 요청 | 403, 상태·업무자료 불변 |
| `HOT-E2E-004` | 유효한 상태관리자 | 사유·재인증과 함께 중지 | 신규점검·매출·문의 차단, 기존업무 보존 |
| `HOT-E2E-005` | 소유주 교체예약 | 전환시각 도래 | 기존 세션 차단, 신규 identity 연결, 과거 행위자 유지 |
| `HOT-E2E-006` | 운영중 객실 | 반복일정 실행 | 업무일당 점검 1건만 생성 |
| `HOT-E2E-007` | 담당자 배정종료 | 점검 자동생성 | 임의대체 없이 미배정·관리자 알림 |
| `HOT-E2E-008` | 참여자 계정 | 최종 완료 요청 | 403, 결과는 유지되나 완료되지 않음 |
| `HOT-E2E-009` | 완료책임자·중대 이상결과 | 점검 완료 | 점검·이슈·감사 원자 저장 |
| `HOT-E2E-010` | 이상항목 사진 없음 | 촬영불가 사유도 없이 저장 | 400 필드오류 |
| `HOT-E2E-011` | 확정매출 증빙 없음 | 확정 요청 | 차단, 상태 DRAFT 유지 |
| `HOT-E2E-012` | 확정·잠금 매출 | 일반 PATCH | 409, 정정 API 안내 |
| `HOT-E2E-013` | 정정권한·사유·근거 있음 | 정정 요청 | 원본 보존, 새 버전·감사 생성 |
| `HOT-E2E-014` | 문의 라우팅 미설정 | 소유주 문의등록 | 기본 운영문의함 저장, 유실 0건 |
| `HOT-E2E-015` | 답변완료 후 7일 무응답 | 자동종료 작업 | 종료·시스템행위자·감사 기록 |
| `HOT-E2E-016` | 파일 VIEW만 있음 | 다운로드 요청 | 차단·실패 접근로그 |
| `HOT-E2E-017` | 파일 DOWNLOAD와 호텔범위 있음 | 다운로드 요청 | 5분 이하 단기응답·성공로그 |
| `HOT-E2E-018` | 배정종료 뒤 기존 서명 URL 만료 | 새 URL 요청 | 차단 |
| `HOT-E2E-019` | 같은 멱등키·같은 요청 | 재시도 | 최초 결과 재응답, 중복자료 없음 |
| `HOT-E2E-020` | 같은 멱등키·다른 요청 | 재시도 | 409 `IDEMPOTENCY_CONFLICT` |
| `HOT-E2E-021` | 오래된 version | 저장 요청 | 409, 최신 DB 값 유지 |
| `HOT-E2E-022` | DB/R2 schema 미설정 | 저장 요청 | 명확한 503, 가짜 성공·부분자료 없음 |
| `HOT-E2E-023` | 긴급이슈 저장 성공·푸시 실패 | 알림 처리 | 이슈 유지, 인앱 알림·푸시 실패상태 기록 |
| `HOT-E2E-024` | 감염 또는 금지형식 파일 | 업로드 완료 | 부모자료 연결 금지·검역/차단·운영알림 |

## 비밀번호 정책 수용 시나리오

경계별 실패 원인을 독립적으로 증명하기 위해 다음 fixture를 사용한다. 각 fixture는 신규 설정·재설정·변경 경로에서 각각 별도로 실행하며 한 경로의 결과로 다른 경로를 갈음하지 않는다.

| Fixture | 고정 조건 |
|---|---|
| `PW-7` | 정확히 7 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점/기호 포함, 대문자 없음 |
| `PW-8` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자·supplementary-plane Unicode 기호 포함, 대문자 없음 |
| `PW-8-PUNCT` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점 포함, Unicode 기호·대문자 없음 |
| `PW-NO-LOWER` | 정확히 8 Unicode 코드 포인트, ASCII 대문자·숫자·Unicode 구두점/기호 포함, 소문자 없음 |
| `PW-NO-NUMBER` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·Unicode 구두점/기호 포함, 숫자·대문자 없음 |
| `PW-NO-PUNCT-OR-SYMBOL` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자만 포함, Unicode 구두점/기호·대문자 없음 |
| `PW-200` | 정확히 200 Unicode 코드 포인트, ASCII 소문자·숫자·supplementary-plane Unicode 기호 포함, 대문자 없음 |
| `PW-201` | 정확히 201 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점/기호 포함, 대문자 없음 |

| ID | Given | When | Then |
|---|---|---|---|
| `HOT-AUTH-PW-001` | `PW-7` | 신규 설정 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-002` | `PW-7` | 재설정 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-003` | `PW-7` | 변경 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-004` | `PW-8` | 신규 설정 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-005` | `PW-8` | 재설정 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-006` | `PW-8` | 변경 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-007` | `PW-NO-LOWER` | 신규 설정 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-008` | `PW-NO-LOWER` | 재설정 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-009` | `PW-NO-LOWER` | 변경 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-010` | `PW-201` | 신규 설정 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-011` | `PW-201` | 재설정 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-012` | `PW-201` | 변경 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-013` | `PW-200` | 신규 설정 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-014` | `PW-200` | 재설정 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-015` | `PW-200` | 변경 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-016` | `PW-NO-NUMBER` | 신규 설정 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-017` | `PW-NO-NUMBER` | 재설정 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-018` | `PW-NO-NUMBER` | 변경 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-019` | `PW-NO-PUNCT-OR-SYMBOL` | 신규 설정 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-020` | `PW-NO-PUNCT-OR-SYMBOL` | 재설정 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-021` | `PW-NO-PUNCT-OR-SYMBOL` | 변경 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-022` | 정책 변경 전에 설정된 기존 비밀번호가 있음 | 정책 배포 | 강제 초기화·즉시 만료 없이 유지되고 다음 설정·재설정·변경부터 새 정책 적용 |
| `HOT-AUTH-PW-023` | 유효한 정책 fixture와 provider 성공 | 비밀번호 작업 완료 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-024` | 정책 위반 fixture | 비밀번호 작업 거절 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-025` | 유효한 정책 fixture와 provider 안전 실패 | 비밀번호 작업 실패 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-026` | `PW-8-PUNCT` | 신규 설정 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-027` | `PW-8-PUNCT` | 재설정 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-028` | `PW-8-PUNCT` | 변경 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |

## DB 검증

- 생성 응답 ID로 상세 SELECT/API 재조회.
- 타 `company_id`·`branch_id` FK 삽입 실패.
- 소유주 1:1 partial unique 위반 실패.
- 객실번호·점검 자동생성·일매출 중복 unique 위반 실패.
- transaction 중간실패 시 업무자료·감사·첨부참조 모두 rollback.
- 과거 version·상태이력·원행위자 보존.

## Preview 완료 게이트

1. 새 호텔 제품 migration `0001` 이상 적용.
2. focused unit/API/permission test 통과.
3. 전체 `pnpm check` 통과.
4. Cloudflare Web build 통과.
5. Preview DB/R2 실제 mutation·재조회·정리.
6. 사용자유형별 로그인 E2E.
7. 타 법인·타 호텔·직접 API 권한우회 회귀.
8. PR/CI/merge/deploy/live smoke는 PRD 승인 후 별도 오케스트레이션 범위로 진행.
