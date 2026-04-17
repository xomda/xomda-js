import type { Template } from '@xomda/template'
import { type EditBuffer, useEditBuffer } from '@xomda/ui'
import { computed, type ComputedRef, markRaw, type Ref, ref } from 'vue'

export interface OpenTemplateTab {
  uuid: string
  buffer: EditBuffer<Template>
}

export interface UseTemplateTabs {
  /** Open tabs in display order. Source of truth for the tab strip. */
  tabs: Ref<OpenTemplateTab[]>
  /** UUID of the currently focused tab, or null when no tab is open. */
  activeUuid: Ref<string | null>
  activeTab: ComputedRef<OpenTemplateTab | null>
  activeBuffer: ComputedRef<EditBuffer<Template> | null>
  /**
   * Open a template. If a tab for its uuid already exists, focus it and
   * (when clean) re-baseline its buffer to the incoming server copy.
   * If the existing tab is dirty, baseline-only update so the draft survives.
   */
  openTab(template: Template): void
  /** Remove a tab by uuid (unchecked — caller is responsible for any prompt). */
  removeTab(uuid: string): void
  /**
   * Reconcile an open tab with a server-side change (post-save, rename, move).
   * Clean tab: full `set`. Dirty tab: `setBaselineOnly` so revert targets the
   * latest server truth without clobbering the draft.
   */
  syncFromServer(template: Template): void
  /** Close the tab for a deleted template. No-op when no matching tab is open. */
  closeDeletedTemplate(uuid: string): void
}

/**
 * Per-template edit buffers, keyed by uuid, with a single focused tab.
 *
 * Each tab owns its own `useEditBuffer<Template>` so dirty tracking and
 * revert work independently — closing a clean tab never prompts; closing
 * a dirty tab is the caller's decision (typically gated by
 * `useUnsavedChangesPrompt`).
 *
 * Active-tab fallback on `removeTab`: next sibling, then previous, then
 * `null`. Simple positional rule — VS Code's MRU rule is deliberately not
 * implemented until a user actually asks for it.
 */
export function useTemplateTabs(): UseTemplateTabs {
  // Cast prevents Vue's deep unwrap from flattening the nested EditBuffer
  // `Ref`s into plain values when stored inside the array ref. Same pattern
  // as useEditBuffer.ts. We rely on array reactivity (push/splice) only;
  // each buffer's own refs continue to drive reactivity inside the tab.
  const tabs = ref<OpenTemplateTab[]>([]) as unknown as Ref<OpenTemplateTab[]>
  const activeUuid = ref<string | null>(null)

  const activeTab = computed<OpenTemplateTab | null>(
    () => tabs.value.find((t) => t.uuid === activeUuid.value) ?? null
  )
  const activeBuffer = computed<EditBuffer<Template> | null>(() => activeTab.value?.buffer ?? null)

  function openTab(template: Template): void {
    const existing = tabs.value.find((t) => t.uuid === template.uuid)
    if (existing) {
      // Switching to an already-open tab. Refresh baseline from the incoming
      // server copy: clean → full set (no edits to preserve); dirty → only
      // baseline so the draft survives. This keeps a switched-to tab in sync
      // with the server without surprising the user.
      if (existing.buffer.dirty.value) existing.buffer.setBaselineOnly(template)
      else existing.buffer.set(template)
      activeUuid.value = template.uuid
      return
    }
    const buffer = useEditBuffer<Template>()
    buffer.set(template)
    // markRaw keeps the buffer object opaque to Vue's reactivity system, so
    // its inner `Ref`s aren't auto-unwrapped when the tab is stored inside
    // a reactive array. The individual refs (`draft`, `dirty`, …) stay
    // independently reactive — that's how dirty tracking continues to work.
    tabs.value.push({ uuid: template.uuid, buffer: markRaw(buffer) })
    activeUuid.value = template.uuid
  }

  function removeTab(uuid: string): void {
    const idx = tabs.value.findIndex((t) => t.uuid === uuid)
    if (idx < 0) return
    tabs.value.splice(idx, 1)
    if (activeUuid.value === uuid) {
      activeUuid.value = tabs.value[idx]?.uuid ?? tabs.value[idx - 1]?.uuid ?? null
    }
  }

  function syncFromServer(template: Template): void {
    const tab = tabs.value.find((t) => t.uuid === template.uuid)
    if (!tab) return
    if (tab.buffer.dirty.value) tab.buffer.setBaselineOnly(template)
    else tab.buffer.set(template)
  }

  function closeDeletedTemplate(uuid: string): void {
    removeTab(uuid)
  }

  return {
    tabs,
    activeUuid,
    activeTab,
    activeBuffer,
    openTab,
    removeTab,
    syncFromServer,
    closeDeletedTemplate,
  }
}
