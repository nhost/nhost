import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror';
import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { cn } from '@/lib/utils';

interface FormCodeEditorProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  /** Rendered between the editor and the validation message (e.g. helper text). */
  children?: ReactNode;
  extensions?: ReactCodeMirrorProps['extensions'];
  readOnly?: boolean;
  className?: string;
  'aria-label'?: string;
}

export default function FormCodeEditor<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  children,
  extensions,
  readOnly = false,
  className,
  'aria-label': ariaLabel,
}: FormCodeEditorProps<TFieldValues, TName>) {
  const theme = useTheme();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex flex-row items-center gap-2">
            {label}
          </FormLabel>
          <FormControl>
            <div>
              <CodeMirror
                aria-label={ariaLabel}
                value={field.value as string}
                onChange={field.onChange}
                theme={
                  theme.palette.mode === 'light' ? githubLight : githubDark
                }
                extensions={extensions}
                readOnly={readOnly}
                editable={!readOnly}
                basicSetup={{
                  foldGutter: false,
                  highlightActiveLine: !readOnly,
                  highlightActiveLineGutter: !readOnly,
                }}
                className={cn(
                  'overflow-hidden rounded-md border text-sm',
                  className,
                )}
              />
            </div>
          </FormControl>
          {children}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
