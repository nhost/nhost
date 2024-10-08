import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { UploadIcon } from '@/components/ui/v2/icons/UploadIcon';
import clsx from 'clsx';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useRef } from 'react';

export type FileUploadButtonProps = Omit<
  ButtonProps,
  'onChange' | 'onChangeCapture'
> &
  Pick<HTMLProps<HTMLInputElement>, 'onChange' | 'onChangeCapture'> & {
    /**
     * Props to be passed to the `<Button />` wrapper element.
     */
    wrapperProps?: Omit<
      DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
      'children'
    >;
    /**
     * Class name to be applied to the `<Button />` element.
     */
    buttonClassName?: string;
  };

export default function FileUploadButton({
  className,
  children,
  wrapperProps = {},
  buttonClassName,
  onChange,
  onChangeCapture,
  ...props
}: FileUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>();

  function handleClick() {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }

  return (
    <div className={clsx('relative', className)} {...wrapperProps}>
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={onChange}
        onChangeCapture={onChangeCapture}
      />

      <Button
        onClick={handleClick}
        startIcon={<UploadIcon className="h-4 w-4" />}
        size="small"
        className={clsx(
          'grid h-full w-full grid-flow-col gap-1',
          buttonClassName,
        )}
        {...props}
      >
        {children}
      </Button>
    </div>
  );
}
