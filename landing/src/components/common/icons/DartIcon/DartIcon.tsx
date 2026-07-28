import { DetailedHTMLProps, HTMLProps } from 'react'

export interface DartIconProps
  extends DetailedHTMLProps<HTMLProps<SVGSVGElement>, SVGSVGElement> {}

export default function DartIcon(props: DartIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width="1em"
      height="1em"
      {...props}
    >
      <defs>
        <radialGradient
          id="logosDart0"
          cx="50%"
          cy="50.002%"
          r="50.004%"
          fx="50%"
          fy="50.002%"
          gradientTransform="scale(1 .99985)"
        >
          <stop offset="0%" stopColor="#FFF" stopOpacity=".1"></stop>
          <stop offset="100%" stopColor="#FFF" stopOpacity="0"></stop>
        </radialGradient>
      </defs>
      <path
        fill="#01579B"
        d="M52.209 203.791L8.413 159.995C3.218 154.67 0 147.141 0 139.782c0-3.407 1.92-8.733 3.369-11.782l40.427-84.204z"
      ></path>
      <path
        fill="#40C4FF"
        d="M202.116 52.209L158.32 8.413C154.5 4.573 146.538 0 139.8 0c-5.796 0-11.48 1.167-15.15 3.369L43.815 43.796zM104.418 256h106.111v-45.471l-79.16-25.276l-72.422 25.276z"
      ></path>
      <path
        fill="#29B6F6"
        d="M43.796 180.209c0 13.513 1.694 16.826 8.413 23.582l6.738 6.738h151.582l-74.097-84.204l-92.636-82.53z"
      ></path>
      <path
        fill="#01579B"
        d="M178.534 43.777H43.796L210.529 210.51H256V106.093L202.097 52.19c-7.566-7.585-14.285-8.413-23.563-8.413"
      ></path>
      <path
        fill="#FFF"
        d="M53.903 205.466c-6.738-6.756-8.413-13.419-8.413-25.257V45.47l-1.675-1.675v136.413c-.02 11.838-.02 15.113 10.088 25.257l5.044 5.044z"
        opacity=".2"
      ></path>
      <path
        fill="#263238"
        d="M254.325 104.418v104.417h-45.471l1.675 1.694H256V106.093z"
        opacity=".2"
      ></path>
      <path
        fill="#FFF"
        d="M202.116 52.209c-8.356-8.357-15.188-8.413-25.257-8.413H43.815l1.675 1.675h131.369c5.025 0 17.71-.847 25.257 6.738"
        opacity=".2"
      ></path>
      <path
        fill="url(#logosDart0)"
        d="m254.325 104.418l-52.209-52.21L158.32 8.414C154.5 4.573 146.538 0 139.8 0c-5.796 0-11.48 1.167-15.15 3.369L43.815 43.796L3.388 128c-1.45 3.068-3.37 8.394-3.37 11.782c0 7.359 3.238 14.868 8.414 20.213l40.351 40.07c.96 1.185 2.09 2.39 3.426 3.726l1.675 1.675l5.044 5.044l43.796 43.796l1.675 1.675H210.49v-45.47h45.471V106.092z"
        opacity=".2"
      ></path>
    </svg>
  )
}
