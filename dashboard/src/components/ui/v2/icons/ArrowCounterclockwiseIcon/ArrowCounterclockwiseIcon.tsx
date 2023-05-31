import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ArrowCounterclockwiseIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="A counterclockwise arrow"
      {...props}
    >
      <path
        d="M4.99 6.232h-3v-3"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.11 11.89a5.5 5.5 0 1 0 0-7.78L1.99 6.233"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

ArrowCounterclockwiseIcon.displayName = 'NhostArrowCounterclockwiseIcon';

export default ArrowCounterclockwiseIcon;
