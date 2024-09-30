import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

function InfoOutlinedIcon(props: IconProps, ref: ForwardedRef<SVGSVGElement>) {
  return (
    <SvgIcon
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-label="Info"
      stroke="currentColor"
      ref={ref}
      {...props}
    >
      <path
        fill="none"
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fill="none"
        d="M12 16V12"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fill="none"
        d="M12 8H12.01"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

InfoOutlinedIcon.displayName = 'NhostInfoOutlinedIcon';

export default forwardRef(InfoOutlinedIcon);
