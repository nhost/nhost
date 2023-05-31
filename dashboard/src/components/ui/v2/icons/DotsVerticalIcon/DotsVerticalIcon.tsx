import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function DotsVerticalIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Three vertical dots"
      {...props}
    >
      <path
        d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

DotsVerticalIcon.displayName = 'NhostDotsVerticalIcon';

export default DotsVerticalIcon;
