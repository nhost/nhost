import { Shapes, SquarePen, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { DeleteLogicalModelDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteLogicalModelDialog';
import { NativeQueriesSidebarListItem } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesSidebarListItem';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const EditLogicalModelForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm/EditLogicalModelForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

interface LogicalModelListItemProps {
  model: LogicalModelItem;
}

export default function LogicalModelListItem({
  model,
}: LogicalModelListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, modelSlug } = router.query;
  const { openDrawer } = useDialog();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  return (
    <>
      <NativeQueriesSidebarListItem
        name={model.name}
        href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default/models/${encodeURIComponent(model.name)}`}
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
            icon: <Trash2 className="size-4" />,
            label: 'Delete logical model',
            onSelect: () => setDeleteDialogOpen(true),
            destructive: true,
          },
        ]}
      />
      <DeleteLogicalModelDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        model={model}
      />
    </>
  );
}
