import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function PlayIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Play sign"
      {...props}
    >
      <path
        d="m13.76 7.573-9-5.499a.5.5 0 0 0-.76.427v10.998a.5.5 0 0 0 .76.427l9-5.5a.5.5 0 0 0 0-.853Z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

PlayIcon.displayName = 'NhostPlayIcon';

export default PlayIcon;
