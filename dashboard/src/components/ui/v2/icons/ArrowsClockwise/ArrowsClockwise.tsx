import type { IconProps } from '@/components/ui/v2/icons';

function ArrowsClockwise(props: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-label="Update"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11.0103 6.23227H14.0103V3.23227"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.11084 4.11091C4.62156 3.60019 5.22788 3.19506 5.89517 2.91866C6.56246 2.64226 7.27766 2.5 7.99993 2.5C8.7222 2.5 9.4374 2.64226 10.1047 2.91866C10.772 3.19506 11.3783 3.60019 11.889 4.11091L14.0103 6.23223"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.98975 9.76773H1.98975V12.7677"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11.8892 11.8891C11.3785 12.3998 10.7722 12.8049 10.1049 13.0813C9.43762 13.3577 8.72242 13.5 8.00015 13.5C7.27788 13.5 6.56269 13.3577 5.89539 13.0813C5.2281 12.8049 4.62179 12.3998 4.11107 11.8891L1.98975 9.76776"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

ArrowsClockwise.displayName = 'NhostArrowsClockwise';

export default ArrowsClockwise;
