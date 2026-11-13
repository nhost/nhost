import { ArrowLeft, GitBranch, ListTree } from 'lucide-react';
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
      {/* One centered group: the back button on the left of the message, like
          any back action, and Manage branches right after it. */}
      <div className="flex h-9 items-center justify-center gap-4 bg-success/10 px-4 text-sm">
        {/* Same icon button as Manage branches, its name in the tooltip. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-xs"
              className="shrink-0 bg-background"
              aria-label="Back to production"
              onClick={() => switchTo(production.id)}
            >
              <ArrowLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to production</TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="size-4 shrink-0 text-success" />
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
        </div>
        <div className="flex shrink-0">
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
