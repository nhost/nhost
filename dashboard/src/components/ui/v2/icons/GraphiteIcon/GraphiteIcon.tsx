import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function GraphiteIcon(props: IconProps) {
  return (
    <SvgIcon
      width="22"
      height="25"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 25"
      aria-label="Graphite"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.39873 13.0137C12.2825 13.0137 14.6203 10.7138 14.6203 7.87671C14.6203 5.03963 12.2825 2.73973 9.39873 2.73973C6.51497 2.73973 4.17722 5.03963 4.17722 7.87671C4.17722 10.7138 6.51497 13.0137 9.39873 13.0137ZM9.39873 15.7534C13.8205 15.7534 17.4051 12.2269 17.4051 7.87671C17.4051 3.52652 13.8205 0 9.39873 0C4.97696 0 1.39241 3.52652 1.39241 7.87671C1.39241 12.2269 4.97696 15.7534 9.39873 15.7534Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.78481 15.7534C2.78481 19.3471 5.74597 22.2603 9.39873 22.2603C13.0515 22.2603 16.0127 19.3471 16.0127 15.7534H18.7975C18.7975 20.8602 14.5895 25 9.39873 25C4.20796 25 0 20.8602 0 15.7534H2.78481Z"
        fill="currentColor"
      />
      <path
        d="M7.37975 1.36986C7.37975 0.613309 8.00315 0 8.77215 0H20.6076C21.3766 0 22 0.613309 22 1.36986C22 2.12642 21.3766 2.73973 20.6076 2.73973H8.77215C8.00315 2.73973 7.37975 2.12642 7.37975 1.36986Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

GraphiteIcon.displayName = 'NhostGraphiteIcon';

export default GraphiteIcon;
