import { Link } from '@tanstack/react-router';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';

export default function NotFoundPage() {
  return (
    <BaseLayout title="Not Found">
      <Container className="grid h-screen max-w-2xl grid-flow-row place-content-center place-items-center gap-2 text-center">
        <h1 className="font-semibold text-6xl">404</h1>

        <p className="font-display font-normal text-lg leading-6">
          Page Not Found
        </p>

        <Link to="/" className="text-primary hover:underline">
          Go back to home page
        </Link>
      </Container>
    </BaseLayout>
  );
}
