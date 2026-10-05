import { Search } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionsGrid';
import { ExtensionsGrid } from '@/features/orgs/projects/database/extensions/components/ExtensionsGrid';
import { InstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/InstallExtensionDialog';
import { UninstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/UninstallExtensionDialog';
import {
  EXTENSIONS_DOCS_URL,
  getExtensionDisplayName,
  POPULAR_EXTENSIONS,
} from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePostgresExtensionsQuery } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';

interface DialogState {
  action: ExtensionAction;
  extension: PostgresExtension;
  // Remounts the dialog so every open starts with fresh SQL and no error.
  key: number;
}

export default function DatabaseExtensions() {
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const isPlatform = useIsPlatform();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dataSource = typeof dataSourceSlug === 'string' ? dataSourceSlug : '';
  const {
    data: extensions = [],
    error,
    isLoading,
  } = usePostgresExtensionsQuery(dataSource);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    throw error;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredExtensions = extensions.filter((extension) =>
    [extension.name, extension.comment, getExtensionDisplayName(extension.name)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch),
  );
  // Popular is a browsing aid; hide it while searching so results appear once.
  const popularExtensions = normalizedSearch
    ? []
    : POPULAR_EXTENSIONS.flatMap((name) =>
        extensions.filter((extension) => extension.name === name),
      );

  function openDialog(action: ExtensionAction, extension: PostgresExtension) {
    setDialog((current) => ({
      action,
      extension,
      key: (current?.key ?? 0) + 1,
    }));
    setIsDialogOpen(true);
  }

  const ExtensionDialog =
    dialog?.action === 'install'
      ? InstallExtensionDialog
      : UninstallExtensionDialog;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">Database extensions</h1>
        <p className="text-muted-foreground">
          Install and manage the PostgreSQL extensions available to this
          database.{' '}
          <TextLink href={EXTENSIONS_DOCS_URL} external>
            Learn more
          </TextLink>
        </p>
        {!isPlatform && (
          <p className="text-muted-foreground text-sm">
            Installing or uninstalling an extension creates a migration in your
            project.
          </p>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search extensions"
          placeholder="Search extensions..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 pl-8 text-sm"
        />
      </div>

      {popularExtensions.length > 0 && (
        <ExtensionsGrid
          ariaLabel="Popular extensions"
          extensions={popularExtensions}
          onAction={openDialog}
        />
      )}

      {filteredExtensions.length > 0 ? (
        <ExtensionsGrid
          ariaLabel="All extensions"
          extensions={filteredExtensions}
          onAction={openDialog}
        />
      ) : (
        <DataBrowserEmptyState
          title="No matching extensions"
          description="Try a different search term."
        />
      )}

      {dialog && (
        <ExtensionDialog
          key={dialog.key}
          extension={dialog.extension}
          dataSource={dataSource}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </div>
  );
}
