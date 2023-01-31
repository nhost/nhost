import { CapitalizeSnakeCase, PickFirstTupleItemThatExtends } from './type-helpers'

export type GenericSchema = Record<string, any> & {
  introspection: Introspection
  types: Record<string, any>
}

export type OperationTypes = 'Query' | 'Mutation' | 'Subscription'

type RootOperationName<
  Schema extends GenericSchema | undefined,
  OperationType extends OperationTypes,
  capitalize extends boolean = true,
  IntrospectionSchema = Schema extends GenericSchema ? Schema['introspection']['__schema'] : never,
  IntrospectionProperty = `${Uncapitalize<OperationType>}Type`
> = Schema extends GenericSchema
  ? IntrospectionProperty extends keyof IntrospectionSchema
    ? IntrospectionSchema[IntrospectionProperty] extends { name: string }
      ? capitalize extends true
        ? CapitalizeSnakeCase<IntrospectionSchema[IntrospectionProperty]['name']>
        : IntrospectionSchema[IntrospectionProperty]['name']
      : never
    : never
  : never

export type RootOperation<
  Schema extends GenericSchema | undefined,
  OperationType extends OperationTypes,
  OperationName = RootOperationName<Schema, OperationType>
> = Schema extends GenericSchema
  ? OperationName extends string
    ? Schema['types'][OperationName] extends object
      ? Schema['types'][OperationName]
      : never
    : never
  : never

export type OperationsOf<
  Schema extends GenericSchema | undefined,
  OperationType extends OperationTypes
> = Omit<RootOperation<Schema | undefined, OperationType>, '__typename' | number | symbol>

export type FieldArgs<
  Schema extends GenericSchema,
  OperationType extends OperationTypes,
  FieldName extends string,
  Suffix extends string = `_${Capitalize<FieldName>}Args`
> = Schema['types'][`${RootOperationName<Schema, OperationType>}${Suffix}`]

export type OperationRootTypeOf<
  Schema extends GenericSchema,
  OperationType extends OperationTypes
> = SelectSingleType<
  Schema,
  { kind: 'OBJECT'; name: RootOperationName<Schema, OperationType, false> }
>

export type SelectSingleType<
  S extends GenericSchema,
  Type extends TypeRef
> = PickFirstTupleItemThatExtends<
  S['introspection']['__schema']['types'],
  Type extends { name: string }
    ? { name: Type['name']; kind: Type['kind'] }
    : { kind: Type['kind'] }
>

type MAX_RECURSION = 10 // maximum recursion depth
type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc
  : Enumerate<N, [...Acc, Acc['length']]>

type Pred = [never, ...Enumerate<MAX_RECURSION>]

// TODO remove the recursion as we know the possible type depth
export type ConcreteTypeOf<
  S extends GenericSchema,
  T extends TypeRef,
  D extends number = MAX_RECURSION
> = [D] extends [0]
  ? any
  : T extends TypeRef
  ? T extends NonNullType
    ? ConcreteTypeOf<S, T['ofType'], Pred[D]>
    : T extends ListType
    ? ConcreteTypeOf<S, T['ofType'], Pred[D]>
    : T extends ObjectType | InterfaceType | UnionType
    ? SelectSingleType<S, T>
    : T
  : never

export type Introspection = {
  __schema: {
    queryType: { name: string } | null
    mutationType: { name: string } | null
    subscriptionType: { name: string } | null
    types: Readonly<Array<TypeRef>>
    directives: Readonly<[]>
  }
}

export type InputObjectType = {
  kind: 'INPUT_OBJECT'
  name: string
  ofType?: null
  readonly inputFields?: Readonly<Array<FieldDefinition>>
}

export type ListType = {
  kind: 'LIST'
  ofType: TypeRef
}

export type NonNullType = {
  kind: 'NON_NULL'
  ofType: TypeRef
}

export type ObjectType<Name extends string = string> = {
  kind: 'OBJECT'
  name: Name
  interfaces?: Readonly<Array<unknown>>
  ofType?: null
  fields?: Readonly<Array<FieldDefinition>>
}

export type ScalarType = {
  kind: 'SCALAR'
  name: string
}

export type UnionType = {
  kind: 'UNION'
  name: string
  ofType?: null
  possibleTypes?: Readonly<Array<ObjectType | UnionType | InterfaceType>>
}

export type EnumType = {
  kind: 'ENUM'
  name: string
  ofType?: null
  enumValues?: Readonly<Array<{ name: string }>>
}

export type InterfaceType = {
  kind: 'INTERFACE'
  name: string
  ofType?: null
  fields?: Readonly<Array<FieldDefinition>>
  possibleTypes?: Readonly<Array<ObjectType | UnionType | InterfaceType>>
}

