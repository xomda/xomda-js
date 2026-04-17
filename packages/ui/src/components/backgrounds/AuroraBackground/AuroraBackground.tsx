import type { PropType } from 'vue'
import { computed, defineComponent, watch } from 'vue'

import { useCanvasBackground } from '../../../composables/useCanvasBackground'
import { useThemeMode } from '../../../composables/useThemeMode'
import styles from './AuroraBackground.module.scss'

export interface AuroraBackgroundProps {
  seed?: number
  mode?: 'light' | 'dark' | 'auto'
  intensity?: number
  scale?: number
  animationSpeed?: number
  paused?: boolean
  blur?: number
  opacity?: number
}

const NUM_BLOBS = 6
const TRANSITION_MS = 1400

function lcgRand(seed: number) {
  let s = (seed * 1664525 + 1013904223) | 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 0x100000000
  }
}

// Cool midnight navy/indigo tones — blended with `screen` on a dark base
const DARK_COLORS: Array<[number, number, number]> = [
  [25, 75, 175],
  [55, 30, 145],
  [18, 105, 140],
  [70, 30, 165],
  [12, 55, 120],
  [35, 90, 160],
]

// Summer-day palette — sea/sky blues with a single warm sun accent, blended with `multiply` on a cream base
const LIGHT_COLORS: Array<[number, number, number]> = [
  [60, 170, 220],
  [95, 165, 225],
  [120, 200, 220],
  [70, 175, 200],
  [150, 195, 230],
  [245, 175, 100],
]

interface BlobDef {
  cx: number
  cy: number
  // Normalised radii in [0.5, 1.0] — multiplied by diag × scaleFactor in render
  rx: number
  ry: number
  rotation: number
  phase: number
  driftFreq: number
  driftAmpX: number
  driftAmpY: number
}

