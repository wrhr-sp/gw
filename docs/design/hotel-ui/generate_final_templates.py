from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT=Path(__file__).resolve().parent
OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
P={'bg':'#F4F7FA','surface':'#FFFFFF','sidebar':'#FFFFFF','primary':'#193B57','accent':'#0E8A7A','text':'#172033','muted':'#667085','line':'#DFE5EA','soft':'#EAF3F5','radius':10}

def ft(s,b=False): return ImageFont.truetype(BOLD if b else FONT,s)
def text(d,xy,t,s=14,c=None,b=False,a=None): d.text(xy,t,font=ft(s,b),fill=c or P['text'],anchor=a)
def rr(d,xy,fill=None,r=10,ol=None,w=1): d.rounded_rectangle(xy,radius=r,fill=fill,outline=ol,width=w)
def card(d,xy,fill=None,r=None):
 x1,y1,x2,y2=xy; rr(d,(x1+2,y1+3,x2+2,y2+3),'#E8ECEF',r or P['radius']); rr(d,xy,fill or P['surface'],r or P['radius'],P['line'])
def btn(d,x,y,label,primary=False,danger=False,w=100,h=40):
 fill=P['primary'] if primary else ('#FFF4F2' if danger else P['surface']); fg='#FFF' if primary else ('#B42318' if danger else P['text']); ol=fill if primary else ('#FDA29B' if danger else P['line'])
 rr(d,(x,y,x+w,y+h),fill,8,ol); text(d,(x+w/2,y+h/2),label,13,fg,True,'mm')
def badge(d,x,y,label,tone='green'):
 m={'green':('#E8F7EE','#067647'),'blue':('#EAF2FF','#175CD3'),'amber':('#FFFAEB','#B54708'),'red':('#FEF3F2','#B42318'),'gray':('#F2F4F7','#475467'),'teal':('#E8F8F5','#087B6C')}; bg,fg=m[tone]; w=max(56,len(label)*13+18); rr(d,(x,y,x+w,y+25),bg,6); text(d,(x+w/2,y+12.5),label,12,fg,True,'mm'); return w

def shell(title,subtitle,active='홈',action=None):
 W,H=1440,900; img=Image.new('RGB',(W,H),P['bg']); d=ImageDraw.Draw(img); side=232; top=64
 d.rectangle((0,0,side,H),fill=P['sidebar']); d.line((side-1,0,side-1,H),fill=P['line'])
 text(d,(24,22),'WEREHERE',20,P['primary'],True); text(d,(24,46),'HOTEL OPERATIONS',10,P['muted'])
 groups=[('홈',None),('호텔 운영',['호텔 관리','객실 관리','객실 점검','운영 이슈']),('운영 정산',['일매출','소유주 문의']),('시스템',['운영 설정','권한 관리'])]
 y=92
 for g,items in groups:
  if items is None:
   items=[g]
  else:
   text(d,(24,y),g,11,P['muted'],True); y+=28
  for item in items:
   if item==active: rr(d,(14,y-5,side-14,y+35),P['soft'],8)
   text(d,(28,y+14),('● ' if item==active else '○ ')+item,14,P['primary'] if item==active else '#475467',item==active,'lm'); y+=44
 d.rectangle((side,0,W,top),fill=P['surface']); d.line((side,top-1,W,top-1),fill=P['line'])
 rr(d,(side+22,13,side+220,51),P['soft'],8,P['line']); text(d,(side+38,32),'전체 호텔  선택',14,P['text'],True,'lm')
 rr(d,(side+250,13,side+570,51),P['bg'],8,P['line']); text(d,(side+268,32),'호텔·객실·담당자 검색',13,P['muted'],False,'lm')
 text(d,(1218,32),'알림 3',13,P['text'],True,'lm'); rr(d,(1300,12,1416,52),P['soft'],20); text(d,(1358,32),'홍길동',12,P['text'],True,'mm')
 x=side+24; y=88; text(d,(x,y),title,28,P['text'],True); text(d,(x,y+40),subtitle,14,P['muted'])
 if action: btn(d,1285,y-4,action,True,w=120)
 return img,d,(x,y+82,1416,876)

