import type { IconProps } from '@/ui/v2/icons';
import SvgIcon from '@/ui/v2/icons/SvgIcon';

function LambdaIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Lambda"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 4h2.382l.974 1.947.381.763L2.429 14h2.323l3.05-5.16 2.303 4.607.277.553H14v-2h-2.382L9.394 7.553l-.625-1.25-.625-1.25-1.25-2.5L6.618 2H3v2Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

LambdaIcon.displayName = 'NhostLambdaIcon';

export default LambdaIcon;
