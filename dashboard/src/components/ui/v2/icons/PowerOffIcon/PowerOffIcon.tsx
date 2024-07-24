import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function PowerOffIcon(props: IconProps) {
  return (
    <SvgIcon
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path
        fill="none"
        d="M18.36 6.64A9 9 0 0 1 20.77 15M6.16 6.16a9 9 0 1 0 12.68 12.68M12 2v4M2 2l20 20"
      />
    </SvgIcon>
  );
}

PowerOffIcon.displayName = 'NhostPowerOffIcon';

export default PowerOffIcon;
