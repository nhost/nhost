import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function TrashIcon(props: IconProps) {
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
        d="M13.5 3.5h-11M6.5 6.5v4M9.5 6.5v4M12.5 3.5V13a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V3.5M10.5 3.5v-1a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v1"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

TrashIcon.displayName = 'NhostTrashIcon';

export default TrashIcon;
