import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function ArrowSquareOutIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Arrow in a square pointing outwards"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.75 1.75h3.75a.75.75 0 0 1 .75.75v3.75h-1.5V4.31l-3.221 3.222-1.061-1.06 3.221-3.222h-1.94l.001-1.5ZM8 5.25H4.25v7.5h7.5V9h1.5v4A1.25 1.25 0 0 1 12 14.25H4A1.25 1.25 0 0 1 2.75 13V5A1.25 1.25 0 0 1 4 3.75h4v1.5Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

ArrowSquareOutIcon.displayName = 'NhostArrowSquareOutIcon';

export default ArrowSquareOutIcon;
