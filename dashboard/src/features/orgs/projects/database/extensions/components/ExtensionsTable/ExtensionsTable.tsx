import { Info, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  getExtensionDisplayName,
  getExtensionDocsUrl,
  PRELOAD_REQUIRED_EXTENSIONS,
  PROTECTED_EXTENSIONS,
} from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { cn } from '@/lib/utils';

export type ExtensionAction = 'install' | 'uninstall';

export interface ExtensionsTableProps {
  ariaLabel: 'Popular extensions' | 'All extensions';
  extensions: PostgresExtension[];
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

function PreloadHint() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Preload requirement"
          className="inline-flex cursor-help rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="max-w-xs">
        Requires <InlineCode>shared_preload_libraries</InlineCode>, which Nhost
        preloads by default.
      </TooltipContent>
    </Tooltip>
  );
}

function BuiltInIndicator({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-auto inline-flex h-9 cursor-help items-center gap-1.5 rounded-md border border-dashed px-3 font-medium text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="h-4 w-4" aria-hidden />
          Built-in
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6} className="max-w-xs">
        Cannot be uninstalled. {reason}
      </TooltipContent>
    </Tooltip>
  );
}

function ExtensionRow({
  extension,
  onAction,
}: Pick<ExtensionsTableProps, 'onAction'> & { extension: PostgresExtension }) {
  const displayName = getExtensionDisplayName(extension.name);
  const isInstalled = extension.installed_version !== null;
  const action = isInstalled ? 'uninstall' : 'install';
  const label = isInstalled ? 'Uninstall' : 'Install';
  const protectedReason = PROTECTED_EXTENSIONS.get(extension.name);
  const isBuiltIn = isInstalled && protectedReason !== undefined;
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
        {extension.comment && (
          <p className="mt-1 text-muted-foreground text-sm">
            {extension.comment}
          </p>
        )}
      </TableCell>
      <TableCell className={cn('text-right tabular-nums', dimmedCell)}>
        {extension.default_version ?? '—'}
      </TableCell>
      <TableCell className={cn('text-right tabular-nums', dimmedCell)}>
        {extension.installed_version ?? '—'}
      </TableCell>
      <TableCell className={cn('pl-8', dimmedCell)}>
        <Badge
          variant={isInstalled && !isBuiltIn ? 'default' : 'outline'}
          className={cn(isBuiltIn && 'text-muted-foreground')}
        >
          {isInstalled ? 'Installed' : 'Available'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {isBuiltIn ? (
          <BuiltInIndicator reason={protectedReason} />
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(action, extension)}
            aria-label={`${label} ${displayName}`}
            data-testid={`${action}-extension-${extension.name}`}
          >
            {label}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function ExtensionsTable({
  ariaLabel,
  extensions,
  onAction,
}: ExtensionsTableProps) {
  return (
    <section aria-label={ariaLabel} className="space-y-3">
      <h2 className="font-semibold text-lg">{ariaLabel}</h2>

      <div className="overflow-hidden rounded-md border">
        <Table className="min-w-[50rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-36 text-right">Default version</TableHead>
              <TableHead className="w-36 text-right">
                Installed version
              </TableHead>
              <TableHead className="w-28 pl-8">Status</TableHead>
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
    </section>
  );
}
