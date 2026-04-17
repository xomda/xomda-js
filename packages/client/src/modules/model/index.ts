import { ModelIcon } from '@xomda/icons'
import { defineStore } from 'pinia'

import { registerModule } from '../registry'

/**
 * Currently-selected element in the model view. Mirrors the local
 * `useEditBuffer` state inside ModelView so other modules (notifications,
 * future tree-view, mini-toolbar) can read selection without prop-drilling
 * through the 1600-line ModelView.
 *
 * The store is intentionally minimal: just the kind + id. Loading the
 * actual data stays the model view's job.
 */
export type SelectedElementKind = 'package' | 'entity' | 'enum' | 'attribute' | 'model'
export interface SelectedElement {
  kind: SelectedElementKind
  id: string
  /** For attributes: the owning entity's id (attributes are not addressable on their own). */
  entityId?: string
}

export const useModelSelectionStore = defineStore('model-selection', {
  state: () => ({
    current: null as SelectedElement | null,
  }),
  actions: {
    select(el: SelectedElement | null) {
      this.current = el
    },
    clear() {
      this.current = null
    },
  },
})

export interface ModelModuleApi {
  selection: ReturnType<typeof useModelSelectionStore>
}

registerModule<ModelModuleApi>({
  id: 'model',
  routes: [
    {
      path: '/model',
      component: () => import('./ModelView').then(({ ModelView }) => ModelView),
    },
  ],
  nav: { icon: ModelIcon, label: 'Model', path: '/model', order: 20 },
  setup() {
    // Store factory runs inside `setup()` so Pinia is active. The returned
    // store ref is then accessible to other modules via
    // `useModule<ModelModuleApi>('model')?.selection`.
    return { selection: useModelSelectionStore() }
  },
})