def dashboard():
 img,d,(x,y,x2,y2)=shell('운영 대시보드','전체 호텔의 오늘 업무와 위험상태를 확인합니다.','홈')
 metrics=[('운영 호텔','9 / 12','정상 운영 9개','teal'),('점검 지연','4건','부산 3 · 서울 1','amber'),('긴급 이슈','1건','서울호텔 703호','red'),('미입력 매출','2개 호텔','제주 · 강릉','blue')]
 gap=14; w=(x2-x-gap*3)/4
 for i,(lab,val,sub,tone) in enumerate(metrics):
  xx=x+i*(w+gap); card(d,(xx,y,xx+w,y+112)); text(d,(xx+18,y+18),lab,12,P['muted'],True); text(d,(xx+18,y+48),val,26,P['text'],True); text(d,(xx+18,y+82),sub,11,P['muted']); badge(d,xx+w-82,y+18,'확인' if tone!='teal' else '정상',tone)
 y+=132
 card(d,(x,y,x+720,y+280)); text(d,(x+20,y+20),'지금 처리할 일',17,P['text'],True); text(d,(x+20,y+48),'위험도와 기한을 기준으로 정렬됩니다.',11,P['muted'])
 tasks=[('긴급','서울호텔 703호 누수 의심','오늘 15:00 · 홍길동','red'),('지연','부산호텔 객실점검 3건','2시간 지연 · 김담당','amber'),('대기','제주호텔 일매출 미입력','영업일 2026.07.15','blue')]
 yy=y+78
 for st,lab,sub,tone in tasks:
  d.line((x+20,yy+58,x+700,yy+58),fill=P['line']); badge(d,x+20,yy,st,tone); text(d,(x+105,yy+5),lab,14,P['text'],True); text(d,(x+105,yy+30),sub,11,P['muted']); btn(d,x+590,yy,'확인',False,w=90,h=34); yy+=64
 card(d,(x+738,y,x2,y+280)); text(d,(x+758,y+20),'호텔 운영건강도',17,P['text'],True)
 hotels=[('서울호텔',94,'#0E8A7A'),('부산호텔',82,'#F79009'),('제주호텔',71,'#2E90FA'),('강릉호텔',58,'#D92D20')]; yy=y+68
 for name,score,col in hotels:
  text(d,(x+758,yy),name,12,P['text'],True); text(d,(x2-34,yy),str(score),12,P['text'],True,'ra'); rr(d,(x+840,yy+2,x2-62,yy+14),'#EDF0F2',6); rr(d,(x+840,yy+2,x+840+(x2-902)*score/100,yy+14),col,6); yy+=47
 y+=298
 card(d,(x,y,x2,y2)); text(d,(x+20,y+18),'최근 활동',16,P['text'],True)
 acts=['서울호텔 운영이슈 담당자가 변경됐습니다.','부산호텔 객실점검 12건이 완료됐습니다.','제주호텔 일매출이 임시저장됐습니다.']; yy=y+58
 for a in acts: text(d,(x+24,yy),'• '+a,12,P['muted']); yy+=30
 img.save(OUT/'pc_dashboard.png')

def hotel_list():
 # use selected prototype already generated; make durable duplicate
 src=Path('/home/wrhrgw/gw-dev-bot/design-previews/hotel-ui/selected-operations-platform/E_combo_recommended_desktop.png')
 Image.open(src).save(OUT/'pc_hotel_list_panel.png')

