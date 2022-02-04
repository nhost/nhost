import axios, { AxiosError, AxiosInstance } from 'axios'
import {
  ApiChangeEmailResponse,
  ApiChangePasswordResponse,
  ApiDeanonymizeResponse,
  ApiError,
  ApiRefreshTokenResponse,
  ApiResetPasswordResponse,
  ApiSendVerificationEmailResponse,
  ApiSignInData,
  ApiSignInResponse,
  ApiSignOutResponse,
  ChangeEmailParams,
  ChangePasswordParams,
  DeanonymizeParams,
  ResetPasswordParams,
  SendVerificationEmailParams,
  Session,
  SignInEmailPasswordParams,
  SignInPasswordlessEmailParams,
  SignInPasswordlessSmsOtpParams,
  SignInPasswordlessSmsParams,
  SignUpEmailPasswordParams
} from './utils/types'

const SERVER_ERROR_CODE = 500
export class HasuraAuthApi {
  private url: string
  private httpClient: AxiosInstance
  private accessToken: string | undefined

  constructor({ url = '' }) {
    this.url = url

    this.httpClient = axios.create({
      baseURL: this.url,
      timeout: 10_000
    })

    // convert axios error to custom ApiError
    this.httpClient.interceptors.response.use(
      (response) => response,
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      (error: AxiosError<{ message: string }>) =>
        // eslint-disable-next-line prefer-promise-reject-errors, promise/no-promise-in-callback
        Promise.reject({
          message: error.response?.data?.message ?? error.message ?? JSON.stringify(error),
          status: error.response?.status ?? SERVER_ERROR_CODE
        })
    )
  }

  /**
   * Use `signUpWithEmailAndPassword` to sign up a new user using email and password.
   */
  async signUpEmailPassword(params: SignUpEmailPasswordParams): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/signup/email-password', params)
      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  async signInEmailPassword(params: SignInEmailPasswordParams): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/signin/email-password', params)
      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  async signInPasswordlessEmail(params: SignInPasswordlessEmailParams): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/signin/passwordless/email', params)
      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  async signInPasswordlessSms(params: SignInPasswordlessSmsParams): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/signin/passwordless/sms', params)
      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  async signInPasswordlessSmsOtp(
    params: SignInPasswordlessSmsOtpParams
  ): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/signin/passwordless/sms/otp', params)
      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  async signOut(params: { refreshToken: string; all?: boolean }): Promise<ApiSignOutResponse> {
    try {
      await this.httpClient.post('/signout', params)

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  async refreshToken(params: { refreshToken: string }): Promise<ApiRefreshTokenResponse> {
    try {
      const res = await this.httpClient.post<Session>('/token', params)

      return { error: null, session: res.data }
    } catch (error) {
      return { error: error as ApiError, session: null }
    }
  }

  async resetPassword(params: ResetPasswordParams): Promise<ApiResetPasswordResponse> {
    try {
      await this.httpClient.post('/user/password/reset', params)

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  async changePassword(params: ChangePasswordParams): Promise<ApiChangePasswordResponse> {
    try {
      await this.httpClient.post('/user/password', params, {
        headers: {
          ...this.generateAuthHeaders()
        }
      })

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  async sendVerificationEmail(
    params: SendVerificationEmailParams
  ): Promise<ApiSendVerificationEmailResponse> {
    try {
      await this.httpClient.post('/user/email/send-verification-email', params)

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  async changeEmail(params: ChangeEmailParams): Promise<ApiChangeEmailResponse> {
    try {
      await this.httpClient.post('/user/email/change', params, {
        headers: {
          ...this.generateAuthHeaders()
        }
      })

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  async deanonymize(params: DeanonymizeParams): Promise<ApiDeanonymizeResponse> {
    try {
      await this.httpClient.post('/user/deanonymize', params)

      return { error: null }
    } catch (error) {
      return { error: error as ApiError }
    }
  }

  // deanonymize

  async verifyEmail(params: { email: string; ticket: string }): Promise<ApiSignInResponse> {
    try {
      const res = await this.httpClient.post<ApiSignInData>('/user/email/verify', params)

      return { data: res.data, error: null }
    } catch (error) {
      return { data: null, error: error as ApiError }
    }
  }

  setAccessToken(accessToken: string | undefined) {
    this.accessToken = accessToken
  }

  private generateAuthHeaders() {
    if (!this.accessToken) {
      return null
    }

    return {
      Authorization: `Bearer ${this.accessToken}`
    }
  }
}
