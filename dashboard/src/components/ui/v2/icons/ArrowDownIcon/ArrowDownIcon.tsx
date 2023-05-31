import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ArrowDownIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="An arrow pointing downwards"
      {...props}
    >
      <path
        d="M8 2.5v11M3.5 9 8 13.5 12.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

ArrowDownIcon.displayName = 'NhostArrowDownIcon';

export default ArrowDownIcon;
