# 객실 기준정보·객실점검 PRD

## 문서 정보

| 항목   | 값                                                            |
| ------ | ------------------------------------------------------------- |
| PRD ID | `HOTEL-MVP-020`                                               |
| 상태   | `user_approved`                                               |
| 근거   | 사용자 원장 `5. 운영사업부.md`, 공통 정본 `12-inspection-process-facility-repair-calendar-prd.md` |

공통 process·권한·정기/수시점검·결과·사진·공식상태·시설물·보수·Calendar는 [12 공통 점검·보수 PRD](12-inspection-process-facility-repair-calendar-prd.md)를 따른다. 이 문서는 객실 기준정보와 객실타입별 항목 적용의 고유규칙을 정의한다.

## 객실 기준정보

| 필드     | 필수 | 규칙                                      |
| -------- | ---- | ----------------------------------------- |
| 객실번호 | Y    | `upper(btrim(value))`로 저장·검색·표시, 같은 호텔의 현재 객실에서 대소문자와 무관하게 유일, 다른 호텔은 중복 가능 |
| 층       | Y    | 호텔별 층 그룹 기준정보                    |
| 객실유형 | Y    | 호텔별 독립 기준정보                       |
| 기준정보 상태 | Y | 활성·사용중지·삭제, 신규 업무대상 포함 여부 |
| version  | Y    | 오래된 저장 409                           |

예약·요금·투숙객 이름·연락처·예약번호는 수집하지 않는다. 판매·투숙·공실·청소·보수중·사용불가 같은 객실 운영 사용상태도 구현하지 않는다. 기준정보 상태는 신규 점검·보수 대상 포함 여부만 판정한다.

### 객실 기준정보 구현 방식 승인

| 항목           | 값                                                        |
| -------------- | --------------------------------------------------------- |
| 후보 gate 상태 | `superseded`                                              |
| 선택자         | 대장                                                      |
| 선택           | 과거 추천안 A                                              |
| 적용 범위      | 과거 객실 기준정보·객실유형·운영상태 설계                 |
| 제외 범위      | 체크리스트·객실점검·예약·PMS·OTA 연동과 그 밖의 신규 기능 |

객실 운영상태 제거, 호텔별 독립 객실유형, 층 그룹, 삭제·snapshot 정책으로 제품범위와 저장구조가 변경됐으므로 이 과거 후보 승인은 현재 구현에 재사용하지 않는다. 최신 공통 process engine, 객실·시설물 공통 inspection 대상·결과 모델, 시설물·공용공간 기준정보, 보수 건·우선순위·방문일정 모델과 Calendar adapter는 12 PRD에서 `approved`이며, 자체 월간·주간 달력 UI만 `unresearched`로 관리한다.

시설물 설치위치는 구현된 객실 기준정보 `ACTIVE/INACTIVE/DELETED` lifecycle을 전제로 한다. 판매·투숙·공실·청소·보수중·사용불가 같은 운영상태는 객실 command·시설물 위치판정에 재사용하지 않는다.

동일 기능 구현 후보와 선택 결과:

| 구현 영역      | 후보 A — 선택                                              | 후보 B                                            | 후보 C                             |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| 데이터·API     | 계약 → Service/Repository → PostgreSQL                     | PostgREST DB-first REST + RLS                     | Hasura GraphQL Engine + PostgreSQL |
| 검색           | 네이티브 검색폼 + 내부 서버 API                            | cmdk 기반 검색                                    | Downshift 기반 원격 검색           |
| PC·모바일 목록 | TanStack Query + 공용 DataTable·semantic table·모바일 카드 | TanStack Table/Query + semantic table·모바일 카드 | AG Grid + 별도 모바일 카드         |
| 폼·접근성      | React Hook Form + Zod + Radix                              | Conform                                           | React Aria Components              |
| 상태 전이      | PostgreSQL transaction·lock/version                        | XState + PostgreSQL                               | DBOS durable workflow              |
| 멱등성         | PostgreSQL idempotency ledger                              | node-idempotency                                  | DBOS workflow ID                   |
| 감사           | transactional domain audit                                 | pgAudit 보완                                      | Retraced self-host 복제            |
| 권한·격리      | PostgreSQL RLS + 애플리케이션 권한                         | OpenFGA + RLS                                     | Cerbos + RLS                       |

