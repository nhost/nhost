import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

function InfoIcon(props: IconProps, ref: ForwardedRef<SVGSVGElement>) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Info"
      ref={ref}
      {...props}
    >
      <path
        opacity="0.2"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.5 8.25h.75V11c0 .414.336.75.75.75h1.5v-1.5h-.75V7.5A.75.75 0 0 0 8 6.75H6.5v1.5Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

InfoIcon.displayName = 'NhostInfoIcon';

export default forwardRef(InfoIcon);
