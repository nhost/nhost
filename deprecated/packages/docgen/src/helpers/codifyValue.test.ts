import { expect, test } from 'vitest'
import codifyValue from './codifyValue'

test('should wrap the value in a code block', () => {
  expect(codifyValue('foo')).toBe('<code>foo</code>')
  expect(codifyValue(0)).toBe('<code>0</code>')
})

test('should not wrap the value in a code block if setting is turned off', () => {
  expect(codifyValue('foo', false)).toBe('foo')
  expect(codifyValue(0, false)).toBe('0')
})

test('should convert some characters to HTML entities', () => {
  expect(codifyValue('<foo>')).toBe('<code>&lt;foo&gt;</code>')
  expect(codifyValue('foo & bar')).toBe('<code>foo &amp; bar</code>')
  expect(codifyValue('foo | bar')).toBe('<code>foo &#124; bar</code>')
})
