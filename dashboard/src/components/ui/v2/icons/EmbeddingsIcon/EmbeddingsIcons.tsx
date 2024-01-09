import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function EmbeddingsIcon(props: IconProps) {
  return (
    <SvgIcon
      width="17"
      height="17"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 17 17"
      fill="none"
      aria-label="Embeddings Icon"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.178057 4.04687L4.04687 0.178057C4.28428 -0.0593522 4.6692 -0.0593522 4.90661 0.178057L8.77542 4.04687C9.01283 4.28428 9.01283 4.6692 8.77542 4.90661C8.53801 5.14402 8.15309 5.14402 7.91568 4.90661L5.08466 2.07559L5.08466 12.7664H3.86881L3.86881 2.07559L1.03779 4.90661C0.800384 5.14402 0.415467 5.14402 0.178057 4.90661C-0.0593524 4.6692 -0.0593524 4.28428 0.178057 4.04687Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.9531 8.22458L16.8219 12.0934C17.0594 12.3308 17.0594 12.7157 16.8219 12.9531L12.9531 16.8219C12.7157 17.0594 12.3308 17.0594 12.0934 16.8219C11.856 16.5845 11.856 16.1996 12.0934 15.9622L14.9244 13.1312H4.23357V11.9153H14.9244L12.0934 9.08432C11.856 8.84691 11.856 8.46199 12.0934 8.22458C12.3308 7.98717 12.7157 7.98717 12.9531 8.22458Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

EmbeddingsIcon.displayName = 'NhostEmbeddingsIcon';

export default EmbeddingsIcon;
