import { useSelector, useInterpret, useActor } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import React, { useEffect, createContext, useContext } from 'react'
import { useLocation } from 'react-use'
import { InterpreterFrom } from 'xstate'

import { NhostMachine, REFRESH_TOKEN_KEY } from './state'

inspect({
  url: 'https://statecharts.io/inspect',
  iframe: false
})

type Context = {
  authService: InterpreterFrom<NhostMachine>
}

export const GlobalStateContext = createContext<Context>({} as Context)

export const NhostProvider: React.FC<{ machine: NhostMachine }> = ({ machine, ...props }) => {
  const authService = useInterpret(machine, { devTools: true })
  const refreshToken = useSelector(authService, (state) => state.context.refreshToken.value)
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const params = new URLSearchParams(location.hash.slice(1))
    const token = params.get('refreshToken')
    if (token) {
      const type = params.get('type')
      if (type === 'signinPasswordless') {
        authService.send({ type: 'UPDATE_REFRESH_TOKEN', token })
      } else {
        console.warn(
          `Found a refresh token in the url but the redirect type is not implemented: ${type}`
        )
      }
    }
  }, [location, authService])

  useEffect(() => {
    // ? Move into the machine ?
    // * Side effect: persist the refresh token if found
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  }, [refreshToken])

  return (
    <GlobalStateContext.Provider value={{ authService }}>
      {props.children}
    </GlobalStateContext.Provider>
  )
}

export const useAuthService = () => {
  const globalServices = useContext(GlobalStateContext)
  return globalServices.authService
}

export const useAuthActor = () => {
  const service = useAuthService()
  return useActor(service)
}

export const useLoading = () => {
  const service = useAuthService()
  return useSelector(service, (state) =>
    state.matches({
      authentication: 'signedOut',
      tokenRefresher: 'refreshing'
    })
  )
}

export const useAuthenticated = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))
}

export const useNhostAuth = () => {
  const [state] = useAuthActor()
  const isLoading = state.matches({
    authentication: 'signedOut',
    tokenRefresher: 'refreshing'
  })
  const isAuthenticated = state.matches({ authentication: 'signedIn' })

  return { isLoading, isAuthenticated }
}

export const useAccessToken = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.accessToken.value)
}

export const useSignUpEmailPassword = (email: string, password: string) => {
  const service = useAuthService()
  return () =>
    service.send({
      type: 'REGISTER',
      email,
      password
    })
}

export const useSignOut = (all = false) => {
  const service = useAuthService()
  return () => service.send({ type: 'SIGNOUT', all })
}

export const useEmailPasswordSignIn = (email: string, password: string) => {
  const service = useAuthService()
  return () =>
    service.send({
      type: 'SIGNIN',
      email,
      password
    })
}

export const useEmailPasswordlessSignIn = (email: string) => {
  const service = useAuthService()
  return () =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email
    })
}

export const useRefreshToken = (): [string | undefined, (v: string) => void] => {
  const service = useAuthService()
  const value = useSelector(service, (state) => state.context.accessToken.value)
  const setValue = (token: string) => {
    service.send({ type: 'UPDATE_REFRESH_TOKEN', token })
  }
  return [value, setValue]
}

export const useUserData = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user)
}

export const useAvatarUrl = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.avatarUrl)
}

export const useDefaultRole = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.defaultRole)
}

export const useDisplayName = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.displayName)
}

export const useEmail = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.email)
}

export const useUserId = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.id)
}

export const useIsAnonymous = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.isAnonymous)
}

export const useUserLocale = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.locale)
}

export const useUserRoles = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.roles)
}
