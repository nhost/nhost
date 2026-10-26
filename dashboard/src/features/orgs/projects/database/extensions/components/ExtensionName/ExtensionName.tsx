import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { getExtensionDocsUrl } from '@/features/orgs/projects/database/extensions/utils/getExtensionDocsUrl';
import { isExtensionBuiltIn } from '@/features/orgs/projects/database/extensions/utils/isExtensionBuiltIn';
import { cn } from '@/lib/utils';

export interface ExtensionNameProps {
  extension: PostgresExtension;
  className?: string;
}

function DocsLink({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon-xs"
          // Keeps the 24px hit area from growing the line the icon sits on.
          className="-my-0.5 shrink-0"
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

export default function ExtensionName({
  extension,
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
    </div>
  );
}
