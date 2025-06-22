import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import type { RemoteSchemaRelationshipType } from '../../../types/remoteSchemas';

export interface RelationshipTypeSectionProps {
  onChange: (value: RemoteSchemaRelationshipType) => void;
  value: RemoteSchemaRelationshipType;
  disabled?: boolean;
}

export default function RelationshipTypeSection({
  onChange,
  value,
  disabled,
}: RelationshipTypeSectionProps) {
  return (
    <div className="space-y-4 px-6">
      <div>
        <h4 className="text-lg font-medium">Relationship Type</h4>
        <p className="text-sm text-muted-foreground">
          {disabled
            ? 'Type of the relationship you want to edit.'
            : 'Choose the type of relationship you want to create.'}
        </p>
      </div>

      <RadioGroup
        onValueChange={onChange}
        value={value}
        className="flex flex-row gap-8"
        disabled={disabled}
      >
        <div className="flex w-full">
          <Label
            htmlFor="remote-schema"
            className={`flex w-full flex-row items-center justify-between space-y-0 rounded-md border p-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex flex-row items-center space-x-3">
              <RadioGroupItem value="remote-schema" id="remote-schema" />
              <div className="flex flex-col space-y-1">
                <div className="text-md font-semibold">Remote Schema</div>
                <p className="text-xs text-muted-foreground">
                  Relationship from this remote schema to another remote schema.
                </p>
              </div>
            </div>
          </Label>
        </div>

        <div className="flex w-full">
          <Label
            htmlFor="database"
            className={`flex w-full flex-row items-center justify-between space-y-0 rounded-md border p-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex flex-row items-center space-x-3">
              <RadioGroupItem value="database" id="database" />
              <div className="flex flex-col space-y-1">
                <div className="text-md font-semibold">Database</div>
                <p className="text-xs text-muted-foreground">
                  Relationship from this remote schema to a database table.
                </p>
              </div>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
