import NavLink from '@/components/common/NavLink';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import Text from '@/ui/v2/Text';
import { twMerge } from 'tailwind-merge';

export interface BreadcrumbsProps extends BoxProps {}

export default function Breadcrumbs({ className, ...props }: BreadcrumbsProps) {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  if (!isPlatform) {
    return (
      <Box
        className={twMerge(
          'grid grid-flow-col items-center gap-3 text-sm font-medium',
          className,
        )}
        {...props}
      >
        <span className="text-greyscaleGrey">/</span>

        <span className="truncate text-[13px] sm:text-sm">local</span>

        <span className="text-greyscaleGrey">/</span>

        <NavLink
          href="/local/local"
          className="truncate text-[13px] hover:underline sm:text-sm"
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
          <Text sx={{ color: 'text.disabled' }}>/</Text>

          <NavLink
            href={`/${currentWorkspace.slug}`}
            className="truncate text-[13px] hover:underline sm:text-sm"
          >
            {currentWorkspace.name}
          </NavLink>
        </>
      )}

      {currentApplication && (
        <>
          <Text sx={{ color: 'text.disabled' }}>/</Text>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentApplication.slug}`}
            className="truncate text-[13px] hover:underline sm:text-sm"
          >
            {currentApplication.name}
          </NavLink>
        </>
      )}
    </Box>
  );
}
