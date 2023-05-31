import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function PlusIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Plus sign"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.25 8.75v4.75h1.5V8.75h4.75v-1.5H8.75V2.5h-1.5v4.75H2.5v1.5h4.75Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

PlusIcon.displayName = 'NhostPlusIcon';

export default PlusIcon;
