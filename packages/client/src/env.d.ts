/// <reference types="vite/client" />

declare module '@fontsource-variable/mulish/index.css'
declare module '@fontsource-variable/source-code-pro/index.css'

declare module '@fontsource-variable/mulish' {
  const content: string
  export default content
}

declare module '@fontsource-variable/source-code-pro' {
  const content: string
  export default content
}

export {}

/**
 * Add a fix for fallthrough events
 */
declare module 'vue/jsx-runtime' {
  import type { ClassValue, StyleValue } from 'vue'

  namespace JSX {
    interface IntrinsicAttributes {
      onClick?: (event: MouseEvent) => void
      onDblclick?: (event: MouseEvent) => void
      onMousedown?: (event: MouseEvent) => void
      onMouseup?: (event: MouseEvent) => void
      onKeydown?: (event: KeyboardEvent) => void
      onKeyup?: (event: KeyboardEvent) => void
      onFocus?: (event: FocusEvent) => void
      onBlur?: (event: FocusEvent) => void
      // AGENTS.md §2: sanctioned `any` for the Vue vnode `on*` hook shim.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      [x: `on${Capitalize<string>}`]:
        | ((...args: any[]) => unknown)
        | ((...args: any[]) => unknown)[]
        | undefined
      /* eslint-enable @typescript-eslint/no-explicit-any */

      class?: ClassValue
      style?: StyleValue
    }
  }
}

declare module '@vue/runtime-dom' {
  interface MetaHTMLAttributes {
    media?: string
  }
}
