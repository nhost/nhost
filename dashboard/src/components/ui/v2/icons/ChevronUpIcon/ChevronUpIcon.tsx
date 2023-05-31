import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ChevronUpIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Chevron up"
      {...props}
    >
      <path
        d="m3 10 5-5 5 5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

ChevronUpIcon.displayName = 'NhostChevronUpIcon';

export default ChevronUpIcon;
