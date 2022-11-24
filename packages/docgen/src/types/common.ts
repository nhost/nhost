import {
  ArrayType,
  IntrinsicType,
  LiteralType,
  QueryType,
  ReferenceType,
  ReflectionType,
  UnionOrIntersectionType
} from './content'

/**
 * Available types for a property.
 */
type AvailableTypes =
  | UnionOrIntersectionType
  | ReferenceType
  | ReflectionType
  | IntrinsicType
  | LiteralType
  | QueryType
  | ArrayType

export type CommentTag = {
  tag: string
  text: string
}

export type Group = {
  title: string
  kind: number
  children: Array<number>
  categories?: Array<{ title: string; children: Array<number> }>
}

export type Source = {
  fileName: string
  line: number
  character: number
}

export type Comment = {
  shortText?: string
  text?: string
  returns?: string
  tags?: Array<CommentTag>
}

export type Parameter = {
  id: number
  name: string
  originalName?: string
  kind: number
  kindString: string
  flags: Record<string, any>
  type: AvailableTypes
  sources?: Array<Source>
  comment?: Comment
  children?: Array<Parameter>
  parameters?: Array<Parameter>
  signatures?: Array<Signature>
}

export type Signature<TChildren = Parameter> = {
  id: number
  name: string
  kind: number
  kindString: string
  flags: Record<string, any>
  sources?: Array<Source>
  signatures?: Array<Signature<TChildren>>
  getSignature?: Array<Signature<TChildren>>
  setSignature?: Array<Signature<TChildren>>
  parameters?: Array<Parameter>
  comment?: Comment
  type?:
    | UnionOrIntersectionType
    | ReferenceType
    | ReflectionType
    | IntrinsicType
    | LiteralType
    | QueryType
    | ArrayType
  children?: Array<TChildren>
  groups?: Array<Group>
  extendedBy?: Array<AvailableTypes>
}

export type ClassSignature = Signature<Signature>
