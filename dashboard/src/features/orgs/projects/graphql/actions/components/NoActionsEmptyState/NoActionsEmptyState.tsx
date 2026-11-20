import { SiGraphql as GraphQLIcon } from '@icons-pack/react-simple-icons';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/v3/button';
import { CreateActionForm } from '@/features/orgs/projects/graphql/actions/components/CreateActionForm';

export default function NoActionsEmptyState() {
  const { openDrawer } = useDialog();

  return (
    <EmptyState
      icon={GraphQLIcon}
      title="Create your first action"
      description={
        <>
          Actions let you extend your GraphQL API with custom business logic
          running behind an HTTP webhook handler.{' '}
          <a
            href="https://docs.nhost.io/products/graphql"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Learn more about the GraphQL API
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </>
      }
      action={
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
      }
    />
  );
}
