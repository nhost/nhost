import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import {
  isFunctionTab,
  type NhostFunction,
} from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface FunctionListItemProps {
  nhostFunction: NhostFunction;
}

export default function FunctionListItem({
  nhostFunction,
}: FunctionListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, functionSlug, tab } = router.query;

  const slug = nhostFunction.route.replace(/^\//, '');
  const currentSlug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : functionSlug;
  const isSelected = slug === currentSlug;
  const preservedTab = isFunctionTab(tab) ? tab : undefined;
  const href = {
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[...functionSlug]',
    query: {
      orgSlug,
      appSubdomain,
      functionSlug: slug,
      ...(preservedTab ? { tab: preservedTab } : {}),
    },
  };

  return (
    <div className="group">
      <Button
        asChild
        variant="link"
        size="default"
        className={cn(
          'flex h-auto w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          {
            'bg-table-selected': isSelected,
          },
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-full flex-col items-start px-[0.625rem] py-1.5 text-left',
              {
                'text-primary-main': isSelected,
              },
            )}
          >
            <TextWithTooltip
              containerClassName="w-full"
              className={cn('!truncate text-sm+', {
                'text-primary-main': isSelected,
              })}
              truncateMode="middle"
              tailLength={12}
              text={nhostFunction.route}
            />
            <TextWithTooltip
              containerClassName="w-full"
              className="!truncate text-muted-foreground text-xs"
              truncateMode="middle"
              tailLength={12}
              text={nhostFunction.path}
            />
          </Link>
        </div>
      </Button>
    </div>
  );
}
