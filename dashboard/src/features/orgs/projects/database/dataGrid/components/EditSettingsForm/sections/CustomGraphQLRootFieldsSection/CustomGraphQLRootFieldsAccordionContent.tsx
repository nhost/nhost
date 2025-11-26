import { FormInput } from '@/components/form/FormInput';
import { useFormContext } from 'react-hook-form';

export interface CustomGraphQLRootFieldsAccordionContentProps {
  fieldLabel: string;
  key: string;
  commentPath: string;
  fieldNamePath: string;
  fieldPlaceholder: string;
  commentPlaceholder: string;
}

export default function CustomGraphQLRootFieldsAccordionContent({
  fieldLabel,
  key,
  commentPath,
  fieldNamePath,
  fieldPlaceholder,
  commentPlaceholder,
}: CustomGraphQLRootFieldsAccordionContentProps) {
  const form = useFormContext();

  return (
    <div
      key={key}
      className="grid grid-cols-[120px,minmax(0,0.8fr),minmax(0,1fr)] items-center gap-3 bg-background px-4 py-3"
    >
      <span className="text-sm font-medium text-foreground">{fieldLabel}</span>
      <FormInput
        control={form.control}
        name={fieldNamePath}
        label=""
        placeholder={fieldPlaceholder}
        className="font-mono text-foreground"
        containerClassName="space-y-0"
        autoComplete="off"
      />
      <div className="flex gap-0">
        <FormInput
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
