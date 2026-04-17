import { type Mat4, mat4, rotateAroundAxis, type Vec3 } from '@xomda/util'
import type { PropType } from 'vue'
import { computed, defineComponent, watch } from 'vue'

import { useCanvasBackground } from '../../../composables/useCanvasBackground'
import { usePointerField } from '../../../composables/usePointerField'
import { useThemeMode } from '../../../composables/useThemeMode'
import styles from './ParticleBackground.module.scss'
import {
  type FieldFunction,
  type FieldFunctionId,
  type FieldParams,
  resolveField,
} from './particleField'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './particleShaders'
import { ParticleSystem } from './particleSystem'
import { createGlContext, linkProgram, parseColor } from './webglContext'

export interface CameraConfig {
  position: Vec3
  target: Vec3
  up: Vec3
  fov: number
  near: number
  far: number
  orbitSpeed: number
  orbitAxis: Vec3
}

export interface ParticleBackgroundProps {
  // Theme
  mode?: 'light' | 'dark' | 'auto'
  baseColor?: string
  // Particles
  particleCount?: number
  particleSize?: number
  fieldFunction?: FieldFunctionId | FieldFunction
  fieldParams?: FieldParams
  /** Overall light multiplier — boosts every particle's brightness uniformly. */
  brightness?: number
  /** Soft halo strength around each particle. 0 disables the halo entirely. */
  glow?: number
  /** Tight bright core strength. Dense regions bloom toward white at higher values. */
  coreIntensity?: number
  /** 0..1 — how strongly each particle's brightness twinkles. */
  brightnessFlicker?: number
  /** Multiplier on flicker oscillation frequency (1 = default tempo). */
  flickerSpeed?: number
  // Camera
  camera?: Partial<CameraConfig>
  // Interaction
  pointerStrength?: number
  pointerRadius?: number
  dropMass?: number
  dropVelocity?: number
  dropRadius?: number
  // Physics
  gravity?: Vec3
  damping?: number
  springStrength?: number
  // Misc
  animationSpeed?: number
  paused?: boolean
  seed?: number
  blur?: number
  opacity?: number
}

const DEFAULT_CAMERA: CameraConfig = {
  position: [0, 0, 5],
  target: [0, 0, 0],
  up: [0, 1, 0],
  fov: Math.PI / 3,
  near: 0.1,
  far: 100,
  orbitSpeed: 0,
  orbitAxis: [0, 1, 0],
}

const DARK_DEFAULT_COLOR = '#a8c8ff'
const LIGHT_DEFAULT_COLOR = '#1d2738'

