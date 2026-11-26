import Link from 'next/link';
import { useRouter } from 'next/router';
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
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/browser/[...functionSlug]',
    query: {
      orgSlug,
      appSubdomain,
      functionSlug: slug,
      ...(preservedTab ? { tab: preservedTab } : {}),
    },
  };

  return (
    <Link
      href={href}
      className={cn(
        'flex w-full max-w-full flex-col items-start rounded-md py-3.5 pr-[1.625rem] pl-2.5 text-left font-medium text-sm+ hover:bg-accent',
        { 'bg-table-selected text-primary': isSelected },
      )}
    >
      <TextWithTooltip
        containerClassName="w-full"
        className={cn('!truncate text-sm+', {
          'text-primary': isSelected,
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
  );
}
