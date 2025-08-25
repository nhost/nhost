import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import NavLink from 'next/link';
import type { ReactElement } from 'react';

export default function NotFoundPage() {
  return (
    <Container className="grid h-screen max-w-2xl grid-flow-row place-content-center place-items-center gap-2 text-center">
      <Text variant="h1" className="text-6xl font-semibold">
        404
      </Text>

      <Text className="font-display text-lg font-normal leading-6">
        Page Not Found
      </Text>

      <NavLink href="/" passHref legacyBehavior>
        <Link href="/" underline="hover">
          Go back to home page
        </Link>
      </NavLink>
    </Container>
  );
}

NotFoundPage.getLayout = function getLayout(page: ReactElement) {
  return <BaseLayout title="Not Found">{page}</BaseLayout>;
};
