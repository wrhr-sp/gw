# 오픈소스 프론트엔드·운영보조 도입 기준

## 1. 문서 목적

오픈소스 프론트엔드·운영보조 도입 기준 문서는 그룹웨어 본체에 넣을
오픈소스와 Docker로 별도 운영할 보조 도구를 분리해, 라이선스·보안·UI/UX·API
검증 기준을 지키면서 단계적으로 검토하기 위한 기준 문서다.

이 문서는 사용자가 확인한 A안과 B안을 함께 적용할 수 있는지에 대한 확정 기준을 남긴다.

- A안: 그룹웨어 본체에 점진 도입할 프론트엔드/API/인증 보조 오픈소스 조합
- B안: 그룹웨어 본체와 분리해 Docker로 띄워 참고하거나 운영보조로 쓸 수 있는 도구 조합

## 2. 결론

A안과 B안은 함께 사용할 수 있다. 단, 역할을 분리한다.

- 그룹웨어 본체에는 MIT 또는 Apache-2.0 계열의 UI·테이블·API 검증·인증 예제만 점진 도입한다.
- Docker형 low-code·no-code 도구는 그룹웨어 본체를 대체하지 않고 별도 운영보조 또는 UX 참고 도구로만 둔다.
- ZITADEL 본체처럼 AGPL 계열이거나 라이선스가 `Other`로 표시되는 저장소 코드는 그룹웨어 본체에 직접 흡수하지 않는다.
- production, custom domain, 실DB 연결, secret 입력, 유료 리소스는 별도 승인 게이트로 둔다.

## 3. 코드 가져오기와 재작성 기준

오픈소스 코드를 가져와 그룹웨어 핏에 맞게 수정하는 것은 가능하다. 다만 아래 조건을
동시에 만족해야 한다.

- Radix, TanStack, Chanfana는 패키지로 도입한다.
- shadcn/ui는 필요한 컴포넌트만 참고해 그룹웨어 토큰에 맞게 재작성한다.
- ZITADEL 예제는 인증 흐름만 참고하고 본체 코드나 secret 예시는 흡수하지 않는다.
- Appsmith와 NocoDB는 Docker로 띄워 UX와 운영보조 흐름만 참고한다.
- Appsmith와 NocoDB의 본체 코드는 그룹웨어 본체로 가져오지 않는다.
- 가져온 코드는 라이선스 안전성, 최소 범위, 그룹웨어 구조 재작성, 실제 API 연결을
  모두 만족해야 한다.

이 기준은 단순 복붙을 허용하는 기준이 아니다. 라이선스가 안전한 코드만 고르고, 필요한
부분만 좁게 가져온 뒤, 그룹웨어 공통 컴포넌트·토큰·API 계약·권한·감사로그 기준에 맞게
재작성하는 기준이다.

## 4. 현재 그룹웨어 기술 기준

현재 저장소 기준은 다음과 같다.

- Web: Next.js 15, React 19, TypeScript
- API: Hono, Cloudflare Workers
- Auth: ZITADEL hybrid 기준
- Package manager: pnpm
- 배포: OpenNext on Cloudflare
- 완료 기준: 실제 API, Service/Repository, DB 저장·재조회, 권한·검증·예외·audit 확인

새 도구는 이 구조를 깨지 않아야 한다.

## 5. A안: 그룹웨어 본체 도입 후보

### 5-1. Radix UI

Radix UI는 그룹웨어 본체의 접근성 높은 인터랙션 컴포넌트 구조를 보강하기 위한 1순위 후보로 둔다.

- 저장소: `radix-ui/primitives`
- 라이선스: MIT
- 적용 후보: Dialog, Tabs, Popover, Dropdown, Select
- 적용 방식: 구조와 접근성 패턴을 가져오고, 색상·간격·테두리는 그룹웨어 디자인 토큰으로 맞춘다.

금지 기준:

- 페이지별 임의 스타일을 새로 늘리지 않는다.
- 기존 공통 UI 토큰과 충돌하는 기본 스타일을 그대로 퍼뜨리지 않는다.

### 5-2. shadcn/ui

shadcn/ui는 컴포넌트 코드와 상태관리 패턴을 참고하기 위한 후보로 둔다.

- 저장소: `shadcn-ui/ui`
- 라이선스: MIT
- 적용 후보: 폼, 탭, 다이얼로그, 드롭다운, 테이블 예시 패턴
- 적용 방식: 필요한 컴포넌트만 그룹웨어 공통 컴포넌트로 변환한다.

주의 기준:

- Tailwind 전면 도입을 기본값으로 보지 않는다.
- shadcn 기본 theme를 그대로 제품에 덮어씌우지 않는다.
- 사용자 화면의 레이아웃·문구·헬퍼텍스트를 임의로 추가하지 않는다.

