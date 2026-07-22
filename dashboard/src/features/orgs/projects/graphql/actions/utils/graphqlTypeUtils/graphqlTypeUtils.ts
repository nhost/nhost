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
