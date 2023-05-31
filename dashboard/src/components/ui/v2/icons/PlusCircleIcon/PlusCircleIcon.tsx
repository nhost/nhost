import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function PlusCircleIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Plus sign in a circle"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5ZM1.25 8a6.75 6.75 0 1 1 13.5 0 6.75 6.75 0 0 1-13.5 0Zm6 .75H5v-1.5h2.25V5h1.5v2.25H11v1.5H8.75V11h-1.5V8.75Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

PlusCircleIcon.displayName = 'NhostPlusCircleIcon';

export default PlusCircleIcon;
