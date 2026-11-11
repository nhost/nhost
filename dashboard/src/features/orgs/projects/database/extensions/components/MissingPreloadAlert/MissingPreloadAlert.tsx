import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

interface MissingPreloadAlertProps {
  extensions: PostgresExtension[];
}

export default function MissingPreloadAlert({
  extensions,
}: MissingPreloadAlertProps) {
  const isSingle = extensions.length === 1;
  const names = extensions
    .map((extension) => getExtensionDisplayName(extension.name))
    .join(', ');

  return (
    <Alert variant="warning">
      <AlertTitle>
        {isSingle
          ? "1 installed extension isn't preloaded"
          : `${extensions.length} installed extensions aren't preloaded`}
      </AlertTitle>
      <AlertDescription>
        {names} won&apos;t work until Postgres preloads{' '}
        {isSingle ? 'its library' : 'their libraries'}. Select the warning icon
        next to {isSingle ? 'the extension' : 'each extension'} to fix this.
      </AlertDescription>
    </Alert>
  );
}
