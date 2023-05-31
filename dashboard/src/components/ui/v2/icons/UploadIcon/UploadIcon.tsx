import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function UploadIcon(props: IconProps) {
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
        d="M7.46974 1.9696C7.76262 1.6768 8.23738 1.6768 8.53026 1.9696L11.1553 4.59391C11.4482 4.88677 11.4483 5.36164 11.1554 5.65457C10.8625 5.9475 10.3877 5.94757 10.0947 5.65471L8.75 4.31032V9.49999C8.75 9.9142 8.41421 10.25 8 10.25C7.58579 10.25 7.25 9.9142 7.25 9.49999V4.31032L5.90526 5.65471C5.61233 5.94757 5.13746 5.9475 4.8446 5.65457C4.55175 5.36164 4.55181 4.88677 4.84474 4.59391L7.46974 1.9696ZM3.25 9.5C3.25 9.08579 2.91421 8.75 2.5 8.75C2.08579 8.75 1.75 9.08579 1.75 9.5V13C1.75 13.3315 1.8817 13.6495 2.11612 13.8839C2.35054 14.1183 2.66848 14.25 3 14.25H13C13.3315 14.25 13.6495 14.1183 13.8839 13.8839C14.1183 13.6495 14.25 13.3315 14.25 13V9.5C14.25 9.08579 13.9142 8.75 13.5 8.75C13.0858 8.75 12.75 9.08579 12.75 9.5V12.75H3.25V9.5Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

UploadIcon.displayName = 'NhostUploadIcon';

export default UploadIcon;
