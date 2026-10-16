import { GitBranch, ListTree } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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
  const manageHref = `/orgs/${orgSlug}/projects/${appSubdomain}/branches?tab=all`;
  // Already on the Branches page: the shortcut has nowhere to go.
  const onBranchesPage = router.pathname.endsWith('/branches');

  if (!isReady || currentBranch.isProduction) {
    return null;
  }

  return (
    // Moved 1px up, opaque and above the header (z-50 > the header's z-40),
    // so it covers the header's bottom border: no gray line between them.
    <div className="relative z-50 -mt-px shrink-0 bg-background">
      <div className="flex h-9 items-center justify-center gap-3 bg-warning/10 px-4 text-sm">
        <GitBranch className="size-4 shrink-0 text-warning" />
        <p className="truncate">
          You're working on the branch{' '}
          <Link
            href={manageHref}
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
        <Tooltip>
          <TooltipTrigger asChild>
            {onBranchesPage ? (
              // The span keeps the tooltip working on the disabled button.
              <span className="inline-flex shrink-0">
                <Button
                  variant="outline"
                  size="icon-xs"
                  className="bg-background"
                  aria-label="Manage branches"
                  disabled
                >
                  <ListTree />
                </Button>
              </span>
            ) : (
              <Button
                asChild
                variant="outline"
                size="icon-xs"
                className="shrink-0 bg-background"
              >
                <Link href={manageHref} aria-label="Manage branches">
                  <ListTree />
                </Link>
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {onBranchesPage ? "You're in Manage branches" : 'Manage branches'}
          </TooltipContent>
        </Tooltip>
      </div>
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
