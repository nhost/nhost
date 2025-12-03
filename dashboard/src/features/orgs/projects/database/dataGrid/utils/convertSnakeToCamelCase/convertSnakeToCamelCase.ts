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
      const isAllLower = segment === segment.toLowerCase();
      const isAllUpper = segment === segment.toUpperCase();

      if (index === 0) {
        if (isAllLower || isAllUpper) {
          return segment.toLowerCase();
        }

        return `${segment.charAt(0).toLowerCase()}${segment.slice(1)}`;
      }

      if (isAllLower || isAllUpper) {
        const lowerCased = segment.toLowerCase();

        return `${lowerCased.charAt(0).toUpperCase()}${lowerCased.slice(1)}`;
      }

      return `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`;
    })
    .join('');
}
