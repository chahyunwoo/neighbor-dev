'use client'

import { Html, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_OBJECTS } from '../../lib/room'
import { anchorFromBox } from './anchors'
import { CameraRig, type FocusTarget, type OrbitControlsLike } from './CameraRig'
import {
  MONITOR_POSITION,
  Monitor,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  Whiteboard,
} from './Fixtures'
import { Furniture } from './Furniture'
import { Lights } from './Lights'
import { CAMERA_FOV, CAMERA_LIMITS, LAYOUT, ROOM_CENTER } from './layout'
import styles from './Scene.module.css'
import { ROOM_BG, Shell } from './Shell'

/**
 * 마커 래퍼에 붙이는 표식. **CSS Module 해시가 아니라 고정 문자열**이다 —
 * `useEdgeClamp` 가 `querySelectorAll` 로 찾고, 스타일은 전역에서 건다.
 */
const MARKER_WRAP = 'room-marker-wrap'
/** 가장자리에 붙일 때 남기는 여백(px). 마커 반지름(15)보다 커야 잘리지 않는다. */
const EDGE_PAD = 26
/** 가장자리에 붙은 것끼리 최소 간격(px). 이보다 가까우면 아래로 민다. */
const EDGE_GAP = 34
/**
 * 왼쪽 UI(카피·번호 목록)가 덮는 폭. `CameraRig.UI_WIDTH` 와 같은 값이다.
 * ⚠️ 좁은 화면에서는 이 값이 화면 절반을 넘을 수 있어 `w*0.5` 로 한 번 접는다.
 */
const UI_LEFT = 520

// 배치에 쓰는 모델을 미리 받아 둔다 — 하나씩 늦게 뜨면 방이 조립되는 것이 보인다.
for (const p of LAYOUT) useGLTF.preload(`/models/${p.model}.glb`)

/**
 * 작업실 3D.
 *
 * 🔴 이 컴포넌트는 **표현 계층일 뿐이다.** 클릭 지점과 그 뜻은 `lib/room.ts` 가
 *    쥐고 있고, 목록 폴백·서버 렌더 HTML 이 같은 데이터를 쓴다(기획서 4절).
 *    여기서 링크를 새로 만들지 않는다 — 만들면 세 경로가 어긋난다.
 */
