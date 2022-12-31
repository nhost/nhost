import { MIN_PASSWORD_LENGTH } from '../constants'

const EMAIL_REGEX =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export const isValidEmail = (email?: string | null) => {
  if (!email || typeof email !== 'string') {
    return false
  }

  const lowerCaseEmail = email.toLowerCase()
  return EMAIL_REGEX.test(lowerCaseEmail)
}

export const isValidPassword = (password?: string | null) => {
  if (!password || typeof password !== 'string') {
    return false
  }

  const passwordLength = password.length
  return passwordLength >= MIN_PASSWORD_LENGTH
}

// TODO improve validation
export const isValidPhoneNumber = (phoneNumber?: string | null) =>
  !!phoneNumber && typeof phoneNumber === 'string'

export const isValidTicket = (ticket?: string | null) =>
  ticket &&
  typeof ticket === 'string' &&
  ticket.match(/^mfaTotp:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
