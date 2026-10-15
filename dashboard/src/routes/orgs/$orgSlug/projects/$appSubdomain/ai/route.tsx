import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AIArea } from '@/features/orgs/projects/ai/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/ai',
)({
  component: AIAreaLayout,
});

function AIAreaLayout() {
  return (
    <AIArea>
      <Outlet />
    </AIArea>
  );
}
