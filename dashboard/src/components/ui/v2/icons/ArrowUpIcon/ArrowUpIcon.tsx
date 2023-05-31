import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ArrowUpIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="An arrow pointing upwards"
      {...props}
    >
      <path
        d="M8 13.5v-11M3.5 7 8 2.5 12.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
}

ArrowUpIcon.displayName = 'NhostArrowUpIcon';

export default ArrowUpIcon;
