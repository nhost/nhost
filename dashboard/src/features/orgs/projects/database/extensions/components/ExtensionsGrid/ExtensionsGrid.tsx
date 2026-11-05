import { Blocks, Lock } from 'lucide-react';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import {
  ExtensionActionControl,
  InstalledBadge,
} from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import { ExtensionName } from '@/features/orgs/projects/database/extensions/components/ExtensionName';
import { ExtensionPreloadStatus } from '@/features/orgs/projects/database/extensions/components/ExtensionPreloadStatus';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionVersionLabel } from '@/features/orgs/projects/database/extensions/utils/getExtensionVersionLabel';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { cn } from '@/lib/utils';

export interface ExtensionsGridProps {
  extensions: PostgresExtension[];
  /**
   * Libraries PostgreSQL preloaded at startup; `undefined` when unknown.
   */
  preloadedLibraries?: string[];
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

function ExtensionCard({
  extension,
  preloadedLibraries,
  onAction,
}: Omit<ExtensionsGridProps, 'extensions'> & {
  extension: PostgresExtension;
}) {
  const isBuiltIn = isExtensionBuiltIn(extension);
  const versionLabel = getExtensionVersionLabel(extension);

  return (
    <div
      data-testid={`extension-card-${extension.name}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        isBuiltIn ? 'bg-muted' : 'bg-background',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isBuiltIn ? (
            <Lock className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <Blocks className="h-5 w-5 shrink-0" aria-hidden />
          )}
          <ExtensionName extension={extension} className="truncate font-bold" />
        </div>
        {versionLabel && (
          <span className="mt-[3px] shrink-0 text-muted-foreground text-xs tabular-nums">
            {versionLabel}
          </span>
        )}
      </div>

      <p className="line-clamp-2 flex-1 text-muted-foreground text-sm">
        {extension.comment}
      </p>

      <div className="flex items-center gap-2">
        <ExtensionPreloadStatus
          extension={extension}
          preloadedLibraries={preloadedLibraries}
          onAction={onAction}
        />
        {extension.installed_version !== null && <InstalledBadge />}
        <div className="ml-auto">
          <ExtensionActionControl extension={extension} onAction={onAction} />
        </div>
      </div>
    </div>
  );
}

export default function ExtensionsGrid({
  extensions,
  preloadedLibraries,
  onAction,
}: ExtensionsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
      {extensions.map((extension) => (
        <ExtensionCard
          key={extension.name}
          extension={extension}
          preloadedLibraries={preloadedLibraries}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
