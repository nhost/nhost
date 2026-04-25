import { ChevronDown } from 'lucide-react'
import type { IconProps } from '@/components/ui/v2/icons'

function ChevronDownIcon({ className, ...props }: IconProps) {
  return (
    <ChevronDown
      aria-label="Chevron down"
      width={16}
      height={16}
      className={className}
      {...props}
    />
  )
}

ChevronDownIcon.displayName = 'NhostChevronDownIcon'

export default ChevronDownIcon

// import type { IconProps } from '@/components/ui/v2/icons';
// import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

// function ChevronDownIcon(props: IconProps) {
//   return (
//     <SvgIcon
//       width="16"
//       height="16"
//       xmlns="http://www.w3.org/2000/svg"
//       viewBox="0 0 16 16"
//       aria-label="Chevron down"
//       {...props}
//     >
//       <path
//         d="m13 6-5 5-5-5"
//         stroke="currentColor"
//         fill="none"
//         strokeWidth="1.5"
//         strokeLinejoin="round"
//       />
//     </SvgIcon>
//   );
// }

// ChevronDownIcon.displayName = 'NhostChevronDownIcon';

// export default ChevronDownIcon;
