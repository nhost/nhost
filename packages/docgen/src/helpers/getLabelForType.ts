import kebabCase from 'just-kebab-case'

import {
  FunctionSignatureTypeFragment,
  GenericTypeFragment,
  UnionOrIntersectionTypeFragment
} from '../fragments'
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
  /**
   * Whether or not to wrap the fragment in an inline code block.
   *
   * @default true
   */
  wrap?: boolean
}

/**
 * Returns the wrapped version for a given `value` if `wrap` is `true`.
 *
 * @param value - Value to wrap
 * @param wrap - Whether or not to wrap the fragment in an inline code block
 * @param wrapper - Wrapper character
 * @returns Wrapped value
 */
const wrappedText = (value: any, wrap?: boolean, wrapper: string = '`') =>
  wrap ? `${wrapper}${value}${wrapper}` : value

/**
 * Returns the label for a given type.
 *
 * @param type - Type for which to return the label
 * @param options - Options for the label
 * @returns The label for the type
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
  { reference = true, typeReferencePath = '../types', wrap = true }: GetLabelForTypeOptions = {}
): string {
  if (!type) {
    return ''
  }

  if (type.type === 'reference' && type.id && reference) {
    return `[\`${type.name}\`](${typeReferencePath}/${kebabCase(type.name)})`
  }

  if (type.type === 'reference' && type.typeArguments) {
    return wrappedText(GenericTypeFragment(type), wrap)
  }

  if (type.type === 'reference' || type.type === 'intrinsic') {
    return wrappedText(type.name, wrap)
  }

  if (
    type.type === 'reflection' &&
    type.declaration.children &&
    type.declaration.children.length > 0
  ) {
    return wrappedText(
      `{ ${type.declaration.children
        .map(
          (value) =>
            `${value.name}: ${getLabelForType(value.type, {
              reference,
              typeReferencePath,
              wrap: false
            })}`
        )
        .join(', ')} }`,
      wrap
    )
  }

  if (
    type.type === 'reflection' &&
    type.declaration.signatures &&
    type.declaration.signatures.length > 0 &&
    type.declaration.signatures[0].kindString === 'Call signature'
  ) {
    return wrappedText(
      FunctionSignatureTypeFragment(
        type.declaration.signatures[0],
        { wrap: false },
        {
          reference: false
        }
      ),
      wrap
    )
  }

  if (type.type === 'reflection') {
    return wrappedText(type.declaration.name, wrap)
  }

  if (type.type === 'literal' && type.value === null) {
    return wrappedText('null', wrap)
  }

  if (type.type === 'literal' && type.value === undefined) {
    return wrappedText('undefined', wrap)
  }

  if (type.type === 'literal') {
    return wrappedText(typeof type.value === 'number' ? type.value : `"${type.value}"`, wrap)
  }

  if (type.type === 'query' && type.queryType.id && reference) {
    return `[\`${type.queryType.name}\`](${typeReferencePath}/${kebabCase(type.queryType.name)})`
  }

  if (type.type === 'query') {
    return wrappedText(type.queryType.name, wrap)
  }

  if (type.type === 'array') {
    return wrappedText(
      `Array<${getLabelForType(type.elementType, {
        reference,
        typeReferencePath,
        wrap: false
      })}>`,
      wrap
    )
  }

  return wrappedText(
    UnionOrIntersectionTypeFragment(type, { wrap: false }, { reference, typeReferencePath, wrap })
  )
}

export default getLabelForType
