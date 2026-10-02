import Link from 'next/link'
import {
  CAMERA_POSITION,
  LAYOUT,
  MONITOR_POSITION,
  ROOM_CENTER,
  ROOM_SHELL,
  WHITEBOARD_POSITION,
} from '@/entities/room/model/layout'
import { type PlanSource, type Point, planPins, planShape } from '@/entities/room/model/plan'
import { ROOM_OBJECTS } from '@/entities/room/model/room'
import styles from './RoomPlan.module.css'

const SOURCE: PlanSource = {
  view: { eye: CAMERA_POSITION, target: ROOM_CENTER },
  layout: LAYOUT,
  fixtures: { monitor: MONITOR_POSITION, whiteboard: WHITEBOARD_POSITION },
  objects: ROOM_OBJECTS,
  shell: ROOM_SHELL,
}

const points = (pts: Point[]) => pts.map(([u, v]) => `${u.toFixed(3)},${v.toFixed(3)}`).join(' ')

// 3D 를 못 띄우는 화면에서 "작업실 안의 물건" 맥락만 준다. 보조기술·키보드 동선은 아래 RoomList 하나가 진다.
export function RoomPlan() {
  const shape = planShape(SOURCE)
  const pins = planPins(SOURCE)
  const [x, y, W, H] = shape.viewBox
  const pct = (u: number, v: number) => ({
    left: `${(((u - x) / W) * 100).toFixed(3)}%`,
    top: `${(((v - y) / H) * 100).toFixed(3)}%`,
  })

  return (
    <div
      className={styles.plan}
      aria-hidden="true"
      style={{
        aspectRatio: `${W.toFixed(3)} / ${H.toFixed(3)}`,
        ['--plan-ratio' as string]: W / H,
      }}
    >
      <svg
        aria-hidden="true"
        className={styles.svg}
        viewBox={`${x} ${y} ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <polygon className={styles.wall} points={points(shape.leftWall)} />
        <polygon className={styles.door} points={points(shape.door)} />
        <polygon className={styles.wall} points={points(shape.backWall)} />
        <polygon className={styles.floor} points={points(shape.floor)} />
      </svg>
      {pins.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          tabIndex={-1}
          className={styles.pin}
          data-plan-pin={p.no}
          data-accent={p.accent}
          style={pct(p.u, p.v)}
        >
          {p.no}
        </Link>
      ))}
    </div>
  )
}
