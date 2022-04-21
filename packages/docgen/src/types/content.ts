import { Group, Parameter, Signature, Source } from './common'

export type Declaration = {
  id: number
  name: string
  kind: number
  kindString: string
  flags: Record<string, any>
  children?: Array<Parameter>
  groups?: Array<Group>
  sources?: Array<Source>
  signatures?: Array<Signature>
}

export type ReferenceType = {
  id?: number
  name: string
  type: 'reference'
  /**
   * This is populated only if an external type is referred such as Omit, Pick,
   * React, etc.
   */
  qualifiedName?: string
  /**
   * This is populated only if an external type is referred such as Omit, Pick,
   * React, etc.
   */
  package?: string
  /**
   * This is populated only if a type accepts generic parameters.
   */
  typeArguments?: Array<
    | LiteralType
    | ReferenceType
    | IntrinsicType
    | QueryType
    | ArrayType
    | ReflectionType
    | UnionOrIntersectionType
  >
}

export type LiteralType = {
  type: 'literal'
  value: any
}

export type QueryType = {
  type: 'query'
  queryType: ReferenceType
}

export type ReflectionType = {
  type: 'reflection'
  declaration: Declaration
}

export type IntrinsicType = {
  type: 'intrinsic'
  name: string
}

export type UnionOrIntersectionType = {
  type: 'union' | 'intersection'
  types?: Array<LiteralType | ReferenceType | IntrinsicType | ReflectionType | ArrayType>
}

export type ArrayType = {
  type: 'array'
  elementType:
    | LiteralType
    | ReferenceType
    | IntrinsicType
    | ReflectionType
    | UnionOrIntersectionType
    | ArrayType
}
