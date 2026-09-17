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
FILES=['sanitize.mjs','tiers.mjs','build-data.mjs','disclosure.mjs','verify-disclosure.mjs','source.mjs']

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

# ── G1. 사명 검사가 *지금 실제로* 잡는가 ───────────────────────────────
#
# 뮤테이션이 아니라 **기준선 검사**다. 위의 M1~M8 은 전부 소스를 망가뜨려 보는데,
# 사명 대조만은 그 방식으로 못 본다 — 정상 데이터에는 사명이 애초에 없어서
# 무엇을 망가뜨려도 위반이 안 나기 때문이다.
#
# 🔴 실측 2026-09-16: `realCompanyNames()` 를 `return []` 로 되돌려도 이 스크립트가
#    초록을 냈다. 사명 목록이 비면 `disclosure.mjs` 의 회사표기 검사가 통째로
#    no-op 이 되는데(`extraCompanyNames.length > 0` 조건, 기본 구현은 `() => []`),
#    그걸 감시하는 케이스가 없었다. 검사기를 고치면서 그 검사기를 지키는 게이트는
#    안 넣은 것이다.
#
# 방법: 정본의 실제 사명 1건을 생성 데이터에 심고 검사기가 잡는지 본다.
# ⚠️ 사명 값은 **출력하지 않는다** — 찍는 순간 그게 곧 유출이다(이 저장소는 PUBLIC).
INJECT = os.path.join(BK, 'inject.mjs')
# ⚠️ import 는 **이 파일의 위치** 기준으로 풀린다. 탐침은 임시 디렉터리에 두므로
#    상대경로(`./scripts/...`)를 쓰면 `/tmp/scripts/...` 를 찾다 실패한다(실측).
io.open(INJECT,'w',encoding='utf-8').write("""
import { readFileSync, writeFileSync } from 'node:fs'
import { realCompanyNames } from '__ROOT__/scripts/source.mjs'
const p = 'data/generated/projects.json'
const d = JSON.parse(readFileSync(p, 'utf8'))
const names = realCompanyNames()
if (names.length === 0) { console.error('NO_NAMES'); process.exit(2) }
d.detail[0].__probe = names[0]          // 값은 찍지 않는다
writeFileSync(p, JSON.stringify(d, null, 2))
""".replace('__ROOT__', ROOT))
rci,_ = run('node scripts/build-data.mjs')
rcj,outj = run(f'node {INJECT}')
if rcj != 0:
    res.append(('G1 사명 검사가 실제로 잡는가','❌ 주입 실패',outj.strip()[:160]))
else:
    rcg,outg = run('node scripts/verify-disclosure.mjs')
    caught = (rcg != 0) and ('회사표기' in outg)
    detail = '기대=회사표기 | ' + (' / '.join(
        l.strip().lstrip('🔴 ') for l in outg.splitlines() if '🔴' in l)[:160]
        or outg.strip()[:120])
    res.append(('G1 사명 검사가 실제로 잡는가','✅ 잡힘' if caught else '❌ 못 잡음', detail))

restore()

# ── G4. 클라이언트 내부 식별자 검사가 *지금 실제로* 잡는가 (#86) ─────────
#
# 🔴 실측 2026-09-17: 사례 상세 1건의 `decisions` 에 클라이언트 API 엔드포인트
#    경로와 서버 응답 스펙 키 나열이 그대로 실려 **배포까지 나갔다.**
#    `verify-disclosure` 가 보던 축은 사명·개인도메인·저장소명·사설IP·시크릿이라
#    **남의 시스템 구조를 보는 축이 아예 없었다.** 검사기는 내내 초록이었다.
#
# M1~M8 방식(소스를 망가뜨린다)으로는 못 본다 — 정상 데이터에는 그 구절이
# 이제 없어서 무엇을 망가뜨려도 위반이 안 난다. G1 과 같은 **기준선 검사**다.
#
# ⚠️ 탐침 값은 실제 유출 값이 아니라 **형태만 같은 가짜**를 쓴다. 이 파일도
#    PUBLIC 저장소에 올라간다 — 진짜 값을 적으면 여기가 새 유출 지점이 된다.
INJECT2 = os.path.join(BK, 'inject-client.mjs')
io.open(INJECT2,'w',encoding='utf-8').write("""
import { readFileSync, writeFileSync } from 'node:fs'
const p = 'data/generated/projects.json'
const d = JSON.parse(readFileSync(p, 'utf8'))
// 형태만 같은 가짜 — 실제 클라이언트 값이 아니다.
d.detail[0].__probeApi = '서버 메타데이터 응답(`/v9/probe/...`)으로 렌더링'
d.detail[0].__probeSpec = '서버가 내려주는 `{alpha, bravo, charlie, delta}` 스펙'
writeFileSync(p, JSON.stringify(d, null, 2))
""")
rci2,_ = run('node scripts/build-data.mjs')
rcj2,outj2 = run(f'node {INJECT2}')
if rcj2 != 0:
    res.append(('G4 클라이언트 내부 식별자 검사가 실제로 잡는가','❌ 주입 실패',outj2.strip()[:160]))
