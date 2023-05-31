import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function FileTextIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Text file"
      {...props}
    >
      <path
        fill="currentColor"
        clipRule="evenodd"
        d="M3.75 13.25V2.75h5V5.5c0 .414.336.75.75.75h2.75v7h-8.5Zm10-7.722V5.5c0-.215-.09-.41-.236-.546L10.03 1.47a.748.748 0 0 0-.53-.22h-6A1.25 1.25 0 0 0 2.25 2.5v11a1.25 1.25 0 0 0 1.25 1.25h9a1.25 1.25 0 0 0 1.25-1.25V5.528Zm-3.5-1.717.94.939h-.94v-.94Zm-5 3.939h5.5v1.5h-5.5v-1.5Zm.75 2h-.75v1.5h5.5v-1.5H6Z"
      />
    </SvgIcon>
  );
}

FileTextIcon.displayName = 'NhostFileTextIcon';

export default FileTextIcon;
