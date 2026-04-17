import { describe, expect, it } from 'vitest'

import { ProjectSettingsSchema } from '../project'

describe('ProjectSettingsSchema', () => {
  it('defaults restrictWritesToProjectRoot to true', () => {
    const parsed = ProjectSettingsSchema.parse({})
    expect(parsed.restrictWritesToProjectRoot).toBe(true)
  })

  it('accepts an explicit false', () => {
    const parsed = ProjectSettingsSchema.parse({ restrictWritesToProjectRoot: false })
    expect(parsed.restrictWritesToProjectRoot).toBe(false)
  })

  it('preserves unknown keys (loose)', () => {
    const parsed = ProjectSettingsSchema.parse({ futureSetting: 42 }) as {
      restrictWritesToProjectRoot: boolean
      futureSetting?: number
    }
    expect(parsed.futureSetting).toBe(42)
  })
})
