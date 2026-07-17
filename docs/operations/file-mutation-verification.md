# 파일 수정 검증

## 목적

파일 수정 도구가 실패했거나 대상 문자열이 여러 곳과 일치했는데도 변경 완료로 오인하는 일을 차단한다. 수정 전 fingerprint와 수정 후 실제 파일을 비교하며, 승인 범위 밖 파일이 함께 바뀌면 실패한다.

## 필수 사용 순서

수정 전에 저장소 밖 임시 manifest와 기대 파일을 지정한다.

```bash
manifest="$(mktemp /tmp/gw-mutation-baseline.XXXXXX.json)"
rm "$manifest"
capture_output="$(pnpm verify:mutations \
  --capture "$manifest" \
  --expect apps/api/src/app.ts \
  --expect packages/contracts/src/index.ts)"
seal="$(printf '%s\n' "$capture_output" | sed -n 's/^FILE_MUTATION_BASELINE_CAPTURED .* \([a-f0-9]\{64\}\)$/\1/p')"
test -n "$seal"
```

파일을 수정한 직후 같은 manifest로 검증한다.

```bash
pnpm verify:mutations --baseline "$manifest" --seal "$seal"
rm -f "$manifest"
```

baseline manifest는 경로와 SHA-256만 저장하며 파일 내용은 저장하지 않는다. 출력된 seal은 manifest 전체의 SHA-256이며 verify 인자로 별도 전달해 사후 변조를 차단한다. 새 파일을 만들 예정이면 아직 존재하지 않는 경로도 `--expect`에 지정한다.

## Fail-closed 동작

- expected 파일의 수정 전후 fingerprint가 같으면 실패한다.
- baseline 이후 기대하지 않은 파일이 새로 변경되면 실패한다.
- baseline 이전부터 dirty였던 비대상 파일이 이후 달라지면 실패한다.
- HEAD가 baseline 이후 바뀌면 실패한다.
- 저장소 밖 expected 경로를 거부한다.
- baseline manifest는 저장소 밖에만 생성한다.
- symlink, directory, FIFO, socket 등 regular file이 아닌 객체를 거부한다.
- untracked 파일, 삭제, staged+unstaged 변경과 rename 양쪽 경로를 검증한다.
- 저장소 하위 디렉터리에서 실행해도 Git top-level을 기준으로 canonicalize한다.
- 검증 상태를 연속 snapshot으로 비교하며 검사 중 변경이 감지되면 재시도를 요구한다.

## 결과 해석

```text
FILE_MUTATION_BASELINE_CAPTURED "<manifest>" <seal-sha256>
FILE_MUTATION_VERIFIED "<path>" <state-sha256>
FILE_MUTATION_MISSING ["<path>", "..."]
FILE_MUTATION_UNEXPECTED ["<path>", "..."]
FILE_MUTATION_PREEXISTING_CHANGED ["<path>", "..."]
FILE_MUTATION_VERIFIER_ERROR <reason>
```

- `MISSING`: 이번 수정에서 expected 파일 내용이 실제로 달라지지 않았다.
- `UNEXPECTED`: baseline 이후 작업범위 밖 파일이 새로 변경됐다.
- `PREEXISTING_CHANGED`: baseline 전부터 dirty였던 비대상 파일이 작업 중 추가로 바뀌었다.
- `ERROR`: 동시 writer, HEAD 변경, 잘못된 경로·객체·manifest 또는 Git 실행 오류다.

검증 성공 후에도 내용의 정확성은 `read_file`, 관련 테스트, `git diff --check`로 별도 확인한다. verifier는 실제 mutation과 범위를 보장하며 구현 내용의 의미적 정확성을 대신하지 않는다.

## 회귀 테스트

```bash
pnpm run test:mutation-verifier
```

테스트는 임시 Git 저장소에서 tracked·untracked·삭제·rename·staged+unstaged·기존 dirty 상태·한글/공백/newline 경로·하위 디렉터리 실행·HEAD 변경·symlink·directory·잘못된 repo를 실제로 검증한다. `pnpm check`와 CI에도 포함한다.