export function Scene({
  openId,
  seen,
  onOpen,
  onEntered,
}: {
  /** 지금 열려 있는 물건. 마커가 그 상태를 보여준다. */
  openId: string | null
  /** 이미 열어본 것 — 흐려져서 "남은 것" 이 눈에 띈다(시안 .mk.seen). */
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
  /** 입장 연출이 끝났다 — 부모가 UI 를 올린다. */
  onEntered: () => void
}) {
  const controls = useRef<OrbitControlsLike>(null)
  /** 입장 연출이 문을 여는 동안만 true. 열린 물건과는 별개다. */
  const [introDoor, setIntroDoor] = useState(false)

  // 🔴 캔버스 밖으로 나간 마커를 가장자리에 붙인다(이슈 #3).
  useEdgeClamp()

  /*
   * 마커 위치 — 물건의 **실제 꼭대기**에서 낸다(`anchors.ts` 참고).
   *
   * 🔴 이전에는 배치 원점 + 고정값 0.85 였다. 배치 원점은 대개 바닥이고
   *    물건 높이가 제각각이라 마커가 엉뚱한 데 떴다 — 실측 2026-09-09:
   *    화이트보드 마커가 허공에, 모니터 마커가 화이트보드 위에 있었다.
   */
  /**
   * 마커 위치 — 물건의 **실제 꼭대기**에서 낸다(`anchors.ts`).
   *
   * 🔴 이전에는 배치 원점 + 고정값 0.85 였다. 배치 원점은 대개 바닥이고
   *    물건 높이가 제각각이라 마커가 엉뚱한 데 떴다 — 실측 2026-09-09:
   *    화이트보드 마커가 허공에, 모니터 마커가 화이트보드 위에 있었다.
   *
   * ⚠️ 계산에는 로드된 모델이 필요하다. 여기서 모델을 다시 열면 반복문 안에서
   *    훅을 부르게 되므로, **이미 열어 둔 `Furniture` 가 보고**하게 한다.
   */
  const [measured, setMeasured] = useState<Record<string, [number, number, number]>>({})
  const report = useCallback((id: string, at: [number, number, number]) => {
    setMeasured((prev) => {
      const old = prev[id]
      if (old && old[0] === at[0] && old[1] === at[1] && old[2] === at[2]) return prev
      return { ...prev, [id]: at }
    })
  }, [])

  const anchors: { id: string; at: [number, number, number]; radius: number }[] = [
    ...LAYOUT.flatMap((p) => {
      if (!p.hotspot) return []
      // 아직 안 재였으면 배치 좌표로 버틴다 — 한 프레임 뒤 제자리를 찾는다.
      const at = measured[p.hotspot] ?? (p.position as [number, number, number])
      const sc = Array.isArray(p.scale) ? Math.max(...p.scale) : p.scale
      return [{ id: p.hotspot, at, radius: Math.max(0.45, sc * 0.42) }]
    }),
    // 직접 만든 고정물 — 크기를 알고 있으니 그 값으로 낸다(Fixtures 실측값).
    { id: 'monitor', at: anchorFromBox(MONITOR_POSITION, 0.28), radius: 0.6 },
    { id: 'whiteboard', at: anchorFromBox(WHITEBOARD_POSITION, 0.64), radius: 1.1 },
  ]

  const hotspots = anchors.flatMap((a) => {
    const meta = ROOM_OBJECTS.find((o) => o.id === a.id)
    // 🔴 짝이 없으면 그리지 않는다. 조용히 어긋나느니 안 보이는 편이 낫다 —
    //    verify-room.mjs 가 이 짝을 전수로 확인한다.
    return meta ? [{ at: a.at, radius: a.radius, meta }] : []
  })

  // 열린 물건의 초점 — 카메라가 여기로 날아간다.
  const focus: FocusTarget | null = (() => {
    const h = hotspots.find((x) => x.meta.id === openId)
    if (!h) return null
    // 마커는 물건 **위**에 있으므로, 초점은 그만큼 내려 물건 몸통을 본다.
    return { center: [h.at[0], h.at[1] - h.radius * 0.6, h.at[2]], radius: h.radius }
  })()

  return (
    <>
      {/*
       * 🔴 카메라를 **씬이 낸다.** 캔버스는 앱 전체에 하나뿐이고
       *    (`components/canvas/CanvasShell.tsx`) 홈과 페이지의 카메라가
       *    다르다(여기 fov 37 · [7.2,5,-3.6] / 페이지 fov 34 · [3.4,2.2,4.2]).
       *    `<Canvas camera={...}>` 는 **마운트 시 1회만** 반영되어 라우트마다
       *    바꿀 수 없다 — `makeDefault` 는 drei 가 교체하고 언마운트 때 되돌린다.
       *
       * ⚠️ 값은 프로토타입 실측이다(`layout.ts` 주석 참고). 자리만 옮겼다.
       *
       * 🔴 **`position` 을 여기서 주지 않는다.** 이 컴포넌트는 마커 실측
       *    보고(`report`)와 문 여닫힘 때문에 여러 번 리렌더되는데, 그때마다
       *    React 가 `position` 을 다시 적용해 **입장 연출을 매 프레임
       *    되감는다** — 실측 2026-09-09: 마커 좌표가 800ms 부터 최종
       *    위치에 고정됐고 `onEntered` 가 영영 안 불려 **카피·목록·어둠막이
       *    통째로 안 보였다.** 카메라 위치는 `CameraRig` 가 쥔다.
       */}
      <PerspectiveCamera makeDefault fov={CAMERA_FOV} />
      <color attach="background" args={[ROOM_BG]} />
      <Lights />

      {/*
       * key 는 좌표로 만든다 — 같은 모델(chairRounded 4개)이 여러 번 오므로
       * 모델명만으로는 겹치고, 배열 index 는 배치를 재정렬하면 어긋난다.
       * 좌표는 이 방에서 유일하다(한 자리에 두 개를 놓지 않는다).
       */}
      {LAYOUT.map((p) => (
        <Furniture
          key={`${p.model}@${p.position.join(',')}`}
          placement={p}
          openId={introDoor && p.hotspot === 'door' ? 'door' : openId}
          onAnchor={report}
        />
      ))}

      {/* 팩에 없거나 못 쓰는 것 — 배지 1·2 라 빠지면 안 된다. */}
      <Monitor position={MONITOR_POSITION} />
      <Whiteboard position={WHITEBOARD_POSITION} rotationY={WHITEBOARD_ROTATION_Y} />

      {/* 방 껍데기 — 벽이 빛을 되돌려 방을 밝힌다. 장식이 아니다. */}
      <Shell />

      {hotspots.map(({ at, meta }) => (
        <Html
          key={meta.id}
          position={at}
          center
          // 🔴 캔버스 밖으로 밀려난 마커를 가장자리로 끌어온다(이슈 #3).
          //    표식을 남겨 `useEdgeClamp` 가 찾을 수 있게 한다.
          wrapperClass={MARKER_WRAP}
          /*
           * 🔴 **값이 클수록 마커가 커진다** — 방향을 반대로 알고 8 → 14 로
           *    올렸다가 더 커졌다(실측 스크린샷으로 확인). drei 의
           *    `distanceFactor` 는 "이 거리에서 1배" 라는 기준 거리이므로,
           *    값을 키우면 같은 거리에서 더 크게 그려진다.
           *    마커는 안내지 주인공이 아니다 — 낮춘다.
           */
          distanceFactor={5}
          zIndexRange={[10, 0]}
        >
          {/*
           * 시안의 마커: **점 + 퍼지는 링**, 라벨은 hover·열림에만.
           * 이전 구현은 라벨을 항상 띄워 6개가 방을 덮었다(실측 스크린샷).
           * 시안 주석도 같은 실패를 적어놨다 — "상시 문구·큰 링은 시끄러웠다".
           */}
          <button
            type="button"
            className={styles.marker}
            data-accent={meta.accent}
            data-open={meta.id === openId}
            data-seen={seen.has(meta.id) && meta.id !== openId}
            onClick={() => onOpen(meta.id)}
            aria-label={`${meta.name} — ${meta.opens}`}
            aria-expanded={meta.id === openId}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.markerName}>
              <b>{meta.no}</b>
              {meta.name}
            </span>
          </button>
        </Html>
      ))}

      <CameraRig
        focus={focus}
        controls={controls}
        onIntroDoor={setIntroDoor}
        onEntered={onEntered}
      />

      <OrbitControls
        ref={controls}
        target={ROOM_CENTER}
        enablePan={false}
        // 줌은 막는다 — 아이소메트릭 구도를 유지한다(기획서 4절).
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        {...CAMERA_LIMITS}
      />

      {/* 포스트프로세싱은 데스크톱에서만 켠다 — 부모가 그 판단을 한다. */}
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </>
  )
}

