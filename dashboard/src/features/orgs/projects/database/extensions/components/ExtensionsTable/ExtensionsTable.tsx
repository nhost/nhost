import { Lock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/v3/table';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import {
  ExtensionActionControl,
  PreloadHint,
} from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { getExtensionVersionLabel } from '@/features/orgs/projects/database/extensions/utils/getExtensionVersionLabel';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { cn } from '@/lib/utils';

export interface ExtensionsTableProps {
  extensions: PostgresExtension[];
  /**
   * Libraries PostgreSQL preloaded at startup; `undefined` when unknown.
   */
  preloadedLibraries?: string[];
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

function ExtensionRow({
  extension,
  preloadedLibraries,
  onAction,
}: Omit<ExtensionsTableProps, 'extensions'> & {
  extension: PostgresExtension;
}) {
  const displayName = getExtensionDisplayName(extension.name);
  const isBuiltIn = isExtensionBuiltIn(extension);

  return (
    <TableRow
      data-testid={`extension-row-${extension.name}`}
      className={cn(isBuiltIn && 'bg-muted hover:bg-muted')}
    >
      <TableCell className="w-56 break-words">
        <div className="flex items-center gap-1.5">
          {isBuiltIn && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <a
            href={getExtensionDocsUrl(extension.name)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'font-medium underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-current',
              isBuiltIn
                ? 'text-muted-foreground'
                : 'text-foreground hover:text-primary',
            )}
          >
            {displayName}
          </a>
          <PreloadHint
            extensionName={extension.name}
            preloadedLibraries={preloadedLibraries}
          />
        </div>
      </TableCell>
      <TableCell className="w-44 pr-8 text-right text-muted-foreground tabular-nums">
        {getExtensionVersionLabel(extension) ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {extension.comment}
      </TableCell>
      <TableCell className="w-32 text-right">
        <ExtensionActionControl extension={extension} onAction={onAction} />
      </TableCell>
    </TableRow>
  );
}

export default function ExtensionsTable({
  extensions,
  preloadedLibraries,
  onAction,
}: ExtensionsTableProps) {
  return (
    <Table className="min-w-[48rem] table-fixed">
      <TableBody>
        {extensions.map((extension) => (
          <ExtensionRow
            key={extension.name}
            extension={extension}
            preloadedLibraries={preloadedLibraries}
            onAction={onAction}
          />
        ))}
      </TableBody>
    </Table>
  );
}
