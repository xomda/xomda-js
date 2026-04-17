import { defineComponent, onUnmounted, ref, watch } from 'vue'
import { VBtn } from 'vuetify/components'

import styles from './PreferencesActionsBar.module.scss'
import { usePreferencesContext } from './usePreferencesEditor'

/**
 * Sticky footer with Cancel + Save that drives the whole Preferences page.
 * Sits at the bottom of the right pane, with the content scrolling under
 * it so the user always has the actions at hand.
 *
 * "Apply" is intentionally not a separate button: there is no modal to
 * close, so Save and Apply would behave identically. Save here stays on
 * the page after persisting — it's both.
 */
export const PreferencesActionsBar = defineComponent({
  name: 'PreferencesActionsBar',
  setup() {
    const editor = usePreferencesContext()
    const justSaved = ref(false)
    // Tracked so the 2,500ms "Saved." flash doesn't write to a disposed
    // ref if the user navigates away from /settings mid-flash. `number` is
    // the DOM return type (window.setTimeout); @types/node's overlapping
    // declaration would otherwise narrow this to NodeJS.Timeout.
    let savedFlashHandle: number | null = null

    // Brief "Saved" confirmation; the watch fires on the dirty→clean transition
    // that follows a successful save (not when the user reverts via Cancel,
    // because revert restores the initial draft without going through save()).
    watch(editor.saving, (nowSaving, wasSaving) => {
      if (wasSaving && !nowSaving) {
        justSaved.value = true
        if (savedFlashHandle !== null) clearTimeout(savedFlashHandle)
        savedFlashHandle = window.setTimeout(() => {
          justSaved.value = false
          savedFlashHandle = null
        }, 2500)
      }
    })

    onUnmounted(() => {
      if (savedFlashHandle !== null) {
        clearTimeout(savedFlashHandle)
        savedFlashHandle = null
      }
    })

    const onCancel = () => {
      editor.revert()
    }

    const onSave = async () => {
      if (!editor.dirty.value || editor.saving.value) return
      await editor.save()
    }

    return () => (
      <div class={styles.bar} role="region" aria-label="Preferences actions">
        <span
          class={[
            styles.status,
            editor.dirty.value && styles.dirty,
            justSaved.value && !editor.dirty.value && styles.saved,
          ]}
        >
          {editor.dirty.value
            ? 'Unsaved changes'
            : justSaved.value
              ? 'Saved.'
              : 'All changes saved'}
        </span>
        <VBtn
          variant="text"
          onClick={onCancel}
          disabled={!editor.dirty.value || editor.saving.value}
        >
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          onClick={onSave}
          disabled={!editor.dirty.value || editor.saving.value}
          loading={editor.saving.value}
        >
          Save
        </VBtn>
      </div>
    )
  },
})
