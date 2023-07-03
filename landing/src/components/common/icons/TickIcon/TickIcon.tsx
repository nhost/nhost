import { DetailedHTMLProps, HTMLProps } from 'react'

export interface TickIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function TickIcon(props: TickIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.05025 12.9497C2.43075 12.3302 2.84164 11.0296 2.52632 10.2675C2.19945 9.47752 1 8.84168 1 7.99998C1 7.15828 2.19945 6.52246 2.52633 5.73246C2.84165 4.97036 2.43075 3.66975 3.05025 3.05025C3.66975 2.43075 4.97037 2.84164 5.73246 2.52632C6.52248 2.19945 7.15832 1 8.00003 1C8.84172 1 9.47754 2.19945 10.2675 2.52633C11.0296 2.84165 12.3302 2.43075 12.9497 3.05025C13.5692 3.66975 13.1584 4.97037 13.4737 5.73246C13.8006 6.52248 15 7.15832 15 8.00003C15 8.84172 13.8005 9.47754 13.4737 10.2675C13.1584 11.0296 13.5692 12.3302 12.9497 12.9497C12.3302 13.5692 11.0296 13.1584 10.2675 13.4737C9.47752 13.8006 8.84168 15 7.99998 15C7.15828 15 6.52246 13.8005 5.73246 13.4737C4.97036 13.1584 3.66975 13.5692 3.05025 12.9497Z"
        fill="currentColor"
      />
      <path
        d="M10.75 6.5L7.08331 10L5.25 8.25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
