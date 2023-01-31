import type { IconProps } from '@/ui/v2/icons';
import SvgIcon from '@/ui/v2/icons/SvgIcon';

function PowerIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Power sign"
      strokeWidth={1.5}
      {...props}
    >
      <path
        d="M8 2.00018V6.75018"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        d="M11.0001 3.38955C11.9938 4.03628 12.7519 4.98681 13.1615 6.09946C13.571 7.21212 13.61 8.42733 13.2727 9.56396C12.9354 10.7006 12.2398 11.6978 11.2897 12.407C10.3395 13.1161 9.18562 13.4992 7.99999 13.4992C6.81436 13.4992 5.66047 13.1161 4.7103 12.4069C3.76014 11.6978 3.06457 10.7006 2.72727 9.56394C2.38997 8.4273 2.42899 7.21209 2.83853 6.09944C3.24807 4.98679 4.00619 4.03626 4.9999 3.38953"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

PowerIcon.displayName = 'NhostPowerIcon';

export default PowerIcon;
