import { reactive } from 'vue'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export interface UnsavedChangesPromptOptions {
  title?: string
  message?: string
  saveLabel?: string
  discardLabel?: string
  cancelLabel?: string
  /**
   * Optional async work to run when the user picks Save. If it resolves the
   * promise resolves to `'save'`; if it throws, the dialog stays open and
   * the prompt promise rejects with the same error (mirrors `useConfirm`'s
   * action contract — callers wrap with `useMutation` to get toast + error).
   */
  saveAction?: () => Promise<void>
  /** When true, backdrop click and Escape are ignored. Default false. */
  persistent?: boolean
}

interface UnsavedChangesState {
  open: boolean
  loading: boolean
  title: string
  message: string
  saveLabel: string
  discardLabel: string
  cancelLabel: string
  persistent: boolean
}

const initialState = (): UnsavedChangesState => ({
  open: false,
  loading: false,
  title: 'Unsaved changes',
  message: 'You have unsaved changes. Save them before closing?',
  saveLabel: 'Save',
  discardLabel: 'Discard',
  cancelLabel: 'Cancel',
  persistent: false,
})

const state = reactive<UnsavedChangesState>(initialState())

let pendingResolve: ((value: UnsavedChoice) => void) | null = null
let pendingReject: ((reason: unknown) => void) | null = null
let pendingSaveAction: (() => Promise<void>) | null = null

function settle(value: UnsavedChoice) {
  const r = pendingResolve
  pendingResolve = null
  pendingReject = null
  pendingSaveAction = null
  state.open = false
  state.loading = false
  if (r) r(value)
}

async function onSave() {
  if (state.loading) return
  if (pendingSaveAction) {
    state.loading = true
    try {
      await pendingSaveAction()
      settle('save')
    } catch (e) {
      state.loading = false
      const reject = pendingReject
      pendingResolve = null
      pendingReject = null
      pendingSaveAction = null
      state.open = false
      if (reject) reject(e)
      throw e
    }
  } else {
    settle('save')
  }
}

function onDiscard() {
  if (state.loading) return
  settle('discard')
}

function onCancel() {
  if (state.loading) return
  settle('cancel')
}

function onUpdateModelValue(value: boolean) {
  if (value) return
  if (state.loading) return
  // Backdrop click / Escape — treated as cancel when not persistent.
  settle('cancel')
}

export function useUnsavedChangesPrompt() {
  function promptUnsavedChanges(options: UnsavedChangesPromptOptions = {}): Promise<UnsavedChoice> {
    if (pendingResolve) {
      // A new prompt cancels the pending one.
      pendingResolve('cancel')
      pendingResolve = null
      pendingReject = null
      pendingSaveAction = null
    }
    const defaults = initialState()
    state.title = options.title ?? defaults.title
    state.message = options.message ?? defaults.message
    state.saveLabel = options.saveLabel ?? defaults.saveLabel
    state.discardLabel = options.discardLabel ?? defaults.discardLabel
    state.cancelLabel = options.cancelLabel ?? defaults.cancelLabel
    state.persistent = options.persistent ?? false
    state.loading = false
    state.open = true
    pendingSaveAction = options.saveAction ?? null
    return new Promise<UnsavedChoice>((res, rej) => {
      pendingResolve = res
      pendingReject = rej
    })
  }

  return { promptUnsavedChanges }
}

export const __unsavedChangesInternals = {
  state,
  onSave,
  onDiscard,
  onCancel,
  onUpdateModelValue,
}
