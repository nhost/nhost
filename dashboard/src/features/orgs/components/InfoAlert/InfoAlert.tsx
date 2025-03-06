import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { cn } from '@/lib/utils';
import { type PropsWithChildren, type ReactNode } from 'react';

interface Props {
  title?: string;
  icon?: ReactNode;
}

function InfoAlert({ children, title, icon }: PropsWithChildren<Props>) {
  const alertClassNames = cn('bg-[#ebf3ff] dark:bg-muted', {
    'flex gap-2 items-center': !!icon,
  });

  const descClassNames = cn('text-[0.9375rem] leading-[22px]', {
    'text-[0.75rem] leading-[1rem]': !!icon,
  });
  return (
    <Alert className={alertClassNames}>
      {icon && <div>{icon}</div>}
      <div>
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className={descClassNames}>
          {children}
        </AlertDescription>
      </div>
    </Alert>
  );
}

export default InfoAlert;
