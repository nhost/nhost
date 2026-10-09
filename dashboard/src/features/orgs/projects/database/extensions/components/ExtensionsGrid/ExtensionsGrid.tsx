import { Blocks, Lock } from 'lucide-react';
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
  const displayName = getExtensionDisplayName(extension.name);
  const isBuiltIn = isExtensionBuiltIn(extension);
  const versionLabel = getExtensionVersionLabel(extension);

  return (
    <div
      data-testid={`extension-card-${extension.name}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        isBuiltIn ? 'bg-background' : 'bg-muted',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isBuiltIn ? (
            <Lock className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <Blocks className="h-5 w-5 shrink-0" aria-hidden />
          )}
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
          <PreloadHint
            extensionName={extension.name}
            preloadedLibraries={preloadedLibraries}
          />
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

      <div className="flex justify-end">
        <ExtensionActionControl extension={extension} onAction={onAction} />
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
