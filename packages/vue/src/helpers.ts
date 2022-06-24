import { Ref, unref } from 'vue'

export type RefOrValue<T> = T | Ref<T>

export type NestedRefOfValue<T> = RefOrValue<{
  [key in keyof T]: T[key] extends RefOrValue<infer Type>
    ? NestedRefOfValue<Type>
    : T[key] extends RefOrValue<infer Type>
    ? Type
    : T[key] extends object
    ? NestedRefOfValue<T[key]>
    : T[key]
}>

export const nestedUnref = <T>(input: NestedRefOfValue<T>): T => {
  const result: NestedRefOfValue<T> = unref(input)
  if (result && typeof result === 'object') {
    return Object.entries(result).reduce(
      (aggr, [key, value]) => ({ ...aggr, [key]: nestedUnref(value as NestedRefOfValue<unknown>) }),
      {} as T
    )
  } else {
    return result
  }
}
