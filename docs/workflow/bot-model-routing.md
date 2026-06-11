# 봇별 메인/폴백 모델 설정

## 확인된 전제
- 현재 이 환경에서 실제 인증이 확인된 provider는 `openai-codex` 1개다.
- 따라서 이번 설정은 **provider 분산**이 아니라 **openai-codex 내부 모델 조합**으로 잡는다.
- 나중에 Anthropic, OpenRouter 같은 provider 인증이 추가되면 역할별로 다시 분산할 수 있다.

## 적용 기준
- 총괄/기획/리뷰/운영처럼 판단 비중이 큰 봇은 `gpt-5.5` 우선
- 구현/테스트/문서처럼 반복 작업 비중이 큰 봇은 `gpt-5.4` 우선
- 폴백은 같은 provider 내 반대 모델로 설정

## 싱드 (`singde`)
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.5`
- 폴백: `openai-codex / gpt-5.4`
- 이유: 총괄·판단·통합 보고 비중이 커서 더 강한 추론 우선

## 도담(`gwplanner`) / 기획봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.5`
- 폴백: `openai-codex / gpt-5.4`
- 이유: 기획·비교·우선순위 정리에 추론 성능 우선

## 이룸(`gwbuilder`) / 구현봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.4`
- 폴백: `openai-codex / gpt-5.5`
- 이유: 구현 작업은 안정적인 기본 코딩 모델을 우선하고 필요 시 상위 모델로 폴백

## 바름(`gwreviewer`) / 리뷰봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.5`
- 폴백: `openai-codex / gpt-5.4`
- 이유: 검토·위험 탐지는 더 강한 판별력 우선

## 해봄(`gwtester`) / 테스트봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.4`
- 폴백: `openai-codex / gpt-5.5`
- 이유: 테스트 실행과 확인은 기본 모델 우선, 복잡한 분석 시 상위 모델 폴백

## 지킴(`gwops`) / 운영봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.5`
- 폴백: `openai-codex / gpt-5.4`
- 이유: 배포·운영 판단은 보수적 추론이 중요해 상위 모델 우선

## 다온(`gwdocs`) / 문서봇
- 메인 provider: `openai-codex`
- 메인 model: `gpt-5.4`
- 폴백: `openai-codex / gpt-5.5`
- 이유: 문서화는 기본 모델로 충분하되 복잡한 재구성 시 상위 모델 폴백
