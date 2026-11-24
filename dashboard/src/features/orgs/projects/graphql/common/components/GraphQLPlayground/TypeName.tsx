import { type GraphQLTypeCategory, typeCategory } from '@graphiql/react';
import type { GraphQLNamedType } from 'graphql';

// GraphiQL colors type names by kind with these tokens; the same here so our
// lists match its own.
const COLOR_CLASSES: Record<GraphQLTypeCategory, string> = {
  composite: 'text-[oklch(var(--type-composite))]',
  scalar: 'text-[oklch(var(--type-scalar))]',
  enum: 'text-[oklch(var(--type-enum))]',
  input: 'text-[oklch(var(--type-input))]',
};

/** A type's name in GraphiQL's color for its kind. */
export default function TypeName({ type }: { type: GraphQLNamedType }) {
  return <span className={COLOR_CLASSES[typeCategory(type)]}>{type.name}</span>;
}
