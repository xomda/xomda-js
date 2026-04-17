import type { Template } from '@xomda/template'
import type { CellInstance } from '@xomda/template'
import { createCellInstance, createExecutionContext } from '@xomda/template'
import { debounce } from 'lodash-es'
import { type MaybeRefOrGetter, onUnmounted, reactive, shallowRef, toValue, watch } from 'vue'

import { trpc } from '../trpc'

type Model = Awaited<ReturnType<typeof trpc.model.get.query>>

export function useTemplatePreview(template: MaybeRefOrGetter<Template | null>) {
  const instances = shallowRef<CellInstance[]>([])
  let model: Model | null = null

  async function getModel(): Promise<Model> {
    if (!model) {
      model = await trpc.model.get.query()
    }
    return model
  }

  async function runPreview() {
    const t = toValue(template)
    if (!t) {
      instances.value = []
      return
    }
    try {
      const m = await getModel()

      const newInstances = t.cells.map(
        (cell) => reactive(createCellInstance(cell)) as CellInstance
      )
      instances.value = newInstances

      const execCtx = createExecutionContext(t, m)
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
