import { ArrowUpRight, Plus, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { CreateActionForm } from '@/features/orgs/projects/actions/components/CreateActionForm';

export interface NoActionsEmptyStateProps {
  /**
   * Title of the empty state.
   */
  title?: ReactNode;
  /**
   * Description of the empty state.
   */
  description?: ReactNode;
}

export default function NoActionsEmptyState({
  title = 'Create your first action',
  description = 'Actions let you extend your GraphQL API with custom business logic running behind an HTTP webhook handler.',
}: NoActionsEmptyStateProps) {
  const { openDrawer } = useDialog();

  return (
    <div className="flex h-full w-full flex-col items-center bg-background px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-7 flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Workflow className="size-8 text-primary" />
        </div>

        <h3 className="text-balance font-semibold text-2xl tracking-tight">
          {title}
        </h3>

        <p className="mt-3 text-muted-foreground leading-relaxed">
          {description}
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            size="sm"
            className="gap-2"
            onClick={() =>
              openDrawer({
                title: 'Create a New Action',
                component: <CreateActionForm />,
              })
            }
          >
            <Plus className="size-4" />
            New Action
          </Button>

          <a
            href="https://docs.nhost.io/products/graphql"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
          >
            Learn more about the GraphQL API
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
