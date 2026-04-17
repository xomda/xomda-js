import type { PropType } from 'vue'
import { computed, defineComponent, watch } from 'vue'

import { useCanvasBackground } from '../../../composables/useCanvasBackground'
import { useThemeMode } from '../../../composables/useThemeMode'
import styles from './GlassBackground.module.scss'

export interface GlassBackgroundProps {
  mode?: 'light' | 'dark' | 'auto'
  intensity?: number
  density?: number
  animationSpeed?: number
  paused?: boolean
  seed?: number
  blur?: number
  opacity?: number
}

interface ResolvedTheme {
  baseHue: number
  baseSat: number
  lightL: number
  midL: number
  darkL: number
  ambient: number
  vignette: string
  glassOverlay: string
  lightColor: [number, number, number]
  specularStrength: number
}

interface Vertex {
  baseX: number
  baseY: number
  baseZ: number
  x: number
  y: number
  z: number
  phase: number
  driftSpeed: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Targets at `intensity = 0` push each mode further in its own direction:
// dark gets deeper (highlights and mids drop, ambient dims), light gets airier
// (shadows lift). At `intensity = 1` we reproduce the source demo's extremes.
const LIGHT_TARGET = { lightL: 96, midL: 80, darkL: 58, ambient: 0.35, vignetteAlpha: 0.14 }
const DARK_TARGET = { lightL: 12, midL: 2, darkL: 0, ambient: 0.015, vignetteAlpha: 0.6 }

function buildTheme(isDark: boolean, intensity: number): ResolvedTheme {
  const t = clamp(1 - intensity, 0, 1)
  if (isDark) {
    return {
      baseHue: 222,
      baseSat: lerp(70, 42, t),
      lightL: lerp(55, DARK_TARGET.lightL, t),
      midL: lerp(14, DARK_TARGET.midL, t),
      darkL: lerp(1, DARK_TARGET.darkL, t),
      ambient: lerp(0.05, DARK_TARGET.ambient, t),
      vignette: `rgba(0,0,0,${lerp(0.7, DARK_TARGET.vignetteAlpha, t).toFixed(3)})`,
      glassOverlay: 'rgba(255,255,255,0.015)',
      lightColor: [130, 140, 160],
      specularStrength: lerp(0.45, 0.18, t),
    }
  }
  return {
    baseHue: 205,
    baseSat: 82,
    lightL: lerp(99, LIGHT_TARGET.lightL, t),
    midL: lerp(78, LIGHT_TARGET.midL, t),
    darkL: lerp(48, LIGHT_TARGET.darkL, t),
    ambient: lerp(0.3, LIGHT_TARGET.ambient, t),
    vignette: `rgba(80,130,200,${lerp(0.18, LIGHT_TARGET.vignetteAlpha, t).toFixed(3)})`,
    glassOverlay: 'rgba(255,255,255,0.04)',
    lightColor: [255, 250, 235],
    specularStrength: 0.65,
  }
}

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export const GlassBackground = defineComponent({
  name: 'GlassBackground',
  props: {
    mode: { type: String as PropType<'light' | 'dark' | 'auto'>, default: 'auto' },
    intensity: { type: Number, default: 0.3 },
    density: { type: Number, default: 0.5 },
    animationSpeed: { type: Number, default: 1 },
    paused: { type: Boolean, default: false },
    seed: { type: Number, default: Math.random() },
    blur: { type: Number, default: 0 },
    opacity: { type: Number, default: 1 },
  },
  setup(props) {
    const isDark = useThemeMode(() => props.mode)
    const theme = computed(() => buildTheme(isDark.value, props.intensity))

    let ctx: CanvasRenderingContext2D | null = null
    let W = 0
    let H = 0

    let vertices: Vertex[] = []
    let triangles: [number, number, number][] = []
    let triCenters: { x: number; y: number }[] = []
    let triRand: number[] = []

    function rebuildMesh() {
      vertices = []
      triangles = []
      triCenters = []
      triRand = []
      const seedOffset = props.seed
      const MIN_COLS = 1
      const MAX_COLS = 200
      const d = clamp(props.density, 0, 1)
      const targetCols = Math.max(1, Math.round(MIN_COLS * Math.pow(MAX_COLS / MIN_COLS, d)))
      const cellW = W / Math.max(1, targetCols)
      const cols = Math.ceil(W / cellW) + 1
      const rows = Math.ceil(H / cellW) + 1
      const offsetX = -cellW * 0.5
      const offsetY = -cellW * 0.5

      for (let row = 0; row < rows + 1; row++) {
        for (let col = 0; col < cols + 1; col++) {
          const seed = row * 1000 + col + seedOffset * 1009
          const jx = (rand(seed * 7.1) - 0.5) * cellW * 0.9
          const jy = (rand(seed * 13.3) - 0.5) * cellW * 0.9
          let x = offsetX + col * cellW + jx
          let y = offsetY + row * cellW + jy
          if (col === 0) x = -2
          if (col === cols) x = W + 2
          if (row === 0) y = -2
          if (row === rows) y = H + 2
          const z = (rand(seed * 19.7) - 0.5) * cellW * 0.9
          vertices.push({
            baseX: x,
            baseY: y,
            baseZ: z,
            x,
            y,
            z,
            phase: rand(seed * 23.9) * Math.PI * 2,
            driftSpeed: 0.00004 + rand(seed * 31.1) * 0.00006,
          })
        }
      }

      const stride = cols + 1
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i00 = row * stride + col
          const i10 = row * stride + (col + 1)
          const i01 = (row + 1) * stride + col
          const i11 = (row + 1) * stride + (col + 1)
          if (rand(row * 100 + col + 0.5 + seedOffset * 0.7) > 0.5) {
            triangles.push([i00, i10, i11])
            triangles.push([i00, i11, i01])
          } else {
            triangles.push([i00, i10, i01])
            triangles.push([i10, i11, i01])
          }
        }
      }
      for (let i = 0; i < triangles.length; i++) {
        triCenters.push({ x: 0, y: 0 })
        triRand.push((rand(i * 7.7 + seedOffset * 0.3) - 0.5) * 2)
      }
    }

    function shadeTriangle(
      v0: Vertex,
      v1: Vertex,
      v2: Vertex,
      lightDir: [number, number, number],
      viewDir: [number, number, number]
    ) {
      const ax = v1.x - v0.x
      const ay = v1.y - v0.y
      const az = v1.z - v0.z
      const bx = v2.x - v0.x
      const by = v2.y - v0.y
      const bz = v2.z - v0.z
      let nx = ay * bz - az * by
      let ny = az * bx - ax * bz
      let nz = ax * by - ay * bx
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      if (nz < 0) {
        nx = -nx
        ny = -ny
        nz = -nz
      }
      const ndotl = Math.max(0, nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2])
      const th = theme.value
      const lightness = Math.min(1, th.ambient + (1 - th.ambient) * ndotl)

      const hx = lightDir[0] + viewDir[0]
      const hy = lightDir[1] + viewDir[1]
      const hz = lightDir[2] + viewDir[2]
      const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1
      const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hl)
      const specular = Math.pow(ndoth, 48) * (ndotl > 0 ? 1 : 0)

