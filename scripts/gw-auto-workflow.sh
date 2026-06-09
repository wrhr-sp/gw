#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh
python3 - "$@" <<'PY'
from __future__ import annotations
import argparse, json, os, subprocess
from dataclasses import dataclass, field
BOARD='groupware'; WORKDIR='/home/wrhrgw/gw'; WORKSPACE=f'dir:{WORKDIR}'
HERMES_BIN=os.environ.get('HERMES_BIN','/home/wrhrgw/gw-dev-bot/.hermes/hermes-agent/venv/bin/hermes')
VALID_TYPES=('feature','bugfix','docs','review','ops')
@dataclass
class Step:
    key:str; label:str; assignee:str; prefix:str; body:str; skills:list[str]=field(default_factory=list); parents:list[str]=field(default_factory=list); initial_status:str|None=None; id:str|None=None
def run(cmd):
    env=os.environ.copy(); env.update({'HOME':'/home/wrhrgw/gw-dev-bot','HERMES_HOME':'/home/wrhrgw/gw-dev-bot/.hermes','XDG_CONFIG_HOME':'/home/wrhrgw/gw-dev-bot/.config','XDG_STATE_HOME':'/home/wrhrgw/gw-dev-bot/.local/state','XDG_CACHE_HOME':'/home/wrhrgw/gw-dev-bot/.cache'})
    return subprocess.run(cmd, check=True, text=True, capture_output=True, cwd=WORKDIR, env=env)
def final_body():
    return '부모 카드 결과를 바탕으로 완료/미완료/사용자 결정 필요 사항을 쉬운 한국어로 최종 보고한다.'
def steps(kind, hold):
    first='scheduled' if hold else None
    if kind=='docs': return [Step('docs','문서화','gwdocs','문서화','목표: {title}\n\n{body}\n\n문서를 작성/수정하고 쉬운 한국어로 정리한다.',['code-wiki','humanizer'],initial_status=first),Step('review','문서 리뷰','gwreviewer','문서 리뷰','부모 문서 결과를 검토한다.',['requesting-code-review']),Step('final','최종 보고','singde','최종 통합 보고',final_body(),['one-three-one-rule'])]
    if kind=='review': return [Step('review','리뷰','gwreviewer','리뷰','목표: {title}\n\n{body}\n\n요구사항, 품질, 위험, 누락을 검토한다.',['github-code-review','requesting-code-review'],initial_status=first),Step('test','검증','gwtester','검증','부모 리뷰 결과를 바탕으로 검증한다.',['test-driven-development','systematic-debugging']),Step('final','최종 보고','singde','최종 통합 보고',final_body(),['one-three-one-rule'])]
    if kind=='ops': return [Step('ops','운영 점검','gwops','운영 점검','목표: {title}\n\n{body}\n\nsystemd, 권한, GitHub 자동화, 로컬 운영 상태를 점검한다.',['systemd-service-operations','privileged-linux-filesystem-ops','github-pr-workflow'],initial_status=first),Step('review','운영 리뷰','gwreviewer','운영 리뷰','부모 운영 점검 결과를 검토한다.',['requesting-code-review']),Step('final','최종 보고','singde','최종 통합 보고',final_body(),['one-three-one-rule'])]
    if kind=='bugfix': return [Step('repro','재현','gwtester','버그 재현','목표: {title}\n\n{body}\n\n재현 절차와 원인 후보를 정리한다.',['systematic-debugging'],initial_status=first),Step('fix','수정','gwbuilder','버그 수정','부모 재현 결과를 읽고 최소 범위로 수정한다.',['code-wiki','systematic-debugging','test-driven-development']),Step('review','리뷰','gwreviewer','수정 리뷰','부모 수정 결과를 검토한다.',['github-code-review','requesting-code-review']),Step('test','회귀 검증','gwtester','회귀 검증','수정 후 회귀 검증한다.',['test-driven-development']),Step('docs','문서화','gwdocs','수정 문서화','수정 내용과 검증 결과를 정리한다.',['code-wiki','humanizer']),Step('final','최종 보고','singde','최종 통합 보고',final_body(),['one-three-one-rule'])]
    return [Step('plan','기획','gwplanner','기획','목표: {title}\n\n{body}\n\n요구사항, 제외 범위, 구현 순서, 완료 기준을 정리한다.',['writing-plans','one-three-one-rule','code-wiki'],initial_status=first),Step('build','구현','gwbuilder','구현','부모 기획 결과를 읽고 승인 범위 안에서 구현한다.',['code-wiki','systematic-debugging','test-driven-development']),Step('review','리뷰','gwreviewer','리뷰','부모 구현 결과를 검토한다.',['github-code-review','requesting-code-review']),Step('test','테스트','gwtester','테스트','부모 구현/리뷰 결과를 테스트한다.',['test-driven-development']),Step('docs','문서화','gwdocs','문서화','작업 결과를 사용자/운영 관점으로 정리한다.',['code-wiki','humanizer']),Step('final','최종 보고','singde','최종 통합 보고',final_body(),['one-three-one-rule'])]
def create(s,title,body,key):
    full_body=s.body.format(title=title, body=body)+'\n\n공통 완료 규칙: 성공 시 complete, 실제로 멈춰야 할 때만 blocked. 비밀값 출력 금지.'
    cmd=[HERMES_BIN,'kanban','--board',BOARD,'create',f'{s.prefix}: {title}','--assignee',s.assignee,'--workspace',WORKSPACE,'--body',full_body,'--json']
    for p in s.parents: cmd += ['--parent',p]
    for sk in s.skills: cmd += ['--skill',sk]
    if s.initial_status in {'blocked','scheduled'}: cmd += ['--initial-status','blocked']
    if key: cmd += ['--idempotency-key',f'{key}:{s.key}']
    data=json.loads(run(cmd).stdout); tid=data.get('id') or data.get('task_id')
    if s.initial_status=='scheduled': run([HERMES_BIN,'kanban','--board',BOARD,'schedule',tid,'자동화 안전 대기: 사용자 승인 또는 수동 promote/unblock 필요'])
    return tid
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--type',choices=VALID_TYPES,default='feature'); ap.add_argument('--preview',action='store_true'); ap.add_argument('--hold',action='store_true'); ap.add_argument('--idempotency-key'); ap.add_argument('title'); ap.add_argument('body'); a=ap.parse_args()
    ss=steps(a.type,a.hold)
    for i in range(1,len(ss)): ss[i].parents=[ss[i-1].key]
    if a.preview:
        print('주의: 실제 카드 생성은 싱드가 대장에게 오케스트레이션 실행 승인을 받은 뒤에만 진행한다.')
        print(f'보드: {BOARD} / 작업 폴더: {WORKDIR}')
        for s in ss: print(f'- {s.key}: {s.label} → {s.assignee} / parents={s.parents or []} / skills={s.skills}')
        return
    made={}
    for s in ss:
        s.parents=[made[p] for p in s.parents]
        tid=create(s,a.title,a.body,a.idempotency_key); made[s.key]=tid; print(f'{s.key}: {tid} ({s.assignee})')
    print('\n생성 완료. ./scripts/gw-kanban-dispatch-dry-run.sh 로 확인하세요.')
if __name__=='__main__': main()
PY
