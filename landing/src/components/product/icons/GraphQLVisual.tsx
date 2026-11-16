import { FC } from 'react'
import { LineGrid } from '@/components/common/LineGrid'

const GraphQLVisual: FC = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-2">
    <div className="flex h-24 w-24  items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-some dark:bg-default/50">
      <LineGrid className="left-0 right-0 bottom-0 top-0 z-10 translate-x-0 scale-100" />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={0.3}
        stroke="currentColor"
        className="h-28 w-28"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.34 5.964a1.395 1.395 0 0 0-1.338-1.796 1.395 1.395 0 0 0-1.34 1.792L7.441 7.82a1.398 1.398 0 0 0-2.223.263 1.398 1.398 0 0 0 .884 2.057v3.72a1.4 1.4 0 0 0-.88 2.055 1.397 1.397 0 0 0 2.22.267l3.22 1.86a1.395 1.395 0 0 0 1.34 1.79 1.397 1.397 0 0 0 1.325-1.837l3.199-1.847a1.398 1.398 0 0 0 2.253-.232 1.392 1.392 0 0 0-.88-2.055V10.14a1.398 1.398 0 0 0 .883-2.056 1.4 1.4 0 0 0-2.224-.262l-3.219-1.858Zm-1.73.94a1.4 1.4 0 0 0 .78.001l4.215 7.3a1.387 1.387 0 0 0-.394.683H7.79a1.4 1.4 0 0 0-.395-.682l4.216-7.302Zm-.613-.37.038.038-4.217 7.304a1.34 1.34 0 0 0-.052-.013v-3.726a1.394 1.394 0 0 0 1.004-1.74l3.227-1.863Zm1.969.04.038-.037 3.226 1.862a1.394 1.394 0 0 0 1.004 1.738v3.725a1.296 1.296 0 0 0-.052.014l-4.216-7.302Zm3.272 9.07-3.205 1.85a1.392 1.392 0 0 0-1.031-.454c-.396 0-.753.164-1.007.428l-3.223-1.861a1.4 1.4 0 0 0 .015-.055h8.425l.026.092Z"
        />
      </svg>
    </div>
  </div>
)

export default GraphQLVisual
