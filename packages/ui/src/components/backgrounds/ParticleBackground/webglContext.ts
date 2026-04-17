/**
 * Returns a WebGL2 rendering context, or null if the browser doesn't expose one.
 * We intentionally don't fall back to WebGL1 — Safari 15+ supports WebGL2, and the
 * shader source uses GLSL ES 3.00 (`#version 300 es`).
 */
export function createGlContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  })
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '<no log>'
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${log}`)
  }
  return shader
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '<no log>'
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${log}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return program
}

/** Parse a CSS color string (#rgb, #rrggbb, rgb(), rgba()) to [r, g, b] in 0..1. */
export function parseColor(input: string): [number, number, number] {
  const s = input.trim()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ]
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ]
    }
  }
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s)
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
  return [1, 1, 1]
}
