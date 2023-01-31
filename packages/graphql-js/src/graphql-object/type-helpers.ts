import { Split, Join, EmptyObject } from 'type-fest'

export type StripImpossibleProperties<T> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends never ? never : Key }[keyof T]
>

export type UnwrapNullableArray<T> = NonNullable<T extends (infer E)[] ? E : T>
export type UnwrapArray<T> = T extends (infer E)[] ? E : NonNullable<T>

export type WrapArray<T, U> = NonNullable<T> extends any[] ? U[] : U

/** Omit all the optional fields of the type */
type OmitOptionalFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K]
}

export type MakeOptional<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K]
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}

/** Select only the properties of the object that matches the second generic argument */
export type Select<T, K extends keyof any> = Pick<T, Extract<keyof T, K>>

/** Gets the main GraphQL type from a GraphQL argument type e.g. `[string!]!` returns `string` */
export type GraphQLPredicate<GQLType extends string> = GQLType extends `${infer S}!`
  ? GraphQLPredicate<S>
  : GQLType extends `[${infer S}]`
  ? GraphQLPredicate<S>
  : GQLType

export type ToUnion<T> = T[keyof T]

type CapitalizeEach<T> = T extends [infer I, ...infer R]
  ? I extends string
    ? [Capitalize<I>, ...CapitalizeEach<R>]
    : []
  : []

/** Transform `a_string_type` to `A_String_Type`  */
export type CapitalizeSnakeCase<T extends string> = Join<CapitalizeEach<Split<T, '_'>>, '_'>

type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
type OptionalKeys<T> = { [K in keyof T]: {} extends Pick<T, K> ? never : K }[keyof T]

export type RequiredWhenChildrenAreRequired<key extends string, T> = RequiredKeys<T> extends never
  ? OptionalKeys<T> extends never
    ? EmptyObject
    : { [k in key]?: T }
  : { [k in key]: T }

export type PickFirstTupleItemThatExtends<T, U> = Readonly<T> extends Readonly<
  [infer I, ...infer Rest]
>
  ? I extends U
    ? I
    : PickFirstTupleItemThatExtends<Rest, U>
  : never

export type IsTrueOrHasOnlyOptionals<T> = T extends true
  ? true
  : keyof OmitOptionalFields<T> extends never
  ? true
  : false
