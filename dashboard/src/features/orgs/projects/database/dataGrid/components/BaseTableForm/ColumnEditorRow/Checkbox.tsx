import { useFormContext, useWatch } from 'react-hook-form';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export interface CheckboxProps extends FieldArrayInputProps {
  name: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

export function Checkbox({ name, index, ...props }: CheckboxProps) {
  const { control } = useFormContext();
  const primaryKeyIndices = useWatch({ name: 'primaryKeyIndices' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });

  const isPrimary = primaryKeyIndices.includes(`${index}`);
  const isIdentity = identityColumnIndex === index;

  return (
    <FormCheckbox
      control={control}
      name={name}
      disabled={isGenerated || isIdentity || isPrimary}
      uncheckWhenDisabled
      {...props}
    />
  );
}

export default Checkbox;
