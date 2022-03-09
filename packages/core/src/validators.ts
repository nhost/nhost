import { MIN_PASSWORD_LENGTH } from './constants'

export const isValidEmail = (email?: string | null) =>
  !!email &&
  typeof email === 'string' &&
  !!String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    )

export const isValidPassword = (password?: string | null) =>
  !!password && typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH
