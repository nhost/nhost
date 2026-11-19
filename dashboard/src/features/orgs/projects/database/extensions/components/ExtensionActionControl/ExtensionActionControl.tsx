import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { PROTECTED_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export type ExtensionAction = 'install' | 'uninstall' | 'preload';

export interface ExtensionActionControlProps {
  extension: PostgresExtension;
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

function BuiltInIndicator({ reason }: { reason: string }) {
  const description = `Cannot be uninstalled. ${reason}`;

  return (
    <span className="inline-flex h-9 items-center font-medium text-muted-foreground text-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center">
            <Lock className="mr-1.5 h-4 w-4" aria-hidden />
            Built-in
            <span className="sr-only">. {description}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6} className="max-w-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function ExtensionActionControl({
  extension,
  onAction,
}: ExtensionActionControlProps) {
  const displayName = getExtensionDisplayName(extension.name);
  const isInstalled = extension.installed_version !== null;
  const action: ExtensionAction = isInstalled ? 'uninstall' : 'install';
  const label = isInstalled ? 'Uninstall' : 'Install';
  const protectedReason = PROTECTED_EXTENSIONS.get(extension.name);

  if (isInstalled && protectedReason !== undefined) {
    return <BuiltInIndicator reason={protectedReason} />;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onAction(action, extension)}
      aria-label={`${label} ${displayName}`}
      data-testid={`${action}-extension-${extension.name}`}
    >
      {label}
    </Button>
  );
}
