import { expect, test, suite, assert, vi } from 'vitest'
import {
  encodeQueryParameters,
  getParameterByName,
  isValidEmail,
  isValidPassword,
  RedirectOption,
  rewriteRedirectTo
} from '../src'

suite('encodeQueryParameters', () => {
  test('returns the baseUrl if no parameters are given', () => {
    assert(encodeQueryParameters('http://example.com'), 'http://example.com')
  })

  test('encodes simple parameters as key-value pairs', () => {
    assert(
      encodeQueryParameters('http://example.com', { foo: 'bar', baz: 'qux' }),
      'http://example.com?foo=bar&baz=qux'
    )
  })

  test('encodes array values as comma-separated lists', () => {
    assert(
      encodeQueryParameters('http://example.com', { foo: ['a', 'b', 'c'] }),
      'http://example.com?foo=a,b,c'
    )
  })

  test('encodes object values as JSON strings', () => {
    assert(
      encodeQueryParameters('http://example.com', { foo: { a: 1, b: 2 } }),
      'http://example.com?foo=%7B%22a%22%3A1%2C%22b%22%3A2%7D'
    )
  })

  test('encodes all parameter values using encodeURIComponent', () => {
    assert(
      encodeQueryParameters('http://example.com', { foo: 'bar baz', baz: 'qux' }),
      'http://example.com?foo=bar%20baz&baz=qux'
    )
  })
})

suite('rewriteRedirectTo', () => {
  test(`should not add redirectTo when none is given`, async () => {
    expect(rewriteRedirectTo('https://frontend.com', {})).toEqual({})
    expect(rewriteRedirectTo('https://frontend.com')).toBeUndefined()
  })

  test(`should remove redirectTo when it's relative and no clientUrl is given`, async () => {
    const options: RedirectOption = { redirectTo: '/index' }
    expect(rewriteRedirectTo('', options)).toEqual({})
    expect(rewriteRedirectTo(undefined, options)).toEqual({})
  })

  test(`should preserve options when redirectTo is not a relative url and no clientUrl is given`, async () => {
    const options: RedirectOption = { redirectTo: 'https://frontend.com' }
    expect(rewriteRedirectTo('', options)).toEqual(options)
    expect(rewriteRedirectTo(undefined, options)).toEqual(options)
  })

  test(`should append redirectTo with the clientUrl prefix`, async () => {
    const options: RedirectOption = { redirectTo: '/index' }

    const result = rewriteRedirectTo('https://frontend.com', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/index')
  })

  test(`should add the query parameters of the clientUrl`, async () => {
    const options: RedirectOption = { redirectTo: '/index' }

    const result = rewriteRedirectTo('https://frontend.com?key=value', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/index?key=value')
  })

  test(`should add the query parameters of the custom redirection`, async () => {
    const options: RedirectOption = { redirectTo: '/index?key=value' }

    const result = rewriteRedirectTo('https://frontend.com', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/index?key=value')
  })

  test(`should override the query parameter initially set in the clientUrl`, async () => {
    const options: RedirectOption = { redirectTo: '/index?key=newValue' }

    const result = rewriteRedirectTo('https://frontend.com?key=original', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/index?key=newValue')
  })

  test(`should combine query parameters from both clientUrl and redirection`, async () => {
    const options: RedirectOption = { redirectTo: '/index?a=valueA' }

    const result = rewriteRedirectTo('https://frontend.com?b=valueB', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/index?b=valueB&a=valueA')
  })

  test(`should ignore the original clientUrl when an absolute URL is given`, async () => {
    const options: RedirectOption = { redirectTo: 'https://another.com/index' }

    const result = rewriteRedirectTo('https://frontend.com', options)
    expect(result?.redirectTo).toEqual('https://another.com/index')
  })

  test(`should ignore the original query parameters when an absolute URL is given`, async () => {
    const options: RedirectOption = { redirectTo: 'https://another.com/index' }

    const result = rewriteRedirectTo('https://frontend.com?key=value', options)
    expect(result?.redirectTo).toEqual('https://another.com/index')
  })

  test(`should keep the trailing / in the clientUrl`, async () => {
    const options: RedirectOption = { redirectTo: '/' }

    const result = rewriteRedirectTo('https://frontend.com/', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/')
  })

  test(`should extend to a relative URL when the clientUrl ends with a slash`, async () => {
    const options: RedirectOption = { redirectTo: '/nested' }

    const result = rewriteRedirectTo('https://frontend.com/main/', options)
    expect(result?.redirectTo).toEqual('https://frontend.com/main/nested')
  })
})

suite('isValidEmail', () => {
  test('should return true for valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('USER@EXAMPLE.COM')).toBe(true)
    expect(isValidEmail('user+label@example.com')).toBe(true)
  })

  test('should return false for invalid email addresses', () => {
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user@.')).toBe(false)
    expect(isValidEmail('user@example.')).toBe(false)
    expect(isValidEmail('user@example.c')).toBe(false)
    expect(isValidEmail('user@example.com.')).toBe(false)
    expect(isValidEmail('.user@example.com')).toBe(false)
    expect(isValidEmail('user@example..com')).toBe(false)
  })

  test('should return false for non-string input', () => {
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
    expect(isValidEmail(123)).toBe(false)
    expect(isValidEmail([])).toBe(false)
    expect(isValidEmail({})).toBe(false)
  })
})

suite('isValidPassword', () => {
  test('should return true for valid passwords', () => {
    expect(isValidPassword('abc123')).toBe(true)
    expect(isValidPassword('abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(isValidPassword('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(true)
    expect(isValidPassword('1234567890')).toBe(true)
    expect(isValidPassword('!@#$%^&*')).toBe(true)
    expect(isValidPassword('abc123ABC!@#$')).toBe(true)
  })

  test('should return false for invalid passwords', () => {
    expect(isValidPassword('')).toBe(false)
    expect(isValidPassword('ab')).toBe(false)
    expect(isValidPassword(null)).toBe(false)
    expect(isValidPassword(undefined)).toBe(false)
    expect(isValidPassword(12)).toBe(false)
    expect(isValidPassword(123123)).toBe(false)
    expect(isValidPassword([])).toBe(false)
    expect(isValidPassword({})).toBe(false)
  })
})

suite('getParameterByName', () => {
  test('should return the value of the specified parameter', () => {
    expect(getParameterByName('param', 'http://example.com?param=value')).toBe('value')
    expect(getParameterByName('param', 'http://example.com?other=other&param=value')).toBe('value')
    expect(getParameterByName('param', 'http://example.com?param=value&other=other')).toBe('value')
    expect(getParameterByName('param', 'http://example.com?param=value#hash')).toBe('value')
  })

  test('should return an empty string for a parameter with no value', () => {
    expect(getParameterByName('param', 'http://example.com?param')).toBe('')
    expect(getParameterByName('param', 'http://example.com?param=')).toBe('')
  })

  test('should return null for a missing parameter', () => {
    expect(getParameterByName('param', 'http://example.com')).toBe(null)
    expect(getParameterByName('param', 'http://example.com?other=value')).toBe(null)
  })

  test('should return the value of the specified parameter after the hash', () => {
    expect(getParameterByName('param', 'http://example.com#param=value')).toBe('value')
    expect(getParameterByName('param', 'http://example.com#other=other&param=value')).toBe('value')
    expect(getParameterByName('param', 'http://example.com#param=value&other=other')).toBe('value')
  })
})
