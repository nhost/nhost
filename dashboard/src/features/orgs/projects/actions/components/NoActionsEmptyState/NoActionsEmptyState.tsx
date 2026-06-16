import { ArrowUpRight, Plus, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import type { BaseActionFormTriggerProps } from '@/features/orgs/projects/actions/components/BaseActionForm';
import { CreateActionForm } from '@/features/orgs/projects/actions/components/CreateActionForm';

const renderNewActionButton = ({ open }: BaseActionFormTriggerProps) => (
  <Button size="sm" className="gap-2" onClick={() => open()}>
    <Plus className="size-4" />
    New Action
  </Button>
);

export default function NoActionsEmptyState() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]"
      />

      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="relative mb-7">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"
          />
          <div className="relative flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
            <Workflow className="size-8 text-primary" />
          </div>
        </div>

        <h3 className="text-balance font-semibold text-2xl tracking-tight">
          Create your first action
        </h3>

        <p className="mt-3 text-muted-foreground leading-relaxed">
          Actions let you extend your GraphQL API with custom business logic
          running behind an HTTP webhook handler.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <CreateActionForm trigger={renderNewActionButton} />

          <a
            href="https://docs.nhost.io/products/graphql"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
          >
            Learn more about GraphQL
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
