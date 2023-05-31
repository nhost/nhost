import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function KeyIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Key"
      {...props}
    >
      <path
        d="M5.823 7.677a4.496 4.496 0 1 1 2.5 2.5L7.5 11H6v1.5H4.5V14H2v-2.5l3.823-3.823Z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M10.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

KeyIcon.displayName = 'NhostKeyIcon';

export default KeyIcon;
