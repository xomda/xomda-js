import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: string
  confirmVariant?: 'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain'
  persistent?: boolean
  action?: () => Promise<void>
}

interface ConfirmState {
  open: boolean
  loading: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  confirmColor: string
  confirmVariant: 'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain'
  persistent: boolean
}

const initialState = (): ConfirmState => ({
  open: false,
  loading: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmColor: 'primary',
  confirmVariant: 'tonal',
  persistent: false,
})

const state = reactive<ConfirmState>(initialState())

let pendingResolve: ((value: boolean) => void) | null = null
let pendingAction: (() => Promise<void>) | null = null

function resolve(value: boolean) {
  const r = pendingResolve
  pendingResolve = null
  pendingAction = null
  state.open = false
  state.loading = false
  if (r) r(value)
}

async function onConfirm() {
  if (state.loading) return
  if (pendingAction) {
    state.loading = true
    try {
      await pendingAction()
      resolve(true)
    } catch (e) {
      state.loading = false
      throw e
    }
  } else {
    resolve(true)
  }
}

function onCancel() {
  if (state.loading) return
  resolve(false)
}

function onUpdateModelValue(value: boolean) {
  if (value) return
  if (state.loading) return
  resolve(false)
}

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    if (pendingResolve) {
      pendingResolve(false)
      pendingResolve = null
      pendingAction = null
    }
    state.title = options.title
    state.message = options.message ?? ''
    state.confirmLabel = options.confirmLabel ?? 'Confirm'
    state.cancelLabel = options.cancelLabel ?? 'Cancel'
    state.confirmColor = options.confirmColor ?? 'primary'
    state.confirmVariant = options.confirmVariant ?? 'tonal'
    state.persistent = options.persistent ?? false
    state.loading = false
    state.open = true
    pendingAction = options.action ?? null
    return new Promise<boolean>((res) => {
      pendingResolve = res
    })
  }

  return { confirm }
}

export const __confirmInternals = {
  state,
  onConfirm,
  onCancel,
  onUpdateModelValue,
}
