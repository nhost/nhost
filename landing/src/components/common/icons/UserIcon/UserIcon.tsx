import { DetailedHTMLProps, HTMLProps } from 'react'

export interface UserIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function UserIcon(props: UserIconProps) {
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
        d="M13.334 14v-1.333A2.667 2.667 0 0 0 10.667 10H5.334a2.667 2.667 0 0 0-2.667 2.667V14M8 7.333A2.667 2.667 0 1 0 8 2a2.667 2.667 0 0 0 0 5.333Z"
        stroke="currentColor"
        strokeWidth=".667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
