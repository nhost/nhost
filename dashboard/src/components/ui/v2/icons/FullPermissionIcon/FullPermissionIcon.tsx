import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function FullPermissionIcon({ sx, ...props }: IconProps) {
  return (
    <SvgIcon
      width="20"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      aria-label="Three filled horizontal lines"
      {...props}
      sx={{ width: 20, height: 20, ...sx }}
    >
      <path fill="currentColor" d="M5 15h10v2.5H5z" />
      <path fill="currentColor" d="M5 8.75h10v2.5H5z" />
      <path fill="currentColor" d="M5 2.5h10V5H5z" />
    </SvgIcon>
  );
}

FullPermissionIcon.displayName = 'NhostFullPermissionIcon';

export default FullPermissionIcon;
