import type { Template } from '@xomda/template'
import { createCellInstance, createExecutionContext } from '@xomda/template'
import type { CellInstance } from '@xomda/template'
import { debounce } from 'lodash-es'
import { type MaybeRefOrGetter, onUnmounted, reactive, shallowRef, toValue, watch } from 'vue'

import { trpc } from '../trpc'

type Model = Awaited<ReturnType<typeof trpc.model.get.query>>
type AllTemplates = Awaited<ReturnType<typeof trpc.template.list.query>>

function resolveInheritance(
  template: Template,
  all: AllTemplates,
  visited = new Set<string>()
): Template {
  if (!template.extends || visited.has(template.uuid)) return template
  visited.add(template.uuid)
  const parent = all.find((t) => t.uuid === template.extends)
  if (!parent) return template
  const resolvedParent = resolveInheritance(parent, all, visited)
  return { ...template, cells: [...resolvedParent.cells, ...template.cells] }
}

export function useTemplatePreview(template: MaybeRefOrGetter<Template | null>) {
  const instances = shallowRef<CellInstance[]>([])
  let model: Model | null = null
  let allTemplates: AllTemplates | null = null

  async function getModel(): Promise<Model> {
    if (!model) {
      model = await trpc.model.get.query()
    }
    return model
  }

  async function getAllTemplates(): Promise<AllTemplates> {
    if (!allTemplates) {
      allTemplates = await trpc.template.list.query()
    }
    return allTemplates
  }

  async function runPreview() {
    const t = toValue(template)
    if (!t) {
      instances.value = []
      return
    }
    try {
      const [m, all] = await Promise.all([getModel(), getAllTemplates()])
      const resolved = resolveInheritance(t, all)

      const newInstances = resolved.cells.map(
        (cell) => reactive(createCellInstance(cell)) as CellInstance
      )
      instances.value = newInstances

      const execCtx = createExecutionContext(resolved, m)
      for (const inst of newInstances) {
        await inst.execute(execCtx)
      }
    } catch {
      // don't clear existing output on transient errors
    }
  }

  const debouncedRun = debounce(runPreview, 300)

  const stop = watch(() => toValue(template), debouncedRun, { deep: true, immediate: true })

  onUnmounted(() => {
    stop()
    debouncedRun.cancel()
  })

  return instances
}
