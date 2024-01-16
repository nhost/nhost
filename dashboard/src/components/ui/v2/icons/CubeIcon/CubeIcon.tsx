import type { IconProps } from '@/components/ui/v2/icons';

function CubeIcon(props: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M14 11.0826V4.91742C14 4.8287 13.9764 4.74158 13.9316 4.665C13.8868 4.58841 13.8225 4.52513 13.7451 4.48163L8.24513 1.38788C8.17029 1.34578 8.08587 1.32367 8 1.32367C7.91413 1.32367 7.82971 1.34578 7.75487 1.38788L2.25487 4.48163C2.17754 4.52513 2.11318 4.58841 2.0684 4.665C2.02361 4.74158 2 4.8287 2 4.91742V11.0826C2 11.1713 2.02361 11.2584 2.0684 11.335C2.11318 11.4116 2.17754 11.4749 2.25487 11.5184L7.75487 14.6121C7.82971 14.6542 7.91413 14.6763 8 14.6763C8.08587 14.6763 8.17029 14.6542 8.24513 14.6121L13.7451 11.5184C13.8225 11.4749 13.8868 11.4116 13.9316 11.335C13.9764 11.2584 14 11.1713 14 11.0826Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.9311 4.66414L8.0594 8.00001L2.06934 4.66357"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.05916 8L8.00049 14.6763"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

CubeIcon.displayName = 'NhostCubeIcon';

export default CubeIcon;
