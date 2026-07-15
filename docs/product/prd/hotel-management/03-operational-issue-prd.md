# 호텔 운영이슈 PRD

## 문서 정보

| 항목 | 값 |
|---|---|
| PRD ID | `HOTEL-MVP-030` |
| 상태 | `user_approved` |
| 근거 | `COM-Q-024~027,033~034,048~050,056`, `HDRAFT-005~008` |

## 목적

점검 이상과 현장 신고를 하나의 이슈로 관리해 담당·조치·소유주 공개·종료를 추적한다.

## 생성 경로

- 지점 유효배정 사내 임직원·하우스키핑의 수동 등록.
- 객실점검 중대·긴급 결과의 자동생성.
- 자동생성은 원본 점검·항목·객실을 참조하며 중복방지키를 사용한다.

## 상태

```text
접수 → 담당지정 → 처리중 → 조치완료 → 종료
          ├→ 보류 → 재개
          └→ 취소
종료 → 재개(권한·사유 필요)
```

- 모든 전이에 행위자·시각·사유·version을 기록한다.
- 보류에는 재개예정일을 둘 수 있고 초과 시 담당자와 이슈관리자에게 알린다.
- 완료·취소 자료는 물리삭제하지 않는다.

## 권한

| 사용자 | 허용 |
|---|---|
| 지점 유효배정자 | 이슈 등록 |
| 지정 담당자 | 처리중, 작업기록, 조치완료 |
| `HOTEL_ISSUE_MANAGE` | 담당지정·보류·취소·종료·재개 |
| 호텔 소유주 | 자기 호텔 공개내용 조회·공개댓글 |
| 하우스키핑 | 본인 담당 이슈 작업·조치완료 |

호텔 소유주에게 사내 개인정보·내부메모·감사원문을 노출하지 않는다.

## 공개댓글과 내부메모 — 사용자 승인

- 공개댓글: 소유주와 허용 사내 담당자가 확인.
- 내부메모: 사내 권한자만 확인.
- 내부메모를 공개로 상태변경하지 않는다. 필요하면 새 공개댓글을 작성해 출처를 감사한다.

## 등급과 기한

관찰·경미·중대·긴급을 공통 사용한다. 등급별 응답·조치기한은 회사 DB 정책으로 설정하며 호텔별 완화는 금지하고 허용범위 내 단축만 허용한다. 숫자 SLA는 사용자 검토 후 확정한다.

## 긴급 알림

- 해당 호텔 유효배정 사내 임직원 전원
- 해당 호텔 유효연결 하우스키핑 전원
- 해당 호텔 소유주
- 앱 내부 알림 항상 생성
- 동의·유효구독이 있는 PWA에 웹푸시
- 푸시 실패는 이슈 transaction을 rollback하지 않고 실패상태를 저장

## 데이터 모델 제안

`hotel_operational_issues`, `hotel_issue_assignments`, `hotel_issue_status_history`, `hotel_issue_work_logs`, `hotel_issue_comments`, `hotel_issue_internal_notes`, `hotel_issue_links`.

각 행은 `company_id`, `hotel_id`, 필요 시 `room_id`, `inspection_id`, `version`을 가진다.

## API 제안

| 메서드 | 경로 |
|---|---|
| GET/POST | `/api/hotels/:hotelId/issues` |
| GET/PATCH | `/api/hotels/:hotelId/issues/:issueId` |
| POST | `/api/hotels/:hotelId/issues/:issueId/assign` |
| POST | `/api/hotels/:hotelId/issues/:issueId/transitions` |
| POST | `/api/hotels/:hotelId/issues/:issueId/work-logs` |
| POST | `/api/hotels/:hotelId/issues/:issueId/public-comments` |
| POST | `/api/hotels/:hotelId/issues/:issueId/internal-notes` |

## 수용 기준

- 점검 중대·긴급 결과와 이슈가 원자적으로 연결된다.
- 호텔 소유주 API 응답에는 내부메모 필드 자체가 없다.
- 타 호텔 담당자 ID를 전달해도 담당지정이 차단된다.
- 권한 없는 사용자는 상태전이를 수행하지 못한다.
- 보류 초과·긴급알림 실패가 운영 확인대상으로 남는다.
- 종료·취소 후 과거 작업·댓글·첨부·행위자는 재현된다.
