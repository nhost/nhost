import { Request, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

import { HasuraUserClaims } from '../hasura-metadata'

import { ExpressError } from './errors'

export const getAccessToken = (req: Request): string | undefined => {
  const authorizationHeader = req.headers.authorization
  return authorizationHeader?.split(' ')[1]
}

export const getDecodedAccessToken = (req: Request): any | undefined => {
  if (!process.env.NHOST_JWT_SECRET) {
    // TODO log or throw error
    return undefined
  }
  const accessToken = getAccessToken(req)

  if (!accessToken) {
    return undefined
  }

  try {
    // TODO what happens if the JWT secret is not using a key e.g. jwk_url?
    const { key } = JSON.parse(process.env.NHOST_JWT_SECRET)
    return jwt.verify(accessToken, key)
  } catch (error) {
    return undefined
  }
}

export const getUserClaims = (req: Request): HasuraUserClaims | undefined => {
  const decodedToken = getDecodedAccessToken(req)
  if (!decodedToken) {
    return
  }
  return decodedToken['https://hasura.io/jwt/claims']
}

export const getRole = (req: Request): string => {
  const claims = getUserClaims(req)

  const roleHeader =
    typeof req.headers['x-hasura-role'] === 'string' ? req.headers['x-hasura-role'] : undefined
  if (claims) {
    if (roleHeader && claims['x-hasura-allowed-roles'].includes(roleHeader)) {
      return roleHeader
    }
    return claims['x-hasura-default-role']
  }

  if (req.headers['x-hasura-admin-secret'] === process.env.NHOST_ADMIN_SECRET) {
    return roleHeader || 'admin'
  }

  return 'public'
}

export const isAdmin = (req: Request): boolean =>
  getRole(req) === 'admin' ||
  req.headers['x-hasura-admin-secret'] === process.env.NHOST_ADMIN_SECRET

export const nhostUserInformationMiddleware: RequestHandler = (req, res, next) => {
  req.userClaims = getUserClaims(req)
  req.isAdmin = isAdmin(req)
  req.role = getRole(req)
  next()
}

export const roleGuard =
  (roles: string[] | string): RequestHandler =>
  (req, _, next) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    if (requiredRoles.includes(req.role)) {
      next()
    } else {
      throw new ExpressError(401, 'unauthorized')
    }
  }

export const adminGuard: RequestHandler = (req, res, next) => {
  if (req.isAdmin || req.role === 'admin') {
    next()
  } else {
    throw new ExpressError(401, 'unauthorized')
  }
}
