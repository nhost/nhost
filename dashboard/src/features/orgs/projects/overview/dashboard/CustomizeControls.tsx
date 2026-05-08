import { Check, LayoutGrid, LayoutTemplate, Plus } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';

type CustomizeControlsProps = {
  editing: boolean;
  dirty: boolean;
  onStartEditing: VoidFunction;
  onAddWidget: VoidFunction;
  onOpenTemplates: VoidFunction;
  onDiscard: VoidFunction;
  onSave: VoidFunction;
};

export default function CustomizeControls({
  editing,
  dirty,
  onStartEditing,
  onAddWidget,
  onOpenTemplates,
  onDiscard,
  onSave,
}: CustomizeControlsProps) {
  if (!editing) {
    return (
      <Button
        variant="outline"
        className="flex h-10 items-center gap-2"
        onClick={onStartEditing}
      >
        <LayoutGrid className="h-4 w-4" />
        Customize
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="flex h-10 items-center gap-2"
        onClick={onAddWidget}
      >
        <Plus className="h-4 w-4" />
        Add widget
      </Button>
      <Button
        variant="outline"
        className="flex h-10 items-center gap-2"
        onClick={onOpenTemplates}
      >
        <LayoutTemplate className="h-4 w-4" />
        Templates
      </Button>
      <Button
        variant="ghost"
        className="flex h-10 items-center"
        onClick={onDiscard}
      >
        Discard
      </Button>
      <Button
        className="flex h-10 items-center gap-2"
        onClick={onSave}
        disabled={!dirty}
      >
        <Check className="h-4 w-4" />
        Save layout
      </Button>
    </div>
  );
}