function generateLayout(seed: number): BlobDef[] {
  const r = lcgRand(Math.round((seed + 1) * 9973))
  return Array.from({ length: NUM_BLOBS }, () => ({
    cx: -0.1 + r() * 1.2,
    cy: -0.1 + r() * 1.2,
    rx: 0.5 + r() * 0.5,
    ry: 0.4 + r() * 0.5,
    rotation: r() * Math.PI * 2,
    phase: r() * Math.PI * 2,
    driftFreq: 0.000008 + r() * 0.000014,
    driftAmpX: 0.015 + r() * 0.02,
    driftAmpY: 0.012 + r() * 0.018,
  }))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpBlob(a: BlobDef, b: BlobDef, t: number): BlobDef {
  return {
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    rotation: lerp(a.rotation, b.rotation, t),
    phase: a.phase,
    driftFreq: lerp(a.driftFreq, b.driftFreq, t),
    driftAmpX: lerp(a.driftAmpX, b.driftAmpX, t),
    driftAmpY: lerp(a.driftAmpY, b.driftAmpY, t),
  }
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export const AuroraBackground = defineComponent({
  name: 'AuroraBackground',
  props: {
    seed: { type: Number, default: 0 },
    mode: { type: String as PropType<'light' | 'dark' | 'auto'>, default: 'auto' },
    intensity: { type: Number, default: 0.4 },
    /**
     * Controls blob size relative to the viewport diagonal.
     * 0 = smaller blobs (~0.25–0.5× diag), some individual shapes visible.
     * 0.5 = medium blobs (~0.4–0.8× diag), good mesh feel. (default)
     * 1 = very large blobs (~0.6–1.1× diag), very diffuse.
     */
    scale: { type: Number, default: 0.5 },
    animationSpeed: { type: Number, default: 1 },
    paused: { type: Boolean, default: false },
    blur: { type: Number, default: 0 },
    opacity: { type: Number, default: 1 },
  },
  setup(props) {
    const isDark = useThemeMode(() => props.mode)

    let ctx: CanvasRenderingContext2D | null = null
    let W = 0
    let H = 0

    let sourceLayout = generateLayout(0)
    let targetLayout = generateLayout(0)
    let currentLayout = generateLayout(0)
    let transitionProgress = 1

    function startTransition(seed: number) {
      sourceLayout = currentLayout.map((b) => ({ ...b }))
      targetLayout = generateLayout(seed)
      transitionProgress = 0
    }

    function updateTransition(dtScaled: number) {
      if (transitionProgress >= 1) return
      transitionProgress = Math.min(1, transitionProgress + dtScaled / TRANSITION_MS)
      const t = easeInOut(transitionProgress)
      currentLayout = sourceLayout.map((s, i) => lerpBlob(s, targetLayout[i], t))
    }

    function render(phaseT: number) {
      if (!ctx || W === 0 || H === 0) return
      const dark = isDark.value
      const colors = dark ? DARK_COLORS : LIGHT_COLORS
      const diag = Math.sqrt(W * W + H * H)
      // scale 0→0.5, 0.5→0.8, 1→1.1 (multiplied by normalised b.rx/ry)
      const scaleFactor = 0.5 + props.scale * 0.6
      const intensity = props.intensity

      ctx.fillStyle = dark ? '#080c1a' : '#faf5ed'
      ctx.fillRect(0, 0, W, H)

      for (let i = 0; i < NUM_BLOBS; i++) {
        const b = currentLayout[i]
        const driftX = Math.sin(phaseT * b.driftFreq + b.phase) * b.driftAmpX
        const driftY = Math.cos(phaseT * b.driftFreq * 0.77 + b.phase + 1.3) * b.driftAmpY
        const x = (b.cx + driftX) * W
        const y = (b.cy + driftY) * H
        const rx = b.rx * diag * scaleFactor
        const ry = b.ry * diag * scaleFactor

        const [cr, cg, cb] = colors[i]
        const baseAlpha = dark
          ? intensity * (0.65 + (i % 3) * 0.1)
          : intensity * (0.55 + (i % 3) * 0.08)

        // Gradual falloff — energy stays high in the core, tapers in the outer 40%
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${baseAlpha.toFixed(3)})`)
        grad.addColorStop(0.3, `rgba(${cr},${cg},${cb},${(baseAlpha * 0.85).toFixed(3)})`)
        grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${(baseAlpha * 0.4).toFixed(3)})`)
        grad.addColorStop(0.85, `rgba(${cr},${cg},${cb},${(baseAlpha * 0.08).toFixed(3)})`)
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)

        ctx.save()
        // `screen` blends with 1-(1-src)(1-dst): soft, can't blow out past white
        // `multiply` on light: deepens/saturates like overlapping washes
        ctx.globalCompositeOperation = dark ? 'screen' : 'multiply'
        ctx.translate(x, y)
        ctx.rotate(b.rotation + phaseT * b.driftFreq * 0.2)
        ctx.scale(rx, ry)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Vignette — deep edge darkening
      const vigR = Math.max(W, H) * 0.75
      const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, vigR)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(0.7, dark ? 'rgba(0,0,0,0.25)' : 'rgba(250,245,237,0.2)')
      vig.addColorStop(1, dark ? 'rgba(0,0,0,0.7)' : 'rgba(250,245,237,0.7)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)
    }

    const { canvasRef, renderOnce } = useCanvasBackground({
      paused: () => props.paused,
      animationSpeed: () => props.animationSpeed,
      onResize: (w, h, dpr, canvas) => {
        if (!ctx) ctx = canvas.getContext('2d')
        if (!ctx) return
        W = w
        H = h
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      },
      onFrame: (phaseT, dtScaled) => {
        updateTransition(dtScaled)
        render(phaseT)
      },
    })

    watch(
      () => props.seed,
      (newSeed, oldSeed) => {
        if (oldSeed === undefined) {
          currentLayout = generateLayout(newSeed ?? 0)
          sourceLayout = currentLayout
          targetLayout = currentLayout
          transitionProgress = 1
        } else {
          startTransition(newSeed ?? 0)
        }
      },
      { immediate: true }
    )

    watch([isDark, () => props.intensity, () => props.scale], () => {
      if (ctx) renderOnce()
    })

    const canvasStyle = computed(() => {
      const style: Record<string, string> = {}
      if (props.blur > 0) style.filter = `blur(${props.blur}px)`
      if (props.opacity !== 1) style.opacity = String(props.opacity)
      return style
    })

    return () => <canvas ref={canvasRef} class={styles.canvas} style={canvasStyle.value} />
  },
})
