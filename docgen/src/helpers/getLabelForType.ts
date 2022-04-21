import kebabCase from 'just-kebab-case'

import { GenericTypeFragment, UnionOrIntersectionTypeFragment } from '../fragments'
import {
  ArrayType,
  IntrinsicType,
  LiteralType,
  QueryType,
  ReferenceType,
  ReflectionType,
  UnionOrIntersectionType
} from '../types'

export type GetLabelForTypeOptions = {
  /**
   * Whether or not to create reference to types.
   *
   * @default true
   */
  reference?: boolean
  /**
   * Path to the folder where types are stored.
   *
   * @default '../types'
   */
  typeReferencePath?: string
}

/**
 * Returns the label for a given type.
 *
 * @param type - The type to get the label for.
 * @param options - Options for the label.
 * @returns The label for the type.
 */
export function getLabelForType(
  type?:
    | UnionOrIntersectionType
    | ReferenceType
    | ReflectionType
    | IntrinsicType
    | LiteralType
    | QueryType
    | ArrayType,
  { reference = true, typeReferencePath = '../types' }: GetLabelForTypeOptions = {}
): string {
  if (!type) {
    return ''
  }

  if (type.type === 'reference' && type.id && reference) {
    return `[\`${type.name}\`](${typeReferencePath}/${kebabCase(type.name)})`
  }

  if (type.type === 'reference' && type.typeArguments) {
    return GenericTypeFragment(type)
  }

  if (type.type === 'reference' || type.type === 'intrinsic') {
    return `\`${type.name}\``
  }

  if (type.type === 'reflection' && type.declaration.children?.length > 0) {
    return `\`{ ${type.declaration.children
      .map(
        (value) =>
          `${value.name}: ${getLabelForType(value.type, {
            reference,
            typeReferencePath
          }).replace(/`/gi, '')}`
      )
      .join(', ')} }\``
  }

  if (type.type === 'reflection') {
    return `\`${type.declaration.name}\``
  }

  if (type.type === 'literal' && type.value === null) {
    return `\`null\``
  }

  if (type.type === 'literal' && type.value === undefined) {
    return `\`undefined\``
  }

  if (type.type === 'literal') {
    return `\`${typeof type.value === 'number' ? type.value : `"${type.value}"`}\``
  }

  if (type.type === 'query' && type.queryType.id) {
    return `[\`${type.queryType.name}\`](${typeReferencePath}/${kebabCase(type.queryType.name)})`
  }

  if (type.type === 'query') {
    return `\`${type.queryType.name}\``
  }

  if (type.type === 'array') {
    return `\`Array<${getLabelForType(type.elementType, {
      reference,
      typeReferencePath
    }).replace(/`/gi, '')}>\``
  }

  return UnionOrIntersectionTypeFragment(type, { wrap: false }, { reference, typeReferencePath })
}

export default getLabelForType
