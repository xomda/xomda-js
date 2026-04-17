import type { Vec3 } from '@xomda/util'

import type { FieldFunction, FieldParams } from './particleField'

export interface ParticleStepParams {
  /** dt in seconds (already scaled by animationSpeed). */
  dt: number
  gravity: Vec3
  damping: number
  springStrength: number
  /** World-space pointer position (e.g. unprojected to z=0). null when inactive. */
  pointer: Vec3 | null
  pointerStrength: number
  pointerRadius: number
  /** Drops to apply this frame (consumed). */
  drops: { worldPos: Vec3; mass: number; velocity: number; radius: number }[]
}

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Stores particle physics state in flat Float32Arrays for cache-friendly stepping
 * and zero-copy uploads to WebGL. The packed `gpuData` array is laid out as
 * `[x, y, z, baseBrightness, phase]` per particle (5 floats, stride 20 bytes).
 */
export class ParticleSystem {
  count: number
  positions: Float32Array
  velocities: Float32Array
  restPos: Float32Array
  /** Interleaved upload buffer: 5 floats per particle. */
  gpuData: Float32Array

  constructor(count: number, generator: FieldFunction, params: FieldParams, seed: number) {
    this.count = count
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.restPos = new Float32Array(count * 3)
    this.gpuData = new Float32Array(count * 5)
    this.generate(generator, params, seed)
  }

  generate(generator: FieldFunction, params: FieldParams, seed: number): void {
    const r = (s: number) => rand(s + seed * 1009)
    for (let i = 0; i < this.count; i++) {
      const p = generator(i, this.count, params, r)
      const o3 = i * 3
      const o5 = i * 5
      this.positions[o3] = p[0]
      this.positions[o3 + 1] = p[1]
      this.positions[o3 + 2] = p[2]
      this.restPos[o3] = p[0]
      this.restPos[o3 + 1] = p[1]
      this.restPos[o3 + 2] = p[2]
      this.velocities[o3] = 0
      this.velocities[o3 + 1] = 0
      this.velocities[o3 + 2] = 0
      this.gpuData[o5] = p[0]
      this.gpuData[o5 + 1] = p[1]
      this.gpuData[o5 + 2] = p[2]
      this.gpuData[o5 + 3] = 0.5 + r(i * 17.3) * 0.5
      this.gpuData[o5 + 4] = r(i * 23.7) * Math.PI * 2
    }
  }

  step(s: ParticleStepParams): void {
    const dt = s.dt
    const damp = Math.pow(s.damping, Math.max(1, dt * 60))
    const k = s.springStrength
    const gx = s.gravity[0]
    const gy = s.gravity[1]
    const gz = s.gravity[2]

    const px = s.pointer?.[0] ?? 0
    const py = s.pointer?.[1] ?? 0
    const pz = s.pointer?.[2] ?? 0
    const pActive = s.pointer !== null
    const pStrength = s.pointerStrength
    const pRadius = s.pointerRadius
    const pRadiusSq = pRadius * pRadius

    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      let vx = this.velocities[o]
      let vy = this.velocities[o + 1]
      let vz = this.velocities[o + 2]
      const x = this.positions[o]
      const y = this.positions[o + 1]
      const z = this.positions[o + 2]

      // Spring back to rest position
      vx += (this.restPos[o] - x) * k * dt
      vy += (this.restPos[o + 1] - y) * k * dt
      vz += (this.restPos[o + 2] - z) * k * dt

      // Gravity
      vx += gx * dt
      vy += gy * dt
      vz += gz * dt

      // Pointer repulsion (world-space, falling off with distance squared)
      if (pActive) {
        const dx = x - px
        const dy = y - py
        const dz = z - pz
        const dSq = dx * dx + dy * dy + dz * dz + 0.01
        if (dSq < pRadiusSq) {
          const f = (pStrength * (1 - Math.sqrt(dSq) / pRadius)) / dSq
          vx += dx * f * dt
          vy += dy * f * dt
          vz += dz * f * dt
        }
      }

      // Drops (single-frame impulses, but cheap to walk per particle since count is small)
      for (let d = 0; d < s.drops.length; d++) {
        const drop = s.drops[d]
        const dx = x - drop.worldPos[0]
        const dy = y - drop.worldPos[1]
        const dz = z - drop.worldPos[2]
        const dSq = dx * dx + dy * dy + dz * dz + 0.001
        if (dSq < drop.radius * drop.radius) {
          const dist = Math.sqrt(dSq)
          const impulse = (drop.velocity * drop.mass) / (1 + dSq)
          vx += (dx / dist) * impulse
          vy += (dy / dist) * impulse
          vz += (dz / dist) * impulse
        }
      }

      // Damping + integrate
      vx *= damp
      vy *= damp
      vz *= damp
      this.velocities[o] = vx
      this.velocities[o + 1] = vy
      this.velocities[o + 2] = vz
      const nx = x + vx * dt
      const ny = y + vy * dt
      const nz = z + vz * dt
      this.positions[o] = nx
      this.positions[o + 1] = ny
      this.positions[o + 2] = nz

      // Sync the position channels of the GPU buffer (brightness + phase are static)
      const g = i * 5
      this.gpuData[g] = nx
      this.gpuData[g + 1] = ny
      this.gpuData[g + 2] = nz
    }
  }
}
