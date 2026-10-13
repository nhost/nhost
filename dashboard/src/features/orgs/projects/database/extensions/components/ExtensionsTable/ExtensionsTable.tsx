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
  InstalledBadge,
} from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import { ExtensionName } from '@/features/orgs/projects/database/extensions/components/ExtensionName';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
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
  const isBuiltIn = isExtensionBuiltIn(extension);

  return (
    <TableRow
      data-testid={`extension-row-${extension.name}`}
      className={cn(isBuiltIn && 'bg-muted hover:bg-muted')}
    >
      <TableCell className="w-72 break-words">
        <div className="flex items-center gap-1.5">
          {isBuiltIn && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <ExtensionName
            extension={extension}
            preloadedLibraries={preloadedLibraries}
            onAction={onAction}
            className="font-medium"
          />
        </div>
      </TableCell>
      <TableCell className="w-44 pr-8 text-right text-muted-foreground tabular-nums">
        {getExtensionVersionLabel(extension) ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {extension.comment}
      </TableCell>
      <TableCell className="w-56">
        <div className="flex items-center justify-end gap-2">
          {extension.installed_version !== null && <InstalledBadge />}
          <div className="flex w-24 justify-end">
            <ExtensionActionControl extension={extension} onAction={onAction} />
          </div>
        </div>
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
    <Table className="min-w-[56rem] table-fixed">
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