else:
    rcg2,outg2 = run('node scripts/verify-disclosure.mjs')
    got_api  = '클라이언트API경로' in outg2
    got_spec = '응답스펙키나열' in outg2
    caught = (rcg2 != 0) and got_api and got_spec
    detail = ('기대=클라이언트API경로+응답스펙키나열 | API경로=%s 스펙키=%s | ' % (got_api, got_spec)
              + (' / '.join(l.strip().lstrip('🔴 ') for l in outg2.splitlines() if '🔴' in l)[:140]
                 or outg2.strip()[:120]))
    res.append(('G4 클라이언트 내부 식별자 검사가 실제로 잡는가','✅ 잡힘' if caught else '❌ 못 잡음', detail))

restore()

# ── G2·G3. 번들 청크 검사가 *지금 실제로* 잡는가 (#78) ──────────────────
#
# 🔴 실측 2026-09-17: 검사용 감사 명단이 `'use client'` 인 3D 씬을 통해 JS 청크에
#    실려 내부 식별자 16건이 서빙되고 있었다. **HTML 에는 한 글자도 없어서**
#    `verify-rendered.mjs` 가 초록이었다 — 그 파일이 `r.text()` 로 페이지 HTML 만
#    봤기 때문이다. 막으려고 만든 `상세건저장소명` 검사는 이미 있었는데
#    **보는 곳에 없었다.** 「검사기가 있다 ≠ 검사기가 잡는다」가 또 반복됐다.
#
# M1~M8 과 달리 `verify-disclosure` 가 아니라 `verify-rendered` 를 돌린다.
# 빌드가 필요하다(실측 2.1초, 캐시 있을 때).

def run_rendered():
    # 🔴 `--bundles-only` — 디스크만 읽는다. 서버를 타면 서버가 없을 때
    #    `fetch failed` 로 죽어 **번들 검사에 도달조차 못 하고**, 그 실패가
    #    "게이트가 못 잡음" 으로 보고된다(원인은 서버인데 결론은 게이트 고장).
    return run('node scripts/verify-rendered.mjs --bundles-only')

# 🔴 **양성 대조 — 뮤테이션 전에 초록인지 먼저 본다.**
#    이게 없으면 "이미 새고 있음" 과 "게이트가 잡음" 이 같은 출력이 된다.
#    번들이 이미 유출 중이면(= #78 상태 그 자체) 탐침이 아무 일도 안 해도
#    `✅ 잡힘` 이 나온다. 전역 규칙: 초기값을 갱신값 중 하나로 두지 않는다.
_rc0, _out0 = run_rendered()
if _rc0 != 0:
    res.append(('G0 뮤테이션 전 번들이 깨끗한가', '❌ 이미 위반 상태',
                '양성 대조 실패 — G2·G3 의 ✅ 를 믿을 수 없다 | ' + _out0.strip()[:160]))
else:
    res.append(('G0 뮤테이션 전 번들이 깨끗한가', '✅ 잡힘', '초록 확인 — G2·G3 의 빨강이 탐침 때문임이 성립한다'))

# G2 — 검사기가 번들 안의 내부 식별자를 잡는가. 청크에 탐침을 직접 심는다.
#      ⚠️ 빌드 산출물을 건드리므로 **반드시 되돌린다.** 다음 빌드가 덮어쓰지만
#         그 사이에 다른 검사가 돌면 오탐이 난다.
import glob as _glob
_chunks = sorted(_glob.glob(os.path.join(ROOT,'apps/web/.next/static','**','*.js'), recursive=True))
if not _chunks:
    res.append(('G2 번들 검사가 내부 식별자를 잡는가','❌ 준비 실패','.next/static 에 .js 가 없다 — 먼저 빌드한다'))