export const ParticleBackground = defineComponent({
  name: 'ParticleBackground',
  props: {
    mode: { type: String as PropType<'light' | 'dark' | 'auto'>, default: 'auto' },
    baseColor: { type: String, default: undefined },
    particleCount: { type: Number, default: 5000 },
    particleSize: { type: Number, default: 220 },
    fieldFunction: {
      type: [String, Function] as PropType<FieldFunctionId | FieldFunction>,
      default: 'galaxy',
    },
    fieldParams: { type: Object as PropType<FieldParams>, default: () => ({}) },
    brightness: { type: Number, default: 1 },
    glow: { type: Number, default: 1 },
    coreIntensity: { type: Number, default: 1 },
    brightnessFlicker: { type: Number, default: 0.4 },
    flickerSpeed: { type: Number, default: 1 },
    camera: { type: Object as PropType<Partial<CameraConfig>>, default: () => ({}) },
    pointerStrength: { type: Number, default: 1.5 },
    pointerRadius: { type: Number, default: 1 },
    dropMass: { type: Number, default: 1 },
    dropVelocity: { type: Number, default: 1 },
    dropRadius: { type: Number, default: 1 },
    gravity: { type: Array as unknown as PropType<Vec3>, default: () => [0, 0, 0] as const },
    damping: { type: Number, default: 0.94 },
    springStrength: { type: Number, default: 0.6 },
    animationSpeed: { type: Number, default: 1 },
    paused: { type: Boolean, default: false },
    seed: { type: Number, default: () => Math.random() },
    blur: { type: Number, default: 0 },
    opacity: { type: Number, default: 1 },
  },
  setup(props) {
    const isDark = useThemeMode(() => props.mode)

    const colorRgb = computed<[number, number, number]>(() => {
      if (props.baseColor) return parseColor(props.baseColor)
      return parseColor(isDark.value ? DARK_DEFAULT_COLOR : LIGHT_DEFAULT_COLOR)
    })

    const camera = computed<CameraConfig>(() => ({ ...DEFAULT_CAMERA, ...props.camera }))

    let gl: WebGL2RenderingContext | null = null
    let program: WebGLProgram | null = null
    let vao: WebGLVertexArrayObject | null = null
    let buffer: WebGLBuffer | null = null
    let system: ParticleSystem | null = null
    let viewportW = 1
    let viewportH = 1
    let orbitAngle = 0
    const projection: Mat4 = mat4.identity()
    const view: Mat4 = mat4.identity()
    const mvp: Mat4 = mat4.identity()

    let uProjection: WebGLUniformLocation | null = null
    let uView: WebGLUniformLocation | null = null
    let uTime: WebGLUniformLocation | null = null
    let uColor: WebGLUniformLocation | null = null
    let uOpacity: WebGLUniformLocation | null = null
    let uSizeScale: WebGLUniformLocation | null = null
    let uFlicker: WebGLUniformLocation | null = null
    let uFlickerSpeed: WebGLUniformLocation | null = null
    let uBrightness: WebGLUniformLocation | null = null
    let uGlow: WebGLUniformLocation | null = null
    let uCoreIntensity: WebGLUniformLocation | null = null

    function rebuildSystem() {
      if (!gl || !buffer) return
      const fn = resolveField(props.fieldFunction)
      system = new ParticleSystem(props.particleCount, fn, props.fieldParams, props.seed)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, system.gpuData, gl.DYNAMIC_DRAW)
    }

    function setupGl(canvas: HTMLCanvasElement) {
      gl = createGlContext(canvas)
      if (!gl) return
      program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
      uProjection = gl.getUniformLocation(program, 'uProjection')
      uView = gl.getUniformLocation(program, 'uView')
      uTime = gl.getUniformLocation(program, 'uTime')
      uColor = gl.getUniformLocation(program, 'uColor')
      uOpacity = gl.getUniformLocation(program, 'uOpacity')
      uSizeScale = gl.getUniformLocation(program, 'uSizeScale')
      uFlicker = gl.getUniformLocation(program, 'uFlicker')
      uFlickerSpeed = gl.getUniformLocation(program, 'uFlickerSpeed')
      uBrightness = gl.getUniformLocation(program, 'uBrightness')
      uGlow = gl.getUniformLocation(program, 'uGlow')
      uCoreIntensity = gl.getUniformLocation(program, 'uCoreIntensity')

      vao = gl.createVertexArray()
      buffer = gl.createBuffer()
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      const STRIDE = 5 * 4
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0)
      gl.enableVertexAttribArray(1)
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, STRIDE, 3 * 4)
      gl.enableVertexAttribArray(2)
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE, 4 * 4)
      gl.bindVertexArray(null)

      gl.enable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)

      rebuildSystem()
    }

    /**
     * Project a NDC coordinate (x, y in -1..1) to a world point on the camera's
     * focal plane (z = camera.target.z, roughly). We use a simple unprojection at
     * the target depth — good enough for "drop" placement and pointer interactions.
     */
    function ndcToWorld(ndcX: number, ndcY: number): Vec3 {
      const cam = camera.value
      const aspect = viewportW / Math.max(1, viewportH)
      const halfH = Math.tan(cam.fov / 2)
      const halfW = halfH * aspect
      // Distance from camera to target plane
      const tx = cam.target[0] - cam.position[0]
      const ty = cam.target[1] - cam.position[1]
      const tz = cam.target[2] - cam.position[2]
      const targetDist = Math.hypot(tx, ty, tz) || 1
      // Camera basis
      const fwd: Vec3 = [tx / targetDist, ty / targetDist, tz / targetDist]
      const upRaw = cam.up
      const right: Vec3 = [
        fwd[1] * upRaw[2] - fwd[2] * upRaw[1],
        fwd[2] * upRaw[0] - fwd[0] * upRaw[2],
        fwd[0] * upRaw[1] - fwd[1] * upRaw[0],
      ]
      const rl = Math.hypot(right[0], right[1], right[2]) || 1
      const r: Vec3 = [right[0] / rl, right[1] / rl, right[2] / rl]
      const u: Vec3 = [
        r[1] * fwd[2] - r[2] * fwd[1],
        r[2] * fwd[0] - r[0] * fwd[2],
        r[0] * fwd[1] - r[1] * fwd[0],
      ]
      const sx = ndcX * halfW * targetDist
      const sy = ndcY * halfH * targetDist
      return [
        cam.target[0] + r[0] * sx + u[0] * sy,
        cam.target[1] + r[1] * sx + u[1] * sy,
        cam.target[2] + r[2] * sx + u[2] * sy,
      ]
    }

    const { canvasRef, renderOnce } = useCanvasBackground({
      paused: () => props.paused,
      animationSpeed: () => props.animationSpeed,
      onResize: (w, h, dpr, canvas) => {
        if (!gl) setupGl(canvas)
        if (!gl) return
        viewportW = w * dpr
        viewportH = h * dpr
        gl.viewport(0, 0, viewportW, viewportH)
        const cam = camera.value
        mat4.perspective(cam.fov, viewportW / Math.max(1, viewportH), cam.near, cam.far, projection)
      },
      onFrame: (phaseT, dtScaled) => {
        if (!gl || !program || !system || !vao || !buffer) return
        const dtSec = Math.min(0.1, dtScaled / 1000)
        const cam = camera.value
        orbitAngle += cam.orbitSpeed * dtSec
        const orbitedPos =
          cam.orbitSpeed === 0
            ? cam.position
            : rotateAroundAxis(cam.position, cam.orbitAxis, orbitAngle)
        mat4.lookAt(orbitedPos, cam.target, cam.up, view)

        const pointerWorld = pointer.state.active
          ? ndcToWorld(pointer.state.ndcX, pointer.state.ndcY)
          : null

        const drops = pointer.consumeDrops().map((d) => ({
          worldPos: ndcToWorld(d.ndcX, d.ndcY),
          mass: props.dropMass,
          velocity: props.dropVelocity,
          radius: props.dropRadius,
        }))

        system.step({
          dt: dtSec,
          gravity: props.gravity,
          damping: props.damping,
          springStrength: props.springStrength,
          pointer: pointerWorld,
          pointerStrength: props.pointerStrength,
          pointerRadius: props.pointerRadius,
          drops,
        })

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, system.gpuData)

        // Blend mode flips between additive (dark) and alpha (light) every frame
        // so a runtime theme toggle is reflected immediately.
        if (isDark.value) gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(program)
        gl.uniformMatrix4fv(uProjection, false, projection)
        gl.uniformMatrix4fv(uView, false, view)
        gl.uniform1f(uTime, phaseT)
        gl.uniform3f(uColor, colorRgb.value[0], colorRgb.value[1], colorRgb.value[2])
        gl.uniform1f(uOpacity, 1)
        gl.uniform1f(uSizeScale, props.particleSize)
        gl.uniform1f(uFlicker, props.brightnessFlicker)
        gl.uniform1f(uFlickerSpeed, props.flickerSpeed)
        gl.uniform1f(uBrightness, props.brightness)
        gl.uniform1f(uGlow, props.glow)
        gl.uniform1f(uCoreIntensity, props.coreIntensity)

        gl.bindVertexArray(vao)
        gl.drawArrays(gl.POINTS, 0, system.count)
        gl.bindVertexArray(null)

        // Suppress lint warning on mvp — kept for future caller-supplied transforms.
        void mvp
      },
    })

    const pointer = usePointerField(canvasRef)

    watch(
      () => [props.particleCount, props.fieldFunction, props.fieldParams, props.seed] as const,
      () => {
        if (!gl) return
        rebuildSystem()
        renderOnce()
      },
      { deep: true }
    )

    watch(
      () => props.camera,
      () => {
        if (!gl) return
        const cam = camera.value
        mat4.perspective(cam.fov, viewportW / Math.max(1, viewportH), cam.near, cam.far, projection)
        renderOnce()
      },
      { deep: true }
    )

    const canvasStyle = computed(() => {
      const style: Record<string, string> = {}
      if (props.blur > 0) style.filter = `blur(${props.blur}px)`
      if (props.opacity !== 1) style.opacity = String(props.opacity)
      return style
    })

    return () => <canvas ref={canvasRef} class={styles.canvas} style={canvasStyle.value} />
  },
})
