import Link from 'next/link'
import { ArrowRightIcon } from './icons/ArrowRightIcon'

const Top = () => {
  return (
    <div className="bg-blue bordering w-full py-2 shadow-2xl">
      <div className="mx-auto flex max-w-full flex-row">
        <div className="mx-auto">
          <Link
            href="/launch-month"
            className="font-display flex items-center justify-center self-center text-center font-normal text-white antialiased"
          >
            Nhost Launch Month - February 2023{' '}
            <ArrowRightIcon className="ml-1 h-4 w-4 font-medium text-white" />
          </Link>
        </div>
      </div>
    </div>
  )
}
export default Top