/**
 * 캔버스 밖으로 밀려난 마커를 **가장자리에 붙여 살린다** (이슈 #3).
 *
 * 🔴 왜 필요한가. 물건 하나를 열면 카메라가 그리로 날아가는데, 그 구도에서
 *    나머지 마커의 가로 퍼짐이 캔버스 폭을 넘는다 — 실측 2026-09-09
 *    (1440x900, 패널이 열려 캔버스는 960):
 *
 *    | 연 물건 | 마커 퍼짐 | 캔버스 |
 *    |---|---|---|
 *    | 테이블 | 613 | 960 ✓ |
 *    | 현관문 | 848 | 960 ✓ |
 *    | 책장 | 1047 | 960 ❌ |
 *    | 노트북 | 1187 | 960 ❌ |
 *    | 모니터 | **1680** | 960 ❌ |
 *
 *    **카메라 거리로는 못 푼다.** 하한을 4.8 → 7.2 까지 올려봤지만 도달
 *    가능 마커는 3/7 → 4/7 에 그쳤다(화면 밖이 UI 뒤로 바뀔 뿐이다).
 *    1680px 퍼짐은 960px 안에 애초에 안 들어간다.
 *
 * 🔴 **CSS 로는 못 한다.** drei 가 래퍼 div 의 `transform` 을 **인라인**으로
 *    매 프레임 덮어쓴다 — 같은 형태의 함정을 이 저장소가 이미 한 번 밟았다
 *    (`pointer-events` 를 CSS 로 세 번 고쳤는데 전부 헛수고였다).
 *    그래서 JS 로 인라인 값을 읽어 접는다.
 *
 * ⚠️ 안쪽에 있는 마커는 **건드리지 않는다.** 3D 앵커를 그대로 둬야
 *    "물건 위에 떠 있다" 가 유지된다. 밖으로 나간 것만 끌어온다.
 */
