# WSL 재시작 후 이어서 할 작업 메모

## 작성 목적

사용자가 Windows PowerShell에서 WSL을 직접 재시작한 뒤 Telegram에서 `완료`라고 말하면, 싱드가 바로 이어서 확인할 수 있도록 남기는 임시 인수인계 메모다.

## 재시작 전 확인된 상태

- 환경: WSL2 Ubuntu
- `/etc/wsl.conf`에 systemd 활성화 확인됨

```ini
[boot]
systemd=true

[user]
default=werehere
```

- `singde` Hermes Gateway는 시스템 서비스에 등록되어 있고 실행 중이었음

```text
hermes-gateway-singde.service  loaded  active  running
Hermes Agent Gateway - Eora (system)
```

- 서비스 파일도 존재했음

```text
/etc/systemd/system/hermes-gateway-singde.service
/etc/systemd/system/multi-user.target.wants/hermes-gateway-singde.service
```

- 단, `hermes -p singde gateway status`는 기본 서비스명 `hermes-gateway.service`를 먼저 찾기 때문에 다음처럼 오해 소지가 있는 메시지를 냈음

```text
Unit hermes-gateway.service could not be found.
```

실제 프로필별 서비스명은 `hermes-gateway-singde.service`임.

## 사용자가 할 작업

Windows PowerShell에서 실행:

```powershell
wsl --shutdown
wsl -d Ubuntu
```

그 후 Telegram에서 싱드에게:

```text
완료
```

라고 말하면 된다.

## 사용자가 `완료`라고 말한 뒤 싱드가 바로 확인할 것

### 1. WSL / systemd / gateway 상태 확인

```bash
ps -p 1 -o comm=
systemctl is-active hermes-gateway-singde.service
systemctl status hermes-gateway-singde.service --no-pager | sed -n '1,80p'
ps -ef | grep -E 'hermes.*gateway|gateway run' | grep -v grep || true
```

정상 기대값:

- `ps -p 1 -o comm=` 결과가 `systemd`
- `systemctl is-active hermes-gateway-singde.service` 결과가 `active`
- `singde` gateway 프로세스가 존재

### 2. Docker Desktop WSL 연동 확인

```bash
docker version
docker compose version
docker ps
```

정상 기대값:

- `permission denied while trying to connect to the docker API` 오류가 없어야 함
- Docker Engine/Client 버전 표시
- Docker Compose 버전 표시
- `docker ps`가 컨테이너 목록을 표시

### 3. 권한 문제 발생 시 볼 것

만약 Docker에서 여전히 permission denied가 나면 아래 확인:

```bash
id
getent group docker
ls -l /var/run/docker.sock 2>/dev/null || true
```

이전 상태:

- `werehere` 사용자는 `docker` 그룹에 추가되어 있었음
- Docker CLI는 Docker Desktop WSL CLI로 연결해둔 상태였음

```text
/usr/local/bin/docker -> /mnt/wsl/docker-desktop/cli-tools/usr/bin/docker
/usr/local/lib/docker/cli-plugins/docker-compose -> Docker Desktop compose plugin
```

### 4. 그룹웨어 개발 파이프라인 상태도 필요하면 확인

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
hermes kanban --board groupware list
```

재시작 전 그룹웨어 보드 상태 요약:

- `gwplanner`: 글로벌 그룹웨어 공개자료 조사 진행 중
- `gwtester`: 한국·아시아 그룹웨어 조사 완료
- `gwreviewer`: 그룹웨어 공통 기능·수익모델·법적 주의점 정리 완료
- `gwdocs`: 통합 보고서 작성 대기
- `singde`: 최종 보고 대기

## 이어서 사용자에게 보고할 기준

사용자가 `완료`라고 말하면, 싱드는 위 검증을 실제로 수행한 뒤 다음 중 하나로 짧게 보고한다.

### 정상일 때

- WSL 재시작 후 Gateway 정상 복구 확인
- Docker Desktop WSL 연동 정상 확인
- `docker version`, `docker compose version`, `docker ps` 정상
- 이후 그룹웨어 개발 파이프라인 계속 진행 가능

### 문제가 있을 때

- Gateway 문제인지 Docker 권한 문제인지 구분
- 확인한 명령과 오류를 그대로 요약
- 사용자가 이해하기 쉽게 다음 조치 1개만 제안
