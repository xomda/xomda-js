import { describe, expect, it } from 'vitest'

import { ModelSchema } from '../model'
import { ProjectFileSchema } from '../project'

const MID = '00000000-0000-4000-8000-000000000001'
const V1 = '00000000-0000-4000-8000-aaaa00000001'

describe('G1 — per-model VersionsIndex on ModelSchema', () => {
  it('model without versions key parses as undefined', () => {
    const m = ModelSchema.parse({ id: MID, name: 'M', version: '1.0.0', packages: [] })
    expect(m.versions).toBeUndefined()
  })

  it('model with an empty versions index round-trips', () => {
    const m = ModelSchema.parse({
      id: MID,
      name: 'M',
      version: '1.0.0',
      packages: [],
      versions: { head: null, versions: [] },
    })
    expect(m.versions).toEqual({ head: null, versions: [] })
  })

  it('model with a populated versions index round-trips', () => {
    const ts = '2026-05-22T10:00:00.000Z'
    const input = {
      id: MID,
      name: 'M',
      version: '1.0.0',
      packages: [],
      versions: {
        head: V1,
        versions: [
          {
            id: V1,
            label: 'first cut',
            parent: null,
            snapshotFilename: `v-${V1}.json`,
            timestamp: ts,
          },
        ],
      },
    }
    const parsed = ModelSchema.parse(input)
    expect(parsed.versions?.head).toBe(V1)
    expect(parsed.versions?.versions[0].label).toBe('first cut')

    const reParsed = ModelSchema.parse(JSON.parse(JSON.stringify(parsed)))
    expect(reParsed.versions?.head).toBe(V1)
  })

  it('legacy project-level versions field continues to parse on ProjectFile', () => {
    const p = ProjectFileSchema.parse({
      name: 'P',
      versions: { head: null, versions: [] },
    })
    expect(p.versions).toEqual({ head: null, versions: [] })
  })

  it('a project carrying versions AND a model carrying versions both parse — they are independent fields', () => {
    const p = ProjectFileSchema.parse({
      name: 'P',
      versions: { head: null, versions: [] },
    })
    const m = ModelSchema.parse({
      id: MID,
      name: 'M',
      version: '1.0.0',
      packages: [],
      versions: { head: null, versions: [] },
    })
    expect(p.versions).toBeDefined()
    expect(m.versions).toBeDefined()
  })
})
