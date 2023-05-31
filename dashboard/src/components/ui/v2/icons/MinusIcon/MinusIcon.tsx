import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function MinusIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Minus"
      {...props}
    >
      <path
        d="M2.5 8h11"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

MinusIcon.displayName = 'NhostMinusIcon';

export default MinusIcon;
