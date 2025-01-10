import { Switch } from '@/components/ui/v2/Switch';
import { usePreviewToggle } from '@/features/orgs/projects/storage/dataGrid/hooks/usePreviewToggle';
import { type ChangeEvent } from 'react';

export default function PreviewHeader() {
  const { previewEnabled, setPreviewEnabled } = usePreviewToggle();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPreviewEnabled(e.target.checked);
  };

  return (
    <div className="flex flex-row items-center gap-2 p-2">
      Preview
      <Switch
        className="self-center"
        checked={previewEnabled}
        onChange={handleChange}
      />
    </div>
  );
}