def hotel_detail():
 img,d,(x,y,x2,y2)=shell('서울호텔','H001 · 서울특별시 중구 · 운영중','호텔 관리','기본정보 수정')
 card(d,(x,y,x2,y+134),P['surface']); badge(d,x+20,y+18,'운영중','green'); text(d,(x+20,y+54),'서울호텔',24,P['text'],True); text(d,(x+20,y+88),'객실 85 · 운영담당 홍길동 · 계약 2026.01.01 – 2027.12.31',13,P['muted']); btn(d,x2-236,y+68,'운영 중지',False,True,100); btn(d,x2-124,y+68,'운영 리포트',False,w=108)
 y+=152
 # left summary, right activity
 card(d,(x,y,x+720,y+216)); text(d,(x+20,y+18),'운영 요약',17,P['text'],True)
 vals=[('점검완료','94%','teal'),('운영이슈','3건','red'),('미답변문의','2건','amber'),('오늘 매출','입력완료','green')]; xx=x+20
 for lab,val,tone in vals:
  text(d,(xx,y+62),lab,11,P['muted'],True); text(d,(xx,y+91),val,20,P['text'],True); badge(d,xx,y+130,'정상' if tone in ('teal','green') else '확인',tone); xx+=165
 card(d,(x+738,y,x2,y+216)); text(d,(x+758,y+18),'오늘 확인할 내용',17,P['text'],True); items=['703호 긴급이슈 1건','객실 재점검 2건','소유주 문의 답변 대기 2건']; yy=y+62
 for item in items: text(d,(x+758,yy),'• '+item,13,P['muted']); yy+=38
 y+=234
 widths=(x2-x-16)/2
 for i,(title,items) in enumerate([('기본정보',['대표전화 02-1234-5678','도로명주소 서울특별시 중구 세종대로 1','호텔코드 H001','상태 변경일 2026.06.01']),('담당 및 연결',['주담당 홍길동','지원담당 김지원','하우스키핑 8명','호텔 소유주 이소유'])]):
  xx=x+i*(widths+16); card(d,(xx,y,xx+widths,y+190)); text(d,(xx+18,y+18),title,16,P['text'],True); yy=y+58
  for item in items: text(d,(xx+20,yy),item,12,P['muted']); yy+=29
 y+=208
 card(d,(x,y,x2,y2)); text(d,(x+18,y+18),'최근 변경 및 감사기록',16,P['text'],True); text(d,(x+20,y+58),'2026.07.15 10:12  홍길동  호텔 기본정보 조회  성공',12,P['muted']); text(d,(x+20,y+88),'2026.07.15 09:30  김담당  객실점검 완료      성공',12,P['muted'])
 img.save(OUT/'pc_hotel_detail.png')

def issue_split():
 img,d,(x,y,x2,y2)=shell('운영 이슈','긴급도·기한·담당자를 기준으로 운영이슈를 처리합니다.','운영 이슈','이슈 등록')
 # filter
 card(d,(x,y,x2,y+70)); text(d,(x+18,y+12),'상태',10,P['muted'],True); rr(d,(x+18,y+31,x+138,y+59),P['surface'],7,P['line']); text(d,(x+30,y+45),'미완료',12,P['text'],False,'lm'); text(d,(x+160,y+12),'긴급도',10,P['muted'],True); rr(d,(x+160,y+31,x+280,y+59),P['surface'],7,P['line']); text(d,(x+172,y+45),'전체',12,P['text'],False,'lm')
 y+=84; listw=350
 card(d,(x,y,x+listw,y2)); text(d,(x+18,y+16),'처리할 이슈 12',15,P['text'],True); yy=y+54
 issues=[('긴급','703호 누수 의심','서울호텔 · 1시간 남음','red'),('중대','502호 비품 파손','부산호텔 · 오늘 18:00','amber'),('일반','301호 비품 누락','서울호텔 · 내일 10:00','blue'),('일반','냉난방 점검','강릉호텔 · 담당자 없음','gray')]
 for st,title,sub,tone in issues:
  fill=P['soft'] if yy==y+54 else P['surface']; rr(d,(x+10,yy,x+listw-10,yy+100),fill,9,P['line']); badge(d,x+22,yy+14,st,tone); text(d,(x+22,yy+48),title,14,P['text'],True); text(d,(x+22,yy+74),sub,11,P['muted']); yy+=110
 # detail
 dx=x+listw+16; card(d,(dx,y,x2,y2)); badge(d,dx+22,y+18,'긴급','red'); text(d,(dx+22,y+58),'703호 누수 의심',24,P['text'],True); text(d,(dx+22,y+94),'서울호텔 · 7층 · 객실 703호',12,P['muted']); btn(d,x2-248,y+18,'담당 변경',False,w=100); btn(d,x2-136,y+18,'처리 완료',True,w=110)
 sections=[('처리정보',['상태  확인중','담당자  홍길동','처리기한  오늘 15:00','자동생성  객실점검 이상항목']),('이상 내용',['욕실 천장에서 누수 흔적이 확인됐습니다.','사진 2개 · 동영상 없음']),('조치 기록',['10:24 현장 확인 시작 · 홍길동','10:31 시설담당자 호출 · 홍길동']),('첨부 및 감사',['첨부파일 2개','최근 조회 10:35 · 김관리'])]; yy=y+138
 for title,items in sections:
  text(d,(dx+22,yy),title,15,P['text'],True); yy+=33
  for item in items: text(d,(dx+28,yy),'• '+item,12,P['muted']); yy+=25
  d.line((dx+22,yy,x2-22,yy),fill=P['line']); yy+=19
 img.save(OUT/'pc_issue_split.png')

