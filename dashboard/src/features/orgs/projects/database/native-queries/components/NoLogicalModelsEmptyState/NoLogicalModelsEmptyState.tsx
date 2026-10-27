import { Database, Plus } from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/v3/button';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';

export default function NoLogicalModelsEmptyState() {
  const { openDrawer } = useDialog();

  return (
    <EmptyState
      icon={Database}
      title="Create your first logical model"
      description="Logical models define reusable field structures for native query results."
      action={
        <Button
          size="sm"
          className="gap-2"
          onClick={() =>
            openDrawer({
              title: 'Create logical model',
              component: <CreateLogicalModelForm />,
            })
          }
        >
          <Plus className="size-4" />
          New logical model
        </Button>
      }
    />
  );
}
