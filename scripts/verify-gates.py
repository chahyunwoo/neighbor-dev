#!/usr/bin/env python3
"""
게이트 검증 — 공개 검사기가 *실제로* 잡는지 뮤테이션으로 확인한다.

"검사기가 있다"와 "검사기가 작동한다"는 다르다. 실측으로 이 스크립트가
검사기의 구멍 둘을 드러냈다:
  · 층 배정을 뒤집어도 `checkTierRules` 는 통과시켰다 → `checkTierAssignment` 추가
  · 게재 컷을 지워도 아무도 안 잡았다               → `checkPeriodCutoff` 추가

돌리는 법:
    python3 scripts/verify-gates.py

⚠️ 함정 셋(전역 규칙 7절)을 이 스크립트가 구조적으로 막는다:
  ⓪ 앵커가 안 맞으면 치환이 no-op 이 되어 "안 잡혔다"로 오독된다
     → `count != 1` 이면 '앵커 불일치' 로 따로 보고하고 판정하지 않는다.
  ① 잔재가 커밋에 섞인다 → 매 케이스 전후로 백업본에서 복사 복구한다.
  ② `git checkout` 은 같은 파일의 다른 미커밋 변경까지 날린다
     → 파일 복사로만 백업·복구한다. git 명령을 쓰지 않는다.

⚠️ M1 이 '못 잡음' 으로 나오는 것은 정상이다 — 개인 도메인 방어가 두 겹
   (익명 라벨 + 문자열 치환)이라 하나만 죽이면 다른 하나가 막는다.
   M2 가 둘 다 죽여 실제로 잡히는 것을 확인한다.
"""

import io,os,subprocess,shutil,json,sys,tempfile,atexit
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BK=tempfile.mkdtemp(prefix='neighbor-gates-')
FILES=['sanitize.mjs','tiers.mjs','build-data.mjs','disclosure.mjs','verify-disclosure.mjs']

# 원본을 백업해 둔다. git 을 쓰지 않는다 — 같은 파일의 다른 미커밋 변경이 날아간다.
for _f in FILES:
    shutil.copy(os.path.join(ROOT,'scripts',_f), os.path.join(BK,_f))
shutil.copy(os.path.join(ROOT,'data','generated','projects.json'), os.path.join(BK,'projects.json'))
atexit.register(lambda: shutil.rmtree(BK, ignore_errors=True))

# PDF 의존성 뮤테이션용 탐침 매니페스트. 실제 앱 파일을 건드리지 않는다.
PKG_PROBE=os.path.join(BK,'pdf-probe.package.json')

def restore():
    for f in FILES: shutil.copy(os.path.join(BK,f), os.path.join(ROOT,'scripts',f))
    shutil.copy(os.path.join(BK,'projects.json'), os.path.join(ROOT,'data','generated','projects.json'))
    if os.path.exists(PKG_PROBE): os.remove(PKG_PROBE)

def run(cmd):
    env=dict(os.environ)
    if os.path.exists(PKG_PROBE): env['PDF_MANIFEST_EXTRA']=PKG_PROBE
    r=subprocess.run(cmd,shell=True,cwd=ROOT,capture_output=True,text=True,env=env)
    return r.returncode, r.stdout+r.stderr

