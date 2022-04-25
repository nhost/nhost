import { Ref } from 'vue'

export type RefOrValue<T> = T | Ref<T>
