import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

interface PreviewLocalStorage {
  [key: string]:
    | {
        previewEnabled?: boolean;
      }
    | undefined;
}

export default function usePreviewToggle() {
  const [preview, setPreview] = useSSRLocalStorage<PreviewLocalStorage>(
    'preview',
    {},
  );
  const { project, loading } = useProject();

  // useEffect(() => {
  //   if (project?.id) {
  //     const newPreview = { ...preview };
  //     if (preview[project.id]?.previewEnabled === undefined) {
  //       newPreview[project.id] = { previewEnabled: true };
  //     }
  //     setPreview(newPreview);
  //   }
  // }, [project?.id, preview, setPreview]);

  // if (loading) {
  //   return {
  //     previewEnabled: true,
  //     setPreviewEnabled: () => {},
  //   };
  // }

  const previewEnabled =
    preview[project?.id] === undefined
      ? true
      : Boolean(preview[project?.id]?.previewEnabled);

  const setPreviewEnabled = (value: boolean) => {
    const newPreview = { ...preview };
    newPreview[project?.id] = { previewEnabled: value };
    setPreview(newPreview);
  };

  return {
    previewEnabled,
    setPreviewEnabled,
  };
}
