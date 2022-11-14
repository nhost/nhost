import NavLink from '@/components/common/NavLink';
import BaseLayout from '@/components/layout/BaseLayout';
import Container from '@/components/layout/Container';
import type { ReactElement } from 'react';

export default function NotFoundPage() {
  return (
    <Container className="absolute top-1/2 left-0 right-0 grid max-w-2xl -translate-y-1/2 grid-flow-row gap-2 text-center">
      <h1 className="text-6xl font-semibold text-dark">404</h1>

      <p className="font-display text-lg font-normal leading-6 text-dark">
        Page Not Found
      </p>

      <NavLink href="/" className="text-sm text-blue hover:underline">
        Go back to home page
      </NavLink>
    </Container>
  );
}

NotFoundPage.getLayout = function getLayout(page: ReactElement) {
  return <BaseLayout title="Not Found">{page}</BaseLayout>;
};
