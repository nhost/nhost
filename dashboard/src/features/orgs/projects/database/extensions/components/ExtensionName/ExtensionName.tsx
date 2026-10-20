import { BookOpen, Info, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import { PRELOAD_LIBRARY_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { isExtensionPreloadMissing } from '@/features/orgs/projects/database/extensions/utils/isExtensionPreloadMissing';
import { cn } from '@/lib/utils';

export interface ExtensionNameProps {
  extension: PostgresExtension;
  /**
   * Libraries PostgreSQL preloaded at startup; `undefined` when unknown.
   */
  preloadedLibraries?: string[];
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
  className?: string;
}

// Keeps the 24px hit area from growing the line the icon sits on.
const iconButtonClassName = '-my-0.5 shrink-0';

function DocsLink({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon-xs"
          className={iconButtonClassName}
        >
          <a
            href={getExtensionDocsUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen className="size-4 text-muted-foreground" aria-hidden />
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
          size="icon-xs"
          aria-label="Preload requirement"
          className={iconButtonClassName}
        >
          <Info className="size-4 text-primary" aria-hidden />
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

function PreloadWarning({
  extension,
  onAction,
}: Pick<ExtensionNameProps, 'extension' | 'onAction'>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const displayName = getExtensionDisplayName(extension.name);

  function handlePreload() {
    setOpen(false);
    // The dialog returns focus to the element focused when it opens, and the
    // popover's button disappears with the popover.
    triggerRef.current?.focus();
    onAction('preload', extension);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon-xs"
          aria-label="Library not preloaded"
          className={iconButtonClassName}
        >
          <TriangleAlert className="size-4 text-warning" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">Library not preloaded</p>
            <p className="text-muted-foreground">
              {displayName} is installed, but Postgres isn&apos;t preloading its
              library, so it won&apos;t work.{' '}
              <TextLink href={getExtensionDocsUrl(extension.name)} external>
                Learn more
              </TextLink>
            </p>
          </div>
          <Button size="sm" onClick={handlePreload}>
            Add to preloaded libraries…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ExtensionName({
  extension,
  preloadedLibraries,
  onAction,
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
      {isExtensionPreloadMissing(extension, preloadedLibraries) ? (
        <PreloadWarning extension={extension} onAction={onAction} />
      ) : (
        <PreloadHint
          name={extension.name}
          preloadedLibraries={preloadedLibraries}
        />
      )}
    </div>
  );
}
