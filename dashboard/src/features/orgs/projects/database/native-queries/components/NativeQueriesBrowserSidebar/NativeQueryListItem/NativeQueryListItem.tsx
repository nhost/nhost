import { Anchor, SquarePen, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/presentational/InlineCode';
import { DatabaseSearchIcon } from '@/features/orgs/projects/database/native-queries/components/DatabaseSearchIcon';
import { NativeQueriesSidebarListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesSidebarListItem';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const EditNativeQueryRelationships = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/EditNativeQueryRelationships'
    ).then((mod) => mod.EditNativeQueryRelationships),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditNativeQueryForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm'
    ).then((mod) => mod.EditNativeQueryForm),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

interface NativeQueryListItemProps {
  query: NativeQueryItem;
  onDelete: (query: NativeQueryItem) => void;
}

export default function NativeQueryListItem({
  query,
  onDelete,
}: NativeQueryListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, querySlug } = router.query;
  const { openDrawer } = useDialog();

  function handleEdit() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit
          <InlineCode className="!text-sm+ font-normal">
            {query.root_field_name}
          </InlineCode>
          native query
        </span>
      ),
      component: <EditNativeQueryForm query={query} />,
    });
  }

  function handleEditRelationships() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit Relationships for
          <InlineCode className="!text-sm+ font-normal">
            {query.root_field_name}
          </InlineCode>
          native query
        </span>
      ),
      component: (
        <EditNativeQueryRelationships queryName={query.root_field_name} />
      ),
      props: {
        PaperProps: { className: 'overflow-hidden' },
      },
    });
  }

  return (
    <NativeQueriesSidebarListItem
      name={query.root_field_name}
      href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/queries/${query.root_field_name}`}
      isSelected={query.root_field_name === querySlug}
      icon={<DatabaseSearchIcon className="h-4 w-4 shrink-0 text-primary" />}
      iconTooltip="Native query"
      actions={[
        {
          icon: <SquarePen className="size-4" />,
          label: 'Edit native query',
          onSelect: handleEdit,
        },
        {
          icon: <Anchor className="size-4" />,
          label: 'Edit Relationships',
          onSelect: handleEditRelationships,
        },
        {
          icon: <Trash2 className="size-4" />,
          label: 'Delete native query',
          onSelect: () => onDelete(query),
          destructive: true,
        },
      ]}
    />
  );
}
