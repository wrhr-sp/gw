#!/usr/bin/env python3
from __future__ import annotations
import argparse, html, json, os, sqlite3, time, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path('/home/wrhrgw/gw'); DB=Path('/home/wrhrgw/gw-dev-bot')/'.hermes/kanban/boards/groupware/kanban.db'; ENV=Path('/home/wrhrgw/gw-dev-bot')/'.hermes/.env'
DEFAULT_CHAT_ID='8648561062'; APP_LABEL='그룹웨어'; MAIN_NAME='싱드(singde)'
RESTRICTED=('secret','.env','credential','token','password','production','prod db','운영 db','운영db','dns','domain','유료','비용','결제','migration','마이그레이션','배포','delete','force','삭제','강제')
RECOVER=('timeout','timed out','crash','crashed','stale','protocol violation','protocol-violation','iteration budget','iteration-budget','worker recovery')
def load_dotenv(path):
    if not path.exists(): return
    for line in path.read_text(errors='ignore').splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
def resolve_chat_id(v):
    v=(v or '').strip()
    if not v: return DEFAULT_CHAT_ID
    if v.startswith('telegram:'): return v.split(':',1)[1]
    try:
        d=json.loads(v); return str(d.get('chat_id') or d.get('id') or DEFAULT_CHAT_ID)
    except Exception: return v
def compact(s,n=90):
    s=' '.join(str(s or '').split()); return s[:n]+('…' if len(s)>n else '')
def classify(row):
    blob='\n'.join(str(row[k] or '') for k in row.keys() if k in ('title','result','status')).lower()
    if any(x in blob for x in RESTRICTED): return '승인필요'
    if any(x in blob for x in RECOVER): return '복구후보'
    if str(row['status'])=='blocked': return '수동분류'
    return '-'
def build_message():
    now=time.strftime('%Y-%m-%d %H:%M')
    if not DB.exists(): return f'🕘 <b>{html.escape(APP_LABEL)} 정각 작업현황</b>\n- 시각: {now}\n- 상태: Kanban DB 없음\n- 조치: {html.escape(MAIN_NAME)} 확인 필요'
    uri='file:'+urllib.parse.quote(str(DB), safe='/')+'?mode=ro'
    con=sqlite3.connect(uri, uri=True, timeout=5); con.row_factory=sqlite3.Row
    with con:
        integrity=con.execute('pragma integrity_check').fetchone()[0]
        rows=con.execute("select id,title,status,assignee,created_at,started_at,last_heartbeat_at,result from tasks where status not in ('archived') order by case status when 'running' then 1 when 'blocked' then 2 when 'ready' then 3 when 'todo' then 4 when 'scheduled' then 5 when 'done' then 6 else 9 end, created_at desc limit 120").fetchall()
    counts={}
    for r in rows: counts[r['status']]=counts.get(r['status'],0)+1
    active=[r for r in rows if r['status'] in ('running','blocked','ready')][:8]
    blocked=[r for r in rows if r['status']=='blocked']; class_counts={'승인필요':0,'복구후보':0,'수동분류':0}
    for r in blocked:
        c=classify(r); class_counts[c]=class_counts.get(c,0)+1
    lines=[f'🕘 <b>{html.escape(APP_LABEL)} 정각 작업현황</b>', f'- 보고 주체: {html.escape(MAIN_NAME)}', f'- 시각: {now}', f'- DB 상태: {html.escape(str(integrity))}', f'- 현황: running {counts.get("running",0)} / blocked {counts.get("blocked",0)} / ready {counts.get("ready",0)} / todo {counts.get("todo",0)} / scheduled {counts.get("scheduled",0)} / done {counts.get("done",0)}']
    if blocked: lines.append(f'- 막힘 분류: 승인필요 {class_counts.get("승인필요",0)} / 복구후보 {class_counts.get("복구후보",0)} / 수동분류 {class_counts.get("수동분류",0)}')
    if active:
        lines += ['', '<b>진행/막힘/대기 핵심</b>']
        for r in active:
            extra=f' · {classify(r)}' if r['status']=='blocked' else ''
            lines.append(f'- {html.escape(r["status"] or "-")}{html.escape(extra)} · {html.escape(r["assignee"] or "미지정")} · {html.escape(compact(r["title"]))}')
    else: lines += ['', '- 현재 running/blocked/ready 핵심 카드 없음']
    lines += ['', '<b>복구 원칙</b>', '- 복구후보도 로그·검증 근거 확인 후 처리합니다.', '- 승인필요 항목(secret/운영DB/DNS/비용/배포 등)은 대장 승인 전 조치하지 않습니다.', '- 완료/막힘/복구/조치 결과는 칸반 보고카드가 아니라 Telegram 직접 보고로 전달합니다.']
    return '\n'.join(lines)
def send(msg):
    token=os.environ.get('SINGDE_TELEGRAM_BOT_TOKEN') or os.environ.get('TELEGRAM_BOT_TOKEN') or os.environ.get('TELEGRAM_TOKEN')
    chat=resolve_chat_id(os.environ.get('TELEGRAM_CHAT_ID') or os.environ.get('HERMES_TELEGRAM_HOME') or DEFAULT_CHAT_ID)
    if not token: raise SystemExit('SINGDE_TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_TOKEN 없음')
    data=urllib.parse.urlencode({'chat_id':chat,'text':msg,'parse_mode':'HTML','disable_web_page_preview':'true'}).encode()
    req=urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=data)
    with urllib.request.urlopen(req, timeout=15) as r: print(r.read().decode()[:300])
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--dry-run',action='store_true'); ap.add_argument('--force',action='store_true'); args=ap.parse_args(); load_dotenv(ENV)
    if not args.force:
        h=int(time.strftime('%H'))
        if h<9 or h>20: print('outside report window'); return
    msg=build_message()
    if args.dry_run: print(msg); return
    send(msg)
if __name__=='__main__': main()
