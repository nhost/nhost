import type {
  RemoteFieldArgumentMapping,
  RemoteFieldArgumentMappingsByPath,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { serializeRemoteFieldArgumentValue } from './forms';

export type ParsedRemoteFieldSelection = {
  rootFieldPath: string;
  selectedFieldPaths: Set<string>;
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath;
};

/**
 * Parse a Hasura remote_field object into selection state for the UI.
 * This is the inverse of buildRemoteFieldFromSelection.
 */
export default function parseRemoteFieldToSelection(
  remoteField?: Record<
    string,
    { arguments?: Record<string, unknown>; field?: Record<string, unknown> }
  >,
): ParsedRemoteFieldSelection {
  const selectedFieldPaths = new Set<string>();
  const argumentMappingsByPath: RemoteFieldArgumentMappingsByPath = {};

  if (!remoteField || Object.keys(remoteField).length === 0) {
    return {
      rootFieldPath: '',
      selectedFieldPaths,
      argumentMappingsByPath,
    };
  }

  const [rootFieldName] = Object.keys(remoteField);
  if (!rootFieldName) {
    return {
      rootFieldPath: '',
      selectedFieldPaths,
      argumentMappingsByPath,
    };
  }

  const walk = (
    fieldMap: Record<
      string,
      { arguments?: Record<string, unknown>; field?: Record<string, unknown> }
    >,
    parentPath: string | null,
  ) => {
    Object.entries(fieldMap).forEach(([fieldName, config]) => {
      const currentPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
      selectedFieldPaths.add(currentPath);

      const args = config?.arguments ?? {};
      const argEntries = Object.entries(args);
      if (argEntries.length > 0) {
        argumentMappingsByPath[currentPath] = argEntries.reduce<
          Record<string, RemoteFieldArgumentMapping>
        >((accumulator, [argumentName, argumentValue]) => {
          const isColumnReference =
            typeof argumentValue === 'string' && argumentValue.startsWith('$');

          return {
            ...accumulator,
            [argumentName]: {
              enabled: true,
              type: isColumnReference ? 'column' : 'static',
              value: isColumnReference
                ? argumentValue.slice(1)
                : serializeRemoteFieldArgumentValue(argumentValue),
            },
          };
        }, {});
      }

      if (config?.field && Object.keys(config.field).length > 0) {
        walk(
          config.field as Record<
            string,
            {
              arguments?: Record<string, unknown>;
              field?: Record<string, unknown>;
            }
          >,
          currentPath,
        );
      }
    });
  };

  walk(remoteField, null);

  return {
    rootFieldPath: rootFieldName,
    selectedFieldPaths,
    argumentMappingsByPath,
  };
}
