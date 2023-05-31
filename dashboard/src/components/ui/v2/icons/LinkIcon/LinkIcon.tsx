import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function LinkIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="A link"
      strokeWidth="1.5"
      {...props}
    >
      <path
        d="m5.879 10.12 4.242-4.242M9.06 11.182 7.294 12.95A3 3 0 0 1 3.05 8.707l1.768-1.768M11.182 9.06l1.768-1.768A3 3 0 0 0 8.707 3.05L6.94 4.818"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
}

LinkIcon.displayName = 'NhostLinkIcon';

export default LinkIcon;
