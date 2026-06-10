#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Iterable

DEFAULT_BOARD = "groupware"
WORKDIR = "/home/wrhrgw/gw"
WORKSPACE = f"dir:{WORKDIR}"
HERMES_HOME = os.environ.get("HERMES_HOME", "/home/wrhrgw/gw-dev-bot/.hermes")
HERMES_BIN = (
    os.environ.get("HERMES_BIN")
    or shutil.which("gw-hermes")
    or "/home/wrhrgw/gw-dev-bot/.hermes/hermes-agent/venv/bin/hermes"
    or shutil.which("hermes")
)
REPORT_PLATFORM = os.environ.get("GW_REPORT_PLATFORM", "telegram")
REPORT_CHAT_ID = os.environ.get("GW_REPORT_CHAT_ID", "8648561062")
REPORT_NOTIFIER_PROFILE = os.environ.get("GW_REPORT_NOTIFIER_PROFILE", "singde")
BENCHMARK_GUIDANCE = """

그룹웨어 벤치마크/UX 참고 규칙:
- UI/UX, 기능 배치, 정보구조, 근태/휴가/급여/노무/문서/결재 화면을 설계하거나 구현할 때는 `docs/ux/groupware-benchmark-principles.md`와 `docs/product/groupware-vision-roadmap.md`를 먼저 확인한다.
- 국내 그룹웨어/HR/근태/급여/노무 공개 페이지와 공개 도움말에서 추출한 일반 패턴만 참고한다.
- 특정 서비스의 화면, 문구, 로고, 색상, 레이아웃을 복제하지 않는다.
- 구현 결과에는 벤치마크 원칙을 어떻게 반영했는지 또는 해당 없음인지를 짧게 남긴다.

Kanban DB/자동화 안전 규칙:
- `kanban.db`, `kanban.db-wal`, `kanban.db-shm`을 직접 쓰거나 편집하지 않는다. 상태 변경은 `hermes kanban ...` CLI를 사용하고 감시는 read-only로 한다.
- 자동화/watcher/systemd/dispatcher/보고 스크립트 변경 전후로 board list, DB integrity, watcher 중복 프로세스, systemd 상태, `dispatch --dry-run`을 확인한다.
- 보고는 기본적으로 `gw-telegram-kanban-report-watch.py`의 직접 Telegram 경로를 사용한다. 별도 사용자 결과보고/막힘 보고 카드 생성이나 `notify-subscribe`는 대장 명시 승인 없이는 켜지 않는다.
- watcher는 단일 인스턴스·state/idempotency·circuit-breaker·safe stop 조건을 갖춘다."""

CARD_SCOPE_APPROVAL_GUIDANCE = """

카드 작업범위 승인 규칙:
- Kanban 카드 제목/본문/체크리스트에 merge, release/릴리즈, deploy/디플로이/배포, PR merge, branch cleanup, release gate가 작업범위로 명시되어 있으면 그 항목은 대장이 카드 작업범위로 명시 승인한 것으로 보고 진행한다.
- 단, 최신 head 기준 CI/check, 빌드/테스트, 배포 전 guard, smoke check, 롤백/복구 가능성, 변경 범위 검증 근거를 남긴다.
- 카드에 명시되지 않은 secret 입력/교체, production DB 실데이터 변경, DNS/custom domain, 유료 리소스 생성·증액, 결제/환불/개인정보 처리, destructive 삭제는 별도 승인 없이는 진행하지 않는다."""

VALID_TYPES = ("feature", "bugfix", "docs", "deploy", "review")


@dataclass
class Step:
    key: str
    label: str
    assignee: str
    title_prefix: str
    body: str
    skills: list[str] = field(default_factory=list)
    parents: list[str] = field(default_factory=list)
    initial_status: str | None = None
    id: str | None = None


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["HERMES_HOME"] = HERMES_HOME
    return subprocess.run(cmd, check=True, text=True, capture_output=True, cwd=WORKDIR, env=env)


