import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function TerminalIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Trash"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.49851 3.43968L2.93795 2.94141L1.94141 4.06252L2.50196 4.56079L6.37134 8.00024L2.50196 11.4397L1.94141 11.938L2.93795 13.0591L3.49851 12.5608L7.99851 8.56079C8.15863 8.41847 8.25024 8.21446 8.25024 8.00024C8.25024 7.78601 8.15863 7.582 7.99851 7.43968L3.49851 3.43968ZM7.99987 11.2502H7.24987V12.7502H7.99987H13.9999H14.7499V11.2502H13.9999H7.99987Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

TerminalIcon.displayName = 'NhostTerminalIcon';

export default TerminalIcon;
