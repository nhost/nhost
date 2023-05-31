import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function RocketIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Rocket"
      strokeWidth={1.5}
      {...props}
    >
      <path
        d="M9 14H7M7.686 1.235C6.499 2.185 2.528 5.985 6 12h4c3.4-6.01-.513-9.809-1.687-10.763a.499.499 0 0 0-.627-.002v0Z"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="m4.617 6.96-1.96 2.351a.5.5 0 0 0-.104.429l.773 3.477a.5.5 0 0 0 .8.282L6 12M11.346 6.915l1.997 2.396a.499.499 0 0 1 .104.429l-.773 3.477a.5.5 0 0 1-.8.282L10 12"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 6.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

RocketIcon.displayName = 'NhostRocketIcon';

export default RocketIcon;
