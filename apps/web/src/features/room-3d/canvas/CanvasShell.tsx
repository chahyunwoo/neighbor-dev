'use client'

import { Preload } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useRoom } from '@/features/room-3d/model/room-state'
import { r3f } from './tunnel'

// 씬은 화면이 아니라 여기서 렌더한다 — 페이지에 두면 라우트 전환마다 GLTF 재세팅으로 멈춘다.
const Scene = dynamic(() => import('../scene/Scene').then((m) => m.Scene), { ssr: false })

// 앱 전체에서 하나뿐인 <Canvas>. 카메라·조명·컨트롤·이펙트는 각 화면의 r3f.In 이 낸다.
// <Canvas camera> 를 쓰지 않는다 — 마운트 시 1회만 반영된다. 각 화면이 <PerspectiveCamera makeDefault> 를 낸다.
// frameloop="demand" 금지 — useFrame 루프(반응·카메라 비행)가 멈춘다.
export function CanvasShell() {
  const ref = useRef<HTMLDivElement>(null)

  /* 캔버스 페이드 인. 같은 프레임에 켜면 브라우저가 시작값을 못 잡아 transition 이 안 돈다 — 한 프레임 뒤에 켠다. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.documentElement.dataset.canvasReady = 'true'
    })
    return () => {
      cancelAnimationFrame(raf)
      delete document.documentElement.dataset.canvasReady
    }
  }, [])

  /* nav·footer 높이를 상수로 박지 않고 실측해 CSS 변수로 넣는다. */
  useEffect(() => {
    const root = document.documentElement
    const ro = new ResizeObserver(() => measure())
    let watched: (Element | null)[] = []
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
     * 라우트 전환에 푸터가 사라져도 이 effect 는 다시 안 돌므로 DOM 변화를 직접 본다.
     * 측정은 프레임당 한 번으로 합친다 — getBoundingClientRect 가 강제 레이아웃이라 삽입마다 돌면 스트리밍 화면에서 쌓인다.
     * 마이크로태스크로 합치면 안 된다 — MutationObserver 도 마이크로태스크라 같은 틱에 또 돈다.
     */
    let queued = 0
    const schedule = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        measure()
        // 관찰 대상이 그대로면 다시 걸지 않는다 — 재 observe 마다 최초 콜백이 또 온다.
        const next = ['nav', 'footer'].map((sel) => document.querySelector(sel))
        if (next.length === watched.length && next.every((el, i) => el === watched[i])) return
        ro.disconnect()
        watched = next
        for (const el of next) if (el) ro.observe(el)
      })
    }
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true })

    measure()
    watched = ['nav', 'footer'].map((sel) => document.querySelector(sel))
    for (const el of watched) if (el) ro.observe(el)
    return () => {
      if (queued) cancelAnimationFrame(queued)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  /*
   * R3F 래퍼 div 가 pointer-events:auto 를 인라인으로 박아 CSS 로는 못 이긴다. eventSource 는 마운트 시 고정이라
   * 모드별로 못 바꾼다. 안 맞추면 페이지 모드에서 캔버스가 본문 클릭을 가로챈다 — 계산값을 자식 인라인에 직접 맞춘다.
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
    <>
      <div className="canvas-frame" aria-hidden="true" />
      <div ref={ref} className="canvas-shell" aria-hidden="true">
        <Canvas
          shadows
          dpr={[1, 2]}
          /* 리사이즈를 debounce 하지 않는다 — 패널 전환 중 드로잉 버퍼가 한 번에 튀어 3D 가 어긋나 보인다. */
          resize={{ debounce: 0 }}
          /* 톤매핑이 없으면 같은 조명값이어도 가구가 갈색으로 뭉개진다. */
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.88,
          }}
        >
          <SceneSlot />
          <r3f.Out />
          <Preload all />
        </Canvas>
      </div>
    </>
  )
}

// off 일 때도 씬을 언마운트하지 않는다 — 다시 켤 때 GLTF 재세팅으로 멈춘다. visibility:hidden 으로 충분하다.
function SceneSlot() {
  const { mode, openId, seen, open, markEntered, resetEntered, night, toggleLight } = useRoom()
  return (
    <Suspense fallback={null}>
      <Scene
        mode={mode === 'page' ? 'page' : 'room'}
        openId={openId}
        seen={seen}
        onOpen={open}
        onEntered={markEntered}
        onIntroStart={resetEntered}
        night={night}
        onToggleLight={toggleLight}
      />
    </Suspense>
  )
}
