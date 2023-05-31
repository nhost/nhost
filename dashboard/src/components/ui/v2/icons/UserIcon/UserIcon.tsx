import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function UserIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="User"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.75 6A3.25 3.25 0 1 1 8 9.25 3.25 3.25 0 0 1 4.75 6Zm6.106 3.795a4.75 4.75 0 1 0-5.713 0 7.758 7.758 0 0 0-3.856 3.33l-.375.649 1.299.75.375-.65A6.252 6.252 0 0 1 8 10.75a6.252 6.252 0 0 1 5.414 3.125l.375.65 1.299-.751-.375-.65a7.753 7.753 0 0 0-3.857-3.329Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

UserIcon.displayName = 'NhostUserIcon';

export default UserIcon;
