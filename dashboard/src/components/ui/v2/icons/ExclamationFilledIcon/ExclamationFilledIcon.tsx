import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

function ExclamationFilledIcon(
  props: IconProps,
  ref: ForwardedRef<SVGSVGElement>,
) {
  return (
    <SvgIcon
      width="7"
      height="7"
      viewBox="0 0 7 7"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Exclamation mark"
      ref={ref}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 3.5C7 5.433 5.433 7 3.5 7C1.567 7 0 5.433 0 3.5C0 1.567 1.567 0 3.5 0C5.433 0 7 1.567 7 3.5ZM3.96667 5.36667C3.96667 5.6244 3.75773 5.83333 3.5 5.83333C3.24227 5.83333 3.03333 5.6244 3.03333 5.36667C3.03333 5.10893 3.24227 4.9 3.5 4.9C3.75773 4.9 3.96667 5.10893 3.96667 5.36667ZM3.5 1.16667C3.20564 1.16667 2.97296 1.41615 2.99345 1.70979L3.16724 4.20075C3.17943 4.37554 3.32478 4.51111 3.5 4.51111C3.67522 4.51111 3.82057 4.37554 3.83276 4.20075L4.00655 1.70979C4.02704 1.41615 3.79436 1.16667 3.5 1.16667Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

ExclamationFilledIcon.displayName = 'NhostExclamationFilledIcon';

export default forwardRef(ExclamationFilledIcon);
