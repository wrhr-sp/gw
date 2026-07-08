# 오픈소스 운영보조 Docker 참고 실행 가이드

## 목적

이 문서는 A안+B안 적용 중 B안에 해당하는 Docker형 운영보조 도구를
그룹웨어 본체와 분리해 검토하기 위한 실행 기준이다.

B안 도구는 그룹웨어 제품 코드가 아니다. Appsmith와 NocoDB는 UX와
운영보조 흐름을 참고하기 위해 로컬 또는 별도 격리 환경에서만 실행한다.

## 허용 범위

- Appsmith CE를 로컬 참고 도구로 실행한다.
- NocoDB를 로컬 참고 도구로 실행한다.
- 샘플 데이터 또는 별도 테스트 데이터만 연결한다.
- CRUD 화면, 필터, 테이블 편집, 내부 운영 대시보드 UX를 관찰한다.
- 필요한 패턴은 그룹웨어 Next.js/React/TypeScript/Hono 구조로 재작성한다.

## 금지 범위

- 그룹웨어 본체 코드를 Appsmith/NocoDB 코드로 대체하지 않는다.
- Appsmith/NocoDB 본체 코드를 그룹웨어 repo에 흡수하지 않는다.
- production DB, preview DB, secret, 개인정보, SMTP/API token을 연결하지 않는다.
- custom domain, 외부 공개, 유료 리소스 연결은 별도 승인 전에는 진행하지 않는다.
- NocoDB는 라이선스가 GitHub API상 `Other`로 확인되므로 본체 코드
  흡수 금지 대상으로 둔다.

## 실행 파일

```bash
ops/docker/open-source-reference.compose.yaml
```

## Appsmith 참고 실행

```bash
docker compose \
  -f ops/docker/open-source-reference.compose.yaml \
  --profile appsmith up -d
```

접속:

```text
http://127.0.0.1:18080
```

종료:

```bash
docker compose \
  -f ops/docker/open-source-reference.compose.yaml \
  --profile appsmith down
```

## NocoDB 참고 실행

```bash
docker compose \
  -f ops/docker/open-source-reference.compose.yaml \
  --profile nocodb up -d
```

접속:

```text
http://127.0.0.1:18081
```

종료:

```bash
docker compose \
  -f ops/docker/open-source-reference.compose.yaml \
  --profile nocodb down
```

## 그룹웨어 적용 방식

Docker 참고 도구에서 확인한 UX는 그대로 복제하지 않는다. 다음 순서로
그룹웨어에 맞춘다.

1. 참고 화면에서 필요한 사용 흐름만 뽑는다.
2. 라이선스와 보안 경계를 확인한다.
3. 그룹웨어 디자인 토큰과 8px grid 기준으로 다시 설계한다.
4. 실제 API, 권한, 검증, audit 기준에 연결한다.
5. mock, dummy, in-memory fallback 없이 테스트와 preview smoke로 확인한다.

## 1차 연결 작업

A안 본체 적용의 1차 작업은 `@tanstack/react-table`을 사원정보관리
목록에 headless table로 도입하는 것이다. B안 Docker 도구는 이 목록
표준화 이후 운영보조 UX 참고가 필요할 때만 격리 실행한다.
