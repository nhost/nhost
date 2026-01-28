import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import type {
  RemoteField,
  RemoteFieldArguments,
} from '@/utils/hasura-api/generated/schemas';
import inferStaticValue from './inferStaticValue';

type RemoteFieldNode = RemoteField[string];

/**
 * Build a Hasura remote_field object from UI selection state.
 * This is the inverse of parseRemoteFieldToSelection.
 *
 * @returns The remote_field object or null if no fields are selected
 */
export default function buildRemoteFieldFromSelection(
  selectedFieldPaths: Set<string>,
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath,
): RemoteField | null {
  const rootCandidates = Array.from(selectedFieldPaths).filter(
    (path) => !path.includes('.'),
  );
  const rootFieldName = rootCandidates[0];
  if (!rootFieldName) {
    return null;
  }

  const getImmediateChildren = (parentPath: string) => {
    const prefix = `${parentPath}.`;
    const children = new Set<string>();

    selectedFieldPaths.forEach((path) => {
      if (!path.startsWith(prefix)) {
        return;
      }

      const rest = path.slice(prefix.length);
      const [childName] = rest.split('.');
      if (childName) {
        children.add(childName);
      }
    });

    return Array.from(children);
  };

  const buildNode = (fieldPath: string): RemoteFieldNode => {
    const mappingsByArgument = argumentMappingsByPath[fieldPath] ?? {};
    const argumentEntries = Object.entries(
      mappingsByArgument,
    ).reduce<RemoteFieldArguments>((accumulator, [argumentName, mapping]) => {
      if (!mapping.enabled) {
        return accumulator;
      }

      if (mapping.type === 'column' && mapping.value.trim().length > 0) {
        return {
          ...accumulator,
          [argumentName]: `$${mapping.value.trim()}`,
        };
      }
      if (mapping.type === 'static' && mapping.value.trim().length > 0) {
        return {
          ...accumulator,
          [argumentName]: inferStaticValue(mapping.value.trim()),
        };
      }

      return accumulator;
    }, {});

    const children = getImmediateChildren(fieldPath);
    const fieldEntries = children.reduce<RemoteField>(
      (accumulator, childName) => {
        const childPath = `${fieldPath}.${childName}`;
        return {
          ...accumulator,
          [childName]: buildNode(childPath),
        };
      },
      {},
    );

    return {
      arguments: argumentEntries,
      ...(Object.keys(fieldEntries).length > 0 ? { field: fieldEntries } : {}),
    };
  };

  return {
    [rootFieldName]: buildNode(rootFieldName),
  };
}
