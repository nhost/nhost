import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseForeignKeySchemaValues } from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/BaseForeignKeyForm';

export interface ReferencedKeySelectProps {
  options: CandidateKey[];
  legacyLabel?: string;
  disabled?: boolean;
  onKeyChange: (keyId: string) => void;
}

function getCandidateLabel(candidate: CandidateKey) {
  const kind = candidate.kind === 'primaryKey' ? 'PRIMARY KEY' : 'UNIQUE';
  return `${kind} ${candidate.name} (${candidate.columns.join(', ')})`;
}

export default function ReferencedKeySelect({
  options,
  legacyLabel,
  disabled,
  onKeyChange,
}: ReferencedKeySelectProps) {
  const { control } = useFormContext<BaseForeignKeySchemaValues>();
  const referencedKeyId = useWatch({ control, name: 'referencedKeyId' });

  return (
    <FormSelect
      control={control}
      name="referencedKeyId"
      label="Referenced key"
      placeholder="Select a primary or unique key"
      disabled={disabled}
      className="border-border"
      contentClassName="z-[1400]"
      transform={{
        in: (value: string) => value ?? '',
        out: (value: string) => {
          if (!value) {
            return referencedKeyId;
          }
          onKeyChange(value);
          return value;
        },
      }}
    >
      {legacyLabel && (
        <SelectItem value="legacy">{legacyLabel}</SelectItem>
      )}
      {options.map((candidate) => (
        <SelectItem value={candidate.id} key={candidate.id}>
          {getCandidateLabel(candidate)}
        </SelectItem>
      ))}
    </FormSelect>
  );
}
