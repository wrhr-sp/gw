# 호텔 일매출 PRD

## 문서 정보

| 항목 | 값 |
|---|---|
| PRD ID | `HOTEL-MVP-040` |
| 상태 | `user_approved` |
| 근거 | `COM-Q-009,029~032,048,050,056`, `HDRAFT-009~014` |

## 목적과 최소범위

PMS·OTA 없이 호텔별 업무일 일매출을 직접 입력·확정·정정하고 증빙과 책임자를 보존한다. 고객 이름·연락처·예약번호 등 고객별 개인정보는 수집하지 않는다.

## 입력 단위

호텔 + `Asia/Seoul` 업무일의 일 집계.

| 필드 | 규칙 |
|---|---|
| 매출구분 | DB 기준정보 |
| 결제수단 | DB 기준정보 |
| 총매출 | 0 이상 |
| 할인 | 0 이상 |
| 환불 | 0 이상, 환불근거 필수 |
| 순매출 | 서버가 `총매출-할인-환불` 재계산 |
| 메모 | 선택 |
| 증빙 | 확정 시 마감증빙 1개 이상 |

호텔·업무일의 중복집계는 DB unique와 멱등키로 차단한다.

## 상태

```text
임시저장 → 확정 → 잠금
                    └→ 정정버전 생성 → 잠금
```

- 임시저장 중 편집 가능.
- 확정에는 `HOTEL_SALES_CONFIRM`, 유효 호텔배정, 마감증빙이 필요.
- 확정 후 원본을 덮어쓰지 않는다.
- 정정에는 `HOTEL_SALES_CORRECT`, 사유, 원값·새값, 정정근거가 필요.

## 권한

| 사용자 | 권한 |
|---|---|
| 유효배정 사내 임직원 | 추가 `HOTEL_SALES_VIEW/MANAGE/CONFIRM/CORRECT`에 따라 수행 |
| 호텔 소유주 | 자기 호텔 확정매출·허용증빙 조회 |
| 하우스키핑 | 접근 불가 |

조회·다운로드 권한은 관리자 화면에서 역할·그룹·개인별 설정한다. 파일마다 별도 승인요청은 하지 않는다.

## 데이터 모델 제안

- `hotel_daily_sales`
- `hotel_daily_sales_lines`
- `hotel_daily_sales_versions`
- `hotel_daily_sales_corrections`
- `hotel_daily_sales_attachments`
- `hotel_sales_categories`
- `hotel_payment_methods`

금액은 정수 원 단위 또는 `numeric`으로 저장하되 프론트 계산값을 신뢰하지 않고 서버가 재계산한다.

## API 제안

| 메서드 | 경로 |
|---|---|
| GET/POST | `/api/hotels/:hotelId/daily-sales` |
| GET/PATCH | `/api/hotels/:hotelId/daily-sales/:salesId` |
| POST | `/api/hotels/:hotelId/daily-sales/:salesId/confirm` |
| POST | `/api/hotels/:hotelId/daily-sales/:salesId/corrections` |

## 오류

- 중복 업무일: `HOTEL_SALES_DUPLICATE_DATE`
- 합계 불일치: `HOTEL_SALES_TOTAL_MISMATCH`
- 증빙 없음: `HOTEL_SALES_EVIDENCE_REQUIRED`
- 잠긴 자료 수정: `HOTEL_SALES_LOCKED`
- 오래된 version: `VERSION_CONFLICT`
- DB 미설정/schema drift: 안전한 503, 성공 fallback 금지

## 수용 기준

- 서버 순매출과 DB 재조회값이 일치한다.
- 하우스키핑·타 호텔·권한 없는 사내계정의 직접 API 호출이 차단된다.
- 확정 후 PATCH가 차단되고 정정 API로만 새 버전을 만든다.
- 환불·정정 근거 없이는 저장되지 않는다.
- 호텔 소유주는 확정자료만 보고 내부메모·작성자 개인정보는 보지 못한다.
- 원본·정정 전후·행위자·첨부 버전이 감사에서 재현된다.
