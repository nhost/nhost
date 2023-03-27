import { test } from 'vitest';
import getTruncatedText from './getTruncatedText';

test('should return the same text if maxLength is lower than text length', () => {
  expect(getTruncatedText('test', 15)).toBe('test');
});

test('should return the truncated text', () => {
  expect(getTruncatedText('long text comes here', 5)).toBe('long...');
});

test('should return the truncated text with ellipsis at the start', () => {
  expect(getTruncatedText('long text comes here', 5, 'start')).toBe('...here');
});

test('should return the truncated text with custom ellipsis', () => {
  expect(getTruncatedText('long text comes here', 5, 'end', '***')).toBe(
    'long***',
  );
});
