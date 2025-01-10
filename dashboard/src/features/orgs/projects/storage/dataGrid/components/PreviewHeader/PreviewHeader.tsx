import { Switch } from '@/components/ui/v2/Switch';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { type ChangeEvent } from 'react';

export default function PreviewHeader() {
  const [preview, setPreview] = useSSRLocalStorage('preview', true);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPreview(e.target.checked);
  };

  return (
    <div className="flex flex-row items-center gap-2 p-2">
      Preview
      <Switch
        className="self-center"
        checked={preview}
        defaultChecked
        onChange={handleChange}
      />
    </div>
  );
}
