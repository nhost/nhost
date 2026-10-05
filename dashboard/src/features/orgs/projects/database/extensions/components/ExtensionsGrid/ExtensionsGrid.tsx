import { Blocks, Info, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
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

export interface ExtensionsGridProps {
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
          className="inline-flex h-9 cursor-help items-center gap-1.5 rounded-md border border-dashed px-3 font-medium text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function getVersionLabel(extension: PostgresExtension) {
  const { default_version: available, installed_version: installed } =
    extension;

  if (installed === null) {
    return available === null ? null : `v${available}`;
  }

  if (available !== null && available !== installed) {
    return `v${installed} (v${available} available)`;
  }

  return `v${installed}`;
}

function ExtensionCard({
  extension,
  onAction,
}: Pick<ExtensionsGridProps, 'onAction'> & { extension: PostgresExtension }) {
  const displayName = getExtensionDisplayName(extension.name);
  const isInstalled = extension.installed_version !== null;
  const action = isInstalled ? 'uninstall' : 'install';
  const label = isInstalled ? 'Uninstall' : 'Install';
  const protectedReason = PROTECTED_EXTENSIONS.get(extension.name);
  const isBuiltIn = isInstalled && protectedReason !== undefined;
  const dimmed = cn(isBuiltIn && 'opacity-50');
  const versionLabel = getVersionLabel(extension);

  return (
    <div
      data-testid={`extension-card-${extension.name}`}
      data-built-in={isBuiltIn || undefined}
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-background p-4',
        isBuiltIn && 'bg-muted',
      )}
    >
      <div className="flex items-start gap-2">
        {isBuiltIn ? (
          <Lock
            className={cn('mt-[2px] h-5 w-5 shrink-0', dimmed)}
            aria-hidden
          />
        ) : (
          <Blocks className="mt-[2px] h-5 w-5 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn('flex items-center gap-1.5', dimmed)}>
            <a
              href={getExtensionDocsUrl(extension.name)}
              target="_blank"
              rel="noopener noreferrer"
              title={displayName}
              className={cn(
                'truncate font-bold underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-current',
                isBuiltIn
                  ? 'text-muted-foreground'
                  : 'text-foreground hover:text-primary',
              )}
            >
              {displayName}
            </a>
            {PRELOAD_REQUIRED_EXTENSIONS.has(extension.name) && <PreloadHint />}
          </div>
          {versionLabel && (
            <span
              className={cn(
                'text-muted-foreground text-xs tabular-nums',
                dimmed,
              )}
            >
              {versionLabel}
            </span>
          )}
        </div>
        <Badge
          variant={isInstalled && !isBuiltIn ? 'default' : 'outline'}
          className={cn('shrink-0', isBuiltIn && 'text-muted-foreground')}
        >
          {isInstalled ? 'Installed' : 'Available'}
        </Badge>
      </div>

      <p
        className={cn(
          'line-clamp-2 flex-1 text-muted-foreground text-sm',
          dimmed,
        )}
      >
        {extension.comment}
      </p>

      <div className="flex justify-end">
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
      </div>
    </div>
  );
}

export default function ExtensionsGrid({
  ariaLabel,
  extensions,
  onAction,
}: ExtensionsGridProps) {
  return (
    <section aria-label={ariaLabel} className="space-y-3">
      <h2 className="font-semibold text-lg">{ariaLabel}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {extensions.map((extension) => (
          <ExtensionCard
            key={extension.name}
            extension={extension}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}
