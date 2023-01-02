import { expect, test } from 'vitest'
import { RedirectOption, rewriteRedirectTo } from '../src'

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

test(`should append redirectTo with a hash`, async () => {
  const options: RedirectOption = { redirectTo: '#/index' }

  const result = rewriteRedirectTo('https://frontend.com', options)
  expect(result?.redirectTo).toMatchInlineSnapshot('"https://frontend.com/#/index"')
})

test(`should replace the hash in the url when using a hash in redirectTo`, async () => {
  const options: RedirectOption = { redirectTo: '#/index' }

  const result = rewriteRedirectTo('https://frontend.com#/current', options)
  expect(result?.redirectTo).toMatchInlineSnapshot('"https://frontend.com/#/index"')
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
