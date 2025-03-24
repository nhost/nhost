import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { cn } from '@/lib/utils';
import { type PropsWithChildren, type ReactNode } from 'react';

interface Props {
  title?: string;
  icon?: ReactNode;
  borderLess?: boolean;
}

function InfoAlert({
  children,
  title,
  icon,
  borderLess = false,
}: PropsWithChildren<Props>) {
  const alertClassNames = cn('bg-[#ebf3ff] dark:bg-muted', {
    'flex gap-2 items-center': !!icon,
    'border-none': borderLess,
  });

  const descClassNames = cn('text-[0.9375rem] leading-6', {
    'text-[0.875rem] leading-6': !!icon,
  });
  return (
    <Alert className={alertClassNames}>
      {icon && <div>{icon}</div>}
      <div>
        {title && <AlertTitle>{title}</AlertTitle>}
        {children && (
          <AlertDescription className={descClassNames}>
            {children}
          </AlertDescription>
        )}
      </div>
    </Alert>
  );
}

export default InfoAlert;