def create_task(step: Step, title: str, body: str, idempotency_key: str | None, board: str) -> str:
    full_title = f"{step.title_prefix}: {title}"
    full_body = step.body.format(title=title, body=body)
    full_body += BENCHMARK_GUIDANCE
    full_body += CARD_SCOPE_APPROVAL_GUIDANCE
    full_body += """

공통 완료 규칙:
- 작업이 성공했고 필요한 검증/근거를 남겼다면 `review-required`로 block하지 말고 카드를 complete 처리한다.
- `review-required` 또는 blocked는 실패, 권한/인증 문제, 사용자 승인 필요, 설계 판단 대기처럼 실제로 멈춰야 하는 경우에만 사용한다.
- 비밀값은 절대 출력하지 않는다."""
    cmd = [
        HERMES_BIN, "kanban", "--board", board, "create", full_title,
        "--assignee", step.assignee,
        "--workspace", WORKSPACE,
        "--body", full_body,
        "--json",
    ]
    for parent in step.parents:
        cmd.extend(["--parent", parent])
    for skill in step.skills:
        cmd.extend(["--skill", skill])
    if step.initial_status in {"blocked", "scheduled"}:
        # Kanban create only supports blocked/running as explicit initial states.
        # For scheduled human-wait gates, create as blocked first, then immediately
        # move to scheduled so the dispatcher will not claim it.
        cmd.extend(["--initial-status", "blocked"])
    if idempotency_key:
        cmd.extend(["--idempotency-key", f"{idempotency_key}:{step.key}"])
    result = run(cmd)
    data = json.loads(result.stdout)
    task_id = data.get("id") or data.get("task_id")
    if step.initial_status == "scheduled":
        run([
            HERMES_BIN, "kanban", "--board", board, "schedule", task_id,
            "자동화 안전 대기: 사용자 승인 또는 수동 promote/unblock 필요",
        ])
    if step.assignee == "singde" and REPORT_CHAT_ID and os.environ.get("GW_ENABLE_FINAL_CARD_NOTIFY_SUBSCRIBE") == "1":
        # 기본 보고 경로는 read-only Telegram watcher다. 카드 notify-subscribe는
        # 중복/아리아 경유 보고를 만들 수 있으므로 명시 승인 env가 있을 때만 붙인다.
        run([
            HERMES_BIN, "kanban", "--board", board, "notify-subscribe", task_id,
            "--platform", REPORT_PLATFORM,
            "--chat-id", REPORT_CHAT_ID,
            "--notifier-profile", REPORT_NOTIFIER_PROFILE,
        ])
    return task_id


def skill_text(skills: Iterable[str]) -> str:
    skills = list(skills)
    if not skills:
        return "없음"
    return ", ".join(f"`{s}`" for s in skills)