def sales():
 img,d,(x,y,x2,y2)=shell('일매출 관리','호텔별 일매출을 입력하고 확정·정정합니다.','일매출','매출 입력')
 card(d,(x,y,x2,y+72)); fields=[('호텔','서울호텔'),('기간','2026.07.01 – 07.15'),('상태','전체')]; xx=x+18
 for lab,val in fields:
  text(d,(xx,y+10),lab,10,P['muted'],True); rr(d,(xx,y+30,xx+190,y+60),P['surface'],7,P['line']); text(d,(xx+12,y+45),val,12,P['text'],False,'lm'); xx+=206
 y+=88; card(d,(x,y,x2,y2)); text(d,(x+18,y+18),'서울호텔 일매출',16,P['text'],True); badge(d,x+160,y+15,'잠금정책 적용','blue')
 cols=[('영업일',x+20),('객실매출',x+170),('기타매출',x+330),('합계',x+490),('상태',x+650),('입력자',x+760),('확정시각',x+890)]; hy=y+58; d.rectangle((x+1,hy,x2-1,hy+42),fill=P['soft'])
 for lab,xx in cols: text(d,(xx,hy+21),lab,11,P['muted'],True,'lm')
 rows=[('2026.07.15','8,450,000','350,000','8,800,000','임시','김담당','-','blue'),('2026.07.14','8,120,000','280,000','8,400,000','확정','김담당','07.15 09:10','green'),('2026.07.13','7,980,000','310,000','8,290,000','잠금','홍관리','07.14 09:03','gray'),('2026.07.12','9,020,000','420,000','9,440,000','정정','김담당','07.13 10:22','amber')]; yy=hy+42
 for r in rows:
  day,a,b,total,status,actor,time,tone=r; vals=[day,a,b,total];
  for val,(_,xx) in zip(vals,cols[:4]): text(d,(xx,yy+24),val,12,P['text'],val==total,'lm')
  badge(d,cols[4][1],yy+11,status,tone); text(d,(cols[5][1],yy+24),actor,12,P['muted'],False,'lm'); text(d,(cols[6][1],yy+24),time,12,P['muted'],False,'lm'); d.line((x+1,yy+48,x2-1,yy+48),fill=P['line']); yy+=49
 d.rectangle((x+1,yy,x2-1,yy+54),fill='#FAFBFC'); text(d,(x+20,yy+27),'합계',12,P['text'],True,'lm'); text(d,(x+170,yy+27),'33,570,000',13,P['text'],True,'lm'); text(d,(x+330,yy+27),'1,360,000',13,P['text'],True,'lm'); text(d,(x+490,yy+27),'34,930,000',13,P['text'],True,'lm')
 text(d,(x+18,y2-64),'정정 요청은 사유와 증빙을 제출하며 원본 금액과 변경이력을 보존합니다.',11,P['muted']); btn(d,x2-140,y2-76,'정정 요청',False,w=120)
 img.save(OUT/'pc_daily_sales.png')

