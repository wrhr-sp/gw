#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

# 그룹웨어 Phase 단위 Kanban 생성기
# scope → build → review → test → docs → pr/ci → final

python3 - "$@" <<'PY'
from __future__ import annotations
import argparse, json, os, subprocess
from dataclasses import dataclass, field
BOARD='groupware'; WORKDIR='/home/wrhrgw/gw'; WORKSPACE=f'dir:{WORKDIR}'
HERMES_BIN=os.environ.get('HERMES_BIN','/home/wrhrgw/gw-dev-bot/.hermes/hermes-agent/venv/bin/hermes')
@dataclass
class Step:
    key:str
    assignee:str
    prefix:str
    body:str
    skills:list[str]=field(default_factory=list)
    parents:list[str]=field(default_factory=list)
    initial_status:str|None=None

def run(cmd):
    env=os.environ.copy()
    env.update({
        'HOME':'/home/wrhrgw/gw-dev-bot',
        'HERMES_HOME':'/home/wrhrgw/gw-dev-bot/.hermes',
        'XDG_CONFIG_HOME':'/home/wrhrgw/gw-dev-bot/.config',
        'XDG_STATE_HOME':'/home/wrhrgw/gw-dev-bot/.local/state',
        'XDG_CACHE_HOME':'/home/wrhrgw/gw-dev-bot/.cache',
    })
    return subprocess.run(cmd, check=True, text=True, capture_output=True, cwd=WORKDIR, env=env)

def build(hold):
    first='scheduled' if hold else None
    return [
      Step('scope','gwplanner','Phase 범위 확정','목표: {title}\n\n{body}\n\n해야 할 일: Phase 목표, 제외 범위, 승인 필요 사항, 완료 기준을 정리한다.',['writing-plans','one-three-one-rule','code-wiki'],initial_status=first),
      Step('build','gwbuilder','Phase 구현','부모 범위 확정 결과를 읽고 승인된 범위 안에서 구현한다. 변경 파일과 검증 결과를 남긴다.',['code-wiki','systematic-debugging','test-driven-development'],parents=['scope']),
      Step('review','gwreviewer','Phase 리뷰','부모 구현 결과를 검토한다. 요구사항, 보안, 권한, 과도한 변경, 비밀값 노출을 확인한다.',['github-code-review','requesting-code-review'],parents=['build']),
      Step('test','gwtester','Phase 검증','부모 구현/리뷰 결과를 바탕으로 가능한 테스트와 실행 검증을 수행한다.',['test-driven-development','systematic-debugging'],parents=['review']),
      Step('docs','gwdocs','Phase 문서화','부모 결과를 바탕으로 사용자/운영/개발 문서를 갱신한다. 쉬운 한국어로 정리한다.',['code-wiki','humanizer'],parents=['test']),
      Step('github','gwops','GitHub PR/CI 점검','부모 문서화 결과를 바탕으로 GitHub PR/CI 상태를 점검한다. 실제 merge/delete는 사용자 승인 없이는 하지 않는다.',['github-pr-workflow','systemd-service-operations'],parents=['docs']),
      Step('final','singde','최종 통합 보고','모든 부모 결과를 확인하고 완료/미완료/승인 필요/미확인 사항을 쉬운 한국어로 최종 보고한다.',['one-three-one-rule'],parents=['github']),
    ]

def create(s,title,body,key):
    full=s.body.format(title=title, body=body)+'\n\n공통 규칙: 비밀값 출력 금지. GitHub merge/delete는 명시 승인 없이는 하지 않는다.'
    cmd=[HERMES_BIN,'kanban','--board',BOARD,'create',f'{s.prefix}: {title}','--assignee',s.assignee,'--workspace',WORKSPACE,'--body',full,'--json']
    for p in s.parents: cmd += ['--parent',p]
    for sk in s.skills: cmd += ['--skill',sk]
    if s.initial_status in {'blocked','scheduled'}: cmd += ['--initial-status','blocked']
    if key: cmd += ['--idempotency-key',f'{key}:{s.key}']
    data=json.loads(run(cmd).stdout)
    tid=data.get('id') or data.get('task_id')
    if s.initial_status=='scheduled':
        run([HERMES_BIN,'kanban','--board',BOARD,'schedule',tid,'Phase 안전 대기: 사용자 승인 또는 수동 promote/unblock 필요'])
    return tid

def main():
    ap=argparse.ArgumentParser(description='그룹웨어 Phase Kanban 파이프라인 생성')
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--hold', action='store_true')
    ap.add_argument('--idempotency-key')
    ap.add_argument('title')
    ap.add_argument('body')
    a=ap.parse_args(); ss=build(a.hold)
    if a.preview:
        print(f'보드: {BOARD} / 작업 폴더: {WORKDIR}')
        for s in ss:
            print(f'- {s.key}: {s.prefix} → {s.assignee} / parents={s.parents} / skills={s.skills}')
        return
    made={}
    for s in ss:
        s.parents=[made[p] for p in s.parents]
        tid=create(s,a.title,a.body,a.idempotency_key)
        made[s.key]=tid
        print(f'{s.key}: {tid} ({s.assignee})')
    print('\n생성 완료. ./scripts/gw-kanban-dispatch-dry-run.sh 로 확인하세요.')
if __name__=='__main__': main()
PY
