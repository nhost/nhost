import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

function ExclamationIcon(props: IconProps, ref: ForwardedRef<SVGSVGElement>) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Exclamation mark"
      ref={ref}
      {...props}
    >
      <path
        opacity=".2"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.75 5.5V4h-1.5v5.5h1.5v-4Zm0 5.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

ExclamationIcon.displayName = 'NhostExclamationIcon';

export default forwardRef(ExclamationIcon);
