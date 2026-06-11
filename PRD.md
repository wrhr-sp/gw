# PRD

## 만들 제품

Cloudflare-first 기반 한국형 그룹웨어 Web/PWA와 Workers API skeleton을 만든다. MVP는 실제 운영 데이터를 처리하는 완제품이 아니라, 업무 흐름과 권한 경계가 검증 가능한 제품 골격이다.

## 포함 범위

- 로그인/내 정보 skeleton
- 회사/조직/직원/부서/역할/권한 조회 skeleton
- 근태/휴가 skeleton
- 전자결재 skeleton
- 게시판/공지 skeleton
- 문서/첨부 metadata/R2 연결 skeleton
- 모바일/PWA shell
- 관리자 사용자/정책/감사 로그 skeleton
- 조직/직원 일반 화면과 관리자 화면 분리
- GitHub PR/CI/merge/Cloudflare 자동 배포 확인 파이프라인

## 제외 범위

- 실제 개인정보 원문 저장/처리
- production DB 실데이터 migration/seed
- 실제 급여/노무/정산 처리
- 외부 HR/전자서명/본인인증 연동
- DNS/custom domain 연결
- 유료 리소스 생성·증액
- secret 입력/교체

## 사용자 역할

- 일반 직원: 출퇴근, 휴가 신청, 결재/공지/문서 확인
- 팀장/승인자: 승인 대기, 팀 예외, 팀원 요청 확인
- 인사/총무: 조직/직원/권한/정책/문서/게시판 운영
- 관리자: 운영 설정, 감사 로그, 권한 통제
- 대표/임원: 운영 현황 요약 확인

## 수용 기준

- 각 Phase는 구현, 리뷰, 테스트, 문서화, GitHub/배포 확인, 최종보고 근거를 남긴다.
- `pnpm check`와 관련 package test/typecheck/build가 통과해야 한다.
- restricted 항목은 문서에 명시하고 별도 승인 전 진행하지 않는다.
