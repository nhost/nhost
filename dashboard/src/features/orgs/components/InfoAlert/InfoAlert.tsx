import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { type PropsWithChildren, type ReactNode } from 'react';

interface Props {
  title?: string;
  icon?: ReactNode;
}

function InfoAlert({ children, title, icon }: PropsWithChildren<Props>) {
  return (
    <Alert className="bg-[#ebf3ff] dark:bg-[#1b2534]">
      {icon}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-[0.9375rem] leading-[22px]">
        {children}
      </AlertDescription>
    </Alert>
  );
}

export default InfoAlert;