# (이름, 종류, 상세)  종류: 'src' = 소스 치환, 'file' = 파일 생성
MUTS=[
 ('M1 개인도메인 치환 제거','src','scripts/sanitize.mjs',
  "[new RegExp(PERSONAL_DOMAIN.replace('.', '\\\\.'), 'g'), '개인 기술 사이트', '개인 도메인 비노출'],",
  '// MUTATION','__NOT_EXPECTED__', '이중 방어 — 익명라벨이 살아 있어 도메인이 애초에 안 들어온다. 안 잡히는 것이 정상'),
 ('M2 익명라벨 + 치환 둘 다 제거','src2','scripts/sanitize.mjs',
  [('return ANONYMOUS_LABELS[id]','return undefined  // MUTATION'),
   ("[new RegExp(PERSONAL_DOMAIN.replace('.', '\\\\.'), 'g'), '개인 기술 사이트', '개인 도메인 비노출'],",'// MUTATION')],
  '개인도메인',''),
 ('M3 루프백 치환 제거','src','scripts/sanitize.mjs',
  "[/`?127\\.0\\.0\\.1`?/g, '로컬 전용 바인딩', '루프백 주소 → 설계 표현'],",
  '// MUTATION','사설IP',''),
 ('M4 층 판정 뒤집기','src','scripts/tiers.mjs',
  "return project.clientSafe === true ? TIER.DETAIL : TIER.SUMMARY",
  "return TIER.DETAIL  // MUTATION",'층배정',''),
 ('M5 허용목록 무력화','src','scripts/build-data.mjs',
  "  const allowed = ALLOWED_FIELDS[tier]",
  "  const allowed = Object.keys(full)  // MUTATION",'층규칙',''),
 ('M6 제외 대상 게재','src','scripts/tiers.mjs',
  "export const EXCLUDED_IDS = new Set(['discord-bot'])",
  "export const EXCLUDED_IDS = new Set()  // MUTATION",'층배정',''),
 ('M7 게재 컷 무력화','src','scripts/tiers.mjs',
  "  if (!isAfterCutoff(parsePeriodStart(project.period))) return TIER.NONE",
  "  // MUTATION",'게재컷',''),
 ('M8 PDF 의존성 유입','pkg',None,None,None,'PDF생성의존성',''),
]

res=[]
for m in MUTS:
    name,kind=m[0],m[1]
    restore()
    if kind=='pkg':
        # ⚠️ 실제 apps/web/package.json 을 덮어쓰지 않는다 — 실측(2026-09-09)에서
        #    정리 단계가 그 파일을 지워 워킹트리에 삭제로 남았다.
        #    전용 임시 파일을 만들고 verify 에 PDF_MANIFEST_EXTRA 로 넘긴다.
        io.open(PKG_PROBE,'w').write(
          json.dumps({"name":"probe","dependencies":{"@react-pdf/renderer":"^4.0.0"}},indent=2))
        expect=m[5]
    elif kind=='src2':
        p=os.path.join(ROOT,m[2]); s=io.open(p,encoding='utf-8').read()
        ok=True
        for old,new in m[3]:
            if s.count(old)!=1: res.append((name,'❌ 앵커 불일치',f'count={s.count(old)}')); ok=False; break
            s=s.replace(old,new)
        if not ok: continue
        io.open(p,'w',encoding='utf-8').write(s)
        assert io.open(p,encoding='utf-8').read().count('MUTATION')==2
        expect=m[4]
    else:
        p=os.path.join(ROOT,m[2]); s=io.open(p,encoding='utf-8').read()
        if s.count(m[3])!=1:
            res.append((name,'❌ 앵커 불일치',f'count={s.count(m[3])} — no-op, 뮤테이션 무효')); continue
        io.open(p,'w',encoding='utf-8').write(s.replace(m[3],m[4]))
        assert 'MUTATION' in io.open(p,encoding='utf-8').read()
        expect=m[5]
    rcb,outb=run('node scripts/build-data.mjs')
    rc,out=run('node scripts/verify-disclosure.mjs')
    caught=(rc!=0) and (expect in out)
    hits=' / '.join(l.strip().lstrip('🔴 ') for l in out.splitlines() if '🔴' in l)[:200]
    res.append((name,'✅ 잡힘' if caught else '❌ 못 잡음', f'기대={expect} | {hits or out.strip()[:120]}'))

restore()
rc,o1=run('node scripts/build-data.mjs'); rc2,o2=run('node scripts/verify-disclosure.mjs')
print('=== 뮤테이션 결과 ===')
for n,v,d in res: print(f'{v}  {n}\n      {d}')
print('\n=== 복구 후 ===')
print(o1.strip()); print(o2.strip(), f'(exit={rc2})')

# M1 은 이중 방어라 '못 잡음' 이 정상. 그 외에 못 잡은 것이 있으면 실패로 본다.
unexpected=[n for n,v,_ in res if v!='✅ 잡힘' and not n.startswith('M1 ')]
if rc2!=0:
    print('\n🔴 복구 후 검사가 실패했다 — 잔재가 남았는지 확인한다.'); sys.exit(1)
if unexpected:
    print(f'\n🔴 게이트가 못 잡은 뮤테이션: {unexpected}'); sys.exit(1)
print('\n✅ 게이트 검증 통과 — M1(이중 방어) 외 전부 잡힌다.')
