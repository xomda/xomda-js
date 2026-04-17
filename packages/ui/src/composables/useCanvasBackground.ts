import { onBeforeUnmount, onMounted, type Ref, ref, watch } from 'vue'

export interface UseCanvasBackgroundOptions {
  /** Returns `true` when the loop should be paused. */
  paused: () => boolean
  /** Multiplier applied to elapsed dt before passing to onFrame. Defaults to 1. */
  animationSpeed?: () => number
  /** Called whenever the canvas resizes (initial mount + ResizeObserver). */
  onResize: (w: number, h: number, dpr: number, canvas: HTMLCanvasElement) => void
  /** Called every animation frame with cumulative phase time and scaled delta. */
  onFrame: (phaseT: number, dtScaled: number) => void
}

export interface UseCanvasBackgroundReturn {
  canvasRef: Ref<HTMLCanvasElement | null>
  /** Force a re-render frame even when paused (useful after a non-animated prop change). */
  renderOnce: () => void
}

/**
 * Centralises the boilerplate that any full-screen canvas background needs:
 * DPR-aware sizing via ResizeObserver, requestAnimationFrame loop with paused/visibility/
 * prefers-reduced-motion handling. Both `GlassBackground` and `ParticleBackground` use it.
 */
export function useCanvasBackground(opts: UseCanvasBackgroundOptions): UseCanvasBackgroundReturn {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let raf: number | null = null
  let resizeObserver: ResizeObserver | null = null
  let phaseT = 0
  let lastFrame = 0

  function shouldAnimate(): boolean {
    if (opts.paused()) return false
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function resize() {
    const canvas = canvasRef.value
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const w = Math.max(1, r.width)
    const h = Math.max(1, r.height)
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    opts.onResize(w, h, dpr, canvas)
  }

  function loop(now: number) {
    if (lastFrame === 0) lastFrame = now
    const dt = now - lastFrame
    lastFrame = now
    const speed = opts.animationSpeed ? opts.animationSpeed() : 1
    const dtScaled = dt * speed
    phaseT += dtScaled
    opts.onFrame(phaseT, dtScaled)
    raf = requestAnimationFrame(loop)
  }

  function startLoop() {
    if (raf != null) return
    lastFrame = 0
    raf = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (raf != null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined') return
    if (document.hidden) stopLoop()
    else if (shouldAnimate()) startLoop()
  }

  function renderOnce() {
    opts.onFrame(phaseT, 0)
  }

  onMounted(() => {
    resize()
    if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
      resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(canvasRef.value)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    if (shouldAnimate()) startLoop()
    else renderOnce()
  })

  onBeforeUnmount(() => {
    stopLoop()
    resizeObserver?.disconnect()
    resizeObserver = null
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  watch(
    () => opts.paused(),
    (p) => {
      if (p) stopLoop()
      else if (shouldAnimate()) startLoop()
    }
  )

  return { canvasRef, renderOnce }
}
