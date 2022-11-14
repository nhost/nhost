import { Text } from '@/ui/Text';
import clsx from 'clsx';

export interface SidebarTitleProps {
  text: string;
  under: boolean;
  setShow?: any;
}

export function SidebarTitle({ text, under, setShow }: SidebarTitleProps) {
  return (
    <button
      type="button"
      className={clsx(
        under && 'mt-14.5',
        'flex flex-row place-content-between',
      )}
      onClick={setShow}
    >
      <Text variant="body" color="greyscaleGrey">
        {text}
      </Text>
    </button>
  );
}
