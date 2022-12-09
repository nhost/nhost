import type { IconProps } from '@/ui/v2/icons';

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
        d="M2.5 8h11M9 3.5 13.5 8 9 12.5"
        stroke="currentColor"
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

ArrowLeftIcon.displayName = 'NhostArrowLeftIcon';

export default ArrowLeftIcon;
