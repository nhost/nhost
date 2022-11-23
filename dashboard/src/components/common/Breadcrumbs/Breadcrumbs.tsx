import NavLink from '@/components/common/NavLink';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface BreadcrumbsProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function Breadcrumbs({ className, ...props }: BreadcrumbsProps) {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  if (!isPlatform) {
    return (
      <div
        className={twMerge(
          'grid grid-flow-col items-center gap-3 text-sm font-medium text-greyscaleDark',
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
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        'grid grid-flow-col items-center gap-3 text-sm font-medium text-greyscaleDark',
        className,
      )}
      {...props}
    >
      {currentWorkspace && (
        <>
          <span className="text-greyscaleGrey">/</span>

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
          <span className="text-greyscaleGrey">/</span>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentApplication.slug}`}
            className="truncate text-[13px] hover:underline sm:text-sm"
          >
            {currentApplication.name}
          </NavLink>
        </>
      )}
    </div>
  );
}
