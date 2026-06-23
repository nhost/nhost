import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormSwitch } from '@/components/form/FormSwitch';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

interface ForwardClientHeadersToggleProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  tooltip: ReactNode;
}

export default function ForwardClientHeadersToggle<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  tooltip,
}: ForwardClientHeadersToggleProps<TFieldValues, TName>) {
  return (
    <FormSwitch
      control={control}
      name={name}
      inline
      labelClassName="w-fit max-w-none whitespace-nowrap"
      label={
        <div className="flex flex-row items-center gap-2">
          {label} <InfoTooltip>{tooltip}</InfoTooltip>
        </div>
      }
    />
  );
}
