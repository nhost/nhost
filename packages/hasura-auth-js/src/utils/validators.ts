import { MIN_PASSWORD_LENGTH } from '../constants'

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

// TODO improve validation
export const isValidPhoneNumber = (phoneNumber?: string | null) =>
  !!phoneNumber && typeof phoneNumber === 'string'

export const isValidTicket = (ticket?: string | null) =>
  ticket &&
  typeof ticket === 'string' &&
  ticket.match(/^mfaTotp:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
