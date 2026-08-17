import type { ComponentPropsWithoutRef, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';

export interface FormProps
  extends Omit<ComponentPropsWithoutRef<'form'>, 'onSubmit'> {
  /**
   * Function to be called when the form is submitted.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  onSubmit: (...args: any[]) => any;
}

export default function Form({
  onSubmit,
  onKeyDown,
  className,
  ...props
}: FormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useFormContext();

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== 'Enter' ||
      (!event.ctrlKey && !event.metaKey) ||
      isSubmitting
    ) {
      return;
    }

    const submitButton = Array.from(
      formRef.current!.getElementsByTagName('button'),
    ).find((item) => item.type === 'submit');

    // Disabling submit if the submit button is disabled
    if (submitButton?.disabled) {
      return;
    }

    event.preventDefault();

    handleSubmit(onSubmit)(event);
  }

  return (
    // We want to support form submission using `Ctrl + Enter` and `Cmd + Enter`
    // so keyboard events must be handled on the form element itself.
    <form
      ref={formRef}
      className={cn('box', className)}
      {...props}
      onKeyDown={(event) => {
        if (onKeyDown) {
          onKeyDown(event);
        }

        handleKeyDown(event);
      }}
      onSubmit={handleSubmit(onSubmit)}
    />
  );
}
