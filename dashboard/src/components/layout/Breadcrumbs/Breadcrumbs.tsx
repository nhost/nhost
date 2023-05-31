import { NavLink } from '@/components/common/NavLink';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { twMerge } from 'tailwind-merge';

export interface BreadcrumbsProps extends BoxProps {}

export default function Breadcrumbs({ className, ...props }: BreadcrumbsProps) {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();

  if (!isPlatform) {
    return (
      <Box
        className={twMerge(
          'grid grid-flow-col items-center gap-3 text-sm font-medium',
          className,
        )}
        {...props}
      >
        <Text color="disabled">/</Text>

        <Text className="truncate text-[13px] sm:text-sm">local</Text>

        <Text color="disabled">/</Text>

        <NavLink
          href="/local/local"
          className="truncate text-[13px] hover:underline sm:text-sm"
          sx={{ color: 'text.primary' }}
        >
          local
        </NavLink>
      </Box>
    );
  }

  return (
    <Box
      className={twMerge(
        'grid grid-flow-col items-center gap-3 text-sm font-medium',
        className,
      )}
      {...props}
    >
      {currentWorkspace && (
        <>
          <Text color="disabled">/</Text>

          <NavLink
            href={`/${currentWorkspace.slug}`}
            className="truncate text-[13px] hover:underline sm:text-sm"
            sx={{ color: 'text.primary' }}
          >
            {currentWorkspace.name}
          </NavLink>
        </>
      )}

      {currentProject && (
        <>
          <Text color="disabled">/</Text>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentProject.slug}`}
            className="truncate text-[13px] hover:underline sm:text-sm"
            sx={{ color: 'text.primary' }}
          >
            {currentProject.name}
          </NavLink>
        </>
      )}
    </Box>
  );
}
