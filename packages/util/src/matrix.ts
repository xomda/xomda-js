export type Vec3 = readonly [number, number, number]
export type Mat4 = Float32Array

export const vec3 = {
  sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  },
  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  },
  scale(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s]
  },
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  },
  cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  },
  length(a: Vec3): number {
    return Math.hypot(a[0], a[1], a[2])
  },
  normalize(a: Vec3): Vec3 {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  },
}

export const mat4 = {
  identity(out: Mat4 = new Float32Array(16)): Mat4 {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = 1
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[10] = 1
    out[11] = 0
    out[12] = 0
    out[13] = 0
    out[14] = 0
    out[15] = 1
    return out
  },

  perspective(
    fov: number,
    aspect: number,
    near: number,
    far: number,
    out: Mat4 = new Float32Array(16)
  ): Mat4 {
    const f = 1 / Math.tan(fov / 2)
    const nf = 1 / (near - far)
    out[0] = f / aspect
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = f
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[10] = (far + near) * nf
    out[11] = -1
    out[12] = 0
    out[13] = 0
    out[14] = 2 * far * near * nf
    out[15] = 0
    return out
  },

  lookAt(eye: Vec3, target: Vec3, up: Vec3, out: Mat4 = new Float32Array(16)): Mat4 {
    const f = vec3.normalize(vec3.sub(target, eye))
    const s = vec3.normalize(vec3.cross(f, up))
    const u = vec3.cross(s, f)
    out[0] = s[0]
    out[1] = u[0]
    out[2] = -f[0]
    out[3] = 0
    out[4] = s[1]
    out[5] = u[1]
    out[6] = -f[1]
    out[7] = 0
    out[8] = s[2]
    out[9] = u[2]
    out[10] = -f[2]
    out[11] = 0
    out[12] = -vec3.dot(s, eye)
    out[13] = -vec3.dot(u, eye)
    out[14] = vec3.dot(f, eye)
    out[15] = 1
    return out
  },

  multiply(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
    const a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3]
    const a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7]
    const a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11]
    const a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4]
      const b1 = b[i * 4 + 1]
      const b2 = b[i * 4 + 2]
      const b3 = b[i * 4 + 3]
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
    }
    return out
  },

  /**
   * Transform a 3D point by a mat4 with implicit w=1, returning a homogeneous vec4 (x,y,z,w).
   * Useful for screen-space projection where we need w to divide.
   */
  transformPoint(m: Mat4, p: Vec3): [number, number, number, number] {
    const x = p[0],
      y = p[1],
      z = p[2]
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
      m[3] * x + m[7] * y + m[11] * z + m[15],
    ]
  },
}

/**
 * Rotate a point around an arbitrary axis through the origin (Rodrigues' formula).
 * Used for camera orbit.
 */
export function rotateAroundAxis(p: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = vec3.normalize(axis)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dot = vec3.dot(k, p)
  const cross = vec3.cross(k, p)
  return [
    p[0] * cos + cross[0] * sin + k[0] * dot * (1 - cos),
    p[1] * cos + cross[1] * sin + k[1] * dot * (1 - cos),
    p[2] * cos + cross[2] * sin + k[2] * dot * (1 - cos),
  ]
}
