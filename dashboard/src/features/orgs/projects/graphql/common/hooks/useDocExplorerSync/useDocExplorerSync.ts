import { useDocExplorerActions } from '@graphiql/plugin-doc-explorer';
import { pick, useGraphiQL } from '@graphiql/react';
import { useEffect } from 'react';

/**
 * Keeps the docs in step with the editor, like GraphiQL's `DocExplorerStore`
 * does, but without its window-wide Cmd/Ctrl+K listener, which would take the
 * shortcut from the dashboard's command palette. Call it inside
 * `GraphiQLProvider`.
 */
export default function useDocExplorerSync() {
  const { schema, validationErrors, schemaReference } = useGraphiQL(
    pick('schema', 'validationErrors', 'schemaReference'),
  );
  const { resolveSchemaReferenceToNavItem, reset, rebuildNavStackWithSchema } =
    useDocExplorerActions();

  // A Ctrl+click on a field in the editor opens its docs.
  useEffect(() => {
    resolveSchemaReferenceToNavItem(schemaReference);
  }, [resolveSchemaReferenceToNavItem, schemaReference]);

  // The docs follow the schema. Another user, role or headers clears it until
  // the new one arrives, so the docs go back to the start.
  useEffect(() => {
    if (schema == null || validationErrors.length > 0) {
      reset();
    } else {
      rebuildNavStackWithSchema(schema);
    }
  }, [rebuildNavStackWithSchema, reset, schema, validationErrors]);
}
