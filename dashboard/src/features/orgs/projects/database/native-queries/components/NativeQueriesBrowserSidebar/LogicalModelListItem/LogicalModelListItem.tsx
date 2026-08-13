import { Shapes, SquarePen, Trash2, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/presentational/InlineCode';
import { NativeQueriesSidebarListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesSidebarListItem';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const EditLogicalModelPermissionsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/EditLogicalModelPermissionsForm'
    ).then((mod) => mod.EditLogicalModelPermissionsForm),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditLogicalModelForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm'
    ).then((mod) => mod.EditLogicalModelForm),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

interface LogicalModelListItemProps {
  model: LogicalModelItem;
  onDelete: (model: LogicalModelItem) => void;
}

export default function LogicalModelListItem({
  model,
  onDelete,
}: LogicalModelListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, modelSlug } = router.query;
  const { openDrawer, closeDrawer } = useDialog();

  function handleEdit() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit
          <InlineCode className="!text-sm+ font-normal">
            {model.name}
          </InlineCode>
          logical model
        </span>
      ),
      component: <EditLogicalModelForm model={model} />,
    });
  }

  function handleEditPermissions() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions for
          <InlineCode className="!text-sm+ font-normal">
            {model.name}
          </InlineCode>
          logical model
        </span>
      ),
      component: (
        <EditLogicalModelPermissionsForm
          logicalModelName={model.name}
          onCancel={closeDrawer}
        />
      ),
      props: {
        PaperProps: { className: 'lg:w-[65%] lg:max-w-7xl' },
      },
    });
  }

  return (
    <NativeQueriesSidebarListItem
      name={model.name}
      href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/models/${model.name}`}
      isSelected={model.name === modelSlug}
      icon={<Shapes className="h-4 w-4 shrink-0 text-primary" />}
      iconTooltip="Logical model"
      actions={[
        {
          icon: <SquarePen className="size-4" />,
          label: 'Edit logical model',
          onSelect: handleEdit,
        },
        {
          icon: <Users className="size-4" />,
          label: 'Edit permissions',
          onSelect: handleEditPermissions,
        },
        {
          icon: <Trash2 className="size-4" />,
          label: 'Delete logical model',
          onSelect: () => onDelete(model),
          destructive: true,
        },
      ]}
    />
  );
}
