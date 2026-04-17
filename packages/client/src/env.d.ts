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
      [x: `on${Capitalize<string>}`]: ((...args: any[]) => any) | undefined

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
