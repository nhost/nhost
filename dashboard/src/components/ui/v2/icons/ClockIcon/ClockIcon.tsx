import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ClockIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Chevron down"
      {...props}
    >
      <path
        d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth={1.3}
        fill="none"
      />
      <path
        d="M8 4.5V8h3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
      />
    </SvgIcon>
  );
}

ClockIcon.displayName = 'NhostClockIcon';

export default ClockIcon;
