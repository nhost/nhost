import { GitBranch } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * Thin strip under the header while you work on a branch, so nobody mistakes
 * a branch for production (or the other way around).
 */
function Banner() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { isReady, currentBranch, production, switchTo } = useDummyBranches();

  if (!isReady || currentBranch.isProduction) {
    return null;
  }

  return (
    <div className="flex h-9 shrink-0 items-center justify-center gap-3 border-warning/40 border-y bg-warning/10 px-4 text-sm">
      <GitBranch className="size-4 shrink-0 text-warning" />
      <p className="truncate">
        You're working on the branch{' '}
        <Link
          href={`/orgs/${orgSlug}/projects/${appSubdomain}/branches?tab=all`}
          className="font-medium font-mono underline-offset-4 hover:underline"
        >
          {currentBranch.name}
        </Link>
        . Changes here don't affect production.
      </p>
      <Button
        variant="outline"
        size="xs"
        className="h-6 shrink-0 bg-background px-2 text-xs"
        onClick={() => switchTo(production.id)}
      >
        Back to production
      </Button>
    </div>
  );
}

export default function BranchModeBanner() {
  const isPlatform = useIsPlatform();
  const router = useRouter();

  if (!isPlatform || !router.query.appSubdomain) {
    return null;
  }

  return <Banner />;
}
