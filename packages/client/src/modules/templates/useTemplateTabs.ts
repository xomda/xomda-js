import type { Template } from '@xomda/template'
import type { EditBuffer } from '@xomda/ui'
import { useEditBuffer } from '@xomda/ui'
import type { ComputedRef, Ref } from 'vue'
import { computed, markRaw, ref, shallowRef } from 'vue'

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
  // `shallowRef` (not `ref`) so Vue does not deep-walk the array and unwrap
  // each tab's nested `EditBuffer<Template>` refs into plain values. The
  // consequence is that mutations must replace `.value` with a new array
  // (push/splice in place would not trigger reactivity). Each buffer's own
  // refs continue to drive reactivity inside the tab.
  const tabs: Ref<OpenTemplateTab[]> = shallowRef([])
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
    // markRaw keeps the buffer object opaque to Vue's reactivity system —
    // the individual refs (`draft`, `dirty`, …) stay independently reactive,
    // which is how dirty tracking continues to work after the tab is stored.
    tabs.value = [...tabs.value, { uuid: template.uuid, buffer: markRaw(buffer) }]
    activeUuid.value = template.uuid
  }

  function removeTab(uuid: string): void {
    const idx = tabs.value.findIndex((t) => t.uuid === uuid)
    if (idx < 0) return
    const next = tabs.value.filter((_, i) => i !== idx)
    tabs.value = next
    if (activeUuid.value === uuid) {
      activeUuid.value = next[idx]?.uuid ?? next[idx - 1]?.uuid ?? null
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