def build_steps(kind: str, hold: bool) -> list[Step]:
    common_final = """부모 카드 결과를 바탕으로 사용자에게 최종 보고한다.

해야 할 일:
- 모든 부모 작업 결과를 확인한다.
- 충돌이나 미확인 사항을 분리한다.
- 완료/미완료/사용자 결정 필요 사항을 구분한다.
- 사용자가 바로 판단할 수 있게 짧고 쉬운 한국어로 보고한다.
- 최종 보고 카드 완료 전, 사용자 채팅에 보고할 최종 요약문을 반드시 작성한다.
- 카드 result/summary에는 `사용자 보고 완료` 또는 `사용자 보고 필요` 중 하나를 명확히 남긴다."""

    if kind == "docs":
        steps = [
            Step(
                key="plan",
                label="문서 기획",
                assignee="gwplanner",
                title_prefix="문서 기획",
                skills=["writing-plans", "one-three-one-rule"],
                body="""목표: {title}

사용자 설명:
{body}

해야 할 일:
- 문서의 독자, 목적, 포함 범위, 제외 범위를 정한다.
- 비개발자에게 필요한 설명 수준을 정한다.
- 문서화 전에 확인해야 할 질문을 남긴다.""",
                initial_status="scheduled" if hold else None,
            ),
            Step(
                key="docs",
                label="문서화",
                assignee="gwdocs",
                title_prefix="문서화",
                skills=["code-wiki", "humanizer"],
                body="""부모 문서 기획 결과를 읽고 문서를 작성한다.

원 작업 설명:
{body}

해야 할 일:
- 한 일, 배경, 사용법, 남은 리스크, 다음 액션을 정리한다.
- 어려운 용어는 쉬운 한국어로 풀어쓴다.
- 필요한 경우 관련 파일/명령/경로를 정확히 적는다.""",
            ),
            Step(
                key="review",
                label="문서 리뷰",
                assignee="gwreviewer",
                title_prefix="문서 리뷰",
                skills=["requesting-code-review", "code-wiki"],
                body="""부모 문서화 카드 결과를 검토한다.

해야 할 일:
- 빠진 내용, 틀린 설명, 위험한 안내가 없는지 확인한다.
- 비개발자가 오해할 표현을 찾는다.
- 수정 필요 사항을 명확히 남긴다.""",
            ),
            Step(
                key="final",
                label="최종 보고",
                assignee="singde",
                title_prefix="최종 통합 보고",
                skills=["one-three-one-rule"],
                body=common_final,
            ),
        ]
    elif kind == "review":
        steps = [
            Step(
                key="review",
                label="리뷰",
                assignee="gwreviewer",
                title_prefix="리뷰",
                skills=["requesting-code-review", "code-wiki", "systematic-debugging"],
                body="""목표: {title}

사용자 설명:
{body}

해야 할 일:
- 변경 범위와 요구사항을 확인한다.
- 위험, 누락, 구조 문제, 보안/비밀값 문제를 분리한다.
- 수정 필요 사항과 근거를 남긴다.""",
                initial_status="scheduled" if hold else None,
            ),
            Step(
                key="test",
                label="검증",
                assignee="gwtester",
                title_prefix="검증",
                skills=["test-driven-development", "systematic-debugging"],
                body="""부모 리뷰 카드 결과를 바탕으로 가능한 검증을 수행한다.

해야 할 일:
- 실행 가능한 테스트/검증 명령을 찾고 실행한다.
- 정상/실패/미확인을 구분한다.
- 재현 절차와 로그 위치를 남긴다.""",
            ),
            Step(
                key="final",
                label="최종 보고",
                assignee="singde",
                title_prefix="최종 통합 보고",
                skills=["one-three-one-rule"],
                body=common_final,
            ),
        ]
    elif kind == "deploy":
        steps = [
            Step(
                key="plan",
                label="배포 기획",
                assignee="gwplanner",
                title_prefix="배포 기획",
                skills=["web-app-hosting", "one-three-one-rule"],
                body="""목표: {title}

사용자 설명:
{body}

해야 할 일:
- 앱 유형을 정리한다: 정적 사이트, 풀스택, 백엔드, Docker, 임시 프리뷰 중 무엇인지 판단한다.
- 배포 목적, 공개 범위, 도메인 필요 여부, 사용자 승인 필요 지점을 정리한다.
- 실제 배포 전에 확인할 질문을 남긴다.""",
                initial_status="scheduled" if hold else None,
            ),
            Step(
                key="prepare",
                label="배포 준비",
                assignee="gwbuilder",
                title_prefix="배포 준비",
                skills=["web-app-hosting", "code-wiki", "systematic-debugging"],
                body="""부모 배포 기획 카드 결과를 읽고 배포 가능한 상태를 준비한다.

원 작업 설명:
{body}

해야 할 일:
- 기존 구조와 빌드/시작 명령을 확인한다.
- 환경변수는 이름만 확인하고 값은 출력하지 않는다.
- 포트, 런타임, 빌드 출력 경로, provider 설정 파일을 확인한다.
- 실제 외부 배포가 이 Kanban 카드 작업범위에 명시되어 있으면 승인된 것으로 보고, 배포 전 guard/검증/롤백 가능성을 확인한 뒤 진행한다. 카드 범위가 준비/검토뿐이면 실행하지 않는다.""",
            ),
            Step(
                key="risk-review",
                label="배포 위험 리뷰",
                assignee="gwreviewer",
                title_prefix="배포 위험 리뷰",
                skills=["web-app-hosting", "requesting-code-review", "systematic-debugging"],
                body="""부모 배포 준비 카드 결과를 검토한다.

해야 할 일:
- 비밀값 노출, 공개되면 안 되는 경로, 위험한 설정을 확인한다.
- 배포 전 차단해야 할 위험과 허용 가능한 위험을 분리한다.
- 사용자 승인이 필요한 항목을 명확히 남긴다.""",
            ),
            Step(
                key="approval",
                label="배포 범위 확인/승인 게이트",
                assignee="singde",
                title_prefix="배포 범위 확인/승인 게이트",
                skills=["web-app-hosting", "one-three-one-rule"],
                body="""부모 배포 위험 리뷰 결과를 바탕으로 카드 작업범위에 실제 배포/릴리즈가 명시되어 있는지 확인한다.

해야 할 일:
- 실제 외부 배포/도메인 연결/유료 리소스/비밀값 입력이 필요한지 확인한다.
- 카드 작업범위에 실제 배포/릴리즈가 명시되어 있으면 명시승인으로 보고 다음 실행 카드로 넘긴다.
- 카드 범위가 준비/검토뿐이거나 DNS/유료/비밀값/production DB 변경이 새로 필요하면 대장에게 별도 승인 요청용 요약을 남기고 block한다.

원 작업 설명:
{body}""",
                initial_status=None,
            ),
            Step(
                key="deploy",
                label="배포 실행/운영 점검",
                assignee="gwops",
                title_prefix="배포 실행/운영 점검",
                skills=["web-app-hosting", "systemd-service-operations", "github-pr-workflow"],
                body="""부모 범위 확인 카드가 배포/릴리즈가 카드 작업범위에 포함됨을 확인한 뒤 진행한다.

해야 할 일:
- 선택된 호스팅 방식에 맞춰 배포 또는 배포 절차를 수행한다.
- 공개 URL을 직접 확인한다.
- 로그, 포트, 환경변수 이름, 롤백/재배포 방법을 남긴다.
- 비밀값은 절대 출력하지 않는다.""",
            ),
            Step(
                key="test",
                label="배포 검증",
                assignee="gwtester",
                title_prefix="배포 검증",
                skills=["web-app-hosting", "test-driven-development", "systematic-debugging"],
                body="""부모 배포 실행 카드 결과를 바탕으로 실제 접속 검증을 수행한다.

해야 할 일:
- 공개 URL 상태를 확인한다.
- 메인 화면과 핵심 route/API 하나 이상을 확인한다.
- 정상/실패/미확인을 구분한다.""",
            ),
            Step(
                key="docs",
                label="배포 문서화",
                assignee="gwdocs",
                title_prefix="배포 문서화",
                skills=["web-app-hosting", "humanizer", "code-wiki"],
                body="""부모 배포 검증 카드 결과를 바탕으로 비개발자용 배포 결과 문서를 작성한다.

해야 할 일:
- URL, provider, 확인한 것, 남은 사용자 조치, 주의사항을 정리한다.
- 비밀값은 쓰지 않고 환경변수 이름만 적는다.""",
            ),
            Step(
                key="final",
                label="최종 보고",
                assignee="singde",
                title_prefix="최종 통합 보고",
                skills=["web-app-hosting", "one-three-one-rule"],
                body=common_final,
            ),
        ]
    else:
        debug_focus = "- 실패 재현과 원인 가설을 먼저 정리한다.\n- 수정은 최소 범위로 진행한다." if kind == "bugfix" else "- 필요한 파일을 최소 범위로 수정한다.\n- 변경 내용과 검증 방법을 남긴다."
        plan_focus = "- 증상, 기대 동작, 실제 동작, 재현 조건을 분리한다." if kind == "bugfix" else "- 범위, 제외 범위, 우선순위를 정한다."
        steps = [
            Step(
                key="plan",
                label="기획",
                assignee="gwplanner",
                title_prefix="기획",
                skills=["writing-plans", "one-three-one-rule", "code-wiki"],
                body=f"""목표: {{title}}

사용자 설명:
{{body}}

해야 할 일:
- 요구를 쉬운 한국어로 정리한다.
{plan_focus}
- 구현 전에 확인해야 할 질문을 남긴다.""",
                initial_status="scheduled" if hold else None,
            ),
            Step(
                key="implement",
                label="구현",
                assignee="gwbuilder",
                title_prefix="구현",
                skills=["code-wiki", "systematic-debugging", "test-driven-development"],
                body=f"""부모 기획 카드 결과를 읽고 구현한다.

원 작업 설명:
{{body}}

해야 할 일:
- 기존 구조를 먼저 확인한다.
{debug_focus}
- 가능하면 테스트를 먼저 작성하거나 검증 기준을 먼저 세운다.""",
            ),
            Step(
                key="review",
                label="리뷰",
                assignee="gwreviewer",
                title_prefix="리뷰",
                skills=["requesting-code-review", "code-wiki", "systematic-debugging"],
                body="""부모 구현 카드 결과를 검토한다.

해야 할 일:
- 요구 누락 여부를 확인한다.
- 위험, 근거 부족, 구조 문제, 보안/비밀값 문제를 분리해서 적는다.
- 수정 필요 사항이 있으면 명확히 남긴다.""",
            ),
            Step(
                key="test",
                label="테스트",
                assignee="gwtester",
                title_prefix="테스트",
                skills=["test-driven-development", "systematic-debugging"],
                body="""부모 리뷰 카드 결과를 바탕으로 동작 검증을 수행한다.

해야 할 일:
- 가능한 테스트 또는 검증 명령을 실행한다.
- 정상/실패/미확인을 구분한다.
- 재현 절차와 로그 위치를 남긴다.""",
            ),
            Step(
                key="docs",
                label="문서화",
                assignee="gwdocs",
                title_prefix="문서화",
                skills=["code-wiki", "humanizer"],
                body="""부모 테스트 카드 결과를 바탕으로 비개발자도 이해할 수 있게 정리한다.

해야 할 일:
- 한 일, 확인된 근거, 남은 리스크, 다음 액션을 정리한다.
- 어려운 용어는 쉬운 한국어로 풀어쓴다.""",
            ),
            Step(
                key="final",
                label="최종 보고",
                assignee="singde",
                title_prefix="최종 통합 보고",
                skills=["one-three-one-rule"],
                body=common_final,
            ),
        ]
    return steps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="그룹웨어 개발 Kanban 자동 파이프라인 생성기",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--type", "-t", choices=VALID_TYPES, default="feature", help="작업 유형: feature, bugfix, docs, deploy, review (기본: feature)")
    parser.add_argument("--board", default=DEFAULT_BOARD, help=f"대상 Kanban 보드 (기본: {DEFAULT_BOARD})")
    parser.add_argument("--hold", action="store_true", help="첫 카드를 scheduled 대기 상태로 만들어 자동 실행을 멈춤. 검증/시연용")
    parser.add_argument("--preview", action="store_true", help="카드를 만들지 않고 생성될 파이프라인만 출력")
    parser.add_argument("--idempotency-key", help="중복 생성 방지 키. 같은 키를 재사용하면 기존 카드를 반환")
    parser.add_argument("title", help="작업 제목")
    parser.add_argument("body", help="작업 설명")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    steps = build_steps(args.type, args.hold)

    print("그룹웨어 개발 자동화 파이프라인")
    print()
    print(f"보드: {args.board}")
    print(f"작업 유형: {args.type}")
    print(f"작업 제목: {args.title}")
    if args.preview:
        print("모드: preview — 실제 카드는 만들지 않음")
    elif args.hold:
        print("모드: hold — 첫 카드는 scheduled 대기 상태로 생성")
    else:
        print("모드: 실행 — 준비된 첫 카드부터 dispatcher가 처리 가능")
    print()

    previous_id: str | None = None
    for step in steps:
        if previous_id:
            step.parents = [previous_id]
        if args.preview:
            parent_label = "이전 단계" if previous_id else "없음"
            status = step.initial_status or ("todo" if previous_id else "ready")
            print(f"- {step.label}: {step.assignee} / 상태={status} / 부모={parent_label} / 스킬={skill_text(step.skills)}")
            previous_id = f"PREVIEW-{step.key}"
        else:
            step.id = create_task(step, args.title, args.body, args.idempotency_key, args.board)
            previous_id = step.id
            status = step.initial_status or ("todo" if step.parents else "ready")
            print(f"- {step.label}: {step.id} -> {step.assignee} / 상태={status} / 스킬={skill_text(step.skills)}")

    print()
    if args.preview:
        print("preview 완료: 실제 Kanban 카드는 생성되지 않았습니다.")
    else:
        print("자동화 작업 파이프라인을 만들었습니다.")
        print()
        print("상태 확인:")
        print("  ./scripts/gw-kanban-status.sh")
        print()
        print("dispatcher dry-run:")
        print("  ./scripts/gw-kanban-dispatch-dry-run.sh")
        print()
        print("첫 카드 로그 보기:")
        first_id = steps[0].id or "<task_id>"
        print(f"  ./scripts/gw-kanban-tail.sh {first_id}")
        if args.type == "deploy":
            approval = next((s for s in steps if s.key == "approval"), None)
            if approval and approval.id:
                print()
                print("배포 범위 확인/승인 게이트 카드:")
                print(f"  {approval.id}")
                print("  카드 작업범위에 배포/릴리즈가 명시되어 있으면 승인된 것으로 진행하고, DNS/유료/비밀값/production DB 등 범위 밖 위험 작업은 별도 승인으로 분리합니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
PY
