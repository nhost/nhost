import type { TypeNode } from 'graphql';
import { Kind } from 'graphql';

export type TypeWrapper = 'l' | 'n';

export interface TypeMetadata {
  typename: string;
  stack: TypeWrapper[];
}

export function unwrapType(wrappedTypename: string): TypeMetadata {
  let typename = wrappedTypename;
  const stack: TypeWrapper[] = [];

  let lastChar = typename.charAt(typename.length - 1);
  while (lastChar) {
    if (lastChar === '!') {
      typename = typename.substring(0, typename.length - 1);
      stack.push('n');
    } else if (lastChar === ']') {
      typename = typename.substring(1, typename.length - 1);
      stack.push('l');
    } else {
      break;
    }
    lastChar = typename.charAt(typename.length - 1);
  }

  return { typename, stack };
}

export function getAstTypeMetadata(type: TypeNode): TypeMetadata {
  let node = type;
  const stack: TypeWrapper[] = [];

  while (node.kind !== Kind.NAMED_TYPE) {
    if (node.kind === Kind.LIST_TYPE) {
      stack.push('l');
    } else if (node.kind === Kind.NON_NULL_TYPE) {
      stack.push('n');
    }
    node = node.type;
  }

  return { typename: node.name.value, stack };
}

export function wrapTypename(name: string, stack: TypeWrapper[]): string {
  return stack.reduceRight((wrappedTypename, wrapper) => {
    if (wrapper === 'l') {
      return `[${wrappedTypename}]`;
    }
    return `${wrappedTypename}!`;
  }, name);
}
