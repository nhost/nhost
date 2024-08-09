import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function RepeatIcon(props: IconProps) {
  return (
    <SvgIcon
      aria-label="Repeat"
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11.4062 11.9779H15.9998L13.7035 8L11.4062 11.9779Z"
        fill="currentColor"
      />
      <path
        d="M13.1959 16.2243C13.1959 17.466 11.9655 18.4759 10.4525 18.4759L4.05328 18.4749C2.54037 18.4749 1.30989 17.2444 1.30989 15.7315V4.26843C1.30989 2.75552 2.54034 1.52504 4.05328 1.52504H10.4525C11.9654 1.52504 13.1959 2.535 13.1959 3.77661V6.53613C13.1959 6.81655 13.4235 7.04415 13.7039 7.04415C13.9844 7.04415 14.212 6.81655 14.212 6.53613V3.77557C14.212 1.97409 12.5253 0.508057 10.4526 0.508057L4.05333 0.509073C1.98056 0.509073 0.293945 2.19574 0.293945 4.26846V15.7326C0.293945 17.8054 1.98061 19.492 4.05333 19.492H10.4526C12.5253 19.492 14.212 18.0258 14.212 16.2245L14.212 13.5H13.1959L13.1959 16.2243Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </SvgIcon>
  );
}

RepeatIcon.displayName = 'NhostRepeatIcon';

export default RepeatIcon;
