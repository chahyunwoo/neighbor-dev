'use client'

import { Html, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_OBJECTS } from '@/entities/room'
import { anchorFromBox } from './anchors'
import { CameraRig, type FocusTarget, FREE_LIMITS, type OrbitControlsLike } from './CameraRig'
import {
  MONITOR_POSITION,
  Monitor,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  Whiteboard,
} from './Fixtures'
import { Furniture } from './Furniture'
import { Lights } from './Lights'
import { CAMERA_FOV, CAMERA_LIMITS, FOCUS_PULL, LAYOUT, ROOM_CENTER } from './layout'
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
  onIntroStart,
  mode = 'room',
}: {
  /** 지금 열려 있는 물건. 마커가 그 상태를 보여준다. */
  openId: string | null
  /** 이미 열어본 것 — 흐려져서 "남은 것" 이 눈에 띈다(시안 .mk.seen). */
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
  /** 입장 연출이 끝났다 — 부모가 UI 를 올린다. */
  onEntered: () => void
  /**
   * 입장 연출이 **다시 시작됐다** — 부모가 `entered` 를 되돌린다.
   *
   * 🔴 그 값이 `data-room-entered` 로 나가고, **브라우저 프로브가 "이제
   *    마커를 눌러도 된다" 를 아는 유일한 신호**다. 되돌리지 않으면 깊은
   *    링크로 들어왔다 홈에 올 때 **비행 중인데 true** 라 검사기가 조용히
   *    비행 한복판에 클릭한다(실측: 홈 도착 +100ms 에 이미 true).
   */
  onIntroStart: () => void
  /**
   * 이 방을 어떻게 쓰는가.
   *
   * - `room` — 홈. 돌아다니고 누를 수 있다. 입장 연출이 있다.
   * - `page` — 본문 화면의 배경. **같은 방을 그대로 쓰되** 카메라만 그
   *   물건 앞에 가 있다. 마커도 조작도 없다.
   *
   * 🔴 페이지에서 **물건 하나만 따로 띄우지 않는 이유**: 그러면 홈의 방과
   *    페이지의 물건이 서로 다른 장면이 되어, 화면이 바뀔 때 3D 가 **한
   *    프레임에 통째로 갈린다.** 어떤 크로스페이드로도 그 "확 바뀜" 은
   *    안 가려진다(실측 2026-09-16: `data-canvas-mode` 가 120ms 에 room →
   *    object 로 즉시 바뀌었다). 방이 하나면 교체 지점 자체가 없다.
   *
   *    ⚠️ 옛 주석은 "페이지마다 방을 통째로 로드하면 번들과 GPU 가 6배" 라고
   *       경고했는데 **재현 명령이 없는 수치였다.** 실측하니 GLB 전체가
   *       232KB 다(`du -ck apps/web/public/models/*.glb`). 홈을 거쳐 오면
   *       이미 받아 둔 것이라 추가 전송은 0 이고, 방 전체를 그리는 홈에서
   *       이미 60fps 가 나온다.
   */
  mode?: 'room' | 'page'
}) {
  const controls = useRef<OrbitControlsLike>(null)
  /** 입장 연출이 문을 여는 동안만 true. 열린 물건과는 별개다. */
  const [introDoor, setIntroDoor] = useState(false)

  /*
   * 🔴 **입장 비행이 끝났는가 — 제약을 언제 걸지 정한다.**
   *
   *    `CAMERA_LIMITS` 는 `minDistance 4.6` 과 방위각 범위를 건다. 그런데 입장
   *    시작 위치는 타깃에서 **3.96** 밖에 안 떨어져 있고 방위각도 그 범위 밖이라,
   *    제약이 살아 있으면 `update()` 가 매 프레임 카메라를 끌어당겨 **문 밖에서
   *    시작하지도 못한다**(실측 2026-09-16: 시작이 `[3.53, 1.73, -0.77]` — 이미
   *    방 안이었고, 진행 0.45 에서 한 프레임에 좌우각이 79.3° 꺾였다).
   *
   *    ⚠️ `CameraRig` 안에서 `Object.assign(ctl, ...)` 로 푸는 것은 **안 먹는다** —
   *       여기서 prop 으로 넘기므로 리렌더마다 drei 가 되돌린다. 이 컴포넌트는
   *       마커 실측 보고(`measured`)로 여러 번 리렌더된다.
   *
   *    ⚠️ 페이지 배경(`mode === 'page'`)은 입장 연출이 없으므로 처음부터 제약을 건다.
   */
  const [entered, setEntered] = useState(mode === 'page')
  const handleEntered = useCallback(() => {
    setEntered(true)
    onEntered()
  }, [onEntered])
  /*
   * 🔴 **입장이 시작되면 제약을 다시 푼다.** 초기값이 `mode === 'page'` 라,
   *    검색으로 본문 화면에 먼저 들어온 사람은 `entered` 가 이미 `true` 다.
   *    그 상태로 홈에 오면 제약이 걸린 채 비행이 시작돼 카메라가 끌려간다.
   */
  const handleIntroStart = useCallback(() => {
    setEntered(false)
    // 🔴 provider 쪽 `entered` 도 같이 되돌린다 — 그래야 `data-room-entered` 가 꺼진다.
    onIntroStart()
  }, [onIntroStart])

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
    const y = h.at[1] - h.radius * 0.6

    /*
     * 🔴 벽에 붙은 물건은 초점을 방 안쪽으로 당긴다 (이슈 #17).
     *    안 그러면 카메라가 그 물건과 방 중심을 잇는 선 위, 즉 **벽 쪽**에
     *    서서 물건이 화면을 덮고 방이 안 보인다. 근거는 `layout.ts` 의
     *    `FOCUS_PULL` 주석.
     */
    const pull = FOCUS_PULL[h.meta.id] ?? 0
    if (pull === 0) return { center: [h.at[0], y, h.at[2]], radius: h.radius }

    const dx = ROOM_CENTER[0] - h.at[0]
    const dz = ROOM_CENTER[2] - h.at[2]
    const len = Math.hypot(dx, dz) || 1
    return {
      center: [h.at[0] + (dx / len) * pull, y, h.at[2] + (dz / len) * pull],
      radius: h.radius,
    }
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

      {/* 🔴 페이지에서는 마커를 그리지 않는다 — 배경이고, 누를 것은 본문에 있다. */}
      {(mode === 'room' ? hotspots : []).map(({ at, meta }) => (
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
        onEntered={handleEntered}
        onIntroStart={handleIntroStart}
        skipIntro={mode === 'page'}
        mode={mode}
      />

      <OrbitControls
        ref={controls}
        target={ROOM_CENTER}
        /*
         * 🔴 페이지에서는 조작을 막는다. 본문 뒤의 배경이라 여기서 드래그를
         *    받으면 스크롤을 뺏는다(옛 `ObjectStage` 도 같은 이유로 막았다).
         */
        enabled={mode === 'room'}
        enablePan={false}
        // 줌은 막는다 — 아이소메트릭 구도를 유지한다(기획서 4절).
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        {...(entered ? CAMERA_LIMITS : FREE_LIMITS)}
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
      /**
       * 화면에서 실제로 보이는 자리 — **직접 잰다.**
       *
       * ⚠️ 래퍼의 `translate3d` 값으로 계산하려 했으나 맞지 않았다.
       *    `tx/scale` 도 `tx*scale` 도 실제 화면 좌표와 안 맞는다(실측으로
       *    확인). 드리의 변환에 더해 우리 `--edge-dx` 보정이 **버튼**에
       *    걸려 있어서, 최종 자리는 계산이 아니라 측정으로만 안다.
       *    `getBoundingClientRect` 는 그 전부가 반영된 값을 준다.
       */
      const onScreen = (el: HTMLElement) => {
        const btn = el.querySelector('button')
        if (!btn) return null
        const r = btn.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
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
        el.style.setProperty('--edge-dx', `${cx - x}px`)
        el.style.setProperty('--edge-dy', `${cy - y}px`)
        if ((el.dataset.edge === 'true') !== clamped) {
          el.dataset.edge = clamped ? 'true' : 'false'
        }
      }

      /*
       * 🔴 **2차 — 접힌 것이 남의 마커를 덮었으면 비켜준다** (이슈 #6).
       *
       *    접기는 각자 따로 하므로 서로를 모른다. 그래서 가장자리로 온 마커가
       *    제자리에 있던 마커 위에 내려앉는다 — 실측: 현관문(접힘)이
       *    책장(안 접힘) 위 25px 안에 앉아 `elementsFromPoint` 에 dot 이 2개
       *    겹쳐 나왔고, **책장이 영영 안 열렸다.**
       *
       * 🔴 **비키는 쪽은 접힌 마커다.** 안 접힌 것은 물건 위의 제자리이므로
       *    그걸 옮기면 "물건을 가리킨다" 가 깨진다. 접힌 것은 이미 제자리를
       *    떠난 안내 표시라 조금 더 움직여도 뜻이 안 변한다.
       *
       * ⚠️ **계산이 아니라 측정으로 판정한다.** 래퍼 좌표로 재려다 틀렸다 —
       *    드리가 거리에 따라 `scale()` 을 같이 걸어서 좌표 거리와 화면
       *    거리가 다르다(책장↔현관문이 좌표로 117px, 화면으로 25px).
       *
       * ⚠️ DOM 순서대로 훑고 **아래로만** 민다. 순서가 프레임마다 바뀌면
       *    마커가 떨려서 오히려 더 안 눌린다(한 번 그렇게 만들어 7/7 → 5/7).
       */
      const canvasBox = canvas.getBoundingClientRect()
      const taken: { x: number; y: number }[] = []
      for (const el of wraps) {
        if (el.dataset.edge !== 'true') {
          // 제자리에 있는 것은 자리를 **먼저** 차지한다. 접힌 것이 피해 간다.
          const at = onScreen(el)
          if (at) taken.push(at)
        }
      }
      for (const el of wraps) {
        if (el.dataset.edge !== 'true') continue
        const at = onScreen(el)
        if (!at) continue

        let shift = 0
        const dy = Number.parseFloat(el.style.getPropertyValue('--edge-dy')) || 0
        while (
          taken.some(
            (q) => Math.abs(q.x - at.x) < EDGE_GAP && Math.abs(q.y - (at.y + shift)) < EDGE_GAP,
          )
        ) {
          shift += EDGE_GAP
          // 아래로 넘치면 포기한다 — 화면 밖으로 내보내면 더 나쁘다.
          if (at.y + shift > canvasBox.bottom - EDGE_PAD) {
            shift = 0
            break
          }
        }
        if (shift) el.style.setProperty('--edge-dy', `${dy + shift}px`)
        taken.push({ x: at.x, y: at.y + shift })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gl])
}
