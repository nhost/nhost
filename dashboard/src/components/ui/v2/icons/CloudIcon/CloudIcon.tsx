import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function CloudIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Cloud"
      {...props}
    >
      <path
        d="M5 8a5 5 0 1 1 5 5H4.5a3.5 3.5 0 1 1 .87-6.891"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

CloudIcon.displayName = 'NhostCloudIcon';

export default CloudIcon;
