import { expect, test } from 'vitest'

import { mergeUrls } from './mergeUrls'

test('should merge two URLs', () => {
  expect(mergeUrls('https://google.com', '/foo/bar')).toBe('https://google.com/foo/bar')
})

test('should merge three or more URLs', () => {
  expect(mergeUrls('https://google.com', '/foo', '/bar')).toBe('https://google.com/foo/bar')
  expect(mergeUrls('https://google.com', '/foo', '/bar', '/baz')).toBe(
    'https://google.com/foo/bar/baz'
  )
})

test('should merge two URLs by removing the last part of the first URL if it matches the first part of the next URL', () => {
  expect(mergeUrls('https://google.com/foo', '/foo/bar')).toBe('https://google.com/foo/bar')
  expect(mergeUrls('https://google.com/foo', '/foo/bar', '/bar/baz')).toBe(
    'https://google.com/foo/bar/baz'
  )
})
