import { isEmptyValue } from '@/lib/utils';
import React from 'react';

// biome-ignore lint/suspicious/noExplicitAny: TODO
export default function getText(data: any): string {
  if (React.isValidElement<{ children?: React.ReactNode }>(data)) {
    const { children } = data.props;
    if (Array.isArray(children)) {
      return children.map(getText).join('');
    }

    if (isEmptyValue(children)) {
      return '';
    }
    return getText(children);
  }
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data);
  }
  return String(data);
}