      return { lightness, specular }
    }

    function colorForFacet(lightness: number, hueVar: number, satVar: number) {
      const th = theme.value
      let L: number
      if (lightness < 0.5) {
        const k = lightness / 0.5
        L = th.darkL + (th.midL - th.darkL) * k
      } else {
        const k = (lightness - 0.5) / 0.5
        L = th.midL + (th.lightL - th.midL) * k
      }
      const H = th.baseHue + hueVar * 5
      const S = Math.max(45, Math.min(95, th.baseSat + satVar * 5))
      return `hsl(${H}, ${S}%, ${L}%)`
    }

    function updateMesh(t: number) {
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i]
        const isEdge = v.baseX <= 0 || v.baseX >= W || v.baseY <= 0 || v.baseY >= H
        if (isEdge) {
          v.x = v.baseX
          v.y = v.baseY
          v.z = v.baseZ + Math.sin(t * v.driftSpeed + v.phase) * 5
        } else {
          const a = t * v.driftSpeed + v.phase
          v.x = v.baseX + Math.sin(a) * 2.5
          v.y = v.baseY + Math.cos(a * 1.1) * 2.0
          v.z = v.baseZ + Math.sin(a * 0.7) * 8
        }
      }
    }

    function getLightDir(t: number): [number, number, number] {
      const slow = t * 0.00018
      const lx = Math.cos(slow) * 0.85
      const ly = -0.5 + Math.sin(slow * 0.7) * 0.25
      const lz = 0.45 + Math.sin(slow) * 0.15
      return normalize3([lx, ly, lz])
    }

    function getLightScreenPos(lightDir: [number, number, number]) {
      return { x: W * (0.5 + lightDir[0] * 0.7), y: H * (0.5 + lightDir[1] * 0.7) }
    }

    function render(t: number) {
      if (!ctx || W === 0 || H === 0) return
      updateMesh(t)

      const lightDir = getLightDir(t)
      const viewDir: [number, number, number] = [0, 0, 1]
      const th = theme.value

      ctx.fillStyle = `hsl(${th.baseHue}, ${th.baseSat}%, ${th.darkL}%)`
      ctx.fillRect(0, 0, W, H)

      for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i]
        const v0 = vertices[tri[0]]
        const v1 = vertices[tri[1]]
        const v2 = vertices[tri[2]]
        triCenters[i].x = (v0.x + v1.x + v2.x) / 3
        triCenters[i].y = (v0.y + v1.y + v2.y) / 3
      }

      const spot = getLightScreenPos(lightDir)
      const spotRadius = Math.max(W, H) * 0.45

      for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i]
        const v0 = vertices[tri[0]]
        const v1 = vertices[tri[1]]
        const v2 = vertices[tri[2]]
        const sh = shadeTriangle(v0, v1, v2, lightDir, viewDir)

        const dx = triCenters[i].x - spot.x
        const dy = triCenters[i].y - spot.y
        const distSq = dx * dx + dy * dy
        const spotFactor = Math.max(0, 1 - distSq / (spotRadius * spotRadius))
        const boostedLightness = Math.min(1, sh.lightness + spotFactor * spotFactor * 0.32)

        const fill = colorForFacet(boostedLightness, triRand[i], triRand[i] * 0.5)
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.moveTo(v0.x, v0.y)
        ctx.lineTo(v1.x, v1.y)
        ctx.lineTo(v2.x, v2.y)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = fill
        ctx.lineWidth = 0.6
        ctx.stroke()

        if (sh.specular > 0.04) {
          ctx.save()
          ctx.globalCompositeOperation = 'screen'
          const lc = th.lightColor
          ctx.fillStyle = `rgba(${lc[0]},${lc[1]},${lc[2]},${sh.specular * th.specularStrength})`
          ctx.beginPath()
          ctx.moveTo(v0.x, v0.y)
          ctx.lineTo(v1.x, v1.y)
          ctx.lineTo(v2.x, v2.y)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }

      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.3,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.78
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, th.vignette)
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = th.glassOverlay
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
        rebuildMesh()
      },
      onFrame: (phaseT) => {
        if (ctx) render(phaseT)
      },
    })

    watch(
      () => [props.density, props.seed] as const,
      () => {
        if (!ctx) return
        rebuildMesh()
        renderOnce()
      }
    )

    watch([isDark, () => props.intensity], () => {
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
