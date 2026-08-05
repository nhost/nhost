import { Ellipsis, GitBranch, SquarePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import DatabaseSearchIcon from '@/features/orgs/projects/database/native-queries/components/DatabaseSearchIcon';
import EditNativeQueryRelationships from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryRelationships';
import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import { cn } from '@/lib/utils';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

interface NativeQueryListItemProps {
  query: NativeQueryItem;
  onDelete: (query: NativeQueryItem) => void;
}

export default function NativeQueryListItem({
  query,
  onDelete,
}: NativeQueryListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, querySlug } = router.query;
  const { openDrawer } = useDialog();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSelected = query.root_field_name === querySlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/queries/${query.root_field_name}`;

  function handleEdit() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit
          <InlineCode className="!text-sm+ font-normal">
            {query.root_field_name}
          </InlineCode>
          native query
        </span>
      ),
      component: <EditNativeQueryForm query={query} />,
    });
  }

  function handleEditRelationships() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit Relationships for
          <InlineCode className="!text-sm+ font-normal">
            {query.root_field_name}
          </InlineCode>
          native query
        </span>
      ),
      component: (
        <EditNativeQueryRelationships queryName={query.root_field_name} />
      ),
      props: {
        PaperProps: { className: 'overflow-hidden' },
      },
    });
  }

  return (
    <div className="group pb-1">
      <Button
        asChild
        variant="link"
        size="sm"
        className={cn(
          'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          isSelected && 'bg-table-selected',
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-[calc(100%-1.6rem)] items-center gap-1.5 p-[0.625rem] pr-0 text-left',
              isSelected && 'text-primary-main',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DatabaseSearchIcon className="h-4 w-4 shrink-0 text-primary" />
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Native query
              </TooltipContent>
            </Tooltip>
            <TextWithTooltip
              containerClassName="w-full"
              className={cn(
                '!truncate text-sm+',
                isSelected && 'text-primary-main',
              )}
              text={query.root_field_name}
            />
          </Link>

          <DropdownMenu
            modal={false}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'relative z-10 h-6 w-6 border-none bg-transparent px-0 opacity-0 transition-opacity hover:bg-transparent focus-visible:bg-transparent group-hover:opacity-100',
                  (isSelected || isMenuOpen) && 'opacity-100',
                )}
                aria-label={`Actions for ${query.root_field_name}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <Ellipsis className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="w-52 p-0 text-foreground"
              forceMount
            >
              <DropdownMenuItem
                onSelect={handleEdit}
                className={menuItemClassName}
              >
                <SquarePen className="size-4" />
                Edit native query
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleEditRelationships}
                className={menuItemClassName}
              >
                <GitBranch className="size-4" />
                Edit Relationships
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(query)}
                className={cn(
                  menuItemClassName,
                  'text-destructive focus:text-destructive',
                )}
              >
                <Trash2 className="size-4" />
                Delete native query
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Button>
    </div>
  );
}
