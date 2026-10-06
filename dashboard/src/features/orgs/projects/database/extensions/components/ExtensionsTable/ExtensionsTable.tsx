import { Lock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import {
  ExtensionActionControl,
  PreloadHint,
} from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import { PRELOAD_REQUIRED_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { getExtensionVersionLabel } from '@/features/orgs/projects/database/extensions/utils/getExtensionVersionLabel';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { cn } from '@/lib/utils';

export interface ExtensionsTableProps {
  extensions: PostgresExtension[];
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

function ExtensionRow({
  extension,
  onAction,
}: Pick<ExtensionsTableProps, 'onAction'> & { extension: PostgresExtension }) {
  const displayName = getExtensionDisplayName(extension.name);
  const isBuiltIn = isExtensionBuiltIn(extension);
  const dimmedCell = cn(isBuiltIn && 'opacity-50');

  return (
    <TableRow
      data-testid={`extension-row-${extension.name}`}
      data-built-in={isBuiltIn || undefined}
      className={cn(isBuiltIn && 'bg-muted hover:bg-muted')}
    >
      <TableCell className={cn('break-words', dimmedCell)}>
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
          {PRELOAD_REQUIRED_EXTENSIONS.has(extension.name) && <PreloadHint />}
        </div>
      </TableCell>
      <TableCell
        className={cn('text-muted-foreground tabular-nums', dimmedCell)}
      >
        {getExtensionVersionLabel(extension) ?? '—'}
      </TableCell>
      <TableCell className={cn('text-muted-foreground', dimmedCell)}>
        {extension.comment}
      </TableCell>
      <TableCell className="text-right">
        <ExtensionActionControl extension={extension} onAction={onAction} />
      </TableCell>
    </TableRow>
  );
}

export default function ExtensionsTable({
  extensions,
  onAction,
}: ExtensionsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="min-w-[48rem] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Name</TableHead>
            <TableHead className="w-44">Version</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extensions.map((extension) => (
            <ExtensionRow
              key={extension.name}
              extension={extension}
              onAction={onAction}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