선택 이유는 신규 외부 서비스·유료 API·두 번째 UI 체계 없이 현재 TypeScript·PostgreSQL·Cloudflare 구조에서 회사·호텔 격리, transaction, 감사, 모바일 접근성을 가장 단순하게 강제할 수 있기 때문이다. 기존 스택이라는 이유로 자동 선택한 것이 아니라 비용·라이선스·상업 이용·보안·호텔 격리·운영 부담·유지보수·확장성을 비교한 결과다.

다음 조건이 생기면 추천은 무효가 될 수 있으며 기능 확장 PRD와 후보 gate를 다시 수행한다.

- 외부 PMS가 객실정보의 정본으로 승인됨
- 원격 자동완성, 수만 행 Excel형 편집 또는 장기 다중 시스템 saga가 필수화됨
- 관계·속성 권한이 현재 애플리케이션 권한과 RLS로 감당할 수 없게 됨
- 새 UI·API·저장 구조·운영 시스템이 필요해짐

대안 도입 전에는 PoC, 법률·라이선스, 보안·호텔 격리, 성능, 배포·운영 gate를 각각 통과해야 한다.

### 객실 기준정보 상태

- 정본 상태는 `ACTIVE`, `INACTIVE`, `DELETED`다.
- 일반 상태변경 command는 `ACTIVE → INACTIVE`, `INACTIVE → ACTIVE`만 허용한다.
- 삭제는 일반 상태변경과 분리된 명시적 command이며 `INACTIVE → DELETED`만 허용한다. `ACTIVE`에서 직접 삭제할 수 없다.
- `DELETED`는 영구 종료다. 정보수정·상태변경·복구·물리삭제를 금지하고 과거 점검·보수·감사·상태이력 조회만 유지한다.
- 기본 객실 목록·검색·pagination total에는 `DELETED`를 포함하지 않는다. 삭제 row의 immutable ID 상세와 과거 이력은 내부 감사·과거업무 조회를 위해 보존한다.
- 활성 객실만 신규 점검·보수 대상으로 선택한다.
- 사용중지·삭제 객실은 다음 미생성 루틴부터 제외한다.
- 사용중지·삭제 전에 생성된 점검과 과거 이력은 당시 객실번호·층·객실타입 snapshot으로 계속 수행·조회한다.
- 객실점검·보수·방문일정·완료가 객실 기준정보 상태를 자동 또는 수동으로 변경하지 않는다.
- 시설물 slice가 활성화된 뒤에는 활성 시설물이 연결된 객실의 사용중지·삭제를 차단하고 시설물을 다른 활성 위치로 옮기거나 먼저 사용중지·삭제해야 한다. 해당 후속 release gate에서 객실·연결 시설물 잠금, 재검사, 오류코드, 실제 PostgreSQL 동시성 검증을 함께 구현하며 그 전까지 이 관계 gate를 구현 완료로 간주하지 않는다.
- 삭제된 객실번호는 재사용할 수 있지만 새 내부 객실 ID를 만들고 이전 이력과 합치지 않는다.
- current 객실 모델·API·UI에는 `plannedResumeDate`를 두지 않으며 날짜 기반 자동 활성화도 없다. migration 전 append-only 상태이력의 과거 재개 예정일만 감사 snapshot으로 보존한다.
- forward migration은 `ACTIVE → ACTIVE`, `TEMP_SUSPENDED → INACTIVE`, `OUT_OF_SERVICE → INACTIVE`로 변환하고 legacy 행을 자동 `DELETED`로 만들지 않는다. current 변환은 version 증가와 시스템 migration history로 남긴다.
- 객실번호는 앞뒤 ASCII space만 제거한 뒤 ASCII `A-Z`, `0-9`, `.`, `_`, `/`, `-` 1~40자로 제한하고 ASCII 대문자로 저장한다. CONTRACT 전 legacy 값이 이 문자계약을 벗어나거나 같은 호텔에서 `upper(btrim(room_number))`가 충돌하면 migration은 `HOTEL_ROOM_NUMBER_UNSUPPORTED` 또는 `HOTEL_ROOM_CANONICAL_COLLISION`로 mutation 전에 안전 중단한다. 운영자는 충돌 row를 임의 병합하지 않고 객실·연결 이력 영향과 유지할 번호를 확인해 승인된 별도 정리 후 migration을 재실행한다.
- 객실 생성·정보수정·상태변경·삭제는 모두 원본 opaque session bearer를 PostgreSQL command에 전달하고 최신 session·유효 호텔배정·개인 DENY 우선 권한·version·멱등·감사를 같은 transaction에서 검증한다. 회사 전체 `ALLOW`도 유효 호텔배정을 대체하지 않는다. API runtime의 `hotel_rooms` 직접 `INSERT/UPDATE`는 금지한다.
- Web은 mutation 응답을 parse한 뒤 같은 객실 ID 상세와 현재 목록을 재조회해 material 결과가 일치할 때만 성공 종료한다. 응답유실로 동일 payload를 재전송할 때는 같은 멱등키를 유지하고, version conflict 뒤 최신 version·가능 전이로 body가 바뀌면 입력·사유를 보존한 채 새 멱등키를 사용한다.

