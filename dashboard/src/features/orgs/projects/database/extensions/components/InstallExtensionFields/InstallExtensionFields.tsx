import { Fragment } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import { ExtensionSQLEditor } from '@/features/orgs/projects/database/extensions/components/ExtensionSQLEditor';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { getMissingExtensionDependencies } from '@/features/orgs/projects/database/extensions/utils/getMissingExtensionDependencies';

interface InstallExtensionFieldsProps {
  extension: PostgresExtension;
  catalog: PostgresExtension[];
  sql: string;
  onSqlChange: (sql: string) => void;
  editable: boolean;
  disabled: boolean;
  error: Error | null;
}

export default function InstallExtensionFields({
  extension,
  catalog,
  sql,
  onSqlChange,
  editable,
  disabled,
  error,
}: InstallExtensionFieldsProps) {
  const displayName = getExtensionDisplayName(extension.name);
  const missingDependencies = getMissingExtensionDependencies(
    extension,
    catalog,
  );

  return (
    <>
      <ExtensionSQLEditor
        value={sql}
        onChange={onSqlChange}
        editable={editable}
        disabled={disabled}
      />

      {missingDependencies.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Also installs{' '}
          {missingDependencies.map((dependency, index) => (
            <Fragment key={dependency}>
              {index > 0 && ', '}
              <InlineCode>{dependency}</InlineCode>
            </Fragment>
          ))}
          , which {displayName} depends on.
        </p>
      )}

      {extension.name === 'pg_squeeze' && (
        <p className="text-muted-foreground text-sm">
          Squeezing tables may require configuring the WAL level and replication
          slots in your Postgres settings.{' '}
          <TextLink href={getExtensionDocsUrl(extension.name)} external>
            Learn more
          </TextLink>
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not install {displayName}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap break-words">
            {error.message}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