else:
    _target=_chunks[0]
    _bk=os.path.join(BK,'chunk.bak'); shutil.copy(_target,_bk)
    try:
        # 심는 값은 정본 id 가 아니라 **게재되지 않은 id** 여야 한다.
        # 게재 id 는 공개 URL 슬러그라 위반이 아니다(정상 노출).
        _audit=json.load(io.open(os.path.join(ROOT,'data','audit.json'),encoding='utf-8'))
        _pub={p['id'] for p in json.load(
            io.open(os.path.join(ROOT,'data','generated','projects.json'),encoding='utf-8'))['detail']}
        _probe=next((a['id'] for a in _audit if a['id'] not in _pub), None)
        if _probe is None:
            res.append(('G2 번들 검사가 내부 식별자를 잡는가','❌ 준비 실패','비공개 id 가 없다'))
        else:
            with io.open(_target,'a',encoding='utf-8') as _f:
                _f.write(f'\n// MUTATION {_probe}\n')   # 값은 아래에서 찍지 않는다
            _rc,_out=run_rendered()
            _caught=(_rc!=0) and ('내부식별자' in _out)
            res.append(('G2 번들 검사가 내부 식별자를 잡는가','✅ 잡힘' if _caught else '❌ 못 잡음',
                        '기대=내부식별자 | ' + (' / '.join(
                          l.strip().lstrip('🔴 ') for l in _out.splitlines() if '🔴' in l)[:160]
                          or _out.strip()[:120])))
    finally:
        shutil.copy(_bk,_target)

# G3 — audit 분리를 되돌리면(= #78 재발) 잡히는가. 소스 뮤테이션 + 실제 빌드.
_bd=os.path.join(ROOT,'scripts','build-data.mjs')
_src=io.open(_bd,encoding='utf-8').read()
_anchor="""    counts: { detail: detail.length, summary: summary.length, excluded: excluded.length },
    detail,
    summary,
  }"""
if _src.count(_anchor)!=1:
    res.append(('G3 audit 을 payload 로 되돌리면 잡히는가','❌ 앵커 불일치',
                f'count={_src.count(_anchor)} — no-op, 뮤테이션 무효'))
else:
    _mut=_anchor.replace("""    summary,
  }""","""    summary,
    audit: [   // MUTATION
      ...detail.map((p, i) => ({ tier: p.tier, id: detailIds[i] })),
      ...summary.map((p, i) => ({ tier: p.tier, id: summaryIds[i] })),
    ],
  }""")
    io.open(_bd,'w',encoding='utf-8').write(_src.replace(_anchor,_mut))
    assert 'MUTATION' in io.open(_bd,encoding='utf-8').read()
    try:
        run('node scripts/build-data.mjs')
        _rcb,_outb=run('pnpm --filter @neighbor/web build')
        if _rcb!=0:
            res.append(('G3 audit 을 payload 로 되돌리면 잡히는가','❌ 빌드 실패',_outb.strip()[-160:]))
        else:
            _rc,_out=run_rendered()
            _caught=(_rc!=0) and ('내부식별자' in _out)
            res.append(('G3 audit 을 payload 로 되돌리면 잡히는가','✅ 잡힘' if _caught else '❌ 못 잡음',
                        '기대=내부식별자 | ' + (' / '.join(
                          l.strip().lstrip('🔴 ') for l in _out.splitlines() if '🔴' in l)[:160]
                          or _out.strip()[:120])))
    finally:
        restore()
        run('node scripts/build-data.mjs')
        # 🔴 잔재가 청크에 남지 않게 다시 빌드한다. **rc 를 본다** —
        #    실패하면 뮤테이션으로 만든 청크(audit 이 실린 번들)가 그대로 남고,
        #    다음 검사의 빨강이 **진짜 유출처럼 보인다.**
        _rcc, _outc = run('pnpm --filter @neighbor/web build')
        if _rcc != 0:
            res.append(('G3 잔재 정리(재빌드)', '❌ 못 잡음',
                        '재빌드 실패 — .next 에 뮤테이션 청크가 남아 있다 | ' + _outc.strip()[-160:]))

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