function useEdgeClamp() {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    /*
     * ⚠️ 마커 래퍼는 `canvas.parentElement` **바로 밑이 아니다** — 드리가
     *    자기 컨테이너 div 를 한 겹 더 끼운다(실측: 래퍼 7개가 잡히는데
     *    `parentElement` 기준으로는 0개였다). 문서 전체에서 찾는다.
     */
    const root = document

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return

      const wraps = [...root.querySelectorAll<HTMLElement>(`.${MARKER_WRAP}`)]
      const read = (el: HTMLElement) => {
        const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform)
        return m ? { x: Number(m[1]), y: Number(m[2]) } : null
      }

      /*
       * 🔴 **안 접힌 마커의 자리도 미리 넣어 둔다.**
       *    접힌 것이 제자리에 있는 마커 위에 내려앉으면 그 마커를 덮어
       *    영영 못 누르게 된다 — 실측 2026-09-09: 책장(799,144, 안 접힘)에
       *    현관문(801,169, 접힘)이 25px 옆에 내려앉아 책장이 안 열렸다.
       */
      const parked: { x: number; y: number }[] = []
      for (const el of wraps) {
        const p = read(el)
        if (!p) continue
        const w2 = canvas.clientWidth
        const h2 = canvas.clientHeight
        const l2 = Math.min(UI_LEFT, w2 * 0.5) + EDGE_PAD
        const inside = p.x >= l2 && p.x <= w2 - EDGE_PAD && p.y >= EDGE_PAD && p.y <= h2 - EDGE_PAD
        if (inside) parked.push(p)
      }

      for (const el of wraps) {
        // drei 가 넣은 인라인 transform 에서 좌표를 읽는다.
        const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform)
        if (!m) continue
        const x = Number(m[1])
        const y = Number(m[2])

        /*
         * 🔴 **캔버스가 아니라 "가용 영역" 안으로 접는다.**
         *    왼쪽은 카피·번호 목록이 덮고 있어서, 캔버스 왼쪽 끝에 붙이면
         *    그 UI 뒤로 들어가 여전히 안 눌린다 — 실측 2026-09-09:
         *    책장(x=80)·테이블(x=91)이 그래서 5/7 이었다.
         *    `UI_LEFT` 는 `CameraRig` 의 `UI_WIDTH` 와 같은 값이다.
         */
        const left = Math.min(UI_LEFT, w * 0.5) + EDGE_PAD
        const cx = Math.min(w - EDGE_PAD, Math.max(left, x))
        const cy = Math.min(h - EDGE_PAD, Math.max(EDGE_PAD, y))
        const clamped = cx !== x || cy !== y

        /*
         * 🔴 **접은 결과를 다시 읽지 않는다.**
         *
         *    처음에는 접은 좌표를 `style.transform` 에 그대로 덮어썼는데,
         *    그러면 다음 프레임에 **접힌 값을 원본으로 읽어** `clamped` 가
         *    false 가 되고 `data-edge` 가 도로 꺼진다 — 스타일이 한 프레임만
         *    붙었다 사라진다(실측 2026-09-09: 화면 가장자리 마커가
         *    `edge="false"` 로 나왔다).
         *
         *    드리는 매 프레임 `transform` 을 새로 쓰므로 **원본은 늘 드리가
         *    준다.** 우리는 그 위에 `translate` 를 덧대기만 하고, 판정은
         *    항상 드리가 준 값으로 한다.
         */
        /*
         * ⚠️ `transform` 에 덧붙이지 않는다 — 드리가 매 프레임 쓰는 값 위에
         *    또 덧대면 **누적된다**(실측 2026-09-09: x 가 -12063 까지 갔다).
         *    보정량만 변수로 넘기고, 적용은 **자식 요소**가 한다.
         *    그래야 드리의 transform 과 우리 보정이 서로를 안 건드린다.
         */
        /*
         * 🔴 접힌 것끼리 **같은 자리에 포개진다.** 그러면 위의 것만 눌리고
         *    아래 것은 영영 못 누른다 — 실측 2026-09-09: `elementsFromPoint`
         *    에 dot 이 2개 겹쳐 나왔고, 책장이 그래서 안 열렸다.
         *
         * ⚠️ 밀어내는 순서가 프레임마다 달라지면 마커가 떨려서 더 못 누른다
         *    (한 번 그렇게 만들어 7/7 → 5/7 로 떨어뜨렸다). 그래서
         *    **DOM 순서대로** 훑으며 **아래로만** 밀고, 밀린 자리는 그 프레임
         *    안에서만 쓴다 — 같은 입력이면 늘 같은 결과가 나온다.
         */
        let py = cy
        if (clamped) {
          while (
            parked.some((q) => Math.abs(q.x - cx) < EDGE_GAP && Math.abs(q.y - py) < EDGE_GAP)
          ) {
            py += EDGE_GAP
            if (py > h - EDGE_PAD) break
          }
          parked.push({ x: cx, y: py })
        }

        el.style.setProperty('--edge-dx', `${cx - x}px`)
        el.style.setProperty('--edge-dy', `${py - y}px`)
        if ((el.dataset.edge === 'true') !== clamped) {
          el.dataset.edge = clamped ? 'true' : 'false'
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gl])
}
