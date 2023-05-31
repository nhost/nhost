import type { IconProps } from '@/components/ui/v2/icons';

function ArrowLeftIcon(props: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="An arrow pointing to the left"
      {...props}
    >
      <path
        d="M13.5 8h-11M7 3.5 2.5 8 7 12.5"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

ArrowLeftIcon.displayName = 'NhostArrowLeftIcon';

export default ArrowLeftIcon;
