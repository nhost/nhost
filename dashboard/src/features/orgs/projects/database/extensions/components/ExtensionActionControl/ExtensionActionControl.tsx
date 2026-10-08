import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import {
  PRELOAD_LIBRARY_EXTENSIONS,
  PROTECTED_EXTENSIONS,
} from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export type ExtensionAction = 'install' | 'uninstall';

export interface ExtensionActionControlProps {
  extension: PostgresExtension;
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

export interface PreloadHintProps {
  extensionName: string;
  /**
   * Libraries PostgreSQL preloaded at startup; `undefined` when unknown.
   */
  preloadedLibraries?: string[];
}

export function PreloadHint({
  extensionName,
  preloadedLibraries,
}: PreloadHintProps) {
  if (!PRELOAD_LIBRARY_EXTENSIONS.has(extensionName)) {
    return null;
  }

  const isPreloaded = preloadedLibraries?.includes(extensionName);

  return (
    <InfoTooltip>
      Requires preloading its library (
      <InlineCode>shared_preload_libraries</InlineCode>).
      {isPreloaded === true && ' Already preloaded in this project.'}
      {isPreloaded === false && ' Not preloaded in this project yet.'}
    </InfoTooltip>
  );
}

function BuiltInIndicator({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-9 cursor-help items-center gap-1.5 font-medium text-muted-foreground text-sm">
          <Lock className="h-4 w-4" aria-hidden />
          Built-in
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6} className="max-w-xs">
        Cannot be uninstalled. {reason}
      </TooltipContent>
    </Tooltip>
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