def permissions():
 img,d,(x,y,x2,y2)=shell('호텔 권한 관리','역할·그룹·개인의 호텔별 기능권한을 설정합니다.','권한 관리','권한 추가')
 # tabs
 tabs=['역할','그룹','개인']; xx=x
 for i,t in enumerate(tabs):
  rr(d,(xx,y,xx+92,y+40),P['primary'] if i==0 else P['surface'],8,P['line']); text(d,(xx+46,y+20),t,13,'#FFF' if i==0 else P['text'],True,'mm'); xx+=100
 y+=56; card(d,(x,y,x+300,y2)); text(d,(x+18,y+18),'역할 목록',15,P['text'],True); roles=[('회사 관리자','전체 호텔'),('호텔 운영책임자','배정 호텔'),('하우스키핑','연결 호텔'),('호텔 소유주','소유 호텔')]; yy=y+58
 for i,(r,scope) in enumerate(roles):
  if i==1: rr(d,(x+10,yy-8,x+290,yy+56),P['soft'],8)
  text(d,(x+20,yy),r,13,P['text'],True); text(d,(x+20,yy+26),scope,11,P['muted']); yy+=74
 dx=x+316; card(d,(dx,y,x2,y2)); text(d,(dx+20,y+18),'호텔 운영책임자',18,P['text'],True); text(d,(dx+20,y+50),'배정된 호텔의 기본 운영업무를 수행합니다.',12,P['muted']);
 text(d,(dx+20,y+88),'호텔 범위',12,P['muted'],True); rr(d,(dx+20,y+110,dx+340,y+150),P['surface'],8,P['line']); text(d,(dx+34,y+130),'유효한 기간배정 호텔',13,P['text'],False,'lm')
 text(d,(dx+20,y+182),'기능 권한',15,P['text'],True)
 perms=[('호텔 조회','허용','호텔 기본정보와 운영요약'),('호텔 기본정보 수정','차단','주소·연락처·계약정보'),('운영상태 변경','차단','활성화·중지·재활성화'),('사용자 배정 관리','허용','사내 임직원·하우스키핑'),('소유주 연결 관리','차단','고위험 별도 권한'),('파일 다운로드','차단','보기와 다운로드 분리')]; yy=y+224
 for name,state,desc in perms:
  d.line((dx+20,yy+48,x2-20,yy+48),fill=P['line']); text(d,(dx+24,yy),name,13,P['text'],True); text(d,(dx+250,yy),desc,11,P['muted']); badge(d,x2-100,yy-4,state,'teal' if state=='허용' else 'red'); yy+=58
 card(d,(dx+20,y2-108,x2-20,y2-20),'#FFF9EB',8); text(d,(dx+36,y2-90),'권한 변경은 즉시 적용되며 감사로그에 남습니다.',12,'#B54708',True); text(d,(dx+36,y2-62),'개인 차단이 역할·그룹 허용보다 우선합니다.',11,'#B54708'); btn(d,x2-136,y2-72,'변경 저장',True,w=104)
 img.save(OUT/'pc_permissions.png')

def mobile_base(title,subtitle):
 W,H=390,844; img=Image.new('RGB',(W,H),P['bg']); d=ImageDraw.Draw(img); d.rectangle((0,0,W,58),fill=P['surface']); d.line((0,57,W,57),fill=P['line']); text(d,(16,29),'서울호텔  선택',15,P['text'],True,'lm'); text(d,(W-56,29),'알림 3',12,P['text'],True,'mm'); text(d,(16,78),title,24,P['text'],True); text(d,(16,112),subtitle,12,P['muted']); return img,d,132

