import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function CopyIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Copy"
      {...props}
    >
      <path
        d="M10.5 10.5h3v-8h-8v3"
        stroke="currentColor"
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10.5 5.5h-8v8h8v-8z"
        stroke="currentColor"
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

CopyIcon.displayName = 'NhostCopyIcon';

export default CopyIcon;
