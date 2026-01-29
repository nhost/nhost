import NavLink from 'next/link';
import type { ReactElement } from 'react';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { Text } from '@/components/ui/v2/Text';

export default function NotFoundPage() {
  return (
    <Container className="grid h-screen max-w-2xl grid-flow-row place-content-center place-items-center gap-2 text-center">
      <Text variant="h1" className="font-semibold text-6xl">
        404
      </Text>

      <Text className="font-display font-normal text-lg leading-6">
        Page Not Found
      </Text>

      <NavLink href="/" className="text-primary hover:underline">
        Go back to home page
      </NavLink>
    </Container>
  );
}

NotFoundPage.getLayout = function getLayout(page: ReactElement) {
  return <BaseLayout title="Not Found">{page}</BaseLayout>;
};
