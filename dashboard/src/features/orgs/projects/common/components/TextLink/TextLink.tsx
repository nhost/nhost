import { SquareArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { PropsWithChildren } from 'react';

function TextLink({
  href,
  children,
  target = '_blank',
  withIcon = false,
}: PropsWithChildren<{ href: string; target?: string; withIcon?: boolean }>) {
  return (
    <Link
      href={href}
      className="text-[0.9375rem] leading-[1.375rem] text-[#0052cd] hover:underline dark:text-[#3888ff]"
      target={target}
      rel="noopener noreferrer"
    >
      {children}
      {withIcon && <SquareArrowUpRightIcon className="h-4 w-4" />}
    </Link>
  );
}

export default TextLink;
