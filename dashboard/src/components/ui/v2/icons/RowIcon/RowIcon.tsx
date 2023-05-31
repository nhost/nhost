import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function RowIcon(props: IconProps) {
  return (
    <SvgIcon
      width="20"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      aria-label="Row"
      {...props}
    >
      <path
        d="M17.5 10v5.833a1.666 1.666 0 0 1-1.667 1.667H4.167A1.667 1.667 0 0 1 2.5 15.833V10m15 0h-15m15 0V4.167A1.667 1.667 0 0 0 15.833 2.5H4.167A1.667 1.667 0 0 0 2.5 4.167V10"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path fill="currentColor" d="M17 10v7H3v-7z" />
    </SvgIcon>
  );
}

RowIcon.displayName = 'NhostRowIcon';

export default RowIcon;
