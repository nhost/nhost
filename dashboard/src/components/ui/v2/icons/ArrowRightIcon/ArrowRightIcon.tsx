import type { IconProps } from '@/components/ui/v2/icons';

function ArrowRightIcon(props: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="An arrow pointing to the right"
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

ArrowRightIcon.displayName = 'NhostArrowRightIcon';

export default ArrowRightIcon;
