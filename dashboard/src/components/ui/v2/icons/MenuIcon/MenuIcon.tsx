import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function MenuIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="A standard hamburger menu icon"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 4.75h-11v-1.5h11v1.5Zm0 4h-11v-1.5h11v1.5Zm-11 4h11v-1.5h-11v1.5Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

MenuIcon.displayName = 'NhostMenuIcon';

export default MenuIcon;
