import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';

export interface CustomGraphQLRootFieldsFieldGroupProps {
  disabled?: boolean;
  fieldLabel: string;
  commentPath: string;
  fieldNamePath: string;
  fieldPlaceholder: string;
  commentPlaceholder: string;
}

export default function CustomGraphQLRootFieldsFieldGroup({
  disabled,
  fieldLabel,
  commentPath,
  fieldNamePath,
  fieldPlaceholder,
  commentPlaceholder,
}: CustomGraphQLRootFieldsFieldGroupProps) {
  const form = useFormContext();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)] items-center gap-3 bg-background px-4 py-3">
      <span className="font-medium text-foreground text-sm">{fieldLabel}</span>
      <FormInput
        disabled={disabled}
        control={form.control}
        name={fieldNamePath}
        label=""
        placeholder={fieldPlaceholder}
        className="font-mono text-foreground"
        containerClassName="space-y-0"
        autoComplete="off"
      />
      <div className="-mr-4 flex gap-0">
        <FormInput
          disabled={disabled}
          control={form.control}
          name={commentPath}
          label=""
          placeholder={commentPlaceholder}
          className="text-foreground"
          containerClassName="w-full space-y-0"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
