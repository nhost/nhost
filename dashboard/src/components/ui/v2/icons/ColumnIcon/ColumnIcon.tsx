import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ColumnIcon(props: IconProps) {
  return (
    <SvgIcon
      width="20"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      aria-label="Column"
      {...props}
    >
      <path
        d="M10 2.5h5.833A1.666 1.666 0 0 1 17.5 4.167v11.666a1.666 1.666 0 0 1-1.667 1.667H10m0-15v15m0-15H4.167A1.667 1.667 0 0 0 2.5 4.167v11.666A1.666 1.666 0 0 0 4.167 17.5H10"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path fill="currentColor" d="M10 3h7v14h-7z" />
    </SvgIcon>
  );
}

ColumnIcon.displayName = 'NhostColumnIcon';

export default ColumnIcon;
