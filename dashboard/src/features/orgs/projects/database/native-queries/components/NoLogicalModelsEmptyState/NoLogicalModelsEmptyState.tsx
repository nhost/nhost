import { Plus, Shapes } from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';

export default function NoLogicalModelsEmptyState() {
  const { openDrawer } = useDialog();

  return (
    <div className="flex h-full w-full flex-col items-center bg-background px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-7 flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Shapes className="size-8 text-primary" />
        </div>
        <h3 className="font-semibold text-2xl tracking-tight">
          Create your first logical model
        </h3>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Logical models define reusable field structures for native query
          results.
        </p>
        <Button
          size="sm"
          className="mt-8 gap-2"
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
      </div>
    </div>
  );
}
