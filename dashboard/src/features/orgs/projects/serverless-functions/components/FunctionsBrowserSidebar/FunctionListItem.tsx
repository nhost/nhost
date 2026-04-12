import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface FunctionListItemProps {
  nhostFunction: NhostFunction;
}

export default function FunctionListItem({
  nhostFunction,
}: FunctionListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, functionSlug } = router.query;

  const slug = nhostFunction.route.replace(/^\//, '');
  const isSelected = slug === functionSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/functions/${slug}`;

  return (
    <div className="group pb-1">
      <Button
        asChild
        variant="link"
        size="sm"
        className={cn(
          'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          {
            'bg-table-selected': isSelected,
          },
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-full items-center p-[0.625rem] text-left',
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
              text={nhostFunction.route}
            />
          </Link>
        </div>
      </Button>
    </div>
  );
}