### 5-3. TanStack Table

TanStack Table은 목록 중심 업무 화면의 테이블·정렬·필터·페이지네이션 구조를 강화하기 위한 1순위 후보로 둔다.

- 저장소: `TanStack/table`
- 라이선스: MIT
- 적용 후보: 사원정보관리, 계정목록, 문서목록, 근태목록, 감사로그
- 적용 방식: headless table 로직만 사용하고 렌더링은 그룹웨어 Table 토큰과 기존 레이아웃을 따른다.

첫 적용 후보는 사원정보관리 목록이다. 사원정보관리는 이미 현황카드, 등록 팝업,
우측 상세패널, 탭 구조, 실제 API 저장·재조회 흐름이 있어 목록 표준화 효과를
검증하기 좋다.

### 5-4. TanStack Query

TanStack Query는 서버 상태와 저장 후 재조회 흐름을 안정화하기 위한 후보로 둔다.

- 저장소: `TanStack/query`
- 라이선스: MIT
- 적용 후보: 저장 후 목록/요약 재조회가 많은 화면
- 적용 방식: 전역 전면 도입이 아니라 API 복잡도가 높은 화면부터 부분 적용한다.

주의 기준:

- 현재 명시적인 fetch·재조회 흐름을 숨겨서 검증이 어려워지면 안 된다.
- 캐시 때문에 저장 후 DB 재조회가 생략된 것처럼 보이면 안 된다.

### 5-5. Chanfana

Chanfana는 Hono API에 OpenAPI 문서와 요청·응답 검증을 붙이기 위한 후보로 둔다.

- 저장소: `cloudflare/chanfana`
- 라이선스: MIT
- 적용 후보: 사원정보관리 API, 감사로그 API, 권한 API, 파일 API
- 적용 방식: 신규 API 또는 특정 API 1개부터 적용한다.

주의 기준:

- 기존 Hono API 전체를 한 번에 바꾸지 않는다.
- `@gw/shared` 계약과 중복·충돌하지 않게 설계한다.
- 문서 생성이 실제 검증을 대체하면 안 된다.

### 5-6. ZITADEL TypeScript / Next.js 예제

ZITADEL TypeScript와 Next.js 예제는 인증 연동 흐름을 참고하기 위한 후보로 둔다.

- 저장소: `zitadel/typescript`, `zitadel/zitadel-nextjs-b2b`
- 라이선스: MIT
- 적용 후보: Next.js 인증 흐름, 조직/B2B 예제, 토큰 처리 흐름 참고

금지 기준:

- `zitadel/zitadel` 본체 코드는 AGPL-3.0이므로 직접 흡수하지 않는다.
- secret 입력, production ZITADEL 설정 변경, 실제 계정 생성 검증은 별도 승인 전에는 하지 않는다.

## 6. B안: Docker 별도 운영보조 후보

### 6-1. Appsmith CE

Appsmith CE는 Docker로 별도 운영하며 내부 운영보조 또는 UX 참고 도구로만 검토한다.

- 저장소: `appsmithorg/appsmith`
- 라이선스: Apache-2.0
- Docker 후보: `appsmith/appsmith-ce`
- 용도: 내부 운영 대시보드 참고, API/DB 연결형 관리자 패널 참고, CRUD UX 검토

금지 기준:

- 그룹웨어 본체를 Appsmith로 대체하지 않는다.
- 사용자-facing 화면으로 직접 노출하지 않는다.
- 실DB 연결, production 연결, custom domain 연결, secret 입력은 별도 승인 전에는 하지 않는다.

### 6-2. NocoDB

NocoDB는 Docker로 별도 운영 가능하지만 라이선스와 보안 경계를 먼저 확인해야 하는 후순위 후보로 둔다.

- 저장소: `nocodb/nocodb`
- 라이선스: GitHub API상 `Other`로 확인됨
- Docker 후보: `nocodb/nocodb`
- 용도: DB 테이블 조회 UX 참고, Airtable식 관리화면 참고

금지 기준:

- 그룹웨어 본체 코드로 흡수하지 않는다.
- 실DB를 바로 연결하지 않는다.
- 개인정보가 포함된 운영 데이터 조회 도구로 쓰기 전에는 별도 보안 검토와 승인을 받는다.

## 7. 라이선스 기준

그룹웨어 본체에 직접 들어갈 수 있는 후보는 다음 조건을 만족해야 한다.

- MIT 또는 Apache-2.0처럼 상용·내부 제품에 적용하기 쉬운 라이선스
- TypeScript/React/Next.js/Hono 구조와 호환
- 코드 복사 또는 패키지 도입 시 라이선스 고지 가능
- 비밀값, 운영 데이터, 외부 유료 리소스를 요구하지 않는 기본 사용 방식

