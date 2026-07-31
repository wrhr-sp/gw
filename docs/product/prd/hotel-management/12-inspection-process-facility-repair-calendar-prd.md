# 공통 점검 프로세스·시설물·하자보수·Calendar PRD

## 1. 문서 정보

| 항목 | 값 |
|---|---|
| PRD ID | `HOTEL-MVP-120` |
| 상태 | `user_approved` |
| 사용자 정본 | `제품요구사항(사용자)/0. 공통기능.md`, `5. 운영사업부.md`, `8. 관리자페이지.md` |
| 제품 범위 | 객실점검, 시설물점검, 공통 검토 프로세스, 하자·보수, 방문일정 |
| 외부 provider | Google Calendar API는 backend-only 단방향 일정 반영 |

이 문서는 객실점검과 시설물점검이 공유하는 업무기반과 하자·보수 세로 기능의 정본이다. 객실 기준정보의 고유 규칙은 [02-room-and-inspection-prd.md](02-room-and-inspection-prd.md), 인증·파일·감사 공통통제는 [06-platform-security-prd.md](06-platform-security-prd.md)를 함께 따른다.

## 2. 제품 목표

```text
호텔 기준정보
→ 객실·공용공간·시설물
→ 적용 점검항목
→ 정기루틴 또는 수시점검
→ 호텔 지점 공용업무 수행
→ 정상·주의·이상 입력
→ 설정형 검토 프로세스
→ 필요 시 별도 보수 건
→ 방문일정·작업완료·검토
→ 생성 당시 프로세스의 다음 경로
→ 공식 최신상태·이력
```

객실점검과 시설물점검은 별도 복제품이 아니라 하나의 공통 inspection subsystem에서 대상유형만 분리한다.

## 3. 초기 MVP 포함·제외

### 포함

- 객실점검과 시설물점검
- 객실·공용공간·시설물 기준정보 연결
- 호텔별 점검항목과 유형별 제외·추가
- 정기루틴·수시점검
- 항목별 실제 수행자
- 정상·주의·이상 결과와 사진
- 설정형 검토 프로세스
- 동적 역할·기능권한·사용자 예외
- 공식 최신상태·최근 점검일·이력
- 점검 연결·직접 등록 보수 건
- 우선순위·복수 방문일정·완료증빙
- 자체 월간·주간 달력
- Google Calendar backend-only 단방향 반영
- 인앱 알림·승인된 PWA 푸시

### 제외

- 객실 판매·투숙·공실·청소·보수중·사용불가 운영상태
- 시설물 운전·정지·고장 같은 운영상태
- PMS·OTA 실제연동
- 외부업체 로그인·포털
- 비용·견적·청구·지급
- SMS·이메일·Google 참석자·Google reminder
- 관리번호·QR·바코드·자산가액·제조사·모델·보증기간·교체주기
- Google Calendar UI·iframe·브라우저 직접 API 호출
- mock·placeholder·static sample 성공·in-memory fallback

## 4. 구현후보 gate

| 구현영역 | 상태 | 기존 승인 재사용 여부 |
|---|---|---|
| 공통 process definition/revision·실행 엔진 | `approved` | PostgreSQL 정본 + TypeScript 자체 엔진, XState·Camunda의 검증 개념만 흡수 |
| 객실·시설물 공통 inspection 대상·결과 모델 | `approved` | 공통 실행·대상 child + `ROOM`/`FACILITY` 직접 composite FK |
| 시설물·공용공간 기준정보 | `approved` | 공용공간·시설물유형 정본 + 시설물의 `ROOM`/`COMMON_AREA` 직접 composite FK |
| 보수 건·우선순위·방문일정 | `approved` | 정규화 PostgreSQL aggregate + append-only history |
| Calendar adapter·OAuth credential·outbox 재시도 | `unresearched` | 신규 외부 provider 경계 |
| 자체 월간·주간 달력 UI | `unresearched` | 신규 UI |

### 4.1 공통 process engine 후보 결정 — 2026-07-31

- 선택자: 대장.
- 선택상태: `approved`.
- 선택안: PostgreSQL 정본 + TypeScript 자체 process engine을 기반으로 하고 XState의 명시적 상태·이벤트·guard·전이행렬 개념과 Camunda의 단계 그래프 유효성검사·definition/revision·execution 분리 개념만 흡수한다.

비교한 독립 후보는 정확히 다음 세 개다.

| 후보 | 확인 결과 | 선택 결과 |
|---|---|---|
| PostgreSQL 18 정본 + TypeScript 자체 엔진 | 기존 RLS·`FORCE ROW LEVEL SECURITY`·version·멱등·감사·command transaction과 직접 결합 가능. 신규 runtime·상용 라이선스·외부 서비스 없음 | 선택 |
| XState 5.32.5 + PostgreSQL | MIT이며 actor snapshot의 DB 저장·복구를 지원하지만 동적 권한·대리인·기한·감사·RLS는 별도 구현이 필요하고 XState snapshot과 DB 실행상태의 이중 정본 위험이 있음 | package 미도입, 모델링 개념만 흡수 |
| Camunda 8.9 + PostgreSQL | User Task·담당후보·멀티테넌시·BPMN 운영도구를 제공하지만 SaaS 또는 별도 Self-Managed runtime이 필요하고 DB transaction과 외부 process 전이를 원자화할 수 없음. Production Self-Managed 주요 compiled component는 Enterprise Edition 경계임 | runtime·Tasklist·Modeler·SaaS 미도입, 그래프 검증 개념만 흡수 |

공식 조사 근거:

- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL 18 JSON Types](https://www.postgresql.org/docs/18/datatype-json.html)
- [XState Persistence](https://stately.ai/docs/persistence)
- [XState MIT License](https://github.com/statelyai/xstate/blob/main/LICENSE)
- [Camunda 8 User Tasks](https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/)
- [Camunda 8 Multi-tenancy](https://docs.camunda.io/docs/components/concepts/multi-tenancy/)
- [Camunda 8 Self-Managed](https://docs.camunda.io/docs/self-managed/about-self-managed/)
- [Camunda 8 Licenses](https://docs.camunda.io/docs/reference/licenses/)

### 4.2 선택안의 정본·실행 경계

- process definition·불변 revision·stage·transition·guard 입력·담당자·기한·execution·현재 stage·history·감사는 PostgreSQL 정본이다.
- Web은 자체 shadcn/Radix/Tailwind UI만 사용하고 외부 Modeler·Tasklist를 사용자 화면에 포함하지 않는다.
- TypeScript는 Contracts parse, 그래프 초안 검증, 사용자 응답 조립을 담당할 수 있지만 최종 transition 권한·현재 stage·version·guard·완료조건은 좁은 PostgreSQL command가 같은 transaction에서 다시 검증한다.
- XState actor snapshot과 Camunda process instance를 업무 정본 또는 복구 정본으로 저장하지 않는다.
- 역할명·단계명·상태명을 코드에 고정하지 않고 생성 당시 process revision snapshot을 실행 건에 보존한다.
- Scheduled Reconciler는 기한초과·알림·중지된 실행 탐지만 담당하며 자동승인·자동반려·자동이동·임의 담당자변경을 하지 않는다.
- PostgreSQL command는 회사·호텔 scope, RLS·`FORCE ROW LEVEL SECURITY`, 활성 session·사용자·배정·동적 기능권한·개인 회수 우선·자료상태와 현재 stage·version·guard·완료조건을 같은 transaction에서 요청마다 다시 검증한다.

### 4.3 흡수하는 장점과 포기하는 장점

흡수:

- 상태·이벤트·guard·허용 transition을 명시적으로 분리한다.
- 저장 전에 시작단계·최종단계·도달가능성·고립단계·유효 transition·완료경로·담당자·분기조건을 검증한다.
- definition/revision과 execution/history를 분리하고 기존 실행은 생성 당시 revision으로만 판정한다.
- 전이행렬·동시처리·응답유실 replay·완료잠금 테스트를 사용한다.

포기:

- XState package·actor runtime·persisted actor snapshot·Stately 전용 운영도구.
- Camunda engine·Zeebe·Tasklist·Modeler·Identity·SaaS·Self-Managed cluster.
- BPMN 전체 표준기능과 외부 workflow 대시보드.

추가 부담:

- 그래프 유효성검사, revision, transition command, 담당자·대리인, 기한·지연, 실행이력, 운영조회 UI를 직접 구현·테스트한다.
- 범용 workflow 제품이 아니라 승인된 호텔 점검·보수 검토흐름에 필요한 좁은 기능만 제공한다.

### 4.4 구현 전 필수 gate

- 이 절의 승인은 공통 process engine 구현방식에만 적용한다. 공통 inspection 모델, 시설물·공용공간 기준정보, 보수 건·우선순위·방문일정 모델은 이후 별도 후보선택으로 `approved`됐으며, Calendar adapter·달력 UI의 `unresearched` 상태는 유지한다.
- 구현 전 exact source snapshot에서 Contracts·DB schema/command·Repository/Service/API·Web UI·테스트 경계를 확정하고 별도 mutation 범위를 승인받는다.
- Red 테스트는 잘못된 그래프, 도달 불가능 단계, 최종경로 부재, revision snapshot 불변, 주 검토자·대리인 동시처리, stale version, 권한회수·배정만료, 기한초과 비자동전이, 최종완료 잠금, 멱등 replay·응답유실을 포함한다.
- 실제 PostgreSQL 18에서 회사/호텔 scope CHECK·복합 FK·RLS·`FORCE ROW LEVEL SECURITY`·non-owner/non-`BYPASSRLS` runtime·command ACL·동시 transition을 검증한다.
- 신규 package·외부 workflow runtime·SaaS·Production·secret·provider mutation은 이 선택에 포함하지 않는다.

### 4.5 재선정 조건

다음 중 하나가 제품정책으로 확정되면 공통 process engine 후보를 다시 선정한다.

- 비개발자가 BPMN 전체 모델러로 범용 프로세스를 직접 설계해야 한다.
- 여러 외부 시스템의 수일·수개월 장기 saga가 핵심업무가 된다.
- 독립 workflow 운영팀·전용 대시보드·별도 SLA가 필요하다.
- 회사 공통플랫폼으로 Camunda Enterprise 사용이 의무화된다.

### 4.6 공통 inspection 대상·결과 모델 후보 결정 — 2026-07-31

- 선택자: 대장.
- 선택상태: `approved`.
- 선택안: 공통 `inspection_executions` aggregate 아래 `inspection_execution_targets` child를 두고 `ROOM`은 `room_id`, `FACILITY`는 `facility_id` 직접 composite FK로 연결한다.

비교한 독립 후보는 정확히 다음 세 개다.

| 후보 | 확인 결과 | 선택 결과 |
|---|---|---|
| 공통 실행대상 child + 유형별 직접 FK | 한 실행에 여러 대상을 담고 객실·시설물 존재·회사·호텔 일치를 declarative composite FK와 행 CHECK로 직접 보장할 수 있음 | 선택 |
| 공통 inspection target registry | 실행에서는 단일 target ID를 쓸 수 있으나 객실·시설물 lifecycle과 registry 동기화, subtype 정확히 하나 보장, stale registry 복구가 추가됨 | 미선택 |
| `target_type + target_id` polymorphic 참조 | 열 추가 없이 대상유형 확장이 쉽지만 한 UUID가 여러 테이블을 가리켜 직접 FK를 만들 수 없고 command·trigger·복구검증에 무결성이 의존함 | 미선택 |

공식 조사 근거:

- [PostgreSQL 18 Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL 18 Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html)
- [PostgreSQL 18 CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)
- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL License](https://www.postgresql.org/about/licence/)

### 4.7 선택안의 정본·무결성 경계

- `inspection_executions`는 회사·호텔·업무일·`execution_source`·routine/process provenance·실행 lifecycle·version을 가진 공통 aggregate이며 `(company_id, branch_id, id)` unique를 제공한다.
- `execution_source='SCHEDULED'`이면 `routine_revision_id`·`business_date`·`occurrence_key`가 모두 non-null이어야 하는 같은 행의 CHECK를 둔다. `(company_id, branch_id, routine_revision_id, business_date, occurrence_key) WHERE execution_source='SCHEDULED'` partial unique로 SQL NULL 우회 없이 같은 회차의 실행 aggregate 중복을 차단한다. 수시점검 replay는 별도 idempotency receipt로 차단한다.
- `inspection_execution_targets`는 `company_id`, `branch_id`, `execution_id`, `target_type`, nullable `room_id`, nullable `facility_id`와 생성 당시 대상 ID·이름·위치·유형정보 snapshot을 가진다.
- 실행대상은 `(company_id, branch_id, execution_id)` composite FK로 같은 tenant의 `inspection_executions(company_id, branch_id, id)`를 참조한다. child 자체 RLS만으로 parent tenant 일치를 대신하지 않는다.
- `ROOM` 행은 `room_id`만 non-null이고 `FACILITY` 행은 `facility_id`만 non-null이어야 하며 다른 조합은 같은 행의 명시적 boolean CHECK로 차단한다. SQL NULL이 CHECK를 통과하지 않도록 각 분기에서 null/non-null을 모두 명시한다.
- 객실은 `(company_id, branch_id, room_id)`, 시설물은 `(company_id, branch_id, facility_id)` composite FK로 실제 같은 호텔 기준정보에 연결한다.
- `(company_id, branch_id, execution_id, room_id) WHERE target_type='ROOM'`과 `(company_id, branch_id, execution_id, facility_id) WHERE target_type='FACILITY'` partial unique로 실행 내 대상 중복을 차단한다.
- 항목 snapshot은 반드시 `execution_target_id`에 연결하고 대상유형별 유효항목·표시순서·증빙조건·기본 심각도·source revision을 불변 보존한다.
- 항목 결과는 해당 항목 snapshot에 연결하고 결과·설명·최종 심각도·실제 수행자·입력/수정 actor·시각·version을 구조화된 열로 저장한다. 대상·결과 정본을 JSONB 하나로 대체하지 않는다.
- 사진은 검역통과 뒤 해당 항목결과 부모에 연결하고 최종완료 잠금·보존정책을 따른다.
- Contracts는 `{ type: "ROOM", roomId } | { type: "FACILITY", facilityId }` discriminated union을 사용하지만 DB를 generic `target_id`로 약화하지 않는다.
- 실행·대상·항목 snapshot·결과·파일연결은 모두 회사·호텔 scope CHECK, RLS·`FORCE ROW LEVEL SECURITY`, non-owner/non-`BYPASSRLS` runtime을 적용한다.

### 4.8 재사용·제외·구현 전 gate

- 기존 dirty 객실점검 구현의 command authority·RLS·멱등 receipt·revision·lease·generation fencing·Repository/test harness는 최신 Red를 통과하는 최소 hunk만 재사용 후보로 둔다.
- 기존 `hotel_inspections.room_id NOT NULL`, 고정 완료책임자·참여자, `SCHEDULED/UNASSIGNED`, 실행 공통 item snapshot 구조는 최신 복수대상·항목별 실제 수행자·설정형 process 모델의 완료 구현으로 재사용하지 않는다.
- 별도 canonical target registry, generic polymorphic DB FK, JSONB-only 대상·결과 정본, 신규 package·외부 서비스는 도입하지 않는다.
- 공통 inspection 대상·결과 모델, 시설물·공용공간 기준정보, 보수 건·우선순위·방문일정 모델은 각각 별도 후보선택으로 `approved`됐다. Calendar adapter·달력 UI의 `unresearched` 상태를 승인으로 확대하지 않는다.
- 시설물 relation·typed composite FK·lifecycle은 9.4~9.6을 따른다. 다만 현재 source의 객실 lifecycle이 최신 정본과 다르므로 9.6의 선행조건을 닫기 전에는 시설물 migration·Red·코드를 시작하지 않는다.
- 구현 전 Red는 복수대상 생성, 실행·대상 중복경쟁, 잘못된 null/FK 조합, 타 회사·타 호텔 대상, 사용중지·삭제 신규대상 차단과 기존 snapshot 지속, 대상별 항목 snapshot, 항목별 실제 수행자, 서로 다른 대상·항목 병렬수정, 같은 항목 stale version, 결과별 설명·사진조건, 최종완료 잠금을 포함한다.

다음 중 하나가 제품정책으로 확정되면 공통 inspection 대상모델 후보를 다시 선정한다.

- inspection 대상유형이 플러그인처럼 계속 추가된다.
- 여러 도메인이 하나의 canonical target ID를 필수로 공유한다.
- 객실·시설물 외 다수 대상유형을 schema 변경 없이 동적으로 운영해야 한다.
- 공통 target registry가 별도 제품 정본으로 승인된다.

후보가 `approved`가 되기 전에는 구현계획 확정, Red 테스트, 코드·migration·화면·Google 연동을 시작하지 않는다. 기존 객실점검 branch의 좁은 체크리스트·일정 승인도 결과·사진·완료·프로세스·시설물·보수·Calendar에는 적용되지 않는다.

## 5. 공통 설정형 검토 프로세스

### 5.1 정의와 버전

- 프로세스는 회사·호텔 범위의 정의와 불변 revision으로 저장한다.
- 단계·순서·전이·승인·반려·사용자 선택값 분기·완료조건을 설정한다.
- 유효한 저장이 성공한 즉시 새 활성 revision이 된다.
- 기존 실행 건은 생성 당시 process revision·단계·전이·담당자·기한을 snapshot으로 유지한다.
- revision 변경 후 기존 실행 건의 merge·완료판정을 재사용하지 않는다.
- 객실점검·시설물점검·보수에 단계명이나 이동경로를 코드로 고정하지 않는다.

### 5.2 단계 담당자·대리

- 각 단계에는 특정 주 검토자 한 명을 지정한다.
- 대리인이 필요하면 한 명과 유효 시작·종료시각을 지정한다.
- 주 검토자와 유효 대리인은 선착순으로 동일 version의 단계처리를 성공할 수 있다.
- 두 번째 처리는 version 충돌로 차단한다.
- 담당자의 계정·호텔배정·처리권한이 무효화되면 실행 건을 자동승인·반려·이동하지 않고 현재 단계에서 중지한다.
- 프로세스 실행관리권한이 있는 사용자는 현재 단계 담당자만 교체할 수 있고 process revision snapshot은 변경하지 않는다.

### 5.3 기한·지연

- 단계 처리기한은 해당 호텔 업무시간대로 계산한다.
- 기한이 지나면 현재 단계에 `지연` 표시만 추가한다.
- 자동승인·자동반려·자동이동·임의 담당자변경을 하지 않는다.
- 알림 실패가 단계처리나 본업무 transaction을 rollback하지 않는다.

### 5.4 최종 완료

- 생성 당시 process revision의 최종 완료조건을 모두 통과해야 공식 완료한다.
- 최종 완료 뒤 결과·설명·사진·심각도·수행자·대상·완료시각·프로세스 snapshot은 누구도 수정·재개·정정하지 못한다.
- 오류가 발견되면 기존 완료 건을 열지 않고 새 업무를 생성한다.

## 6. 동적 권한

호텔별 유효권한은 다음을 정본으로 계산한다.

```text
회사 공통역할 허용
+ 현재 호텔 역할 허용
+ 회사 전체 사용자 추가허용
+ 현재 호텔 사용자 추가허용
- 회사 전체 사용자 권한회수
- 현재 호텔 사용자 권한회수
```

- 개인별 권한회수가 모든 역할 허용보다 우선한다.
- 역할명·직급명·부서명·`ADMIN`을 기능판정에 하드코딩하지 않는다.
- 최고관리자만 역할·기능권한을 설정한다.
- 활성 최고관리자는 항상 정확히 두 명이어야 한다.
- 최고관리자 교체는 기존 한 명 해제와 신규 한 명 지정을 하나의 transaction으로 처리한다.
- 최고관리자는 자기 자신을 교체할 수 없고 중요작업 재인증과 감사가 필요하다.
- 권한 변경은 transaction 완료 후 다음 요청부터 재로그인 없이 적용한다.
- 요청마다 활성 세션·사용자·회사·호텔배정·사용자유형·역할·사용자 예외·자료상태를 서버와 DB에서 다시 검증한다.
- 권한별 capability 응답은 DB 판정에서 파생하고 프론트엔드 고정 역할표를 정본으로 사용하지 않는다.

## 7. 공통 inspection 모델

### 7.1 대상유형

- `ROOM`: 객실 한 개.
- `FACILITY`: 시설물 한 개.
- 하나의 실행 건은 대상 한 개 또는 여러 개를 포함할 수 있다.
- 생성 당시 대상 ID·유형·이름·위치·유형정보를 snapshot으로 보존한다.
- 사용중지·삭제된 기준정보는 신규 실행 대상에서 제외하지만 이미 생성된 실행 건은 snapshot으로 계속 수행한다.

### 7.2 결과

| 결과 | 설명 | 사진 |
|---|---|---|
| `NORMAL` 정상 | 선택 | 선택 |
| `CAUTION` 주의 | 필수 | 선택 |
| `ABNORMAL` 이상 | 필수 | 1~5장 필수 |

- `해당없음` 결과는 사용하지 않고 기준정보 설정에서 적용대상에서 제외한다.
- 점검항목마다 기본 이상 심각도를 설정할 수 있다.
- 현장 수행자는 더 높은 심각도로 상향할 수 있지만 낮출 수 없다.
- 하향은 별도 권한과 사유가 필요하고 전후값을 감사한다.
- 각 항목에는 실제 수행자·입력시각·수정자·수정시각을 기록한다.
- 같은 항목 동시수정은 version 충돌로 차단하고 서로 다른 대상·항목은 병렬 수행할 수 있다.

### 7.3 사진·첨부

- 모바일 카메라·사진첩과 PC 로컬 이미지 선택을 지원한다.
- 원본과 긴 변 2,048px 화면용 최적화본을 비공개 R2에 저장한다.
- 화면용 최적화 과정에서 위치정보를 제거한다.
- 원본·최적화본은 검역을 통과한 뒤에만 부모자료에 연결한다.
- 요청마다 활성 세션·회사·호텔·기능권한·부모자료 상태를 검증한다.
- 원본은 점검 완료일 또는 미완료 종료일 기준 1년 뒤 삭제한다.
- 최적화본·이력·삭제 감사는 계속 보존한다.

## 8. 객실점검

- 객실 기준정보와 객실타입 정책은 02 PRD를 따른다.
- 적용항목은 `호텔 객실 공통항목 - 객실타입 제외항목 + 객실타입 추가항목`이다.
- 객실점검은 오늘의 점검과 객실 최신상태를 연결한다.
- 수시점검은 현재 호텔의 층·활성 객실 한 개 이상·객실별 유효항목 한 개 이상을 선택한다.
- 호텔별 활성 기본 객실 수시점검 process revision을 자동 적용하고 등록자가 선택·우회하지 못한다.

## 9. 공용공간·시설물 기준정보

### 9.1 공용공간

- 호텔마다 로비·복도·창고 같은 공용공간 이름과 사용여부를 관리한다.
- 앞뒤 공백을 제거하고 영문 대소문자를 구분하지 않은 정규화 이름은 같은 호텔에서 유일하다.
- 활성 공용공간만 신규 시설물 위치·직접 보수대상으로 선택한다.
- 이름변경·사용중지 전 보수·점검에는 당시 위치명 snapshot을 유지한다.

### 9.2 시설물

- 호텔별 시설물유형과 실제 점검할 개별 시설물을 관리한다.
- 필수 기준정보는 호텔·시설물유형·시설물명·설치위치·활성/사용중지/삭제다.
- 설치위치는 같은 호텔의 활성 객실 한 개 또는 활성 공용공간 한 개다.
- 시설물명은 같은 `호텔 + 설치위치 + 시설물유형` 안에서 정규화 중복을 차단한다.
- 위치나 유형이 다르면 같은 시설물명을 사용할 수 있다.
- 시설물유형에 시설물이 연결돼 있으면 유형 삭제를 차단하고 영향목록을 표시한다.
- 활성 시설물이 연결된 객실·공용공간은 사용중지·삭제를 차단한다.
- 시설물을 다른 활성 위치로 옮기거나 먼저 사용중지·삭제한 뒤에만 위치를 사용중지·삭제할 수 있다.
- 위치를 변경해도 과거 점검·보수에는 당시 위치 snapshot을 유지한다.
- 시설물을 사용중지·삭제하면 신규 점검에서 제외하고 이미 생성된 실행 건은 snapshot으로 계속 수행한다.
- 시설물 운영상태·관리번호·QR·바코드·자산정보는 만들지 않는다.

### 9.3 시설물 점검항목

- 적용항목은 `호텔 시설물 공통항목 - 시설물유형 제외항목 + 시설물유형 추가항목`이다.
- 시설물점검은 객실점검과 동일한 결과·사진·수행자·프로세스·권한·공식상태·보수 연결 정책을 사용한다.

### 9.4 시설물·공용공간 기준정보 후보 결정 — 2026-07-31

- 선택자: 대장.
- 선택상태: `approved`.
- 선택안: 호텔별 `hotel_common_areas`·`hotel_facility_types` 정본과 `hotel_facilities`를 두고, 시설물 설치위치는 `ROOM`의 `room_id` 또는 `COMMON_AREA`의 `common_area_id`를 직접 composite FK로 연결한다.

비교한 독립 후보는 정확히 다음 세 개다.

| 후보 | 확인 결과 | 선택 결과 |
|---|---|---|
| 시설물의 위치유형별 직접 composite FK | 실제 객실·공용공간 존재와 회사·호텔 일치를 declarative FK와 같은 행 CHECK로 직접 보장하고 별도 위치 동기화가 필요 없음 | 선택 |
| 공통 location registry | 시설물이 단일 location ID를 쓸 수 있으나 객실·공용공간 lifecycle과 registry 동기화, subtype 정확히 하나 보장, stale registry 복구가 추가됨 | 미선택 |
| `location_type + location_id` polymorphic 참조 | 열 추가 없이 위치유형 확장이 쉽지만 한 UUID가 여러 테이블을 가리켜 직접 FK를 만들 수 없고 command·trigger·복구검증에 무결성이 의존함 | 미선택 |

공식 조사 근거:

- [PostgreSQL 18 Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL 18 Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)
- [PostgreSQL 18 Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html)
- [PostgreSQL 18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL License](https://www.postgresql.org/about/licence/)

### 9.5 선택안의 정본·무결성 경계

- `hotel_common_areas`, `hotel_facility_types`, `hotel_facilities`는 `company_id`, `branch_id`, `id`, `version`, actor·시각과 `ACTIVE/INACTIVE/DELETED` lifecycle을 가진 호텔 정본이며 물리삭제하지 않는다. 각 테이블은 child composite FK가 참조할 `(company_id, branch_id, id)` unique parent key를 제공한다.
- 이름은 앞뒤 공백을 제거하고 영문 대소문자를 구분하지 않는다. 공용공간·시설물유형·시설물의 `normalized_name`은 built-in immutable `lower(btrim(name))` stored generated column으로 계산한다. 공용공간·시설물유형의 호텔별 unique와 시설물의 9.5 위치·유형별 unique는 모두 삭제상태를 포함한 전체 lifecycle에 적용한다.
- `hotel_facilities`는 같은 호텔 `facility_type_id`, `location_type`, nullable `room_id`, nullable `common_area_id`를 가진다.
- `ROOM` 행은 `room_id`만 non-null이고 `COMMON_AREA` 행은 `common_area_id`만 non-null이어야 하며 다른 조합은 같은 행의 명시적 boolean CHECK로 차단한다. SQL NULL이 CHECK를 통과하지 않도록 각 분기에서 null/non-null을 모두 명시한다.
- 시설물유형은 `(company_id, branch_id, facility_type_id)`, 객실은 `(company_id, branch_id, room_id)`, 공용공간은 `(company_id, branch_id, common_area_id)` composite FK로 실제 같은 호텔 기준정보에 직접 연결한다.
- `(company_id, branch_id, facility_type_id, room_id, normalized_name) WHERE location_type='ROOM'`과 `(company_id, branch_id, facility_type_id, common_area_id, normalized_name) WHERE location_type='COMMON_AREA'` partial unique로 같은 위치·유형의 시설물명 중복을 차단한다. 위치나 유형이 다르면 같은 이름을 허용한다.
- Contracts는 `{ type: "ROOM", roomId } | { type: "COMMON_AREA", commonAreaId }` discriminated union을 사용하지만 DB를 generic `location_id`로 약화하지 않는다.
- 공용공간·시설물유형·시설물과 lifecycle command는 회사·호텔 scope CHECK, RLS·`FORCE ROW LEVEL SECURITY`, non-owner/non-`BYPASSRLS` runtime을 적용한다.
- 시설물 생성·위치이동과 위치·유형 lifecycle command는 후보 참조를 먼저 읽은 뒤 `시설물유형 UUID → 기존·새 위치 (location_type, UUID) → 시설물 UUID`의 전역순서로 관련 행을 잠근다. 잠금 뒤 참조·version·같은 호텔·활성 lifecycle을 재조회하고 후보 참조가 바뀌면 conflict/retry로 처리한다. A→B와 B→A 이동도 기존·새 위치 전체를 같은 정렬순서로 잠가 deadlock과 검사 직후 신규연결을 차단한다.
- 잠금·재검사 뒤 활성 시설물이 연결된 위치의 사용중지·삭제와 시설물이 하나라도 연결된 유형 삭제를 차단하고 영향목록을 반환하며 자동이동·자동상태변경하지 않는다. 시설물 위치 이동은 version·감사를 원자 갱신하고, 과거 inspection·repair는 생성 당시 위치·이름 snapshot을 계속 사용한다.
- 시설물유형은 `(company_id, branch_id, normalized_name)` unique를 `ACTIVE/INACTIVE/DELETED` 전체 lifecycle에 적용하고 `DELETED` 행의 이름을 불변으로 유지한다. 삭제해도 이름을 재사용하지 않고 다른 호텔에서는 같은 이름을 허용한다. 동시 생성·이름변경 충돌은 DB unique와 안정 오류로 처리하며 기존 유형·연결 시설물·과거 snapshot을 바꾸지 않는다.

### 9.6 재사용·제외·구현 전 gate

- 최신 `hotel_rooms(company_id, branch_id, id)` composite key, generated normalized-name·version·actor·감사·RLS·command 패턴은 Red를 통과하는 최소 hunk만 재사용 후보로 둔다.
- 현재 source의 객실 `ACTIVE/TEMP_SUSPENDED/OUT_OF_SERVICE` 운영상태는 최신 기준정보 `ACTIVE/INACTIVE/DELETED` lifecycle과 상충하므로 시설물 위치판정에 재사용하지 않는다.
- 객실 lifecycle 교정과 exact relation·command·권한·오류계약을 구현계획에 명시하고 별도 mutation 승인을 받기 전에는 migration·Red·코드를 시작하지 않는다.
- 별도 canonical location registry, generic polymorphic DB FK, JSONB-only 위치 정본, 신규 package·외부 서비스는 도입하지 않는다.
- 이 승인은 시설물·공용공간 기준정보 저장구조에만 적용한다. 보수 건·우선순위·방문일정 모델은 이후 별도 후보선택으로 `approved`됐으며 Calendar adapter·달력 UI는 계속 `unresearched`다.

다음 중 하나가 제품정책으로 확정되면 시설물 위치모델 후보를 다시 선정한다.

- 객실·공용공간 외 설치위치 유형이 지속적으로 추가된다.
- 여러 독립 업무가 하나의 canonical location ID를 필수로 공유한다.
- 건물·동·층·구역·공간의 가변 계층이 제품범위가 된다.
- 외부 PMS·자산관리 시스템의 location ID가 정본이 된다.
- DB 직접 FK보다 동적 plugin 확장성을 우선하도록 보안정책이 변경된다.

## 10. 정기루틴·Scheduled Reconciler

- 루틴은 `고정 반복` 또는 `회차별 대상 변경`을 지원한다.
- 반복은 매일·매주·매월·N일마다·N주마다·N개월마다를 지원한다.
- 매월 지정일이 없는 달은 루틴별로 `건너뜀` 또는 `그달 마지막 날`을 선택한다.
- 호텔은 24시간 운영하므로 주말·공휴일에도 예정일대로 생성한다.
- 미래 실행 건을 미리 만들지 않고 실행일에 호텔 지점 공용업무로 생성한다.
- 특정 직원·팀·완료책임자에게 자동배정하지 않는다.
- 변경형 루틴은 회차순서대로 진행하고 마지막 회차 다음에는 첫 회차로 돌아간다.
- 루틴 변경은 다음 미생성 실행 건부터 적용하고 이미 생성된 실행 건 snapshot은 바꾸지 않는다.
- 호텔 전체·유형 전체·위치 전체 범위는 새로 추가된 활성 대상을 이후 생성 건부터 포함한다.
- 직접 대상목록 루틴은 새 대상을 자동포함하지 않는다.
- 이전 실행 건이 미완료여도 다음 예정일에는 다음 회차 실행 건을 생성한다.
- 기한초과 건은 다음 동일 루틴 실행 전까지 입력·완료할 수 있고 완료하면 `지연 완료`로 보존한다.
- 다음 실행 생성 시 기존 미완료는 읽기 전용 `미완료 종료`로 전환하고 새 실행 생성과 같은 transaction에서 처리한다.
- 미완료 결과를 다음 회차로 복사·병합하지 않는다.
- 누락복구는 현재 업무일 기준 31일까지만 자동생성하고 그보다 오래된 누락은 backlog 경보로 남긴다.
- claim·lease·generation fencing과 idempotent receipt로 중복생성을 차단한다.

## 11. 수시점검

- 객실점검과 시설물점검 화면에 각각 `수시점검 등록하기`를 제공한다.
- 한 개 또는 여러 대상과 대상별 유효항목 한 개 이상을 선택해야 한다.
- 특정 생성자의 개인업무로 고정하지 않고 호텔 지점 공용업무로 생성한다.
- 항목별 실제 수행자를 별도로 기록한다.
- 호텔별 유효한 활성 기본 수시점검 process revision이 없으면 빈 실행 건 없이 안전하게 차단한다.
- 기존 완료기록·정기루틴 회차를 수정하지 않고 별도 실행 건으로 저장한다.

## 12. 공식 최신상태·이력

- process 최종 완료 결과만 대상별 항목 공식 최신상태·최근 점검일에 반영한다.
- 진행 중 저장값은 `진행 중 결과`로 분리한다.
- 미완료 종료 부분결과는 이력에 남기되 공식상태를 덮어쓰지 않는다.
- 항목 유효기간이 지나면 마지막 결과·점검일을 유지하고 `점검 필요`로 표시한다.
- 진행 중 이상은 완료 전에도 권한 있는 화면에 경고한다.
- 중대·긴급은 호텔별 알림담당자 또는 이상알림 수신권한자에게 인앱 알림과 허용된 PWA 푸시를 보낸다.
- 이력은 20건 페이지네이션과 날짜범위·상태·실제 수행자·심각도·루틴명 검색을 제공한다.

## 13. 하자·보수

### 13.1 생성

- 출처는 `객실점검 연결`, `시설물점검 연결`, `직접 등록`이다.
- 주의·이상 결과만으로 자동 보수 건을 만들지 않는다.
- 생성 당시 process 판단단계에서 권한 있는 사용자가 보수 필요를 선택할 때 별도 보수 건을 만든다.
- 원본 점검·대상·항목·결과·설명·사진 snapshot을 연결한다.
- 원본 점검은 필수 보수 건이 모두 완료될 때까지 process에 설정된 대기경로에 머문다.
- 직접 등록은 객실·공용공간·시설물 중 대상 하나와 하자설명, 현장사진 1장 이상 또는 촬영불가 사유가 필요하다.
- 직접 등록에는 호텔별 활성 기본 보수 process revision을 자동 적용하고 등록자가 선택·우회하지 못한다.

### 13.2 대상 무결성

- 보수 건 하나는 객실 한 개·공용공간 한 개·시설물 한 개 중 하나만 대상으로 한다.
- 같은 대상의 관련 하자는 묶을 수 있고 성격이 다르면 여러 건으로 나눌 수 있다.
- 서로 다른 대상을 한 보수 건으로 합치지 않는다.

### 13.3 우선순위

- 호텔별로 이름·정렬순서·표시색·사용여부를 설정한다.
- lifecycle은 `ACTIVE/INACTIVE/DELETED`이며 물리삭제하지 않는다. `INACTIVE`·`DELETED`는 신규 보수 건에서 선택하지 않되 기존 보수 건의 생성 snapshot은 계속 유효하다.
- 코드에 `일반`·`긴급` 같은 값을 고정하지 않는다.
- 등록 시 활성 우선순위 한 개를 필수로 직접 선택하고 기본값을 미리 선택하지 않는다.
- 시스템이 점검결과·설명·사진으로 자동판정하지 않는다.
- 선택 당시 설정 ID·version·이름·순서·색상 snapshot을 저장한다.
- 설정변경은 기존 건에 소급하지 않고 진행 중 건의 직접 변경에는 사유·전후 이력을 남긴다.
- 우선순위는 정렬·필터·배지용이며 process·담당자·일정·알림을 자동변경하지 않는다.

### 13.4 수행·완료

- 수행자는 활성·호텔배정·보수 수행권한을 가진 사내 임직원 또는 외부 보수업체다.
- 외부업체 계정·로그인은 만들지 않고 권한 있는 내부 사용자가 외부 작업결과를 기록한다.
- 외부업체 snapshot은 업체명 필수, 담당자명 선택, 연락처 필수만 저장한다. 이메일·주소·사업자번호·계정·계약·견적·청구정보는 초기 MVP에서 수집하지 않는다.
- 작업완료 제출에는 실제 작업결과 설명과 완료사진 1장 이상 또는 촬영불가 사유가 필요하다.
- 원래 하자사진과 완료사진을 연결해 전후를 확인한다.
- 수행자 제출 후 process 검토자가 승인·반려할 수 있다.
- 완료권한과 현재 단계 처리권한을 모두 가진 내부 사용자는 동일 필수값·증빙·version 검증 후 정식 단계처리로 연속 완료할 수 있다.
- 보수 완료가 객실·시설물 공식 점검상태를 자동 `정상`으로 바꾸거나 최근 점검일을 갱신하지 않는다.
- 재점검을 자동생성하지 않고 생성 당시 process revision의 다음 경로로 이동한다.

## 14. 방문일정

- 보수 건 하나에 현장진단·부품교체·실제 보수·완료확인 등 여러 방문일정을 등록할 수 있다.
- 일정명은 사용자가 구성하고 고정 단계명으로 제한하지 않는다.
- 정확한 시작·종료일시와 사내 수행자 또는 외부업체가 확정된 뒤에만 등록한다.
- 방문일정마다 주 수행자 사내 임직원 한 명 또는 외부업체 한 곳을 정확히 하나만 배정한다. 내부·외부 동시배정과 추가 참여자·협업자 정본은 초기 MVP에서 만들지 않는다.
- 조율 중이면 방문일정을 만들지 않고 보수 건을 `일정 미정`으로 표시한다.
- 잠정일정·희망기간은 달력에 표시하지 않는다.
- 일정 중복을 조회·경고·차단·자동조정하지 않는다.
- 종료시간이 지나도 저장상태를 자동변경하지 않고 조회 시 `시간 경과`로만 표시한다.
- 새 일정 알림은 기본 24시간 전 사내 수행자와 등록자에게 보내고 일정별 사용여부·시점·내부 수신자·앱/PWA 채널을 변경할 수 있다.
- 외부업체에 문자·이메일·푸시를 자동전송하지 않는다.

### 14.1 취소·삭제·다시 잡기

- 취소와 삭제는 별도 command다.
- 취소는 원래 일정·수행자·사유·처리자·시각·version을 보존하고 달력 원래 위치에 회색·취소선·배지로 표시한다.
- 취소일정·취소사유 조회와 취소 실행·감사원문 조회는 각각 동적 권한으로 설정한다.
- 취소 일정은 `취소 복구` 또는 `새 일정 만들기`로 다시 잡을 수 있다.
- 취소 복구는 동일 일정·provider event ID를 유지하고 취소이력을 보존한다.
- 새 일정 만들기는 원본 취소일정을 유지하고 새 일정·provider event를 생성해 원본 ID를 연결한다.
- 삭제는 시작 전 미래 일정이며 작업·첨부·완료·알림 전송이 하나도 없을 때만 허용한다.
- 삭제는 활성 일정과 Google 이벤트를 제거하되 삭제 전 snapshot·사유·처리자·시각은 감사에 남긴다.

### 14.2 구현후보 비교·선택 (`2026-08-01`)

보수 건·우선순위·다중 방문일정의 같은 기능결과를 만드는 저장·실행방식만 비교했다. Calendar provider adapter와 자체 달력 UI는 별도 후보 gate로 남긴다.

| 후보 | 구조·기능 적합성 | UX·PC/모바일 | 보안·격리·동시성 | 비용·상업이용·유지보수 | 확장성 | 판정 |
|---|---|---|---|---|---|---|
| 정규화 PostgreSQL repair aggregate + append-only history | typed source·target, priority·process snapshot, case 아래 독립 visit·performer·완료증빙 current relation과 별도 불변 history | PC 필터·달력 query와 모바일 방문카드·일정별 저장이 직접 relation에 대응하고 서로 다른 visit 수정충돌이 작음 | composite FK·null-safe CHECK·RLS·`FORCE ROW LEVEL SECURITY`; case·visit별 expected version과 transaction 잠금 | 신규 package·서비스·비용 없음, PostgreSQL License로 상업이용 가능; 기존 SQL migration·DB·감사 운영 재사용으로 유지보수 가장 단순 | index·필요 시 partition으로 case·visit·history를 독립 확장하고 Calendar adapter를 경계 밖에서 추가 가능 | **선택** |
| PostgreSQL append-only event stream + current projection | 모든 변경 event를 stream version으로 append하고 case·visit projection을 같은 transaction에서 갱신 | PC·모바일은 projection을 읽어 같은 화면이 가능하지만 projection 오류·재구축 중 최신상태 판정이 추가됨 | event·projection 양쪽 tenant 정책, event schema version·replay·projection rebuild 필요 | PostgreSQL License로 상업이용 가능하고 신규 라이선스 비용은 없지만 자체 event 규약·upcaster·projection을 지속 유지 | 다수 event 소비자와 과거시점 replay에는 유리하나 stream·projection 저장량과 rebuild 운영이 함께 증가 | 비선택 |
| PostgreSQL JSONB repair document aggregate | case 한 행 JSONB에 priority·visits·performer·result·history 배열 저장 | 같은 화면은 가능하지만 모바일에서 visit 하나 저장해도 case 전체 version 충돌, PC 관계형 필터·달력 query가 복잡 | 문서 내부 typed FK·행 CHECK가 약하고 방문별 병렬수정이 case 전체 version에서 충돌; RLS는 case 단위 | PostgreSQL License로 상업이용 가능하고 신규 비용은 없지만 자체 JSON schema·과거문서 migration·GIN query를 지속 유지 | 필드 추가는 쉽지만 문서성장·row 경합·visit/performer별 권한·관계형 분석 확장이 불리 | 비선택 |

선택안은 현재상태를 정규화 relation으로 유지하고 후보 2의 append-only 이력 장점만 흡수한다. JSONB는 감사 before/after summary처럼 제한되고 비정본인 metadata에만 허용하며 대상·우선순위·방문·수행자·완료결과·파일의 업무 정본을 대체하지 않는다.

공식 근거:

- [PostgreSQL Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL JSON Types and Indexing](https://www.postgresql.org/docs/18/datatype-json.html)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL License](https://www.postgresql.org/about/licence/)

### 14.3 선택안의 정본·무결성 경계

- 정본 relation은 `hotel_repair_priorities`, `hotel_repair_cases`, `hotel_repair_case_history`, `hotel_repair_visits`, `hotel_repair_visit_performers`, `hotel_repair_visit_history`다. priority·case·visit current table은 child가 참조할 `(company_id, branch_id, id)` unique parent key를 제공한다. case history와 visit은 `(company_id, branch_id, repair_case_id)`로 case를, performer와 visit history는 `(company_id, branch_id, repair_visit_id)`로 visit을 직접 composite FK 참조한다. current row와 해당 append-only history는 command transaction에서 원자 기록하고 history는 수정·물리삭제하지 않는다.
- `INSPECTION` source는 case typed target과 동일한 회사·호텔 inspection 실행대상·항목·결과 composite FK와 생성 당시 설명·사진 snapshot을 갖고, `DIRECT` source는 inspection 참조 없이 하자설명과 현장사진 1장 이상 또는 촬영불가 사유를 갖는다. 같은 행의 명시적 CHECK가 SQL NULL 우회, 두 source 분기 혼합, inspection source target과 repair target 불일치를 차단한다.
- case target은 `ROOM`이면 `room_id`만, `COMMON_AREA`이면 `common_area_id`만, `FACILITY`이면 `facility_id`만 non-null인 명시적 CHECK와 각 `(company_id, branch_id, typed_id)` composite FK를 사용하고 생성 당시 대상 snapshot을 보존한다.
- 우선순위 이름은 앞뒤 공백을 제거하고 영문 대소문자를 구분하지 않는다. `normalized_name=lower(btrim(name))` stored generated column과 `(company_id, branch_id, normalized_name)` unique를 `ACTIVE/INACTIVE/DELETED` 전체 lifecycle에 적용한다. 물리삭제와 `DELETED` 행 이름변경을 금지해 삭제 후 같은 호텔에서 이름을 재사용하지 않고 다른 호텔에서는 같은 이름을 허용한다.
- 우선순위는 활성 호텔별 definition을 직접 참조하고 선택 당시 ID·version·이름·정렬순서·색상 snapshot을 case에 구조화해 저장한다. 동시 생성·이름변경은 DB unique와 안정 오류로 처리한다. 설정변경은 기존 case에 소급하지 않고 진행 중 직접변경은 expected version·사유·전후 history를 남긴다.
- case는 생성 당시 설정형 공통 process execution을 같은 tenant composite FK로 참조한다. 점검 판단 생성과 직접등록 모두 process를 우회하지 않는다.
- case 한 건에 독립 `hotel_repair_visits` 여러 행을 두고 각 visit이 별도 version을 가진다. `hotel_repair_visit_performers`는 `(company_id, branch_id, repair_visit_id)` unique로 최대 한 행을 강제하고, visit·performer 양쪽 INSERT·UPDATE·DELETE를 감시하는 deferred constraint trigger가 commit 시 활성 visit마다 정확히 한 행인지 검사한다. `INTERNAL`은 같은 tenant의 활성 사내 임직원 사용자유형·유효 호텔배정·보수권한을 command에서 재검증하고, `EXTERNAL`은 `contractor_name` 필수·`contact_name` 선택·`contact_phone` 필수 snapshot만 갖도록 null-safe CHECK해 내부·외부 혼합을 차단한다. visit·performer는 승인 command transaction에서 원자 생성한다. 진행 중 교체와 최종완료는 공통 `case → process execution → visit UUID → performer UUID` 순서로 잠그고 상태·version·자격을 재조회하며, 교체는 사유·history를 원자 기록하고 완료 뒤 차단한다. 업체정보 변경은 다른 일정·기존 snapshot에 소급하지 않는다.
- 방문시간 중복을 위한 제약·조회·경고·차단·자동조정을 만들지 않는다. 종료시각 경과는 저장상태 mutation 없이 조회에서만 계산한다.
- 최종완료 command는 case·process expected version, 현재 단계권한, 필수 작업결과, 검역통과 증빙과 모든 visit·performer를 위 공통 순서로 잠금·재검증해 한 번만 완료한다. 완료 뒤 case·visit·수행자·증빙 핵심필드는 수정·재개하지 않으며 추가 작업은 완료 case를 바꾸지 않는 새 보수 건으로 만든다.
- 모든 정본·history는 회사·호텔 scope CHECK, tenant 포함 composite FK, RLS·`FORCE ROW LEVEL SECURITY`, non-owner/non-`BYPASSRLS` runtime을 적용한다. migration owner만 FK·UNIQUE를 생성하고 runtime·reconciler role에는 table owner·superuser·`BYPASSRLS`·DDL·직접 `REFERENCES` 권한을 부여하지 않는다. 승인 command는 권한·tenant를 FK 평가 전에 검증하고 타 tenant parent 존재여부를 구분할 수 없는 안정 오류를 반환한다. `REPAIR_EXTERNAL_CONTACT_VIEW` 동적권한 보유자만 목록·상세·직접 API·history에서 외부업체 담당자명·연락처 원문을 보고, 미보유자는 업체명과 마스킹 연락처만 본다. 원문은 로그·오류·감사요약·검색색인·Calendar payload에 포함하지 않는다.
- 방문일정 저장은 PostgreSQL current·history 재조회까지 성공으로 본다. Calendar outbox·provider event ID·OAuth·재시도는 adapter 후보가 승인되기 전 생성하거나 구현하지 않는다.

### 14.4 재사용·제외·구현 전 gate

- 현재 source에는 repair relation·Contracts·Repository·Service·API·Web UI 구현이 없다. 승인된 process·inspection·facility·RLS·version·멱등·감사·비공개 파일 패턴은 Red를 통과하는 최소 hunk만 재사용한다.
- 완료 뒤 새 보수 건의 관계명·화면표시를 제품정책으로 확정한다.
- 위 제품정책과 exact relation column·command·권한·오류계약·잠금순서를 구현계획에 명시하고 별도 mutation 승인을 받기 전에는 migration·Red·코드를 시작하지 않는다.
- 보수 event가 법적 정본이 되고 모든 현재상태를 replay로만 재구축하거나 여러 외부시스템의 실시간 event 정본이 필요해지면 event-stream 후보를 다시 선정한다.
- 방문일정이 독립 자원예약·중복판정·자동배정·최적화로 확대되거나 외부업체 계정·포털·청구·계약관리 또는 PMS·자산관리 시스템이 정본이 되면 제품범위와 후보를 다시 승인받는다.
- 신규 package·외부 서비스·event runtime·projection rebuild·JSONB-only 업무 정본은 도입하지 않는다.

## 15. 자체 달력 UI

- shadcn/ui·Radix UI·Tailwind CSS 기반 자체 화면만 사용한다.
- PC는 월간·주간 보기를 제공하고 초기 MVP에 일간 보기는 없다.
- 최초·기억시간 만료 후에는 주간 보기로 시작한다.
- 사용자가 선택한 마지막 보기는 브라우저에 보기종류·마지막 사용시각만 저장해 2시간 기억한다.
- 로그아웃·계정 변경 시 제거하고 호텔·객실·보수·provider 식별자는 저장하지 않는다.
- 모바일은 PC 달력을 축소하지 않고 동일 데이터를 터치 가능한 반응형 구조로 재배치한다.
- 기본은 현재 호텔 한 곳이고 권한 있는 사용자가 직접 `전체 호텔`을 선택했을 때만 허용 호텔 일정을 통합한다.
- 전체호텔 보기에서 일정 생성 시 호텔을 첫 필수항목으로 직접 선택하고 자동선택하지 않는다.
- 호텔 선택 후 해당 호텔의 보수 건·대상·수행자만 조회하고 저장 transaction에서 범위를 다시 검증한다.

## 16. Google Calendar backend-only 연동

### 16.1 정본과 범위

```text
호텔관리 자체 UI
→ same-origin API
→ PostgreSQL transaction·outbox
→ Google Calendar API
```

- PostgreSQL이 일정·권한·version·감사의 정본이다.
- Google 직접수정 값은 호텔관리로 역수입하지 않는다.
- 초기 MVP는 호텔마다 `보수일정` Google Calendar 리소스 하나를 연결한다.
- 호텔별 DB 테이블을 만들지 않고 공용 연결 테이블의 회사·범위유형·범위 ID·용도·provider calendar ID로 구분한다.
- 다른 호텔 캘린더로 fallback하거나 이벤트를 복사하지 않는다.
- 전용 Google 연동계정은 현재 DB 동적 Calendar 연동설정권한과 회사·호텔 범위·개인 회수 우선을 통과한 내부 운영자가 중요작업 재인증 뒤 OAuth 2.0으로 연결한다. 연결·교체·해제·수동 재시도마다 현재 권한을 다시 검증하고 안전한 전후값·행위자·시각·결과를 감사한다.
- 일반 사용자는 Google 로그인·동의화면·Google 계정연결을 하지 않는다.
- 구현은 앱이 생성·관리하는 보수 캘린더와 이벤트에 필요한 공식 최소 OAuth scope allowlist만 허용하고 더 넓은 scope나 allowlist 불일치는 안전 실패한다. exact scope는 구현 전 provider 문서·보안검토에서 동결한다.
- access/refresh token은 승인된 암호화·secret 경계에만 저장하고 브라우저·API 응답·로그·감사에 원문을 남기지 않는다. 연결대상은 원문 식별자 대신 안전한 fingerprint로 감사하며 credential 저장·회전·폐기는 provider mutation 승인에 포함한다.

### 16.2 최소정보

Google에 보내는 값:

- 일반 제목 `보수 방문일정` 또는 `취소된 보수 방문일정`
- 확정 시작·종료일시
- 호텔 업무시간대
- 불투명 내부 연결키

Google에 보내지 않는 값:

- 호텔명·객실번호·공용공간·시설물·층
- 하자내용·점검결과·사진
- 사내 수행자·외부업체·담당자·연락처
- 변경·취소·삭제 사유
- 참석자·Google 이메일 알림·Google reminder

### 16.3 실패·재시도

- PostgreSQL 일정 확정 뒤 outbox로 생성·변경·취소·삭제를 구분해 보낸다.
- timeout·일시적 provider 오류·rate limit만 증가 backoff와 jitter로 제한 재시도한다.
- 인증·권한·scope·삭제된 캘린더·유효하지 않은 요청은 반복하지 않고 관리자 확인 대상으로 중지한다.
- 한도초과는 `캘린더 반영 실패`로 유지하고 권한 있는 관리자에게 원인·마지막 시도·호텔을 알린다.
- 관리자는 원인을 해결한 뒤 수동 재시도할 수 있다.
- 자동·수동 재시도 전 최신 일정 version·호텔·연결·권한을 다시 검증한다.
- idempotency key와 provider event ID로 중복 이벤트를 차단한다.
- 일정 aggregate별 outbox는 단일 직렬순서와 단조 증가 source version으로 처리한다. provider 호출 전에 최신 정본 version·provider 적용 version을 비교하고 오래된 job은 `SUPERSEDED`로 종료한다.
- 생성 timeout 뒤 취소, 변경 v2 뒤 v1 재시도, 취소 뒤 복구 경쟁에서도 최신 source version만 provider에 반영하며 취소·삭제가 오래된 생성·변경으로 되돌아가지 않도록 claim token과 version fence를 함께 검증한다.
- Google 실패가 PostgreSQL 일정·보수·process를 rollback하거나 가짜 성공시키지 않는다.

## 17. API 경계 제안

실제 경로는 후보 승인 뒤 `packages/contracts`에 먼저 정의한다.

```text
/api/process-definitions/*
/api/process-executions/*
/api/hotels/:hotelId/inspection-items?targetType=ROOM|FACILITY
/api/hotels/:hotelId/facility-types/*
/api/hotels/:hotelId/common-areas/*
/api/hotels/:hotelId/facilities/*
/api/hotels/:hotelId/inspection-routines/*
/api/hotels/:hotelId/inspections/*
/api/hotels/:hotelId/repairs/*
/api/hotels/:hotelId/repair-visits/*
/api/admin/calendar-connections/*
/api/admin/calendar-sync-failures/*
```

- 브라우저는 same-origin API만 호출한다.
- 변경 API는 version·멱등키·transaction·감사·안전 오류코드를 사용한다.
- 타 회사·타 호텔·타 대상 ID 직접전송은 존재·건수·식별정보를 노출하지 않고 차단한다.
- DB·R2·schema·Calendar 연결 미설정은 부분자료나 가짜 성공 없이 안전하게 실패한다.

## 18. 데이터 경계 제안

이 절은 전체 도메인의 논리경계를 요약한다. 실제 테이블명은 `approved` 후보 결정절에서 명시한 공통 process·inspection·시설물 기준정보·보수 범위만 정본이며, 아직 `unresearched`인 Calendar adapter·달력 UI의 relation 이름은 확정하지 않는다.

- process definition·revision·stage·transition·assignment·execution·history
- 공용공간·시설물유형·시설물·위치 snapshot
- 점검항목 definition·호텔/유형 적용·revision
- inspection routine·revision·target·cursor·receipt·backlog alert
- inspection execution·target snapshot·item snapshot·result·performer·attachment
- 대상별 공식 최신상태·최근 점검일·이력
- repair priority definition·snapshot
- repair case·source snapshot·target snapshot·process execution
- repair visit·status history·notification
- calendar connection·provider event link·outbox attempt·sync failure

모든 tenant table은 `company_id`를 필수로 가진다. 호텔 범위 실행·설정·일정·파일·outbox는 호텔 지점 정본 `branch_id`와 `(company_id, branch_id)` 복합 FK를 필수로 하며, 회사 공통 process·역할·권한처럼 회사 범위인 행은 `scope_type=COMPANY + branch_id IS NULL`, 호텔 범위 행은 `scope_type=HOTEL + branch_id IS NOT NULL` CHECK로 구분한다. sentinel 호텔 지점 ID나 범위 우회를 금지한다.

모든 tenant table은 RLS와 `FORCE ROW LEVEL SECURITY`를 적용한다. runtime·API·scheduled reconciler role은 table owner·superuser·`BYPASSRLS`가 될 수 없고, 회사·호텔 context 미설정·조작·타 tenant ID·직접 SQL command도 같은 정책으로 차단한다.

## 19. 수용 기준

- 객실·시설물 정기·수시점검이 실제 PostgreSQL에 저장·재조회된다.
- 항목별 실제 수행자와 변경이력이 보존된다.
- 주의 설명·이상 설명과 1~5장 사진 규칙을 서버가 검증한다.
- process revision 변경 뒤 기존 실행 건은 생성 당시 경로를 유지한다.
- 주 담당자·대리인 동시처리는 한 명만 성공한다.
- 담당자 무효화는 자동처리 없이 중지되고 권한 있는 관리자가 현재 담당자만 교체한다.
- 단계기한 초과는 지연표시만 만들고 자동승인·반려·이동하지 않는다.
- 최종 완료 뒤 모든 핵심필드 수정·재개가 차단된다.
- 객실·시설물 공식상태는 최종 완료 결과만 반영한다.
- 보수 완료가 공식 점검상태를 자동 정상화하거나 재점검을 만들지 않는다.
- 객실·공용공간·시설물 대상 무결성과 snapshot이 유지된다.
- 31일 catch-up·초과 backlog·claim fencing·idempotent receipt가 실제 PostgreSQL에서 검증된다.
- 취소·삭제·복구·새 일정 생성이 서로 다른 감사이력과 provider 동작을 만든다.
- 전체호텔 보기와 일정 생성이 호텔별 동적 권한을 재검증한다.
- Google에는 승인된 최소정보만 전송되고 실패가 PostgreSQL 업무를 rollback하지 않는다.
- 브라우저 네트워크는 same-origin API만 호출하고 frontend bundle·응답·브라우저 저장소에 OAuth credential·provider calendar/event ID가 없다.
- 오래된 Google outbox version은 provider 호출 없이 superseded되고 생성·변경·취소·삭제 경쟁에서 최신 PostgreSQL version만 반영된다.
- 타 회사·타 호텔·회수된 권한·만료 배정의 UI·API·DB 우회가 차단된다.
- 회사/호텔 scope CHECK, RLS·`FORCE ROW LEVEL SECURITY`, non-owner/non-`BYPASSRLS` runtime·reconciler와 직접 SQL 교차 tenant 차단을 실제 PostgreSQL에서 검증한다.
- PC 월간·주간, 모바일 현장 카드, 키보드·포커스·스크린리더·44px 터치영역을 검증한다.
- Preview PostgreSQL·비공개 R2·권한차단 E2E 전 Production 배포를 금지한다.

## 20. 구현 전 차단조건

- 이 문서의 각 `unresearched` 구현후보를 정확히 세 후보로 조사한다.
- 비용·UX·PC·모바일·보안·호텔격리·라이선스·운영·유지보수·확장성을 비교한다.
- 대장이 기능별 후보를 명시적으로 선택해 `approved`로 바꾼다.
- 승인 전 기존 dirty 객실점검 구현을 완료·commit·PR·merge·배포하지 않는다.
- 선택 뒤 exact snapshot·mutation manifest·Red 테스트부터 새 개발 사이클을 시작한다.
