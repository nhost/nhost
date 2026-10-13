import { BookOpen, Info } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { PRELOAD_LIBRARY_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { cn } from '@/lib/utils';

export interface ExtensionNameProps {
  extension: PostgresExtension;
  /**
   * Libraries PostgreSQL preloaded at startup; `undefined` when unknown.
   */
  preloadedLibraries?: string[];
  className?: string;
}

// Keeps the 24px hit area from growing the line the icon sits on.
const ICON_BUTTON_CLASS_NAME = '-my-0.5 h-6 w-6 shrink-0 rounded-sm p-0';

function DocsLink({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          className={cn(
            ICON_BUTTON_CLASS_NAME,
            'text-muted-foreground hover:text-foreground',
          )}
        >
          <a
            href={getExtensionDocsUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen className="size-4" aria-hidden />
            <span className="sr-only">Documentation (opens in a new tab)</span>
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Documentation</TooltipContent>
    </Tooltip>
  );
}

function PreloadHint({
  name,
  preloadedLibraries,
}: {
  name: string;
  preloadedLibraries?: string[];
}) {
  if (!PRELOAD_LIBRARY_EXTENSIONS.has(name)) {
    return null;
  }

  const isPreloaded = preloadedLibraries?.includes(name);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Preload requirement"
          className={cn(
            ICON_BUTTON_CLASS_NAME,
            'text-primary hover:text-primary',
          )}
        >
          <Info className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Requires preloading its library (
        <InlineCode>shared_preload_libraries</InlineCode>).
        {isPreloaded === true && ' Already preloaded in this project.'}
        {isPreloaded === false && ' Not preloaded in this project yet.'}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ExtensionName({
  extension,
  preloadedLibraries,
  className,
}: ExtensionNameProps) {
  const displayName = getExtensionDisplayName(extension.name);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span
        title={displayName}
        className={cn(
          'min-w-0',
          isExtensionBuiltIn(extension) && 'text-muted-foreground',
          className,
        )}
      >
        {displayName}
      </span>
      <DocsLink name={extension.name} />
      <PreloadHint
        name={extension.name}
        preloadedLibraries={preloadedLibraries}
      />
    </div>
  );
}