## 객실 점검항목

- 각 호텔은 객실 공통 점검항목을 관리한다.
- 객실타입별 유효항목은 `호텔 객실 공통항목 - 객실타입 제외항목 + 객실타입 추가항목`으로 계산한다.
- 적용하지 않는 항목은 점검에서 `해당없음`으로 입력하지 않고 객실타입 설정에서 제외한다.
- 객실유형 기준정보는 유효항목이 0개여도 먼저 저장할 수 있다. 다만 실행시점 유효항목이 0개인 대상의 점검 생성은 안전 오류로 차단하고 기준정보 설정으로 안내한다.
- 변경마다 불변 revision을 만들고 이미 생성된 점검에는 당시 항목·유형·증빙조건 snapshot을 보존한다.
- 설정권한은 역할명이 아니라 06·12 PRD의 동적 기능권한으로 판정한다.

스냅샷 필수값:

```text
항목명, 설명, 필수여부, 표시순서,
기본 심각도, 정상·주의·이상 증빙조건, 항목 revision
```

실제 항목과 객실타입별 제외·추가는 호텔 DB 설정값이며 항목명·분류를 코드에 고정하지 않는다.

## 점검 일정과 생성

- 대상은 호텔 전체·특정 층 전체·객실타입 전체·개별 객실목록이다.
- 반복은 매일·매주·매월·N일·N주·N개월, 고정형·변경형 회차를 지원한다.
- 미래 실행 건을 선생성하지 않고 예정일에 호텔 지점 공용업무로 생성한다.
- 특정 완료책임자·참여자를 루틴에 고정하지 않는다.
- 같은 일정·객실·업무일은 DB unique와 멱등 receipt로 중복생성하지 않는다.
- 사용중지·삭제 객실은 다음 실행부터 제외하고 생성 당시 snapshot은 유지한다.
- 기한초과·미완료 종료·31일 catch-up·backlog·claim fencing은 12 PRD를 따른다.

## 점검 수행

- 같은 호텔의 점검 수행권한자가 객실·항목을 나누어 수행하고 항목별 실제 수행자를 기록한다.
- 정상은 설명·사진 선택, 주의는 설명 필수·사진 선택, 이상은 설명과 사진 1~5장 필수다.
- 결과입력만으로 완료하지 않고 생성 당시 설정형 검토 프로세스의 최종 완료조건을 통과해야 한다.
- 수행·검토·대리·기한·지연·최종잠금은 12 PRD를 따른다.

### 이상등급

