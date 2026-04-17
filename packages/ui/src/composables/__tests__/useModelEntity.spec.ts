import type { Model } from '@xomda/model'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useModelEntity, useModelEnum } from '../useModelEntity'

const makeModel = (): Model => ({
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Test',
  version: '1.0.0',
  packages: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'root',
      packages: [
        {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'nested',
          packages: [],
          enums: [
            {
              id: '00000000-0000-0000-0000-000000000010',
              name: 'NestedEnum',
              values: [{ id: '00000000-0000-0000-0000-000000000011', name: 'A' }],
            },
          ],
          entities: [
            {
              id: '00000000-0000-0000-0000-000000000020',
              name: 'NestedEntity',
              attributes: [],
            },
          ],
        },
      ],
      enums: [],
      entities: [
        {
          id: '00000000-0000-0000-0000-000000000030',
          name: 'TopEntity',
          attributes: [],
        },
      ],
    },
  ],
})

describe('useModelEntity', () => {
  it('finds an entity at the top of a package', () => {
    const model = ref<Model | null>(makeModel())
    const result = useModelEntity(model, 'TopEntity')
    expect(result.value?.name).toBe('TopEntity')
  })

  it('finds an entity in nested packages', () => {
    const model = ref<Model | null>(makeModel())
    const result = useModelEntity(model, 'NestedEntity')
    expect(result.value?.name).toBe('NestedEntity')
  })

  it('returns null when the entity is not found', () => {
    const model = ref<Model | null>(makeModel())
    const result = useModelEntity(model, 'Nonexistent')
    expect(result.value).toBeNull()
  })

  it('returns null when the model is null', () => {
    const model = ref<Model | null>(null)
    const result = useModelEntity(model, 'TopEntity')
    expect(result.value).toBeNull()
  })

  it('reacts to model changes', () => {
    const model = ref<Model | null>(null)
    const result = useModelEntity(model, 'TopEntity')
    expect(result.value).toBeNull()
    model.value = makeModel()
    expect(result.value?.name).toBe('TopEntity')
  })

  it('reacts to name changes', () => {
    const model = ref<Model | null>(makeModel())
    const name = ref('TopEntity')
    const result = useModelEntity(model, name)
    expect(result.value?.name).toBe('TopEntity')
    name.value = 'NestedEntity'
    expect(result.value?.name).toBe('NestedEntity')
  })
})

describe('useModelEnum', () => {
  it('finds an enum in nested packages', () => {
    const model = ref<Model | null>(makeModel())
    const result = useModelEnum(model, 'NestedEnum')
    expect(result.value?.values.map((v) => v.name)).toEqual(['A'])
  })

  it('returns null when not found', () => {
    const model = ref<Model | null>(makeModel())
    const result = useModelEnum(model, 'Missing')
    expect(result.value).toBeNull()
  })
})
