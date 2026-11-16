import { FC } from 'react'

const FunctionsVisual: FC = () => (
  <div className="flex h-24 w-full items-center justify-center gap-3 p-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        {/* Heroicon: code-bracket-square */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
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
        {/* Heroicon: cube (represents a module/block) */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
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
        {/* Heroicon: bolt */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    </div>
  </div>
)

export default FunctionsVisual
