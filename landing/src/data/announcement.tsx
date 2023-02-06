import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Link } from '@/components/common/Link'

/**
 * Configure the global announcement here.
 */
const announcement = {
  id: 'nhost-launch-month-announcement-seen',
  content: (
    <Link
      href="/launch-month"
      className="font-display flex items-center justify-center self-center text-center text-opacity-100"
    >
      Nhost Launch Month - February 2023{' '}
      <ArrowRightIcon className="ml-1 h-4 w-4 text-white" />
    </Link>
  ),
}

export default announcement
