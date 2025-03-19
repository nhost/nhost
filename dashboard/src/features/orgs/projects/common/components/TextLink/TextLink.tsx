import Link from 'next/link';
import type { PropsWithChildren } from 'react';

function TextLink({
  href,
  children,
  target = '_blank',
}: PropsWithChildren<{ href: string; target?: string }>) {
  return (
    <Link
      href={href}
      className="text-[0.9375rem] leading-[1.375rem] text-[#0052cd] hover:underline dark:text-[#3888ff]"
      target={target}
      rel="noopener noreferrer"
    >
      {children}
    </Link>
  );
}

export default TextLink;
