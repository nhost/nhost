import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function CheckIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Checkmark"
      {...props}
    >
      <path
        d="m13.5 4.5-7 7L3 8"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

CheckIcon.displayName = 'NhostCheckIcon';

export default CheckIcon;
