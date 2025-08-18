import { expect, test } from 'vitest'
import appendImageTransformationParameters from './appendImageTransformationParameters'

test('should append image transformation parameters to a simple URL', () => {
  expect(
    appendImageTransformationParameters('https://example.com', {
      width: 100,
      height: 100,
      blur: 50,
      quality: 80
    })
  ).toBe('https://example.com/?w=100&h=100&b=50&q=80')
})

test('should append image transformation parameters to a URL with existing query parameters', () => {
  expect(
    appendImageTransformationParameters('https://example.com/?foo=bar', {
      width: 100,
      height: 100,
      blur: 50,
      quality: 80
    })
  ).toBe('https://example.com/?foo=bar&w=100&h=100&b=50&q=80')
})

test('should not append falsy values', () => {
  expect(
    appendImageTransformationParameters('https://example.com', {
      width: undefined,
      height: 100,
      blur: undefined,
      quality: 80
    })
  ).toBe('https://example.com/?h=100&q=80')
})

test('should keep the original URL if no transformation parameters are provided', () => {
  expect(appendImageTransformationParameters('https://example.com')).toBe('https://example.com')
  expect(
    appendImageTransformationParameters('https://example.com/?param1=test_data&param2=test_data')
  ).toBe('https://example.com/?param1=test_data&param2=test_data')
  expect(appendImageTransformationParameters('https://example.com/')).toBe('https://example.com/')
})
