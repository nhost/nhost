import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function UsersIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Users"
      {...props}
    >
      <path
        d="M5.5 10a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeMiterlimit="10"
      />
      <path
        d="M9.713 3.621A3.25 3.25 0 1 1 10.595 10M1 12.337a5.501 5.501 0 0 1 9 0M10.595 10a5.493 5.493 0 0 1 4.5 2.337"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

UsersIcon.displayName = 'NhostUsersIcon';

export default UsersIcon;
