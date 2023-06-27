import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

function WarningIcon(props: IconProps, ref: ForwardedRef<SVGSVGElement>) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Warning"
      ref={ref}
      {...props}
    >
      <path
        d="M8 5.5V9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7.135 2.49904L1.63648 11.9986C1.5485 12.1506 1.5021 12.3231 1.50195 12.4987C1.50181 12.6743 1.54792 12.8469 1.63565 12.999C1.72338 13.1512 1.84964 13.2776 2.00172 13.3654C2.15379 13.4533 2.32633 13.4995 2.50196 13.4995H13.499C13.6746 13.4995 13.8472 13.4533 13.9992 13.3654C14.1513 13.2776 14.2776 13.1512 14.3653 12.999C14.453 12.8469 14.4991 12.6743 14.499 12.4987C14.4988 12.3231 14.4524 12.1506 14.3645 11.9986L8.86594 2.49904C8.7781 2.34728 8.6519 2.22129 8.49999 2.1337C8.34809 2.04611 8.17582 2 8.00047 2C7.82512 2 7.65285 2.04611 7.50095 2.1337C7.34904 2.22129 7.22284 2.34728 7.135 2.49904V2.49904Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 12C8.41421 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41421 10.5 8 10.5C7.58579 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58579 12 8 12Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

WarningIcon.displayName = 'NhostWarningIcon';

export default forwardRef(WarningIcon);
