import { describe, expect, it } from 'vitest'

import { mat4, rotateAroundAxis, vec3 } from '../matrix'

const approx = (n: number, p = 6) => Number(n.toFixed(p))

describe('vec3', () => {
  describe('sub', () => {
    it('subtracts component-wise', () => {
      expect(vec3.sub([1, 2, 3], [0.5, 1, 1.5])).toEqual([0.5, 1, 1.5])
    })

    it('returns [0,0,0] when subtracting a vector from itself', () => {
      expect(vec3.sub([7, 8, 9], [7, 8, 9])).toEqual([0, 0, 0])
    })
  })

  describe('add', () => {
    it('adds component-wise', () => {
      expect(vec3.add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9])
    })
  })

  describe('scale', () => {
    it('multiplies every component by the scalar', () => {
      expect(vec3.scale([1, -2, 3], 4)).toEqual([4, -8, 12])
    })

    it('returns the zero vector when scaled by 0', () => {
      expect(vec3.scale([10, 20, 30], 0)).toEqual([0, 0, 0])
    })
  })

  describe('dot', () => {
    it('computes the dot product', () => {
      expect(vec3.dot([1, 2, 3], [4, 5, 6])).toBe(32)
    })

    it('returns 0 for perpendicular vectors', () => {
      expect(vec3.dot([1, 0, 0], [0, 1, 0])).toBe(0)
    })

    it('equals length squared when dotted with itself', () => {
      expect(vec3.dot([2, 3, 6], [2, 3, 6])).toBe(49)
    })
  })

  describe('cross', () => {
    it('matches the right-hand rule for unit axes', () => {
      expect(vec3.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
      expect(vec3.cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
      expect(vec3.cross([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0])
    })

    it('is anti-commutative', () => {
      const a: [number, number, number] = [1, 2, 3]
      const b: [number, number, number] = [4, 5, 6]
      const ab = vec3.cross(a, b)
      const ba = vec3.cross(b, a)
      expect(ab.map((v) => -v)).toEqual([...ba])
    })

    it('returns zero for parallel vectors', () => {
      expect(vec3.cross([1, 2, 3], [2, 4, 6])).toEqual([0, 0, 0])
    })
  })

  describe('length', () => {
    it('computes the Euclidean magnitude', () => {
      expect(vec3.length([3, 4, 0])).toBe(5)
      expect(approx(vec3.length([1, 1, 1]))).toBe(approx(Math.sqrt(3)))
    })

    it('returns 0 for the zero vector', () => {
      expect(vec3.length([0, 0, 0])).toBe(0)
    })
  })

  describe('normalize', () => {
    it('returns a unit vector pointing in the same direction', () => {
      const n = vec3.normalize([3, 4, 0])
      expect(approx(vec3.length(n))).toBe(1)
      expect(n).toEqual([0.6, 0.8, 0])
    })

    it('does not divide by zero for the zero vector', () => {
      const n = vec3.normalize([0, 0, 0])
      expect(n).toEqual([0, 0, 0])
    })
  })
})

describe('mat4.identity', () => {
  it('produces the 4x4 identity matrix', () => {
    const m = mat4.identity()
    // prettier-ignore
    expect(Array.from(m)).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])
  })

  it('writes into the provided out buffer', () => {
    const out = new Float32Array(16)
    const m = mat4.identity(out)
    expect(m).toBe(out)
  })

  it('is a multiplicative identity', () => {
    const i = mat4.identity()
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    const result = mat4.multiply(i, a)
    expect(Array.from(result)).toEqual(Array.from(a))

    const result2 = mat4.multiply(a, i)
    expect(Array.from(result2)).toEqual(Array.from(a))
  })
})

