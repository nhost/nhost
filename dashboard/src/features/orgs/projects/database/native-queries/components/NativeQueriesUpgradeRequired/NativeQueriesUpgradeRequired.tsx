import Link from 'next/link';
import { useRouter } from 'next/router';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/v3/button';
import { MIN_HASURA_VERSION_NATIVE_QUERIES } from '@/features/orgs/projects/database/native-queries/constants';

export default function NativeQueriesUpgradeRequired() {
  const { orgSlug, appSubdomain } = useRouter().query;

  return (
    <Container className="mx-auto max-w-9xl space-y-5">
      <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
        <div className="flex flex-col space-y-1">
          <h3 className="text-center font-medium text-foreground text-lg">
            GraphQL Engine Too Old
          </h3>
          <p className="max-w-prose text-pretty text-center text-muted-foreground text-sm">
            Native queries require Hasura GraphQL Engine version{' '}
            {MIN_HASURA_VERSION_NATIVE_QUERIES} or later. Please upgrade your
            Hasura service in the Settings page.
          </p>
        </div>
        <Button asChild>
          <Link
            href={`/orgs/${orgSlug}/projects/${appSubdomain}/settings/hasura`}
          >
            Upgrade Hasura
          </Link>
        </Button>
      </div>
    </Container>
  );
}
