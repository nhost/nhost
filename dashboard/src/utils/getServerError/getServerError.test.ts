import { expect, test } from 'vitest';
import getServerError from './getServerError';

test('should return the error message if it exists', () => {
  expect(
    getServerError('fallback message')(new Error('Message not allowed.')),
  ).toBe('Error: Message not allowed.');
});

test('should return the fallback message if the error message does not exist', () => {
  expect(getServerError('fallback message')()).toBe('fallback message');
});