본체 직접 흡수 금지 후보는 다음과 같다.

- AGPL 계열 본체 코드
- 라이선스가 `Other`로 표시되어 제품 코드 흡수 가능성이 불명확한 저장소
- low-code 플랫폼 자체 코드
- 외부 서비스 비밀값을 요구하는 예제 코드

## 8. UI/UX 적용 기준

새 도구를 도입해도 그룹웨어 UI 원칙은 바뀌지 않는다.

- Input, Select, DatePicker, Button, Table은 공식 가이드와 그룹웨어 공통 토큰을 우선한다.
- 검색/필터 영역은 균등 Grid 구조를 유지한다.
- 버튼 묶음은 부모 툴바에서 flex, center 정렬, 8px gap을 기본으로 한다.
- 콘텐츠 박스, 필터, 폼, 리스트, 버튼 묶음은 8px 단위 간격을 따른다.
- 의미 없는 7px, 13px 같은 임의 픽셀값을 새 코드에 만들지 않는다.
- 사용자가 말하지 않은 문구, 헬퍼텍스트, 개발 상태 설명문을 UI에 노출하지 않는다.

## 9. API/보안 적용 기준

새 도구는 그룹웨어 no-mock 원칙을 약화하면 안 된다.

- 저장·수정·삭제·승인·반려·제출 버튼은 실제 API 호출과 연결한다.
- API는 DB 미설정, schema drift, forbidden, not found, validation error를 성공처럼 숨기지 않는다.
- 프론트엔드는 SMTP/API provider secret, token, password, DB URL을 보유하지 않는다.
- Chanfana/OpenAPI는 실제 검증과 문서화를 보조하며, 테스트를 대체하지 않는다.
- Docker 보조 도구는 운영 실DB, secret, 개인정보에 접근하기 전 별도 승인을 받는다.

## 10. 권장 도입 순서

1. 문서 기준 확정
   - 이 문서를 기준으로 본체 도입 후보와 Docker 보조 후보를 분리한다.

2. 사원정보관리 목록 표준화
   - TanStack Table 또는 headless table 패턴을 검토한다.
   - 기존 등록 팝업, 우측 상세패널, 탭 구조, 저장 후 재조회 흐름을 유지한다.

3. 공통 인터랙션 컴포넌트 정리
   - Radix 기반 Dialog, Tabs, Popover, Dropdown, Select 후보를 그룹웨어 토큰으로 감싼다.

4. API 검증 1개 적용
   - Chanfana를 사원정보관리 또는 감사로그 API 중 하나에 제한 적용한다.

5. ZITADEL 예제 비교
   - MIT 예제만 분석하고 현재 `@zitadel/node` 기반 흐름과 차이를 정리한다.

6. Appsmith CE 로컬 보조 검토
   - Docker로 로컬 또는 내부망 보조 도구 후보를 확인한다.
   - 실DB 연결과 production 연결은 별도 승인 전까지 하지 않는다.

7. NocoDB 후순위 검토
   - 라이선스와 보안 경계를 별도로 확인한 뒤 필요하면 참고용으로만 검토한다.

## 11. 1차 실제 적용 후보

1차 실제 적용 후보는 사원정보관리 목록/상세패널 컴포넌트 표준화다.

적용 범위:

- 사원정보관리 목록의 headless table 구조 후보 검토
- 선택된 사원 행 표시 기준 정리
- 등록 팝업과 우측 상세패널 구조 유지
- 상세패널 안의 탭 구조 유지
- 저장 후 API 재조회 흐름 유지

비대상 범위:

- 관리자페이지 `/admin/users` IA 변경
- 신규 권한 체계 추가
- production ZITADEL 설정 변경
- 실DB/secret/custom domain/유료 리소스 연결
- Appsmith/NocoDB를 사용자-facing 화면으로 노출

## 12. 완료 기준

1차 적용 작업의 완료 기준은 다음과 같다.

- 기존 테스트 통과
- `pnpm check` 통과
- `pnpm --filter web build` 통과
- `pnpm --filter web build:cf` 통과
- PR CI 통과
- main merge 후 release-gate 통과
- preview smoke에서 대상 화면과 API health 200 확인
- Obsidian repo backup 누락 0, 불일치 0 확인

## 13. 다음 작업

다음 작업은 사원정보관리 목록/상세패널 컴포넌트 표준화의 IA와 변경 범위를 먼저
좁히는 것이다. 이 작업에서는 TanStack Table을 바로 설치하기 전에 현재 사원정보관리
목록 코드와 테스트 기준을 확인하고, 실제 패키지 도입이 필요한지 또는 headless 패턴만
먼저 적용할지 결정한다.
