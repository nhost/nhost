// Gracefully poached from https://github.com/sindresorhus/type-fest
export type Split<
  S extends string,
  Delimiter extends string
> = S extends `${infer Head}${Delimiter}${infer Tail}`
  ? [Head, ...Split<Tail, Delimiter>]
  : S extends Delimiter
  ? []
  : [S]

export type Join<
  Strings extends Readonly<Array<string | number>>,
  Delimiter extends string
> = Strings extends []
  ? ''
  : Strings extends [string | number]
  ? `${Strings[0]}`
  : Strings extends readonly [string | number, ...infer Rest extends Array<string | number>]
  ? `${Strings[0]}${Delimiter}${Join<Rest, Delimiter>}`
  : string

declare const emptyObjectSymbol: unique symbol

export type EmptyObject = { [emptyObjectSymbol]?: never }

type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
  ? true
  : false
type Simplify<T> = { [KeyType in keyof T]: T[KeyType] }
type Filter<KeyType, ExcludeType> = IsEqual<KeyType, ExcludeType> extends true
  ? never
  : KeyType extends ExcludeType
  ? never
  : KeyType

type Except<ObjectType, KeysType extends keyof ObjectType> = {
  [KeyType in keyof ObjectType as Filter<KeyType, KeysType>]: ObjectType[KeyType]
}

export type RequireAtLeastOne<ObjectType, KeysType extends keyof ObjectType = keyof ObjectType> = {
  // For each `Key` in `KeysType` make a mapped type:
  [Key in KeysType]-?: Required<Pick<ObjectType, Key>> & // 1. Make `Key`'s type required
    // 2. Make all other keys in `KeysType` optional
    Partial<Pick<ObjectType, Exclude<KeysType, Key>>>
}[KeysType] &
  // 3. Add the remaining keys not in `KeysType`
  Except<ObjectType, KeysType>

export type SetRequired<BaseType, Keys extends keyof BaseType> = Simplify<
  // Pick just the keys that are optional from the base type.
  Except<BaseType, Keys> &
    // Pick the keys that should be required from the base type and make them required.
    Required<Pick<BaseType, Keys>>
>
