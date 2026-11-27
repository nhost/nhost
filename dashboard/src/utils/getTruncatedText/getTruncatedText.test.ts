import getTruncatedText from './getTruncatedText';

it('should return the same text if maxLength is lower than text length', () => {
  expect(getTruncatedText('test', 15)).toBe('test');
});

it('should return the truncated text', () => {
  expect(getTruncatedText('long text comes here', 5)).toBe('long...');
});

it('should return the truncated text with ellipsis at the start', () => {
  expect(getTruncatedText('long text comes here', 5, 'start')).toBe('...here');
});

it('should return the truncated text with custom ellipsis', () => {
  expect(getTruncatedText('long text comes here', 5, 'end', '***')).toBe(
    'long***',
  );
});
