import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function DotsHorizontalIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Three horizontal dots"
      {...props}
    >
      <path
        d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM13 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

DotsHorizontalIcon.displayName = 'NhostDotsHorizontalIcon';

export default DotsHorizontalIcon;
