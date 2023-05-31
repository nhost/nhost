import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function StorageIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Storage"
      {...props}
    >
      <path
        d="M14.667 8H1.333M3.633 3.407 1.333 8v4a1.333 1.333 0 0 0 1.334 1.334h10.666A1.333 1.333 0 0 0 14.667 12V8l-2.3-4.593a1.333 1.333 0 0 0-1.194-.74H4.827a1.333 1.333 0 0 0-1.194.74v0ZM4 10.667h.008M6.667 10.667h.007"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
}

StorageIcon.displayName = 'NhostStorageIcon';

export default StorageIcon;