export type TypeRef =
  | InputObjectType
  | ListType
  | NonNullType
  | ObjectType
  | ScalarType
  | UnionType
  | EnumType
  | InterfaceType

export type FieldDefinition = {
  readonly name: string
  readonly args?: ReadonlyArray<{ name: string; type: TypeRef }>
  readonly type: TypeRef
}

export const getIntrospectionType = <S extends GenericSchema, Type extends Partial<TypeRef>>(
  schema: S,
  type: Type
) =>
  schema.introspection.__schema.types.find((t) =>
    Object.entries(type).every(([key, value]) => t[key as keyof TypeRef] === value)
  )

const getRootOperationNodeType = <S extends GenericSchema, OperationType extends OperationTypes>(
  schema: S,
  operationType: OperationType
): ObjectType<OperationType> | null => {
  const name =
    schema.introspection.__schema[
      `${operationType.toLowerCase()}Type` as 'queryType' | 'mutationType' | 'subscriptionType'
    ]?.name
  if (!name) {
    return null
  }
  const type = getIntrospectionType(schema, { kind: 'OBJECT', name }) as ObjectType<OperationType>
  if (!type) {
    throw new Error(`Could not find the root operation type for ${operationType}`)
  }
  return type
}

export const getRootOperationNames = <
  S extends GenericSchema | undefined,
  OperationType extends OperationTypes,
  Operations = OperationsOf<S, OperationType>
>(
  schema: S,
  operationType: OperationType
): Array<keyof Operations> => {
  if (!schema) {
    return []
  }
  const type = getRootOperationNodeType(schema, operationType)
  return (type?.fields?.map((field) => field.name) as Array<keyof Operations>) ?? []
}

export const getTypeFromRef = (schema: GenericSchema, typeRef?: TypeRef) => {
  const type = schema.introspection.__schema.types.find(
    (t) => 'name' in t && typeRef && 'name' in typeRef && t.name === typeRef.name
  )
  if (!type) {
    throw new Error(`Could not find type`)
  }
  return type
}

export const getArgumentType = (name: String, definition: FieldDefinition) => {
  const type = definition?.args?.find((f) => f.name === name)?.type
  if (!type) {
    throw new Error(`Could not determine the type of the argument ${name}`)
  }
  return type
}

export const getFieldType = (
  schema: GenericSchema,
  fieldName: String,
  definition: TypeRef | FieldDefinition
) => {
  const type = 'type' in definition ? definition.type : definition
  const objectType = getTypeFromRef(schema, getConcreteType(schema, type))
  if (objectType.kind === 'OBJECT' || objectType.kind === 'INTERFACE') {
    const type = objectType.fields?.find((f) => f.name === fieldName)
    if (!type) {
      return null
    }
    return type
  }
  if (objectType.kind === 'INPUT_OBJECT') {
    const type = objectType?.inputFields?.find((f) => f.name === fieldName)
    if (!type) {
      return null
    }
    return type
  }

  return null
}

export const getRootOperationNode = (
  schema: GenericSchema,
  opType: OperationTypes,
  rootOperation: string
) => {
  const rootNode = getRootOperationNodeType(schema, opType)
  const node = rootNode?.fields?.find((field) => field.name === rootOperation)
  if (!node) {
    throw new Error(`Could not find root operation ${rootOperation}`)
  }
  return node
}

export const getConcreteType = (
  schema: GenericSchema,
  definition: TypeRef | FieldDefinition
): TypeRef => {
  if ('type' in definition) {
    return getConcreteType(schema, definition.type)
  }
  if (definition.kind === 'NON_NULL' || definition.kind === 'LIST') {
    return getConcreteType(schema, definition.ofType)
  }
  const type = schema.introspection.__schema.types?.find(
    (f) => 'name' in f && f.name === definition.name
  )
  if (!type) {
    throw new Error('not found')
  }
  return type
}

export const getGraphQLType = (schema: GenericSchema, type: TypeRef): string => {
  if (type.kind === 'NON_NULL') {
    return `${getGraphQLType(schema, type.ofType)}!`
  }
  if (type.kind === 'LIST') {
    return `[${getGraphQLType(schema, type.ofType)}]`
  }
  const typeDesc = schema.introspection.__schema.types?.find(
    (f) => 'name' in f && f.name === type.name
  )
  if (!typeDesc) {
    throw new Error(`Could not find type ${type.name}`)
  }
  if (!('name' in typeDesc)) {
    throw new Error(`Could not determine GraphQL type name for ${type.name}`)
  }
  return typeDesc.name
}
