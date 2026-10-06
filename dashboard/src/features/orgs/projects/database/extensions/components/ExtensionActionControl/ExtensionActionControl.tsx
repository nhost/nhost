import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { PROTECTED_EXTENSIONS } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export type ExtensionAction = 'install' | 'uninstall';

export interface ExtensionActionControlProps {
  extension: PostgresExtension;
  onAction: (action: ExtensionAction, extension: PostgresExtension) => void;
}

export function PreloadHint() {
  return (
    <InfoTooltip>
      Requires <InlineCode>shared_preload_libraries</InlineCode>, which Nhost
      preloads by default.
    </InfoTooltip>
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
