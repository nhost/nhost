import { isNotEmptyValue } from '@/lib/utils';

const readFileAsync = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (isNotEmptyValue(e.target?.result)) {
        resolve(e.target.result as string);
      }
    };

    reader.onerror = reject;

    reader.readAsText(file);
  });
};

export default async function readMetadataFile(
  file: File,
): Promise<Record<string, unknown>> {
  try {
    const content = await readFileAsync(file);
    const parsed = JSON.parse(content);
    return parsed.metadata ?? parsed;
  } catch (error) {
    throw new Error(error?.message || 'Failed to parse JSON file.');
  }
}
