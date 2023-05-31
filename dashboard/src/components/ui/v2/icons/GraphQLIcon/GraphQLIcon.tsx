import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';

function GraphQLIcon(props: IconProps) {
  return (
    <SvgIcon
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="Logo of GraphQL"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.611 2.905a1.4 1.4 0 0 0 .779 0l4.216 7.302a1.39 1.39 0 0 0-.393.68H3.787a1.4 1.4 0 0 0-.392-.679L7.61 2.905Zm-.615-.37.04.039-4.217 7.303a1.39 1.39 0 0 0-.055-.015V6.137a1.394 1.394 0 0 0 1.004-1.739l3.228-1.864Zm2.342-.572A1.4 1.4 0 0 0 8 .168a1.395 1.395 0 0 0-1.339 1.793L3.439 3.82a1.398 1.398 0 1 0-1.711 2.17 1.4 1.4 0 0 0 .372.149v3.72a1.4 1.4 0 0 0-.88 2.055 1.397 1.397 0 0 0 2.22.267l3.22 1.859A1.395 1.395 0 0 0 8 15.832a1.397 1.397 0 0 0 1.325-1.836l3.202-1.848a1.398 1.398 0 0 0 2.253-.232 1.392 1.392 0 0 0-.88-2.055V6.14a1.4 1.4 0 0 0 .884-2.056 1.4 1.4 0 0 0-2.225-.261l-3.22-1.86Zm-.373.61.038-.037L12.23 4.4a1.394 1.394 0 0 0 1.005 1.737v3.725l-.054.015-4.217-7.304Zm3.275 9.07-3.208 1.852A1.392 1.392 0 0 0 8 13.04c-.395 0-.752.164-1.006.427l-3.223-1.861.014-.054h8.43c.007.03.015.061.025.091Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

GraphQLIcon.displayName = 'NhostGraphQLIcon';

export default GraphQLIcon;
