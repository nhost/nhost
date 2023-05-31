import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function EyeOffIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Eye crossed out"
      {...props}
    >
      <path
        d="m3 2.5 10 11M9.682 9.85a2.5 2.5 0 0 1-3.364-3.7"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.625 4.287C2.077 5.577 1 8 1 8s2 4.5 7 4.5a7.376 7.376 0 0 0 3.375-.788M13.038 10.569C14.401 9.349 15 8 15 8s-2-4.5-7-4.5c-.433-.001-.865.034-1.292.105"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.47 5.544a2.502 2.502 0 0 1 2.02 2.22"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

EyeOffIcon.displayName = 'NhostEyeOffIcon';

export default EyeOffIcon;
