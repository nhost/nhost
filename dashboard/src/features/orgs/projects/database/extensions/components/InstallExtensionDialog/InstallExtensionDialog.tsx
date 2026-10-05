import { PostgreSQL, sql as sqlLanguage } from '@codemirror/lang-sql';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import {
  getInstallExtensionSQL,
  useSetExtensionInstalledMutation,
} from '@/features/orgs/projects/database/extensions/hooks/useSetExtensionInstalledMutation';
import { useThemePreference } from '@/providers/Theme';

export interface InstallExtensionDialogProps {
  extension: PostgresExtension;
  dataSource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InstallExtensionDialog({
  extension,
  dataSource,
  open,
  onOpenChange,
}: InstallExtensionDialogProps) {
  const { resolvedTheme } = useThemePreference();
  const {
    mutate: installExtension,
    isPending,
    error,
  } = useSetExtensionInstalledMutation(dataSource);
  const [version, setVersion] = useState(extension.default_version ?? '');
  const [sql, setSql] = useState(() => getInstallExtensionSQL(extension.name));
  const displayName = getExtensionDisplayName(extension.name);

  function handleVersionChange(nextVersion: string) {
    setVersion(nextVersion);
    setSql(
      getInstallExtensionSQL(
        extension.name,
        nextVersion === extension.default_version ? undefined : nextVersion,
      ),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent
        disableOutsideClick
        className="flex max-h-[90vh] max-w-2xl flex-col gap-5 overflow-y-auto text-foreground"
      >
        <DialogHeader>
          <DialogTitle>Install {displayName}</DialogTitle>
          <DialogDescription>
            Review the SQL that will run. You can edit it before installing.
          </DialogDescription>
        </DialogHeader>

        {extension.versions.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="install-extension-version">Version</Label>
            <Select
              value={version}
              onValueChange={handleVersionChange}
              disabled={isPending}
            >
              <SelectTrigger id="install-extension-version" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {extension.versions.map((availableVersion) => (
                  <SelectItem key={availableVersion} value={availableVersion}>
                    {availableVersion === extension.default_version
                      ? `${availableVersion} (default)`
                      : availableVersion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Changing the version regenerates the SQL below.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>SQL</Label>
          <CodeMirror
            aria-label="SQL"
            value={sql}
            height="140px"
            className="overflow-hidden rounded-md border"
            theme={resolvedTheme === 'light' ? githubLight : githubDark}
            extensions={[sqlLanguage({ dialect: PostgreSQL })]}
            editable={!isPending}
            onChange={setSql}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not install {displayName}</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap break-words">
              {error.message}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            onClick={() =>
              installExtension(
                { name: extension.name, installed: true, sql },
                { onSuccess: () => onOpenChange(false) },
              )
            }
            loading={isPending}
            disabled={!sql.trim()}
            data-testid="confirm-install-extension"
          >
            Install
          </ButtonWithLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
