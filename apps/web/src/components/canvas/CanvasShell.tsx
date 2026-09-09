'use client'

import { Preload } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { r3f } from './tunnel'

/**
 * 지속 캔버스 — **앱 전체에서 단 하나뿐인 `<Canvas>`**.
 *
 * 🔴 이전에는 캔버스가 2개였고 둘 다 페이지 안에 있어서, 라우트가 바뀌면
 *    3D 가 통째로 죽고 새로 떴다(실측 2026-09-09: 표식을 찍어 확인했고
 *    `webglcontextlost` 가 2건 났다). 그러면 "작업실 안에 프로젝트가
 *    산다"(기획서 4절)가 화면 사이에서 끊긴다.
 *
 * 🔴 **여기는 얇게 둔다.** 카메라·조명·컨트롤·이펙트·배경색은 전부
 *    `r3f.In` 쪽(각 화면)이 낸다 — 홈과 페이지가 **하나도 안 겹치기 때문**이다:
 *
 *    | | 홈 | 페이지 |
 *    |---|---|---|
 *    | 카메라 | fov 37 · [7.2,5,-3.6] | fov 34 · [3.4,2.2,4.2] |
 *    | 조명 | Lights(램프·창) | ambient + dir 2개 |
 *    | 컨트롤 | 드래그 가능 | `enabled={false}` autoRotate |
 *    | 이펙트 | Bloom | 없음 |
 *
 *    ⚠️ 그래서 `<Canvas camera={...}>` 를 쓰지 않는다 — 그 prop 은 **마운트
 *       시 1회만** 반영되어 라우트마다 바꿀 수 없다. 각 화면이
 *       `<PerspectiveCamera makeDefault>` 를 내면 drei 가 교체·복원한다.
 *
 * ⚠️ `frameloop="demand"` 로 바꾸지 마라 — `useReaction`·`CameraRig` 의
 *    `useFrame` 루프가 멈춘다.
 */
export function CanvasShell() {
  const ref = useRef<HTMLDivElement>(null)

  /*
   * 홈에서 캔버스는 헤더 **아래**에서 시작한다(실측 y=97).
   *
   * 🔴 이 값을 상수로 박지 않는다. `nav` 높이가 바뀌면 조용히 어긋난다 —
   *    같은 이유로 `page.module.css` 가 `calc(100dvh - 152px)` 를 이미
   *    버렸다(실측 2026-09-09: 15px 넘쳤다). 실제 `nav` 를 재서 넣는다.
   *
   * ⚠️ 3D 가 뜰 때만 도는 코드다(이 컴포넌트가 `ssr:false`) — 폴백 3단에 영향이 없다.
   */
  useEffect(() => {
    const root = document.documentElement
    const ro = new ResizeObserver(() => measure())
    /** 지금 화면의 헤더·푸터를 재서 변수에 넣는다. 없으면 0. */
    const measure = () => {
      for (const [sel, prop] of [
        ['nav', '--nav-h'],
        ['footer', '--foot-h'],
      ] as const) {
        const el = document.querySelector(sel)
        root.style.setProperty(
          prop,
          el ? `${Math.round(el.getBoundingClientRect().height)}px` : '0px',
        )
      }
    }

    /*
     * ⚠️ 라우트가 바뀌면 헤더는 남지만 **푸터는 사라진다**(홈에만 있다).
     *    캔버스는 안 죽으므로 이 effect 가 다시 돌지 않는다 — 그래서
     *    DOM 변화를 직접 본다. 안 그러면 `/work` 에서 홈의 푸터 높이가
     *    남아 캔버스 아래가 70px 잘린다.
     */
    const mo = new MutationObserver(() => {
      measure()
      ro.disconnect()
      for (const sel of ['nav', 'footer']) {
        const el = document.querySelector(sel)
        if (el) ro.observe(el)
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    measure()
    for (const sel of ['nav', 'footer']) {
      const el = document.querySelector(sel)
      if (el) ro.observe(el)
    }
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  /*
   * 🔴 **R3F 의 래퍼 div 가 `pointer-events:auto` 를 인라인으로 박는다.**
   *
   *    라이브러리 소스에 그 이유가 적혀 있다
   *    (`@react-three/fiber@9.7.0/dist/react-three-fiber.esm.js:124`):
   *
   *        // When the event source is not this div, we need to set
   *        // pointer-events to none. Or else the canvas will block
   *        // events from reaching the event source
   *        const pointerEvents = eventSource ? 'none' : 'auto'
   *
   *    즉 `eventSource` 를 넘기면 R3F 가 알아서 `'none'` 을 쓴다. 그런데
   *    **우리는 그걸 못 쓴다** — 홈에서는 캔버스가 마커 클릭을 직접 받아야
   *    하는데(`eventSource` 를 주면 이벤트가 그 DOM 으로 넘어간다), 페이지에서는
   *    반대로 안 받아야 한다. 한 캔버스가 두 모드를 오가므로 **모드에 따라
   *    바뀌는 값**이 필요하고, `eventSource` 는 마운트 시 고정이다.
   *
   *    껍데기에 `none` 을 줘도 그 자식이 인라인으로 `auto` 를 들고 있어
   *    **인라인이 이긴다** — CSS 규칙으로는 절대 못 이긴다(실측 2026-09-09:
   *    `.canvas-shell *{pointer-events:inherit}` 를 넣어도 계산값이 auto 였고,
   *    래퍼의 style 속성에 `pointer-events: auto` 가 그대로 있었다).
   *
   *    그 결과 **페이지에서 캔버스가 본문 클릭을 가로챘다** — `/work` 사례
   *    카드 링크 4개, `/work/<id>` 토글 버튼 2개, `/team` 링크 1개가 안 눌렸다.
   *    빌드도 `pnpm verify` 도 초록이었다. 실제로 눌러봐야 보인다.
   *
   *    → 껍데기의 계산값을 읽어 자식들의 **인라인 스타일을 직접 맞춘다.**
   */
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const sync = () => {
      const want = getComputedStyle(root).pointerEvents
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.style.pointerEvents !== want) el.style.pointerEvents = want
      }
    }
    sync()
    // 모드가 바뀌면(라우트 전환) 다시 맞춘다.
    const mo = new MutationObserver(sync)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-canvas-mode'],
    })
    // R3F 가 래퍼를 다시 그릴 때도 맞춘다.
    const inner = new MutationObserver(sync)
    inner.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    })
    return () => {
      mo.disconnect()
      inner.disconnect()
    }
  }, [])

  return (
    <div ref={ref} className="canvas-shell" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 2]}
        /*
         * 🔴 톤매핑이 조명의 절반이다. 프로토타입과 같은 조명값을 넣어도
         *    이 설정이 없으면 전혀 다르게 나온다 — 가구가 갈색으로 뭉개진다
         *    (실측 2026-09-09, 프로토타입 스크린샷과 대조해 발견).
         */
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.88,
        }}
      >
        <r3f.Out />
        <Preload all />
      </Canvas>
    </div>
  )
}
