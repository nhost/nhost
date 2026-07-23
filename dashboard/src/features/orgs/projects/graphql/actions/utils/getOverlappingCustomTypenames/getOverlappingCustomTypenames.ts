import type { ClientCustomType } from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
import { parseCustomTypes } from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
import { parseTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/parseTypesSdl';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';

export default function getOverlappingCustomTypenames(
  typesSdl: string,
  existingCustomTypes: CustomTypes,
  typenamesInUseByAction: string[],
): string[] {
  const { types: newTypes, error } = parseTypesSdl(typesSdl);
  if (error !== null) {
    return [];
  }

  const inUseByAction = new Set(typenamesInUseByAction);
  const existingTypenames = new Set(
    parseCustomTypes(existingCustomTypes).map(
      (type: ClientCustomType) => type.name,
    ),
  );

  return newTypes
    .map((type) => type.name)
    .filter(
      (typename) =>
        existingTypenames.has(typename) && !inUseByAction.has(typename),
    );
}
