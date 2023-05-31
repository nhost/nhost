import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function GaugeIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="A gauge"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.757 3.295A7.25 7.25 0 0 0 8 2.75h-.026c-3.286.011-6.032 2.231-6.92 5.227a.753.753 0 0 0-.081.293 7.359 7.359 0 0 0-.223 1.8v1.43A1.25 1.25 0 0 0 2 12.75h12a1.25 1.25 0 0 0 1.25-1.25V10a7.25 7.25 0 0 0-.246-1.872l-.001-.004V8.12a7.248 7.248 0 0 0-4.246-4.825Zm-2.77 7.955h5.763V10c0-.252-.017-.503-.05-.751l-1.16.31a.75.75 0 1 1-.387-1.448l1.16-.31-.003-.006a5.751 5.751 0 0 0-4.56-3.496V5.5a.75.75 0 0 1-1.5 0V4.3c-2.053.271-3.764 1.645-4.545 3.505l1.142.306A.75.75 0 1 1 3.46 9.56L2.307 9.25a5.895 5.895 0 0 0-.057.82v1.179h3.845l4.05-5.277a.75.75 0 0 1 1.19.913L7.985 11.25Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

GaugeIcon.displayName = 'NhostGaugeIcon';

export default GaugeIcon;
