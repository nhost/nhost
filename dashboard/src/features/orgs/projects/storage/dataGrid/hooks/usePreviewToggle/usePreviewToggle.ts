import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

type PreviewLocalStorage = {
  [key: string]: boolean | undefined;
};

export default function usePreviewToggle() {
  const [preview, setPreview] = useSSRLocalStorage<PreviewLocalStorage>(
    'preview',
    {},
  );
  const { project } = useProject();

  const previewEnabled = preview[project?.id] ?? true;

  const setPreviewEnabled = (value: boolean) => {
    const newPreview = { ...preview };
    newPreview[project?.id] = value;
    setPreview(newPreview);
  };

  return {
    previewEnabled,
    setPreviewEnabled,
  };
}
