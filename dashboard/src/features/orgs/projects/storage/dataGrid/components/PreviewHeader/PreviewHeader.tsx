import { Switch } from '@/components/ui/v3/switch';
import { usePreviewToggle } from '@/features/orgs/projects/storage/dataGrid/hooks/usePreviewToggle';

export default function PreviewHeader() {
  const { previewEnabled, setPreviewEnabled } = usePreviewToggle();

  const handleChange = (checked: boolean) => {
    setPreviewEnabled(checked);
  };

  return (
    <div className="flex h-8 items-center justify-between px-3">
      Preview
      <Switch
        className="h-[1.15rem] w-8 self-center"
        thumbClassName="h-4 w-4 "
        checked={previewEnabled}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
