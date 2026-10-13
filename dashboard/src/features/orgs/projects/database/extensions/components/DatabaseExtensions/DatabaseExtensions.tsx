import { Search, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import type { ExtensionAction } from '@/features/orgs/projects/database/extensions/components/ExtensionActionControl';
import { ExtensionsGrid } from '@/features/orgs/projects/database/extensions/components/ExtensionsGrid';
import { ExtensionsTable } from '@/features/orgs/projects/database/extensions/components/ExtensionsTable';
import { InstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/InstallExtensionDialog';
import { PreloadExtensionDialog } from '@/features/orgs/projects/database/extensions/components/PreloadExtensionDialog';
import { UninstallExtensionDialog } from '@/features/orgs/projects/database/extensions/components/UninstallExtensionDialog';
import {
  EXTENSIONS_DOCS_URL,
  POPULAR_EXTENSIONS,
} from '@/features/orgs/projects/database/extensions/constants';
import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePostgresExtensionsQuery } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import { usePreloadedLibrariesQuery } from '@/features/orgs/projects/database/extensions/hooks/usePreloadedLibrariesQuery';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';
import { isExtensionPreloadMissing } from '@/features/orgs/projects/database/extensions/utils/isExtensionPreloadMissing';

const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

type InstallFilter = 'all' | 'installed' | 'available';

const INSTALL_FILTERS: Array<{ value: InstallFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'installed', label: 'Installed' },
  { value: 'available', label: 'Available' },
];

function matchesInstallFilter(
  extension: PostgresExtension,
  filter: InstallFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }

  return (extension.installed_version !== null) === (filter === 'installed');
}

interface DialogState {
  action: ExtensionAction;
  extension: PostgresExtension;
  // Remounts the dialog so every open starts with fresh SQL and no error.
  key: number;
  // Receives focus again when the dialog closes.
  opener: HTMLElement | null;
}

function MissingPreloadAlert({
  extensions,
}: {
  extensions: PostgresExtension[];
}) {
  const isSingle = extensions.length === 1;
  const names = LIST_FORMAT.format(
    extensions.map((extension) => getExtensionDisplayName(extension.name)),
  );

  return (
    <Alert variant="warning">
      <TriangleAlert className="h-4 w-4" aria-hidden />
      <AlertTitle>
        {isSingle
          ? "1 installed extension isn't preloaded"
          : `${extensions.length} installed extensions aren't preloaded`}
      </AlertTitle>
      <AlertDescription>
        {names} won&apos;t work until Postgres preloads{' '}
        {isSingle ? 'its library' : 'their libraries'}. Select the warning icon
        next to {isSingle ? 'the extension' : 'each extension'} to fix this.
      </AlertDescription>
    </Alert>
  );
}

export default function DatabaseExtensions() {
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const isPlatform = useIsPlatform();
  const [search, setSearch] = useState('');
  const [installFilter, setInstallFilter] = useState<InstallFilter>('all');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dataSource = typeof dataSourceSlug === 'string' ? dataSourceSlug : '';
  const {
    data: extensions = [],
    error,
    isLoading,
  } = usePostgresExtensionsQuery(dataSource);
  const { data: preloadedLibraries } = usePreloadedLibrariesQuery(dataSource);

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
  const searchedExtensions = extensions.filter((extension) =>
    [extension.name, extension.comment, getExtensionDisplayName(extension.name)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const filteredExtensions = searchedExtensions.filter((extension) =>
    matchesInstallFilter(extension, installFilter),
  );
  const popularExtensions = POPULAR_EXTENSIONS.flatMap((name) =>
    extensions.filter((extension) => extension.name === name),
  );
  const missingPreloadExtensions = extensions.filter((extension) =>
    isExtensionPreloadMissing(extension, preloadedLibraries),
  );

  function openDialog(action: ExtensionAction, extension: PostgresExtension) {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setDialog((current) => ({
      action,
      extension,
      key: (current?.key ?? 0) + 1,
      opener,
    }));
    setIsDialogOpen(true);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    dialog?.opener?.focus();
  }

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

      {missingPreloadExtensions.length > 0 && (
        <MissingPreloadAlert extensions={missingPreloadExtensions} />
      )}

      {popularExtensions.length > 0 && (
        <section aria-label="Popular extensions" className="space-y-3">
          <h2 className="font-semibold text-lg">Popular extensions</h2>
          <ExtensionsGrid
            extensions={popularExtensions}
            preloadedLibraries={preloadedLibraries}
            onAction={openDialog}
          />
        </section>
      )}

      <section aria-label="All extensions" className="space-y-3">
        <h2 className="font-semibold text-lg">All extensions</h2>

        <Tabs
          value={installFilter}
          onValueChange={(value) => setInstallFilter(value as InstallFilter)}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search extensions"
                placeholder="Search extensions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 pl-8 text-sm"
              />
            </div>
            <TabsList aria-label="Filter extensions">
              {INSTALL_FILTERS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                  <span className="ml-1.5 text-muted-foreground tabular-nums">
                    {
                      searchedExtensions.filter((extension) =>
                        matchesInstallFilter(extension, value),
                      ).length
                    }
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={installFilter} className="mt-0">
            {filteredExtensions.length > 0 ? (
              <ExtensionsTable
                extensions={filteredExtensions}
                preloadedLibraries={preloadedLibraries}
                onAction={openDialog}
              />
            ) : (
              <DataBrowserEmptyState
                title="No matching extensions"
                description="Try a different search term or filter."
              />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {dialog?.action === 'install' && (
        <InstallExtensionDialog
          key={dialog.key}
          extension={dialog.extension}
          catalog={extensions}
          dataSource={dataSource}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onCloseAutoFocus={restoreFocus}
        />
      )}
      {dialog?.action === 'preload' && (
        <PreloadExtensionDialog
          key={dialog.key}
          extension={dialog.extension}
          dataSource={dataSource}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onCloseAutoFocus={restoreFocus}
        />
      )}
      {dialog?.action === 'uninstall' && (
        <UninstallExtensionDialog
          key={dialog.key}
          extension={dialog.extension}
          dataSource={dataSource}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onCloseAutoFocus={restoreFocus}
        />
      )}
    </div>
  );
}
