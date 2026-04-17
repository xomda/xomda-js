import { reactive } from 'vue'

export interface PromptOptions {
  title: string
  message?: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: string
  validate?: (value: string) => string | null
  action?: (value: string) => Promise<void>
}

interface PromptState {
  open: boolean
  loading: boolean
  title: string
  message: string
  label: string
  placeholder: string
  value: string
  confirmLabel: string
  cancelLabel: string
  confirmColor: string
  error: string
}

const initialState = (): PromptState => ({
  open: false,
  loading: false,
  title: '',
  message: '',
  label: '',
  placeholder: '',
  value: '',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  confirmColor: 'primary',
  error: '',
})

const state = reactive<PromptState>(initialState())

let pendingResolve: ((value: string | null) => void) | null = null
let pendingAction: ((value: string) => Promise<void>) | null = null
let pendingValidate: ((value: string) => string | null) | null = null

function resolve(value: string | null) {
  const r = pendingResolve
  pendingResolve = null
  pendingAction = null
  pendingValidate = null
  state.open = false
  state.loading = false
  state.error = ''
  if (r) r(value)
}

async function onConfirm() {
  if (state.loading) return
  const value = state.value
  if (pendingValidate) {
    const err = pendingValidate(value)
    if (err) {
      state.error = err
      return
    }
  }
  if (pendingAction) {
    state.loading = true
    state.error = ''
    try {
      await pendingAction(value)
      resolve(value)
    } catch (e) {
      state.loading = false
      state.error = e instanceof Error ? e.message : String(e)
    }
  } else {
    resolve(value)
  }
}

function onCancel() {
  if (state.loading) return
  resolve(null)
}

function onUpdateModelValue(value: boolean) {
  if (value) return
  if (state.loading) return
  resolve(null)
}

function onUpdateValue(value: string) {
  state.value = value
  if (state.error) state.error = ''
}

export function usePrompt() {
  function prompt(options: PromptOptions): Promise<string | null> {
    if (pendingResolve) {
      pendingResolve(null)
      pendingResolve = null
      pendingAction = null
      pendingValidate = null
    }
    state.title = options.title
    state.message = options.message ?? ''
    state.label = options.label ?? ''
    state.placeholder = options.placeholder ?? ''
    state.value = options.initialValue ?? ''
    state.confirmLabel = options.confirmLabel ?? 'OK'
    state.cancelLabel = options.cancelLabel ?? 'Cancel'
    state.confirmColor = options.confirmColor ?? 'primary'
    state.error = ''
    state.loading = false
    state.open = true
    pendingAction = options.action ?? null
    pendingValidate = options.validate ?? null
    return new Promise<string | null>((res) => {
      pendingResolve = res
    })
  }

  return { prompt }
}

export const __promptInternals = {
  state,
  onConfirm,
  onCancel,
  onUpdateModelValue,
  onUpdateValue,
}
