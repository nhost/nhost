import { FC } from 'react'
import PostgresElephantIcon from './PostgresElephantIcon'
import { LineGrid } from '@/components/common/LineGrid'

const DatabaseVisual: FC = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
    <div className="h-64 w-64 items-center justify-center rounded-lg border border-divider bg-paper text-brand-light transition-colors group-hover:border-some dark:bg-default/50">
      <LineGrid className="left-0 right-0 bottom-0 top-0 z-10 translate-x-0 scale-100" />
      <PostgresElephantIcon className="h-32 w-32" />
    </div>
  </div>
)

export default DatabaseVisual