describe('mat4.multiply', () => {
  it('produces the correct product for two simple matrices', () => {
    // Translation by (1,0,0)
    const tx = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1])
    // Translation by (0,1,0)
    const ty = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1])
    const result = mat4.multiply(tx, ty)
    // Transforming origin by result should give (1,1,0)
    const transformed = mat4.transformPoint(result, [0, 0, 0])
    expect(transformed.slice(0, 3)).toEqual([1, 1, 0])
  })
})

describe('mat4.transformPoint', () => {
  it('returns the input point with w=1 for the identity', () => {
    const m = mat4.identity()
    expect(mat4.transformPoint(m, [2, 3, 4])).toEqual([2, 3, 4, 1])
  })

  it('applies a translation correctly', () => {
    const t = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, -2, 7, 1])
    expect(mat4.transformPoint(t, [1, 1, 1])).toEqual([6, -1, 8, 1])
  })
})

describe('mat4.perspective', () => {
  it('produces a matrix with the expected structure', () => {
    const m = mat4.perspective(Math.PI / 2, 1, 1, 100)
    // For fov=PI/2, aspect=1: f=1, so m[0]=m[5]=1
    expect(approx(m[0])).toBe(1)
    expect(approx(m[5])).toBe(1)
    // Perspective row: m[11] = -1
    expect(m[11]).toBe(-1)
    // m[15] = 0 for true perspective
    expect(m[15]).toBe(0)
  })

  it('maps the near plane to -1 and far plane to +1 in NDC (z-axis)', () => {
    const near = 1
    const far = 100
    const m = mat4.perspective(Math.PI / 2, 1, near, far)
    // Point on the near plane (z = -near in view space).
    const onNear = mat4.transformPoint(m, [0, 0, -near])
    expect(approx(onNear[2] / onNear[3])).toBe(-1)
    const onFar = mat4.transformPoint(m, [0, 0, -far])
    expect(approx(onFar[2] / onFar[3])).toBe(1)
  })
})

describe('mat4.lookAt', () => {
  it('places the eye at the origin in view space', () => {
    const eye: [number, number, number] = [0, 0, 5]
    const m = mat4.lookAt(eye, [0, 0, 0], [0, 1, 0])
    const transformed = mat4.transformPoint(m, eye)
    expect(approx(transformed[0])).toBe(0)
    expect(approx(transformed[1])).toBe(0)
    expect(approx(transformed[2])).toBe(0)
  })

  it('places the target on the negative z-axis (camera forward)', () => {
    const m = mat4.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const transformed = mat4.transformPoint(m, [0, 0, 0])
    // Camera looks toward target along -z in view space.
    expect(approx(transformed[2])).toBeLessThan(0)
  })
})

describe('rotateAroundAxis', () => {
  it('returns the input point unchanged for a zero angle', () => {
    const p: [number, number, number] = [1, 2, 3]
    const out = rotateAroundAxis(p, [0, 1, 0], 0)
    expect(out.map(approx)).toEqual(p)
  })

  it('rotates (1,0,0) by 90° around Y to (0,0,-1)', () => {
    const out = rotateAroundAxis([1, 0, 0], [0, 1, 0], Math.PI / 2)
    expect(out.map((v) => approx(v))).toEqual([0, 0, -1])
  })

  it('rotates (1,0,0) by 180° around Z to (-1,0,0)', () => {
    const out = rotateAroundAxis([1, 0, 0], [0, 0, 1], Math.PI)
    expect(out.map((v) => approx(v))).toEqual([-1, 0, 0])
  })

  it('preserves vector length', () => {
    const original = vec3.length([3, 1, 2])
    const rotated = rotateAroundAxis([3, 1, 2], [1, 1, 1], 1.7)
    expect(approx(vec3.length(rotated))).toBe(approx(original))
  })

  it('normalizes a non-unit axis automatically', () => {
    const a = rotateAroundAxis([1, 0, 0], [0, 1, 0], Math.PI / 2)
    const b = rotateAroundAxis([1, 0, 0], [0, 5, 0], Math.PI / 2)
    expect(a.map(approx)).toEqual(b.map(approx))
  })
})
