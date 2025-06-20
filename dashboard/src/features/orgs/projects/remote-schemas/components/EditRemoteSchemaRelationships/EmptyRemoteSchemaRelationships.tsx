import { Button } from '@/components/ui/v3/button';
import { Anchor, PlusIcon } from 'lucide-react';

export interface EmptyRemoteSchemaRelationshipsProps {
  onAddRelationship: () => void;
}

export default function EmptyRemoteSchemaRelationships({
  onAddRelationship,
}: EmptyRemoteSchemaRelationshipsProps) {
  return (
    <div className="mt-8 flex flex-1 flex-col items-center gap-6">
      <Anchor className="h-12 w-12" />
      <div className="flex flex-col gap-2">
        <h4 className="text-center text-xl font-medium tracking-tight">
          No remote schema relationships found
        </h4>
        <p className="text-center leading-7">
          All your remote schema&apos;s relationships will be listed here.
        </p>
      </div>
      <Button className="flex gap-1" onClick={onAddRelationship}>
        <PlusIcon className="h-4 w-4" />
        Add Relationship
      </Button>
    </div>
  );
}
