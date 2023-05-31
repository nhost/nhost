import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function HomeIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Home"
      {...props}
    >
      <path
        d="M13.5 13.5V7.22a.501.501 0 0 0-.164-.37l-5-4.545a.5.5 0 0 0-.673 0l-5 4.546a.5.5 0 0 0-.163.37V13.5M1 13.5h14"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 13.499v-3.5a.5.5 0 0 0-.5-.5H7a.5.5 0 0 0-.5.5v3.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

HomeIcon.displayName = 'NhostHomeIcon';

export default HomeIcon;
