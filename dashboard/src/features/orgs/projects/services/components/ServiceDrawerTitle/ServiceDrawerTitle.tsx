import { BoxIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface ServiceDrawerTitleProps {
  children: ReactNode;
}

export default function ServiceDrawerTitle({
  children,
}: ServiceDrawerTitleProps) {
  return (
    <div className="flex flex-row items-center space-x-2">
      <BoxIcon className="h-5 w-5" />
      <span>{children}</span>
    </div>
  );
}
