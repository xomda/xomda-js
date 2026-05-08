import type { InjectionKey, Ref } from 'vue'

export const CONTAINER_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol('xomda-container-el')
