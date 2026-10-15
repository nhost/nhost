import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '@/components/presentational/NotFoundPage';

// Guards send users here when an organization or project does not exist.
// Unknown URLs render the same page through the root's notFoundComponent.
export const Route = createFileRoute('/404')({
  component: NotFoundPage,
});