def mobile_home():
 img,d,y=mobile_base('오늘 업무','지금 처리해야 할 업무를 확인하세요.');
 metrics=[('객실점검','8 / 12','계속하기','teal'),('긴급이슈','1건','확인하기','red'),('매출입력','완료','보기','green'),('소유주문의','2건','답변하기','amber')]
 for i,(lab,val,act,tone) in enumerate(metrics):
  x=14+(i%2)*184; yy=y+(i//2)*128; card(d,(x,yy,x+176,yy+112),r=12); text(d,(x+16,yy+15),lab,12,P['muted'],True); text(d,(x+16,yy+43),val,23,P['text'],True); badge(d,x+16,yy+76,act,tone)
 y+=270; text(d,(16,y),'긴급 확인',16,P['text'],True); y+=30; card(d,(14,y,376,y+104),'#FFF9F8',12); badge(d,28,y+16,'긴급','red'); text(d,(28,y+52),'703호 누수 의심',16,P['text'],True); text(d,(28,y+78),'10분 전 · 현장 확인 필요',11,P['muted']); btn(d,270,y+50,'확인',True,w=86,h=38)
 bottom_nav(d,'홈'); img.save(OUT/'mobile_home.png')

def bottom_nav(d,active):
 H=844; d.rectangle((0,H-68,390,H),fill=P['surface']); d.line((0,H-68,390,H-68),fill=P['line']); labs=['홈','점검','이슈','알림','더보기']
 for i,l in enumerate(labs): x=(i+.5)*78; c=P['primary'] if l==active else P['muted']; text(d,(x,H-46),'●' if l==active else '○',12,c,False,'mm'); text(d,(x,H-21),l,11,c,l==active,'mm')

def mobile_inspection():
 img,d,y=mobile_base('703호 객실점검','8개 항목 중 4개를 완료했습니다.'); rr(d,(16,y,374,y+10),P['line'],5); rr(d,(16,y,195,y+10),P['primary'],5); y+=28
 items=[('욕실 청결','이상'),('침구 상태','정상'),('비품 확인','미입력')]
 for name,state in items:
  h=132 if state=='이상' else 96; card(d,(14,y,376,y+h),r=12); text(d,(28,y+18),name,15,P['text'],True); btn(d,28,y+48,'✓ 정상',primary=state=='정상',w=142,h=42); btn(d,190,y+48,'! 이상',danger=state=='이상',w=142,h=42)
  if state=='이상': text(d,(28,y+101),'사진 2개 · “천장 누수 흔적”',11,'#B42318')
  y+=h+10
 card(d,(14,y,376,y+94),r=12); text(d,(28,y+16),'사진 및 메모',14,P['text'],True); btn(d,28,y+45,'카메라 촬영',False,w=130,h=38); btn(d,170,y+45,'파일 선택',False,w=100,h=38); y+=108
 d.rectangle((0,776,390,844),fill=P['surface']); d.line((0,775,390,775),fill=P['line']); btn(d,14,790,'임시저장',False,w=116,h=42); btn(d,142,790,'다음 항목 →',True,w=234,h=42); img.save(OUT/'mobile_inspection.png')

def mobile_issue():
 img,d,y=mobile_base('긴급 운영이슈','703호 · 누수 의심'); badge(d,16,y,'긴급','red'); y+=42
 card(d,(14,y,376,y+164),r=12); text(d,(28,y+18),'처리정보',15,P['text'],True); rows=[('상태','확인중'),('담당자','홍길동'),('처리기한','오늘 15:00'),('호텔','서울호텔')]; yy=y+52
 for a,b in rows: text(d,(28,yy),a,11,P['muted']); text(d,(138,yy),b,12,P['text'],True); yy+=27
 y+=178; card(d,(14,y,376,y+142),r=12); text(d,(28,y+18),'이상 내용',15,P['text'],True); text(d,(28,y+52),'욕실 천장에서 누수 흔적이 확인됐습니다.',12,P['muted']); rr(d,(28,y+82,102,y+126),'#DDE6EC',8); rr(d,(112,y+82,186,y+126),'#DDE6EC',8); text(d,(65,y+104),'사진 1',10,P['muted'],False,'mm'); text(d,(149,y+104),'사진 2',10,P['muted'],False,'mm')
 y+=156; card(d,(14,y,376,y+136),r=12); text(d,(28,y+18),'조치 기록',15,P['text'],True); text(d,(28,y+53),'10:24  현장 확인 시작',12,P['muted']); text(d,(28,y+82),'10:31  시설담당자 호출',12,P['muted']); text(d,(28,y+111),'+ 조치 내용 추가',12,P['accent'],True)
 d.rectangle((0,776,390,844),fill=P['surface']); d.line((0,775,390,775),fill=P['line']); btn(d,14,790,'담당 변경',False,w=116,h=42); btn(d,142,790,'처리 완료',True,w=234,h=42); img.save(OUT/'mobile_issue.png')

def sheet(files,name,cols=2,cell=(720,500)):
 cw,ch=cell; rows=(len(files)+cols-1)//cols; out=Image.new('RGB',(cw*cols,ch*rows),'#DDE3E8');
 for i,p in enumerate(files):
  im=Image.open(p).convert('RGB'); im.thumbnail((cw-16,ch-16),Image.Resampling.LANCZOS); x=(i%cols)*cw+(cw-im.width)//2; y=(i//cols)*ch+(ch-im.height)//2; out.paste(im,(x,y))
 out.save(OUT/name)

dashboard(); hotel_list(); hotel_detail(); issue_split(); sales(); permissions(); mobile_home(); mobile_inspection(); mobile_issue()
pc=[OUT/n for n in ['pc_dashboard.png','pc_hotel_list_panel.png','pc_hotel_detail.png','pc_issue_split.png','pc_daily_sales.png','pc_permissions.png']]
mo=[OUT/n for n in ['mobile_home.png','mobile_inspection.png','mobile_issue.png']]
sheet(pc,'comparison_pc_final.png',2,(720,460)); sheet(mo,'comparison_mobile_final.png',3,(410,870))
print('FINAL_TEMPLATES_OK')
for p in sorted(OUT.glob('*.png')): print(p.name,p.stat().st_size)
