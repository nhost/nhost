import { DetailedHTMLProps, HTMLProps } from 'react'

export interface VueIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function VueIcon(props: VueIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#clip0_210_13833)">
        <path
          d="M10.4549 3.59995L9.00004 6.11989L7.54516 3.59995H2.7002L9.00004 14.5117L15.2999 3.59995H10.4549Z"
          fill="currentColor"
        />
        <path
          d="M10.455 3.60004L9.00012 6.11998L7.54524 3.60004H5.22021L9.00012 10.147L12.78 3.60004H10.455Z"
          fill="#666666"
        />
      </g>
      <defs>
        <clipPath id="clip0_210_13833">
          <rect
            width="12.6"
            height="10.9119"
            fill="currentColor"
            transform="translate(2.7002 3.6001)"
          />
        </clipPath>
      </defs>
    </svg>
  )
}
