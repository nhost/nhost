import { RequireAtLeastOne, SetRequired } from 'type-fest'
import {
  ConcreteTypeOf,
  FieldArgs,
  FieldDefinition,
  GenericSchema,
  InterfaceType,
  ObjectType,
  OperationRootTypeOf,
  OperationsOf,
  OperationTypes,
  UnionType
} from './schema'
import {
  IsTrueOrHasOnlyOptionals,
  PickFirstTupleItemThatExtends,
  RequiredWhenChildrenAreRequired,
  StripImpossibleProperties,
  ToUnion,
  UnwrapArray,
  UnwrapNullableArray,
  WrapArray
} from './type-helpers'

type ParametersOf<
  Schema extends GenericSchema,
  OperationType extends OperationTypes,
  Element extends Record<string, any>,
  Definition,
  FieldName extends string,
  FieldTypeRef extends FieldDefinition = Definition extends { fields: readonly any[] }
    ? PickFirstTupleItemThatExtends<Definition['fields'], { name: FieldName }>
    : never,
  FieldType extends ObjectType | InterfaceType | UnionType = ConcreteTypeOf<
    Schema,
    FieldTypeRef['type']
  >,
  HasArgs = FieldTypeRef extends { args: readonly any[] }
    ? FieldTypeRef['args']['length'] extends 0
      ? false
      : true
    : false,
  Args = HasArgs extends true
    ? unknown extends FieldArgs<Schema, OperationType, FieldTypeRef['name']>
      ? FieldArgs<Schema, OperationType, FieldType['name']>
      : FieldArgs<Schema, OperationType, FieldTypeRef['name']>
    : never,
  Fields = {
    [key in keyof Element]?: UnwrapNullableArray<Element[key]> extends object
      ? // * Accept either a list of fields or `true` to select all the fields
        | ParametersOf<
              Schema,
              OperationType,
              UnwrapNullableArray<Element[key]>,
              FieldType,
              string & key
            >
          | true
      : // * If the element key is not an object/array of objects, it's a scalar field
        true
  },
  Select = {
    // * The `select` property is optional, as when absent, all the fields are selected
    select?: Fields
  },
  // * The `variables` property is required when at least one of the children is required
  // * If there is no possible variables, the `variables` property is not available
  Variables = RequiredWhenChildrenAreRequired<'variables', Args>,
  OnFields = FieldType extends SetRequired<UnionType | InterfaceType, 'possibleTypes'>
    ? {
        [key in FieldType['possibleTypes'][number] as key['name']]?:
          | ParametersOf<
              Schema,
              OperationType,
              Schema['types'][key['name']],
              ConcreteTypeOf<Schema, key>,
              string & keyof Schema['types'][key['name']]
            >
          | true
      }
    : never,
  On = FieldType extends SetRequired<UnionType, 'possibleTypes'>
    ? // * In an union type, the `on` property is required, and at least one union type must be selected
      { on: RequireAtLeastOne<OnFields> }
    : FieldType extends SetRequired<InterfaceType, 'possibleTypes'>
    ? // * In an interface type, the `on` property is optional.
      { on?: OnFields }
    : {}
> = Select & Variables & On

type QueryFields<
  Params extends { select?: any },
  Element,
  UnwrappedParams extends { select?: any } = UnwrapArray<Params>
> = UnwrappedParams extends undefined
  ? Element
  : WrapArray<
      NonNullable<Element>,
      IsTrueOrHasOnlyOptionals<UnwrappedParams['select']> extends true
        ? // * Return all the non-object (scalar) fields
          StripImpossibleProperties<{
            [k in keyof NonNullable<Element>]: k extends keyof UnwrapArray<Element>
              ? UnwrapArray<NonNullable<Element>>[k] extends object
                ? never
                : UnwrapArray<Element>[k]
              : never
          }>
        : // * The parameter is a list of fields and the element in an object: pick the selected fields
          StripImpossibleProperties<{
            [k in keyof UnwrappedParams['select']]: k extends keyof UnwrapArray<Element>
              ? UnwrapArray<NonNullable<Element>>[k] extends object
                ? QueryFields<UnwrappedParams['select'][k], UnwrapArray<Element>[k]>
                : UnwrapArray<Element>[k]
              : never
          }>
    >

type UnionFields<
  Schema extends GenericSchema,
  Params extends { on: any[] },
  Fragments = NonNullable<NonNullable<Params>['on']>
> = ToUnion<{
  [fragmentName in keyof Fragments]: {
    __typename: NonNullable<Schema['types'][string & fragmentName]['__typename']>
  } & QueryFields<NonNullable<Fragments[fragmentName]>, Schema['types'][string & fragmentName]>
}>

// * See: https://stackoverflow.com/a/59230299
type Exactly<T, U> = T & Record<Exclude<keyof U, keyof T>, never>

export type OperationFactory<
  Schema extends GenericSchema | undefined,
  OperationType extends OperationTypes,
  Operations = Schema extends GenericSchema ? OperationsOf<Schema, OperationType> : {}
> = Schema extends GenericSchema
  ? Required<{
      [name in keyof Operations]: <
        Operation extends Operations[name],
        Element extends UnwrapArray<Operation>,
        Params extends ParametersOf<
          Schema,
          OperationType,
          NonNullable<Element>,
          OperationRootTypeOf<Schema, OperationType>,
          string & name
        >,
        // * See: https://stackoverflow.com/a/59230299
        ExactParams extends Exactly<Params, ExactParams>,
        Result extends WrapArray<
          Operation,
          ExactParams extends { on: any }
            ?
                | (UnionFields<Schema, ExactParams> & QueryFields<ExactParams, Element>)
                | ({
                    // * We add `__typename` as an union discrimimator.
                    // * Interfaces have no `__typename` property, so we set it to `null` if not present.
                    __typename: Element extends { __typename: any } ? Element['__typename'] : null
                  } & QueryFields<ExactParams, Element>)
            : QueryFields<ExactParams, Element>
        >
      >(
        // * Parameters are required when variables are required
        ...parameters: ExactParams extends { variables: any } ? [ExactParams] : [ExactParams?]
      ) => Promise<Result>
    }>
  : {}
