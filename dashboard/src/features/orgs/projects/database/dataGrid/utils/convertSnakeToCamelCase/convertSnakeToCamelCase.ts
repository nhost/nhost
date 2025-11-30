export default function convertSnakeToCamelCase(value?: string | null): string {
  const normalizedValue = value ?? '';

  if (!normalizedValue) {
    return '';
  }

  if (!normalizedValue.includes('_')) {
    return normalizedValue;
  }

  const parts = normalizedValue.split('_').filter(Boolean);

  if (!parts.length) {
    return '';
  }

  return parts
    .map((segment, index) => {
      const lowerCased = segment.toLowerCase();

      if (index === 0) {
        return lowerCased;
      }

      return `${lowerCased.charAt(0).toUpperCase()}${lowerCased.slice(1)}`;
    })
    .join('');
}
