import kebabCase from 'just-kebab-case'
import { snapshot } from 'valtio'
import {
  FunctionSignatureTypeFragment,
  GenericTypeFragment,
  UnionOrIntersectionTypeFragment
} from '../fragments'
import { appState } from '../state'
import {
  ArrayType,
  IntrinsicType,
  LiteralType,
  QueryType,
  ReferenceType,
  ReflectionType,
  UnionOrIntersectionType
} from '../types'
import codifyValue from './codifyValue'

export type GetLabelForTypeOptions = {
  /**
   * Whether or not to create reference to types.
   *
   * @default true
   */
  reference?: boolean
  /**
   * Whether or not to wrap the fragment in a code tag.
   *
   * @default true
   */
  wrap?: boolean
}

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
  { reference = true, wrap = true }: GetLabelForTypeOptions = {}
): string {
  // TODO: Dependency on the appState should be reviewed
  const { contentReferences, baseSlug, formattedDocsRoot } = snapshot(appState)

  if (!type) {
    return ''
  }

  if (type.type === 'reference' && type.id && reference) {
    const originalType = contentReferences.get(type.id)

    if (!originalType) {
      return codifyValue(type.name, wrap)
    }

    if (originalType === 'Class') {
      const finalSlug = baseSlug || formattedDocsRoot

      return `[\`${type.name}\`](/${
        finalSlug ? `${finalSlug.replace(/^\//i, '')}/` : ''
      }${kebabCase(type.name)})`
    }

    return `[\`${type.name}\`](/${
      formattedDocsRoot ? `${formattedDocsRoot}/` : ''
    }types/${kebabCase(type.name)})`
  }

  if (type.type === 'reference' && type.typeArguments) {
    return codifyValue(GenericTypeFragment(type), wrap)
  }

  if (type.type === 'reference' || type.type === 'intrinsic') {
    return codifyValue(type.name, wrap)
  }

  if (
    type.type === 'reflection' &&
    type.declaration.children &&
    type.declaration.children.length > 0
  ) {
    return codifyValue(
      `{ ${type.declaration.children
        .map(
          (value) =>
            `${value.name}: ${getLabelForType(value.type, {
              reference,
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
    return codifyValue(
      FunctionSignatureTypeFragment(
        type.declaration.signatures[0],
        { wrap: 'none' },
        {
          reference: false
        }
      ),
      wrap
    )
  }

  if (type.type === 'reflection') {
    return codifyValue(type.declaration.name, wrap)
  }

  if (type.type === 'literal' && type.value === null) {
    return codifyValue('null', wrap)
  }

  if (type.type === 'literal' && type.value === undefined) {
    return codifyValue('undefined', wrap)
  }

  if (type.type === 'literal') {
    return codifyValue(typeof type.value === 'number' ? type.value : `"${type.value}"`, wrap)
  }

  if (type.type === 'query' && type.queryType.id && reference) {
    return getLabelForType(type.queryType, { reference, wrap })
  }

  if (type.type === 'query') {
    return codifyValue(type.queryType.name, wrap)
  }

  if (type.type === 'array') {
    return codifyValue(
      `Array<${getLabelForType(type.elementType, { reference, wrap: false })}>`,
      wrap
    )
  }

  return codifyValue(
    // Do not wrap union or intersection types internally
    UnionOrIntersectionTypeFragment(type, { wrap: false }, { reference, wrap: false }),
    wrap
  )
}

export default getLabelForType
