# 봇 실행 가이드

이 문서는 `/home/wrhrgw/gw` 작업 폴더에서 그룹웨어 봇 팀을 어떻게 실행하고 관리할지 정리한 문서다.

## 핵심 원칙
- **사용자는 원칙적으로 싱드(`singde`)하고만 대화한다.**
- 싱드는 메인봇이며, 나머지 봇은 싱드가 필요할 때 활용하는 내부 보조 역할이다.
- 모든 봇은 그룹웨어 작업 폴더 `/home/wrhrgw/gw`를 기준으로 실행한다.
- 이 폴더의 `AGENTS.md`와 관련 문서를 작업 기준으로 삼는다.

## 평소 사용 방식
사용자는 아래처럼 싱드만 실행하거나 대화하면 된다.

```bash
cd /home/wrhrgw/gw
hermes --profile singde chat
```

한 번만 질문할 때:

```bash
cd /home/wrhrgw/gw
hermes --profile singde chat -q "오늘 해야 할 일 정리해줘"
```

짧은 스크립트:

```bash
/home/wrhrgw/gw/scripts/run-singde.sh
/home/wrhrgw/gw/scripts/run-singde.sh "오늘 해야 할 일 정리해줘"
```

## 내부 봇 수동 점검용 실행법
아래 실행법은 사용자가 평소 직접 쓸 필요는 없다.  
프로필 동작 확인, 역할 테스트, 문제 진단이 필요할 때만 사용한다.

### 공통 호출기
```bash
/home/wrhrgw/gw/scripts/run-bot.sh singde
/home/wrhrgw/gw/scripts/run-bot.sh gwplanner "그룹웨어 작업 계획 정리해줘"
```

### 봇별 바로가기
```bash
/home/wrhrgw/gw/scripts/run-singde.sh
/home/wrhrgw/gw/scripts/run-gwplanner.sh "기획안 정리해줘"
/home/wrhrgw/gw/scripts/run-gwbuilder.sh "기능 구현 시작해줘"
/home/wrhrgw/gw/scripts/run-gwreviewer.sh "리뷰해줘"
/home/wrhrgw/gw/scripts/run-gwtester.sh "테스트 관점에서 확인해줘"
/home/wrhrgw/gw/scripts/run-gwops.sh "배포 위험 점검해줘"
/home/wrhrgw/gw/scripts/run-gwdocs.sh "비개발자용 문서로 정리해줘"
```

## 봇 역할 요약
- **싱드** (`singde`): 메인봇, 사용자 대화, 작업 조율, 결과 통합
- **기획봇** (`gwplanner`): 계획, 우선순위, 선택지 정리
- **구현봇** (`gwbuilder`): 구현, 파일 수정, 코드 작성
- **리뷰봇** (`gwreviewer`): 리뷰, 누락 점검, 품질 확인
- **테스트봇** (`gwtester`): 테스트, 검증, 실패/성공 확인
- **운영봇** (`gwops`): 배포·운영 위험 점검
- **문서봇** (`gwdocs`): 문서화, 쉬운 설명 정리

## 권장 운영 흐름
1. 사용자는 싱드에게 자연어로 요청한다.
2. 싱드가 요구를 정리한다.
3. 싱드가 필요하면 내부 역할을 선택한다.
4. 내부 결과가 있으면 싱드가 검토하고 통합한다.
5. 최종 보고는 싱드가 쉬운 한국어로 전달한다.

## 현재 자동화 단계
- 현재는 **프로필, 문서, 실행 스크립트, Kanban 보드 기반 자동 파이프라인**이 준비된 상태다.
- 사용자는 원칙적으로 싱드에게 요청하고, 싱드가 필요한 작업을 Kanban 카드로 나누어 내부 봇에게 배정한다.
- 작은 작업은 계획 → 문서화/구현 → 리뷰/검증 → 최종 보고까지 자동으로 이어질 수 있다.
- 단, 긴 작업, 큰 변경, 배포, 삭제, 외부 전송, 비용 발생, 비밀값 입력은 중간 확인이나 사용자 승인 게이트가 필요할 수 있다.
