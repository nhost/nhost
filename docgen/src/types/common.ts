import {
  ArrayType,
  IntrinsicType,
  LiteralType,
  QueryType,
  ReferenceType,
  ReflectionType,
  UnionOrIntersectionType
} from './content'

export type CommentTag = {
  tag: string
  text: string
}

export type Group = {
  title: string
  kind: number
  children: Array<number>
}

export type Source = {
  fileName: string
  line: number
  character: number
}

export type Declaration = {
  id: number
  name: string
  kind: number
  kindString: string
  flags: Record<string, any>
  children: Array<Parameter>
  groups?: Array<Group>
  sources?: Array<Source>
}

export type GeneralType = {
  id?: number
  type: string
  name: string
}

export type Comment = {
  shortText: string
  returns?: string
  tags?: Array<CommentTag>
}

export type Parameter = {
  id: number
  name: string
  kind: number
  kindString: string
  flags: Record<string, any>
  type:
    | UnionOrIntersectionType
    | ReferenceType
    | ReflectionType
    | IntrinsicType
    | LiteralType
    | QueryType
    | ArrayType
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
  signatures: Array<Signature<TChildren>>
  sources: Array<Source>
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
}

export type ClassSignature = Signature<Signature>
