import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export interface PointerDrop {
  /** Normalized device coords: x in [-1, 1], y in [-1, 1] (y up). */
  ndcX: number
  ndcY: number
  /** Wall-clock time of the click (ms). */
  time: number
}

export interface PointerFieldState {
  /** Normalized device coords (-1..1, y up). */
  ndcX: number
  ndcY: number
  /** Smoothed pointer velocity in NDC units per ms. */
  vx: number
  vy: number
  /** True while the pointer is over the canvas (or the button is held). */
  active: boolean
}

export interface UsePointerFieldReturn {
  state: PointerFieldState
  /** Drain the queue of unhandled click drops since the last call. */
  consumeDrops(): PointerDrop[]
}

/**
 * Tracks pointer position (in NDC) and smoothed velocity over a target canvas, plus a
 * click-drop queue. The canvas itself is `pointer-events: none` (it's behind UI), so
 * we listen on `window` and clip with the canvas's bounding rect.
 */
export function usePointerField(canvasRef: Ref<HTMLCanvasElement | null>): UsePointerFieldReturn {
  const state: PointerFieldState = {
    ndcX: 0,
    ndcY: 0,
    vx: 0,
    vy: 0,
    active: false,
  }
  const drops: PointerDrop[] = []
  let lastX = 0
  let lastY = 0
  let lastT = 0

  function toNdc(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const canvas = canvasRef.value
    if (!canvas) return { x: 0, y: 0, inside: false }
    const r = canvas.getBoundingClientRect()
    const x = ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1
    const y = -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1
    const inside =
      clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
    return { x, y, inside }
  }

  function onMove(e: PointerEvent) {
    const now = e.timeStamp
    const { x, y, inside } = toNdc(e.clientX, e.clientY)
    if (lastT !== 0) {
      const dt = Math.max(1, now - lastT)
      // Exponential smoothing: ~50ms time constant
      const a = Math.min(1, dt / 50)
      state.vx = state.vx * (1 - a) + ((x - lastX) / dt) * a
      state.vy = state.vy * (1 - a) + ((y - lastY) / dt) * a
    }
    state.ndcX = x
    state.ndcY = y
    state.active = inside
    lastX = x
    lastY = y
    lastT = now
  }

  function onLeave() {
    state.active = false
    state.vx = 0
    state.vy = 0
  }

  function onDown(e: PointerEvent) {
    const { x, y, inside } = toNdc(e.clientX, e.clientY)
    if (!inside) return
    drops.push({ ndcX: x, ndcY: y, time: e.timeStamp })
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerleave', onLeave)
  })

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerleave', onLeave)
  })

  function consumeDrops(): PointerDrop[] {
    if (drops.length === 0) return []
    const out = drops.slice()
    drops.length = 0
    return out
  }

  return { state, consumeDrops }
}
