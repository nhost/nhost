import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

const readFileAsync = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (isNotEmptyValue(e.target?.result)) {
        resolve(e.target.result as string);
      }
    };

    reader.onerror = () =>
      reject(new Error('Failed to read the selected file.'));

    reader.readAsText(file);
  });
};

export default async function readMetadataFile(
  file: File,
): Promise<Record<string, unknown>> {
  const content = await readFileAsync(file);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('The selected file does not contain valid JSON.');
  }

  const metadata = (parsed.metadata ?? parsed) as Record<string, unknown>;
  if (isEmptyValue(metadata)) {
    throw new Error('Failed to parse metadata.');
  }
  return metadata;
}
