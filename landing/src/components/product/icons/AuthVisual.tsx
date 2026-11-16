import { FC } from 'react'
import { LineGrid } from '@/components/common/LineGrid'

const AuthVisual: FC = () => (
  <div className="flex h-24 w-full items-center justify-center gap-3 overflow-hidden rounded-md p-2">
    <LineGrid className="left-0 right-0 bottom-0 top-0 z-10 translate-x-0 scale-100" />
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    </div>
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    </div>
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.698 9.931c1.265 1.022 2.872 1.569 4.698 1.569 2.21 0 4.255-.852 5.797-2.288M3 3l3.636 3.636m14.364 14.364L21 21M5.742 21.364A14.935 14.935 0 0012 21.75c2.497 0 4.813-.623 6.75-1.709M12 10.5a8.115 8.115 0 012.414.668"
        />
      </svg>
    </div>
  </div>
)

export default AuthVisual
