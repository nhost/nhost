import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { useFormContext } from 'react-hook-form';

export interface FormProps extends BoxProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (...args: any[]) => any;
}

export default function Form({ onSubmit, onKeyDown, ...props }: FormProps) {
  const formRef = useRef<HTMLDivElement>();
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useFormContext();

  function handleKeyDown(event: KeyboardEvent) {
    if (
      event.key !== 'Enter' ||
      (!event.ctrlKey && !event.metaKey) ||
      isSubmitting
    ) {
      return;
    }

    const submitButton = Array.from(
      formRef.current.getElementsByTagName('button'),
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
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <Box
      ref={formRef}
      component="form"
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
