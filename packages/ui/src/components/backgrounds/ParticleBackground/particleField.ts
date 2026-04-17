import type { Vec3 } from '@xomda/util'

export type FieldParams = Record<string, number>

export type FieldFunction = (
  i: number,
  total: number,
  params: FieldParams,
  rand: (s: number) => number
) => Vec3

export type FieldFunctionId =
  | 'sphere'
  | 'galaxy'
  | 'torus'
  | 'lattice'
  | 'wave'
  | 'noise'
  | 'lorenz'

const TAU = Math.PI * 2

const sphere: FieldFunction = (i, n, p) => {
  const radius = p.radius ?? 1.5
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  ]
}

const galaxy: FieldFunction = (i, n, p, rand) => {
  const arms = Math.max(1, Math.round(p.arms ?? 4))
  const tightness = p.tightness ?? 0.6
  const radius = p.radius ?? 2.5
  const t = (i + 1) / n
  const arm = i % arms
  const r = Math.sqrt(t) * radius
  const swirl = (arm / arms) * TAU + r * tightness * 3 + (rand(i * 1.7) - 0.5) * 0.4
  const y = (rand(i * 7.13) - 0.5) * 0.4 * (1 - t)
  return [r * Math.cos(swirl), y, r * Math.sin(swirl)]
}

const torus: FieldFunction = (i, n, p, rand) => {
  const R = p.radius ?? 2
  const r = p.tube ?? 0.6
  const u = (i / n) * TAU * (p.coils ?? 1)
  const v = rand(i * 3.7) * TAU
  return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]
}

const lattice: FieldFunction = (i, n, p) => {
  const size = p.size ?? 3
  const side = Math.max(2, Math.round(Math.cbrt(n)))
  const x = i % side
  const y = Math.floor(i / side) % side
  const z = Math.floor(i / (side * side)) % side
  const step = size / (side - 1)
  return [-size / 2 + x * step, -size / 2 + y * step, -size / 2 + z * step]
}

const wave: FieldFunction = (i, n, p) => {
  const size = p.size ?? 4
  const amplitude = p.amplitude ?? 0.6
  const frequency = p.frequency ?? 1.5
  const side = Math.max(2, Math.round(Math.sqrt(n)))
  const x = i % side
  const z = Math.floor(i / side)
  const px = -size / 2 + (x / (side - 1)) * size
  const pz = -size / 2 + (z / (side - 1)) * size
  const py = Math.sin(px * frequency) * Math.cos(pz * frequency) * amplitude
  return [px, py, pz]
}

const noise: FieldFunction = (i, _n, p, rand) => {
  const size = p.size ?? 3
  return [(rand(i * 1.7) - 0.5) * size, (rand(i * 3.1) - 0.5) * size, (rand(i * 5.9) - 0.5) * size]
}

const lorenz: FieldFunction = (i, _n, p, rand) => {
  // Sample points along the Lorenz attractor, deterministic per index.
  const sigma = p.sigma ?? 10
  const rho = p.rho ?? 28
  const beta = p.beta ?? 8 / 3
  const dt = p.dt ?? 0.01
  const scale = p.scale ?? 0.04
  let x = 0.1 + (rand(i * 0.13) - 0.5) * 0.05
  let y = 0
  let z = 0
  const steps = 20 + (i % 200)
  for (let s = 0; s < steps; s++) {
    const dx = sigma * (y - x)
    const dy = x * (rho - z) - y
    const dz = x * y - beta * z
    x += dx * dt
    y += dy * dt
    z += dz * dt
  }
  return [x * scale, (y - 25) * scale, z * scale - 1]
}

export const fields: Record<FieldFunctionId, FieldFunction> = {
  sphere,
  galaxy,
  torus,
  lattice,
  wave,
  noise,
  lorenz,
}

export function resolveField(input: FieldFunctionId | FieldFunction | undefined): FieldFunction {
  if (typeof input === 'function') return input
  if (input && input in fields) return fields[input]
  return fields.galaxy
}
