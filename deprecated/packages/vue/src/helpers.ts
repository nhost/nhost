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

  if (Array.isArray(result)) {
    // If the result is an array, recursively process each element.
    return result.map((value) => nestedUnref(value as NestedRefOfValue<unknown>)) as T
  } else if (result && typeof result === 'object') {
    // If the result is an object, recursively process its properties.
    return Object.entries(result).reduce(
      (aggr, [key, value]) => ({ ...aggr, [key]: nestedUnref(value as NestedRefOfValue<unknown>) }),
      {} as T
    )
  } else {
    // For non-object and non-array values, return the result as is.
    return result
  }
}
