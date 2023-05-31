import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function XIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="X sign"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m6.94 8-3.97 3.97 1.06 1.06L8 9.06l3.97 3.97 1.06-1.06L9.06 8l3.97-3.97-1.06-1.06L8 6.94 4.03 2.97 2.97 4.03 6.94 8Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

XIcon.displayName = 'NhostXIcon';

export default XIcon;
