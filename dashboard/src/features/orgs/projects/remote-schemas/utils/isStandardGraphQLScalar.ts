import { BUILT_IN_SCALARS } from './constants';

function isStandardGraphQLScalar(typeName: string): boolean {
  return BUILT_IN_SCALARS.has(typeName);
}

export default isStandardGraphQLScalar;