| 등급 | 의미                    | 후속처리                            |
| ---- | ----------------------- | ----------------------------------- |
| 관찰 | 추적 필요               | 점검 안에서 기록                    |
| 경미 | 일반 보완·수선          | 점검 안에서 기록, 필요 시 수동 이슈 |
| 중대 | 운영차질·고객영향 가능  | 경고·설정된 내부알림, 자동 보수생성 없음 |
| 긴급 | 안전·보안·영업중단 위험 | 경고·설정된 내부알림, 자동 보수생성 없음 |

주의·이상·심각도만으로 운영이슈나 보수 건을 자동생성하지 않는다. 생성 당시 프로세스 판단단계에서 권한 있는 사용자가 선택할 때 별도 보수 건을 만든다.

### 취소·재점검 — 사용자 승인

- 예정·진행중 점검은 점검관리자가 사유와 함께 취소한다.
- 완료점검은 다시 열거나 덮어쓰지 않는다.
- 재점검은 새 점검으로 생성하고 원본 `inspection_id`를 연결한다.

## 청결 범위

공통 점검에 청결·침구 육안확인은 포함하지만 청소대기·청소중·청소완료 상태, 청소배정, 청소완료 업무는 만들지 않는다.

## 데이터 모델 제안

| 엔터티                                | 역할                                  |
| ------------------------------------- | ------------------------------------- |
| `hotel_room_types`                    | 호텔별 객실유형·제외/추가 항목 연결   |
| `hotel_rooms`                         | 객실 기준정보·층·유형·version          |
| `inspection_item_definitions/revisions` | 호텔 공통·유형별 적용항목            |
| `inspection_routines/revisions/targets` | 반복·회차·대상·기한 snapshot         |
| `inspection_executions/targets`       | 공용 실행 건·객실 대상 snapshot        |
| `inspection_item_snapshots/results`   | 항목 snapshot·정상/주의/이상·실제 수행자 |
| `inspection_attachments`              | 비공개 파일 참조                      |
| 공통 process·보수 엔터티              | 12 PRD 논리경계                       |

## 상태 제안

```text
생성 → 현장입력 → 생성 당시 process 단계·분기 → 최종완료
                     └→ 필요 시 별도 보수 건 → 설정된 다음 경로
최종완료 → 불변, 새 수시점검만 생성 가능
```

## API 제안

| 메서드    | 경로                                                       |
| --------- | ---------------------------------------------------------- |
| GET/POST  | `/api/hotels/:hotelId/rooms`                               |
| GET/PATCH | `/api/hotels/:hotelId/rooms/:roomId`                       |
| POST      | `/api/hotels/:hotelId/rooms/:roomId/status`                |
| POST      | `/api/hotels/:hotelId/rooms/:roomId/delete`                |
| GET/POST  | `/api/hotels/:hotelId/room-types`                          |
| GET/POST  | `/api/hotels/:hotelId/inspection-items?targetType=ROOM`     |
| GET/POST  | `/api/hotels/:hotelId/inspection-routines`                 |
| POST      | `/api/hotels/:hotelId/inspections`                         |
| PATCH     | `/api/hotels/:hotelId/inspections/:inspectionId/results`   |
| POST      | `/api/hotels/:hotelId/inspections/:inspectionId/transitions` |
| POST      | `/api/hotels/:hotelId/inspections/:inspectionId/repair`    |

## 수용 기준

- 다른 호텔 객실 ID 직접전송을 서버가 차단한다.
- 사용중지·삭제 객실에는 신규점검을 만들지 않는다.
- 권한 없는 단계처리·대리기간 밖 처리·오래된 version을 차단한다.
- 주의 설명·이상 설명과 사진 1~5장 누락을 차단한다.
- 결과만으로 운영이슈·보수 건을 자동생성하지 않는다.
- 템플릿 변경 후 기존 점검을 열어도 당시 항목을 재현한다.
- 자동생성 중복이 없고 지점 공용업무·항목별 실제 수행자 이력이 유지된다.
