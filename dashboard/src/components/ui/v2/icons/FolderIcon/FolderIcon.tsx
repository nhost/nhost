import type { IconProps } from '@/ui/v2/icons';
import SvgIcon from '@/ui/v2/icons/SvgIcon';

function FolderIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="A monochrome folder"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.75 4.25v-.5h2.94l.5.5H2.75ZM1.25 5V3.5A1.25 1.25 0 0 1 2.5 2.25h3.293a1.25 1.25 0 0 1 .884.366L8.31 4.25H13.5a1.25 1.25 0 0 1 1.25 1.25v7.056a1.195 1.195 0 0 1-1.194 1.194H2.459a1.213 1.213 0 0 1-1.209-1.21V5ZM8 5.75H2.75v6.5h10.5v-6.5H8Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

FolderIcon.displayName = 'NhostFolderIcon';

export default FolderIcon;
